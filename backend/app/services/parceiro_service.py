"""
Loja do parceiro (TESTE, painel admin): o cliente paga por Pix na conta
Mercado Pago do dono do Seklyn, a gente lê a taxa real que o Mercado Pago
cobrou e divide o LÍQUIDO pelo percentual combinado (50% = metade da venda
e metade da taxa pra cada um).

O repasse pro parceiro é um Pix pra chave dele: o Mercado Pago não tem API
pública pra enviar Pix sozinho pra chave de terceiros (o split automático
deles exige que o parceiro tenha conta Mercado Pago). Então geramos o
"Pix copia e cola" (BR Code estático do Banco Central) já com a chave e o
valor do parceiro — o dono só escaneia no app do banco e confirma.
"""
import re
import unicodedata
from datetime import datetime, timedelta, timezone
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy.orm import Session

from app.models.parceiro import Parceiro, VendaParceiro
from app.services import mercadopago_service as mp

PREFIXO_VENDA = "seklyn-loja-"
TAXA_PIX_ESTIMADA = Decimal("0.0099")  # Pix no Mercado Pago (pra estimativa antes da venda)
CENTAVO = Decimal("0.01")


# ---------- Divisão ----------


def dividir(valor: Decimal, taxa: Decimal, percentual_parceiro: int) -> tuple[Decimal, Decimal]:
    """(parte do parceiro, parte do dono) a partir do líquido da venda."""
    liquido = (Decimal(valor) - Decimal(taxa)).quantize(CENTAVO)
    parceiro = (liquido * Decimal(percentual_parceiro) / 100).quantize(CENTAVO, rounding=ROUND_HALF_UP)
    return parceiro, liquido - parceiro


def _taxa_do_pagamento(pagamento: dict, valor: Decimal) -> Decimal:
    taxas = pagamento.get("fee_details") or []
    if taxas:
        return sum((Decimal(str(t.get("amount") or 0)) for t in taxas), Decimal("0")).quantize(CENTAVO)
    liquido = (pagamento.get("transaction_details") or {}).get("net_received_amount")
    if liquido:
        return (valor - Decimal(str(liquido))).quantize(CENTAVO)
    return Decimal("0.00")


# ---------- Vendas ----------


def criar_venda_pix(db: Session, parceiro: Parceiro, produto: str, valor: Decimal, email_pagador: str) -> tuple[VendaParceiro, dict]:
    venda = VendaParceiro(
        parceiro_id=parceiro.id,
        produto=produto,
        valor=valor,
        percentual_parceiro=parceiro.percentual_parceiro,
        status="aguardando",
        repasse_status="pendente",
    )
    db.add(venda)
    db.flush()
    expira = datetime.now(timezone.utc) + timedelta(hours=1)
    pagamento = mp._requisitar(
        "POST",
        "/v1/payments",
        {
            "transaction_amount": float(valor),
            "payment_method_id": "pix",
            "description": f"{produto} — {parceiro.nome}"[:250],
            "external_reference": f"{PREFIXO_VENDA}{venda.id}",
            "payer": {"email": email_pagador},
            "date_of_expiration": expira.isoformat(timespec="milliseconds"),
        },
    )
    venda.mp_pagamento_id = str(pagamento["id"])
    db.commit()
    db.refresh(venda)
    return venda, mp._dados_pix(pagamento)


