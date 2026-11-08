"""
Integração com o Mercado Pago — assinatura mensal do Personal (produto
"Assinaturas", recurso /preapproval).

Fluxo:
1. O Personal digita o cartão no formulário do Mercado Pago embutido na
   página de assinatura (Card Brick). O Brick troca o cartão por um
   `card_token` de uso único — o número nunca chega no Seklyn — e com ele
   criamos o preapproval já "authorized", com o valor combinado com esse
   Personal. Não exige conta Mercado Pago.
2. O Mercado Pago avisa por webhook quando a assinatura muda ou uma
   cobrança mensal acontece. A notificação só diz QUAL recurso mudou: o
   status real é sempre buscado na API com o nosso token
   (`sincronizar_preapproval`), então uma notificação forjada não consegue
   ativar conta nenhuma — no máximo dispara uma consulta.

Formas de pagamento (Assinatura.forma_pagamento):
- "credito": assinatura automática acima — cobra sozinha todo mês.
- "debito" / "pix": pagamento avulso (/v1/payments) de UM mês por vez. O
  acesso vai até current_period_end; perto do vencimento o site mostra um
  aviso grande pra pagar o próximo mês (pagando adiantado, o mês novo começa
  quando o atual acaba — ninguém perde dias).

Cancelamento: até settings.reembolso_horas depois do último pagamento,
devolve o dinheiro e encerra. Depois disso, só para a renovação e o acesso
continua até o fim do mês já pago (cancelamento_agendado).
"""
import calendar
import hashlib
import hmac
import json
import logging
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.assinatura import Assinatura
from app.models.personal import Personal

settings = get_settings()
logger = logging.getLogger("seklyn.mercadopago")

API_URL = "https://api.mercadopago.com"

# Status do preapproval no Mercado Pago -> status da nossa Assinatura.
STATUS_PREAPPROVAL = {
    "authorized": "active",
    "pending": "pendente",
    "paused": "past_due",
    "cancelled": "canceled",
}


class ErroMercadoPago(Exception):
    def __init__(self, mensagem: str, status_http: int | None = None):
        super().__init__(mensagem)
        self.status_http = status_http


class CartaoRecusado(Exception):
    """O Mercado Pago recusou o cartão — `mensagem` já é pra mostrar ao Personal."""

    def __init__(self, mensagem: str):
        super().__init__(mensagem)
        self.mensagem = mensagem


# Motivos de recusa mais comuns do Mercado Pago -> texto pro Personal.
MOTIVOS_RECUSA = {
    "cc_rejected_insufficient_amount": "Saldo ou limite insuficiente nesse cartão.",
    "cc_rejected_bad_filled_security_code": "O código de segurança (CVV) não confere.",
    "cc_rejected_bad_filled_date": "A data de validade não confere.",
    "cc_rejected_bad_filled_card_number": "O número do cartão não confere.",
    "cc_rejected_call_for_authorize": "Seu banco pediu pra você autorizar essa cobrança. Fale com ele e tente de novo.",
    "cc_rejected_card_disabled": "Esse cartão está desativado. Fale com seu banco ou use outro.",
    "cc_rejected_high_risk": "O pagamento foi recusado pela análise de segurança. Tente outro cartão.",
    "cc_rejected_max_attempts": "Muitas tentativas com esse cartão. Espere um pouco ou use outro.",
    "cc_rejected_duplicated_payment": "Esse pagamento já foi feito.",
}


def _mensagem_recusa(detalhe: str) -> str:
    for codigo, texto in MOTIVOS_RECUSA.items():
        if codigo in detalhe:
            return texto
    return "O cartão foi recusado. Confira os dados ou tente outro cartão."


def configurado() -> bool:
    return bool(settings.mercadopago_access_token)


