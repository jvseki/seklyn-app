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
"""
import hashlib
import hmac
import json
import logging
import urllib.error
import urllib.request
import uuid
from datetime import datetime
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

    try:
        resposta = _requisitar(
            "POST",
            "/preapproval",
            {
                "reason": "Seklyn — assinatura mensal",
                "external_reference": f"seklyn-personal-{personal.id}",
                "payer_email": personal.email,
                "card_token_id": card_token,
                "auto_recurring": {
                    "frequency": 1,
                    "frequency_type": "months",
                    "transaction_amount": float(valor),
                    "currency_id": "BRL",
                },
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

    assinatura.mp_preapproval_id = resposta["id"]
    assinatura.status = STATUS_PREAPPROVAL.get(resposta.get("status"), "pendente")
    proxima = _data_iso(resposta.get("next_payment_date"))
    if proxima:
        assinatura.current_period_end = proxima
    db.commit()
    return assinatura


def cancelar_assinatura(db: Session, assinatura: Assinatura) -> None:
    if assinatura.mp_preapproval_id:
        _requisitar("PUT", f"/preapproval/{assinatura.mp_preapproval_id}", {"status": "cancelled"})
    assinatura.status = "canceled"
    db.commit()


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
    status_cobranca = (pagamento.get("payment") or {}).get("status")
    if assinatura and status_cobranca == "rejected":
        assinatura.status = "past_due"
        db.commit()


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