def aplicar_pagamento(db: Session, pagamento: dict) -> VendaParceiro | None:
    """Espelha o pagamento do Mercado Pago na venda (aprovado = divide)."""
    referencia = pagamento.get("external_reference") or ""
    if not referencia.startswith(PREFIXO_VENDA) or not referencia.removeprefix(PREFIXO_VENDA).isdigit():
        return None
    venda = db.get(VendaParceiro, int(referencia.removeprefix(PREFIXO_VENDA)))
    if venda is None or venda.mp_pagamento_id != str(pagamento.get("id")):
        return None
    situacao = pagamento.get("status")
    if situacao == "approved" and venda.status != "paga":
        venda.taxa_mp = _taxa_do_pagamento(pagamento, Decimal(venda.valor))
        venda.parte_parceiro, venda.parte_dono = dividir(venda.valor, venda.taxa_mp, venda.percentual_parceiro)
        venda.status = "paga"
        venda.paga_em = datetime.now(timezone.utc)
    elif situacao in ("refunded", "charged_back"):
        venda.status = "reembolsada"
    elif situacao in ("cancelled", "rejected") and venda.status == "aguardando":
        venda.status = "expirada"
    db.commit()
    return venda


def sincronizar(db: Session, venda: VendaParceiro) -> VendaParceiro:
    if venda.mp_pagamento_id and venda.status == "aguardando":
        aplicar_pagamento(db, mp._requisitar("GET", f"/v1/payments/{venda.mp_pagamento_id}"))
    return venda


def reembolsar(db: Session, venda: VendaParceiro) -> VendaParceiro:
    mp._requisitar("POST", f"/v1/payments/{venda.mp_pagamento_id}/refunds", {})
    venda.status = "reembolsada"
    db.commit()
    return venda


# ---------- Pix copia e cola (BR Code estático do Banco Central) ----------


def normalizar_chave(tipo: str, chave: str) -> str:
    chave = chave.strip()
    if tipo in ("cpf", "cnpj"):
        return re.sub(r"\D", "", chave)
    if tipo == "celular":
        digitos = re.sub(r"\D", "", chave)
        if not digitos.startswith("55") or len(digitos) <= 11:
            digitos = "55" + digitos
        return "+" + digitos
    return chave.lower()


def chave_valida(tipo: str, chave: str) -> bool:
    if tipo == "cpf":
        return len(chave) == 11
    if tipo == "cnpj":
        return len(chave) == 14
    if tipo == "celular":
        return re.fullmatch(r"\+55\d{10,11}", chave) is not None
    if tipo == "email":
        return re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", chave) is not None and len(chave) <= 77
    if tipo == "aleatoria":
        return re.fullmatch(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", chave) is not None
    return False


def _sem_acento(texto: str, limite: int) -> str:
    limpo = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode()
    return re.sub(r"[^A-Za-z0-9 ]", "", limpo).strip().upper()[:limite] or "SEKLYN"


def _campo(id_: str, valor: str) -> str:
    return f"{id_}{len(valor):02d}{valor}"


def _crc16(payload: str) -> str:
    crc = 0xFFFF
    for byte in payload.encode("utf-8"):
        crc ^= byte << 8
        for _ in range(8):
            crc = ((crc << 1) ^ 0x1021) if crc & 0x8000 else (crc << 1)
            crc &= 0xFFFF
    return f"{crc:04X}"


def montar_br_code(chave: str, nome: str, cidade: str, valor: Decimal | None = None, txid: str = "***") -> str:
    """Payload EMV do Pix ("copia e cola"), lido por qualquer app de banco."""
    conta = _campo("00", "br.gov.bcb.pix") + _campo("01", chave)
    payload = (
        _campo("00", "01")
        + _campo("26", conta)
        + _campo("52", "0000")
        + _campo("53", "986")
        + (_campo("54", f"{Decimal(valor):.2f}") if valor is not None else "")
        + _campo("58", "BR")
        + _campo("59", nome)
        + _campo("60", cidade)
        + _campo("62", _campo("05", txid))
        + "6304"
    )
    return payload + _crc16(payload)


def pix_repasse(venda: VendaParceiro) -> str:
    parceiro = venda.parceiro
    return montar_br_code(
        chave=parceiro.chave_pix,
        nome=_sem_acento(parceiro.nome, 25),
        cidade=_sem_acento(parceiro.cidade, 15),
        valor=venda.parte_parceiro,
        txid=f"SEKLYNREPASSE{venda.id}",
    )