def _requisitar(metodo: str, caminho: str, corpo: dict | None = None) -> dict:
    headers = {
        "Authorization": f"Bearer {settings.mercadopago_access_token}",
        "Content-Type": "application/json",
        "User-Agent": "SeklynAPI/1.0",
    }
    if metodo == "POST":
        # Evita cobrança/assinatura duplicada se a requisição for reenviada.
        headers["X-Idempotency-Key"] = str(uuid.uuid4())
    dados = json.dumps(corpo).encode("utf-8") if corpo is not None else None
    requisicao = urllib.request.Request(f"{API_URL}{caminho}", data=dados, method=metodo, headers=headers)
    try:
        with urllib.request.urlopen(requisicao, timeout=15) as resposta:
            return json.loads(resposta.read().decode("utf-8") or "{}")
    except urllib.error.HTTPError as erro:
        detalhe = erro.read().decode("utf-8", errors="replace")
        logger.error("Mercado Pago %s %s -> HTTP %s: %s", metodo, caminho, erro.code, detalhe)
        raise ErroMercadoPago(detalhe, erro.code) from erro
    except (urllib.error.URLError, TimeoutError) as erro:
        logger.error("Mercado Pago %s %s indisponível: %s", metodo, caminho, erro)
        raise ErroMercadoPago(str(erro)) from erro


def _data_iso(valor: str | None) -> datetime | None:
    if not valor:
        return None
    try:
        return datetime.fromisoformat(valor.replace("Z", "+00:00"))
    except ValueError:
        return None


def obter_ou_criar_assinatura(db: Session, personal: Personal) -> Assinatura:
    assinatura = db.query(Assinatura).filter(Assinatura.personal_id == personal.id).first()
    if assinatura is None:
        assinatura = Assinatura(personal_id=personal.id, status="inativa")
        db.add(assinatura)
        db.commit()
        db.refresh(assinatura)
    return assinatura


def assinar_com_cartao(db: Session, personal: Personal, assinatura: Assinatura, card_token: str) -> Assinatura:
    """
    Cria a assinatura mensal direto com o cartão digitado no formulário do
    Mercado Pago dentro do Seklyn (Card Brick). O número do cartão nunca
    chega aqui: o Brick troca ele por um `card_token` de uso único, e é só
    isso que o backend recebe. Não exige conta Mercado Pago do Personal.
    """
    valor: Decimal = assinatura.valor_mensal
    # Um checkout anterior que ficou pela metade (ou uma assinatura com
    # cobrança recusada) é cancelado antes — senão o Personal poderia acabar
    # com duas assinaturas cobrando quando a antiga voltasse a funcionar.
    if assinatura.mp_preapproval_id and assinatura.status in ("pendente", "past_due"):
        try:
            _requisitar("PUT", f"/preapproval/{assinatura.mp_preapproval_id}", {"status": "cancelled"})
        except ErroMercadoPago:
            logger.warning("Não deu pra cancelar o preapproval pendente %s", assinatura.mp_preapproval_id)

    # Ainda tem mês pago (Pix/débito ou cancelamento agendado)? A primeira
    # cobrança automática fica pro dia em que ele acaba — sem pagar duas vezes.
    fim = assinatura.fim_do_periodo
    comeca_depois = assinatura.ativa and fim is not None and fim > _agora() + timedelta(hours=1)
    recorrencia = {
        "frequency": 1,
        "frequency_type": "months",
        "transaction_amount": float(valor),
        "currency_id": "BRL",
    }
    if comeca_depois:
        recorrencia["start_date"] = fim.isoformat(timespec="milliseconds")
    try:
        resposta = _requisitar(
            "POST",
            "/preapproval",
            {
                "reason": "Seklyn — assinatura mensal",
                "external_reference": f"seklyn-personal-{personal.id}",
                "payer_email": personal.email,
                "card_token_id": card_token,
                "auto_recurring": recorrencia,
                "back_url": f"{settings.frontend_url}/personal/assinatura.html",
                "status": "authorized",
            },
        )
    except ErroMercadoPago as erro:
        # 4xx = o Mercado Pago recusou (cartão, dados) — mensagem pro Personal.
        # Sem status HTTP / 5xx = instabilidade, sobe como erro genérico.
        if erro.status_http and 400 <= erro.status_http < 500:
            raise CartaoRecusado(_mensagem_recusa(str(erro))) from erro
        raise

    novo_status = STATUS_PREAPPROVAL.get(resposta.get("status"), "pendente")
    assinatura.mp_preapproval_id = resposta["id"]
    assinatura.forma_pagamento = "credito"
    assinatura.cancelamento_agendado = False
    assinatura.pagamento_pendente_id = None
    if comeca_depois:
        # Continua no mês já pago; a cobrança automática começa no fim dele.
        assinatura.status = "active" if novo_status in ("active", "pendente") else novo_status
    else:
        assinatura.status = novo_status
        assinatura.ultimo_pagamento_em = _agora()  # 1ª cobrança é agora
        assinatura.ultimo_pagamento_id = None  # id aparece depois (busca na hora do reembolso)
    proxima = _data_iso(resposta.get("next_payment_date"))
    if proxima:
        assinatura.current_period_end = proxima
    db.commit()
    return assinatura


# ---------- Pagamento avulso: débito e Pix (um mês por vez) ----------


def _agora() -> datetime:
    return datetime.now(timezone.utc)


def _somar_meses(data: datetime, meses: int) -> datetime:
    """08/11 + 1 mês = 08/12; 31/01 + 1 mês = 28/02 (ou 29)."""
    total = data.month - 1 + meses
    ano, mes = data.year + total // 12, total % 12 + 1
    return data.replace(year=ano, month=mes, day=min(data.day, calendar.monthrange(ano, mes)[1]))


def dias_para_vencer(assinatura: Assinatura) -> int | None:
    fim = assinatura.fim_do_periodo
    if not assinatura.vence_sozinha or fim is None:
        return None
    segundos = (fim - _agora()).total_seconds()
    return int(-(-segundos // 86400)) if segundos > 0 else 0  # arredonda pra cima


def pode_pagar_avulso(assinatura: Assinatura) -> bool:
    """Pix/débito: pra assinar ou pagar o próximo mês (a partir do aviso)."""
    if not assinatura.valor_mensal:
        return False
    if not assinatura.ativa:
        return True
    if assinatura.vence_sozinha:
        dias = dias_para_vencer(assinatura)
        return dias is not None and dias <= settings.dias_alerta_vencimento
    return False  # crédito automático ativo ou liberado pelo admin


def janela_reembolso_ate(assinatura: Assinatura) -> datetime | None:
    """Até quando dá pra cancelar com reembolso total (None = já passou)."""
    pago_em = assinatura.ultimo_pagamento_em
    if not settings.reembolso_horas or pago_em is None or not assinatura.ativa:
        return None
    if pago_em.tzinfo is None:
        pago_em = pago_em.replace(tzinfo=timezone.utc)
    limite = pago_em + timedelta(hours=settings.reembolso_horas)
    return limite if limite > _agora() else None


def _referencia_avulsa(personal_id: int, forma: str) -> str:
    return f"seklyn-avulso-{personal_id}-{forma}-{uuid.uuid4().hex[:8]}"


def _ler_referencia_avulsa(referencia: str | None) -> tuple[int, str] | None:
    partes = (referencia or "").split("-")
    if len(partes) == 5 and partes[:2] == ["seklyn", "avulso"] and partes[2].isdigit() and partes[3] in ("debito", "pix"):
        return int(partes[2]), partes[3]
    return None


def _aplicar_pagamento_avulso(db: Session, assinatura: Assinatura, pagamento: dict, forma: str) -> None:
    """Pagamento aprovado: +1 mês a partir do fim do mês atual (ou de hoje)."""
    pagamento_id = str(pagamento["id"])
    if assinatura.ultimo_pagamento_id == pagamento_id:
        return  # já aplicado (webhook e consulta chegando juntos)
    fim = assinatura.fim_do_periodo
    agora = _agora()
    inicio = fim if (assinatura.ativa and assinatura.vence_sozinha and fim and fim > agora) else agora
    # Estava no crédito automático: a assinatura antiga não pode cobrar de novo.
    if assinatura.mp_preapproval_id:
        try:
            _requisitar("PUT", f"/preapproval/{assinatura.mp_preapproval_id}", {"status": "cancelled"})
        except ErroMercadoPago:
            logger.warning("Não deu pra cancelar o preapproval %s ao trocar pra %s", assinatura.mp_preapproval_id, forma)
        assinatura.mp_preapproval_id = None
    assinatura.current_period_end = _somar_meses(inicio, 1)
    assinatura.status = "active"
    assinatura.forma_pagamento = forma
    assinatura.cancelamento_agendado = False
    assinatura.ultimo_pagamento_id = pagamento_id
    assinatura.ultimo_pagamento_em = agora
    if assinatura.pagamento_pendente_id == pagamento_id:
        assinatura.pagamento_pendente_id = None
    db.commit()


def pagar_com_debito(
    db: Session,
    personal: Personal,
    assinatura: Assinatura,
    card_token: str,
    payment_method_id: str,
    issuer_id: str | None = None,
    documento_tipo: str | None = None,
    documento_numero: str | None = None,
) -> Assinatura:
    pagador: dict = {"email": personal.email}
    if documento_tipo and documento_numero:
        pagador["identification"] = {"type": documento_tipo, "number": documento_numero}
    corpo: dict = {
        "transaction_amount": float(assinatura.valor_mensal),
        "token": card_token,
        "description": "Seklyn — mensalidade (1 mês)",
        "installments": 1,
        "payment_method_id": payment_method_id,
        "external_reference": _referencia_avulsa(personal.id, "debito"),
        "payer": pagador,
    }
    if issuer_id:
        corpo["issuer_id"] = int(issuer_id) if str(issuer_id).isdigit() else issuer_id
    try:
        pagamento = _requisitar("POST", "/v1/payments", corpo)
    except ErroMercadoPago as erro:
        if erro.status_http and 400 <= erro.status_http < 500:
            raise CartaoRecusado(_mensagem_recusa(str(erro))) from erro
        raise
    situacao = pagamento.get("status")
    if situacao == "approved":
        _aplicar_pagamento_avulso(db, assinatura, pagamento, "debito")
    elif situacao in ("pending", "in_process", "authorized"):
        assinatura.pagamento_pendente_id = str(pagamento["id"])
        db.commit()
    else:
        raise CartaoRecusado(_mensagem_recusa(pagamento.get("status_detail") or ""))
    return assinatura


def _dados_pix(pagamento: dict) -> dict:
    dados = (pagamento.get("point_of_interaction") or {}).get("transaction_data") or {}
    return {
        "pagamento_id": str(pagamento["id"]),
        "qr_code": dados.get("qr_code") or "",
        "qr_code_base64": dados.get("qr_code_base64") or "",
        "ticket_url": dados.get("ticket_url"),
        "expira_em": _data_iso(pagamento.get("date_of_expiration")),
        "valor": pagamento.get("transaction_amount"),
    }


def gerar_pix(db: Session, personal: Personal, assinatura: Assinatura) -> dict:
    """Gera (ou reaproveita, se ainda estiver em aberto) o Pix de 1 mês."""
    if assinatura.pagamento_pendente_id:
        try:
            aberto = _requisitar("GET", f"/v1/payments/{assinatura.pagamento_pendente_id}")
            if (
                aberto.get("payment_method_id") == "pix"
                and aberto.get("status") == "pending"
                and float(aberto.get("transaction_amount") or 0) == float(assinatura.valor_mensal)
            ):
                return _dados_pix(aberto)
        except ErroMercadoPago:
            pass
    expira = _agora() + timedelta(hours=24)
    pagamento = _requisitar(
        "POST",
        "/v1/payments",
        {
            "transaction_amount": float(assinatura.valor_mensal),
            "payment_method_id": "pix",
            "description": "Seklyn — mensalidade (1 mês)",
            "external_reference": _referencia_avulsa(personal.id, "pix"),
            "payer": {"email": personal.email},
            "date_of_expiration": expira.isoformat(timespec="milliseconds"),
        },
    )
    assinatura.pagamento_pendente_id = str(pagamento["id"])
    db.commit()
    return _dados_pix(pagamento)


def sincronizar_pagamento_avulso(db: Session, pagamento_id: str) -> Assinatura | None:
    """Busca o pagamento (Pix/débito) na API e aplica se foi aprovado."""
    pagamento = _requisitar("GET", f"/v1/payments/{pagamento_id}")
    lido = _ler_referencia_avulsa(pagamento.get("external_reference"))
    if lido is None:
        return None  # não é mensalidade avulsa do Seklyn
    personal_id, forma = lido
    assinatura = db.query(Assinatura).filter(Assinatura.personal_id == personal_id).first()
    if assinatura is None:
        return None
    situacao = pagamento.get("status")
    if situacao == "approved":
        _aplicar_pagamento_avulso(db, assinatura, pagamento, forma)
    elif situacao in ("rejected", "cancelled", "refunded", "charged_back") and assinatura.pagamento_pendente_id == str(
        pagamento_id
    ):
        assinatura.pagamento_pendente_id = None
        db.commit()
    return assinatura


# ---------- Cancelamento ----------


def cancelar_assinatura(db: Session, assinatura: Assinatura) -> bool:
    """
    Dentro da janela de reembolso: devolve o último pagamento e encerra.
    Fora dela: para a renovação e mantém o acesso até o fim do mês pago.
    Retorna True se houve reembolso.
    """
    agora = _agora()
    dentro_da_janela = janela_reembolso_ate(assinatura) is not None

    # 1) Nada de cobranças futuras.
    if assinatura.mp_preapproval_id and assinatura.forma_pagamento in (None, "credito"):
        _requisitar("PUT", f"/preapproval/{assinatura.mp_preapproval_id}", {"status": "cancelled"})

    # 2) Reembolso, se ainda dá.
    reembolsado = False
    if dentro_da_janela:
        pagamento_id = assinatura.ultimo_pagamento_id
        if not pagamento_id and assinatura.mp_preapproval_id:
            aprovados = [
                p
                for p in _pagamentos_da_assinatura(
                    {"id": assinatura.mp_preapproval_id, "external_reference": f"seklyn-personal-{assinatura.personal_id}"}
                )
                if p["status"] == "approved"
            ]
            pagamento_id = aprovados[-1]["id"] if aprovados else None
        if pagamento_id:
            _requisitar("POST", f"/v1/payments/{pagamento_id}/refunds", {})
            reembolsado = True
        else:
            logger.warning("Cancelamento na janela de reembolso sem cobrança encontrada (assinatura %s)", assinatura.id)

    # 3) Até quando fica ativa.
    fim = assinatura.fim_do_periodo
    if reembolsado:
        assinatura.ultimo_pagamento_id = None
        assinatura.ultimo_pagamento_em = None
        # Pagou o próximo mês adiantado e pediu reembolso: volta pro mês que já tinha.
        if assinatura.forma_pagamento in ("debito", "pix") and fim is not None:
            fim = _somar_meses(fim, -1)
            assinatura.current_period_end = fim
        if fim is not None and fim > agora and assinatura.forma_pagamento in ("debito", "pix"):
            assinatura.cancelamento_agendado = True
        else:
            assinatura.status = "canceled"
            assinatura.cancelamento_agendado = False
    elif fim is not None and fim > agora:
        assinatura.cancelamento_agendado = True  # segue ativa até `fim`
    else:
        assinatura.status = "canceled"
    db.commit()
    return reembolsado


def sincronizar_preapproval(db: Session, preapproval_id: str) -> Assinatura | None:
    """Busca o estado real do preapproval na API e espelha na Assinatura."""
    preapproval = _requisitar("GET", f"/preapproval/{preapproval_id}")

    assinatura = db.query(Assinatura).filter(Assinatura.mp_preapproval_id == preapproval_id).first()
    if assinatura is None:
        # Fallback: achar pelo external_reference (ex: o id não chegou a ser
        # salvo porque o commit falhou depois do POST).
        referencia = preapproval.get("external_reference") or ""
        if referencia.startswith("seklyn-personal-"):
            personal_id = int(referencia.removeprefix("seklyn-personal-"))
            assinatura = db.query(Assinatura).filter(Assinatura.personal_id == personal_id).first()
    if assinatura is None:
        logger.warning("Preapproval %s sem assinatura correspondente", preapproval_id)
        return None

    # Notificação atrasada de um checkout antigo (já substituído por outro)
    # não pode sobrescrever o estado da assinatura atual.
    if assinatura.mp_preapproval_id and assinatura.mp_preapproval_id != preapproval_id:
        logger.info("Ignorando preapproval antigo %s (atual: %s)", preapproval_id, assinatura.mp_preapproval_id)
        return assinatura

    if assinatura.cancelamento_agendado or assinatura.forma_pagamento in ("debito", "pix"):
        # Cancelou (acesso até o fim do mês pago) ou trocou pra Pix/débito:
        # o preapproval cancelado não muda mais nada aqui.
        return assinatura

    assinatura.mp_preapproval_id = preapproval_id
    novo_status = STATUS_PREAPPROVAL.get(preapproval.get("status"))
    if novo_status:
        assinatura.status = novo_status
    proxima = _data_iso(preapproval.get("next_payment_date"))
    if proxima:
        assinatura.current_period_end = proxima
    db.commit()
    return assinatura


def tratar_pagamento_autorizado(db: Session, pagamento_id: str) -> None:
    """Cobrança mensal de uma assinatura: re-sincroniza o preapproval e, se
    a cobrança foi recusada, marca como pagamento pendente."""
    pagamento = _requisitar("GET", f"/authorized_payments/{pagamento_id}")
    preapproval_id = pagamento.get("preapproval_id")
    if not preapproval_id:
        return
    assinatura = sincronizar_preapproval(db, preapproval_id)
    cobranca = pagamento.get("payment") or {}
    status_cobranca = cobranca.get("status")
    # Só conta cobrança da assinatura automática que está valendo agora.
    if not assinatura or assinatura.mp_preapproval_id != preapproval_id or assinatura.forma_pagamento != "credito":
        return
    if status_cobranca == "rejected" and not assinatura.cancelamento_agendado:
        assinatura.status = "past_due"
        db.commit()
    elif status_cobranca == "approved" and cobranca.get("id"):
        # Cobrança do mês aprovada: abre a janela de reembolso dela.
        if assinatura.ultimo_pagamento_id != str(cobranca["id"]):
            assinatura.ultimo_pagamento_id = str(cobranca["id"])
            assinatura.ultimo_pagamento_em = _agora()
            db.commit()


# ---------- Teste de cobrança real (painel admin) ----------
#
# Assinatura de R$ 1,00 SEPARADA da conta de qualquer Personal, só pra o dono
# do produto confirmar que a cobrança no cartão funciona de ponta a ponta.
# Marcada pelo external_reference — o reembolso só aceita assinaturas com
# essa marca, então o botão nunca consegue estornar cliente de verdade.

PREFIXO_TESTE = "seklyn-teste-"
VALOR_TESTE = 1.00


def criar_assinatura_teste(card_token: str, payer_email: str) -> dict:
    referencia = f"{PREFIXO_TESTE}{uuid.uuid4().hex[:12]}"
    try:
        resposta = _requisitar(
            "POST",
            "/preapproval",
            {
                "reason": "Seklyn — teste de cobrança (será reembolsado)",
                "external_reference": referencia,
                "payer_email": payer_email,
                "card_token_id": card_token,
                "auto_recurring": {
                    "frequency": 1,
                    "frequency_type": "months",
                    "transaction_amount": VALOR_TESTE,
                    "currency_id": "BRL",
                },
                "back_url": f"{settings.frontend_url}/personal/admin.html",
                "status": "authorized",
            },
        )
    except ErroMercadoPago as erro:
        if erro.status_http and 400 <= erro.status_http < 500:
            raise CartaoRecusado(_mensagem_recusa(str(erro))) from erro
        raise
    return {"preapproval_id": resposta["id"], "status": resposta.get("status")}


def _preapproval_de_teste(preapproval_id: str) -> dict:
    preapproval = _requisitar("GET", f"/preapproval/{preapproval_id}")
    if not (preapproval.get("external_reference") or "").startswith(PREFIXO_TESTE):
        raise ValueError("Essa assinatura não é de teste.")
    return preapproval


def _pagamentos_da_assinatura(preapproval: dict) -> list[dict]:
    """Cobranças já geradas por uma assinatura: [{"id", "status", "valor"}].
    Tenta a busca de cobranças da assinatura e, de reserva, a busca de
    pagamentos pela referência — o primeiro débito pode levar alguns
    minutos pra aparecer depois da autorização."""
    encontrados: dict[str, dict] = {}
    consultas = [
        (f"/authorized_payments/search?preapproval_id={preapproval['id']}", lambda item: {"transaction_amount": item.get("transaction_amount"), **(item.get("payment") or {})}),
        (f"/v1/payments/search?external_reference={preapproval.get('external_reference', '')}", lambda item: item),
    ]
    for caminho, extrair in consultas:
        try:
            resultado = _requisitar("GET", caminho)
        except ErroMercadoPago:
            logger.warning("Busca de pagamentos falhou: %s", caminho)
            continue
        for item in resultado.get("results", []):
            pagamento = extrair(item)
            if pagamento.get("id"):
                encontrados[str(pagamento["id"])] = {
                    "id": str(pagamento["id"]),
                    "status": pagamento.get("status"),
                    "valor": pagamento.get("transaction_amount"),
                }
    return list(encontrados.values())


def consultar_teste(preapproval_id: str) -> dict:
    preapproval = _preapproval_de_teste(preapproval_id)
    return {
        "preapproval_id": preapproval_id,
        "status": preapproval.get("status"),
        "pagamentos": _pagamentos_da_assinatura(preapproval),
    }


def cancelar_e_reembolsar_teste(preapproval_id: str) -> dict:
    preapproval = _preapproval_de_teste(preapproval_id)
    if preapproval.get("status") != "cancelled":
        _requisitar("PUT", f"/preapproval/{preapproval_id}", {"status": "cancelled"})
    reembolsados, aguardando = [], 0
    for pagamento in _pagamentos_da_assinatura(preapproval):
        if pagamento["status"] == "approved":
            _requisitar("POST", f"/v1/payments/{pagamento['id']}/refunds", {})
            reembolsados.append(pagamento["id"])
        elif pagamento["status"] in ("pending", "in_process", "authorized"):
            aguardando += 1
    return {"preapproval_id": preapproval_id, "cancelada": True, "reembolsados": reembolsados, "aguardando": aguardando}


# Teste avulso (débito ou Pix de R$ 1,00), também marcado com PREFIXO_TESTE.


def _resumo_teste(pagamento: dict) -> dict:
    tipo = {"debit_card": "debito", "credit_card": "credito", "bank_transfer": "pix"}.get(pagamento.get("payment_type_id"))
    if pagamento.get("payment_method_id") == "pix":
        tipo = "pix"
    dados = (pagamento.get("point_of_interaction") or {}).get("transaction_data") or {}
    return {
        "pagamento_id": str(pagamento["id"]),
        "tipo": tipo or "debito",
        "status": pagamento.get("status"),
        "status_detail": pagamento.get("status_detail"),
        "valor": pagamento.get("transaction_amount"),
        "pix_qr_code": dados.get("qr_code"),
        "pix_qr_code_base64": dados.get("qr_code_base64"),
    }


def criar_pagamento_teste_debito(
    card_token: str,
    payment_method_id: str,
    payer_email: str,
    issuer_id: str | None = None,
    documento_tipo: str | None = None,
    documento_numero: str | None = None,
) -> dict:
    pagador: dict = {"email": payer_email}
    if documento_tipo and documento_numero:
        pagador["identification"] = {"type": documento_tipo, "number": documento_numero}
    corpo: dict = {
        "transaction_amount": VALOR_TESTE,
        "token": card_token,
        "description": "Seklyn — teste de cobrança no débito (será reembolsado)",
        "installments": 1,
        "payment_method_id": payment_method_id,
        "external_reference": f"{PREFIXO_TESTE}{uuid.uuid4().hex[:12]}",
        "payer": pagador,
    }
    if issuer_id:
        corpo["issuer_id"] = int(issuer_id) if str(issuer_id).isdigit() else issuer_id
    try:
        pagamento = _requisitar("POST", "/v1/payments", corpo)
    except ErroMercadoPago as erro:
        if erro.status_http and 400 <= erro.status_http < 500:
            raise CartaoRecusado(_mensagem_recusa(str(erro))) from erro
        raise
    if pagamento.get("status") in ("rejected", "cancelled"):
        raise CartaoRecusado(_mensagem_recusa(pagamento.get("status_detail") or ""))
    return _resumo_teste(pagamento)


def criar_pix_teste(payer_email: str) -> dict:
    expira = _agora() + timedelta(hours=1)
    pagamento = _requisitar(
        "POST",
        "/v1/payments",
        {
            "transaction_amount": VALOR_TESTE,
            "payment_method_id": "pix",
            "description": "Seklyn — teste de cobrança no Pix (será reembolsado)",
            "external_reference": f"{PREFIXO_TESTE}{uuid.uuid4().hex[:12]}",
            "payer": {"email": payer_email},
            "date_of_expiration": expira.isoformat(timespec="milliseconds"),
        },
    )
    return _resumo_teste(pagamento)


def _pagamento_de_teste(pagamento_id: str) -> dict:
    pagamento = _requisitar("GET", f"/v1/payments/{pagamento_id}")
    if not (pagamento.get("external_reference") or "").startswith(PREFIXO_TESTE):
        raise ValueError("Esse pagamento não é de teste.")
    return pagamento


def consultar_pagamento_teste(pagamento_id: str) -> dict:
    return _resumo_teste(_pagamento_de_teste(pagamento_id))


def reembolsar_pagamento_teste(pagamento_id: str) -> dict:
    """Aprovado → reembolsa. Pix ainda não pago → cancela o QR."""
    pagamento = _pagamento_de_teste(pagamento_id)
    situacao = pagamento.get("status")
    if situacao == "approved":
        _requisitar("POST", f"/v1/payments/{pagamento_id}/refunds", {})
    elif situacao in ("pending", "in_process"):
        _requisitar("PUT", f"/v1/payments/{pagamento_id}", {"status": "cancelled"})
    return _resumo_teste(_requisitar("GET", f"/v1/payments/{pagamento_id}"))


def assinatura_webhook_valida(x_signature: str | None, x_request_id: str | None, data_id: str | None) -> bool:
    """
    Valida o header x-signature ("ts=...,v1=...") do Mercado Pago: v1 é o
    HMAC-SHA256 (chave = secret do webhook) do manifesto
    "id:<data.id>;request-id:<x-request-id>;ts:<ts>;".
    """
    if not settings.mercadopago_webhook_secret or not x_signature:
        return False
    partes = dict(item.strip().split("=", 1) for item in x_signature.split(",") if "=" in item)
    ts, v1 = partes.get("ts"), partes.get("v1")
    if not ts or not v1:
        return False
    manifesto = ""
    if data_id:
        manifesto += f"id:{data_id.lower() if data_id.isalnum() else data_id};"
    if x_request_id:
        manifesto += f"request-id:{x_request_id};"
    manifesto += f"ts:{ts};"
    esperado = hmac.new(settings.mercadopago_webhook_secret.encode(), manifesto.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(esperado, v1)
