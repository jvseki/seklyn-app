"""
Integração com o Stripe: criação de checkout de assinatura e
processamento dos webhooks que mantêm `assinaturas.status` em dia.
"""
from datetime import datetime, timezone

import stripe
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.assinatura import Assinatura
from app.models.personal import Personal

settings = get_settings()
stripe.api_key = settings.stripe_secret_key


def _obter_ou_criar_assinatura(db: Session, personal: Personal) -> Assinatura:
    assinatura = db.query(Assinatura).filter(Assinatura.personal_id == personal.id).first()
    if assinatura is None:
        assinatura = Assinatura(personal_id=personal.id, status="inativa")
        db.add(assinatura)
        db.commit()
        db.refresh(assinatura)
    return assinatura


def _obter_ou_criar_stripe_customer(db: Session, personal: Personal) -> str:
    assinatura = _obter_ou_criar_assinatura(db, personal)
    if assinatura.stripe_customer_id:
        return assinatura.stripe_customer_id

    customer = stripe.Customer.create(email=personal.email, name=personal.nome)
    assinatura.stripe_customer_id = customer["id"]
    db.commit()
    return customer["id"]


def criar_checkout_session_url(db: Session, personal: Personal) -> str:
    """Cria a Checkout Session de assinatura (mode=subscription) e retorna a URL para redirect."""
    customer_id = _obter_ou_criar_stripe_customer(db, personal)

    session = stripe.checkout.Session.create(
        customer=customer_id,
        mode="subscription",
        line_items=[{"price": settings.stripe_price_id, "quantity": 1}],
        success_url=f"{settings.frontend_url}/personal/assinatura.html?status=sucesso",
        cancel_url=f"{settings.frontend_url}/personal/assinatura.html?status=cancelado",
    )
    return session["url"]


def _timestamp_para_datetime(ts: int | None) -> datetime | None:
    if ts is None:
        return None
    return datetime.fromtimestamp(ts, tz=timezone.utc)


def tratar_evento_webhook(db: Session, evento: dict) -> None:
    """Atualiza a assinatura local a partir de um evento de webhook do Stripe já validado."""
    tipo = evento["type"]
    objeto = evento["data"]["object"]

    if tipo == "checkout.session.completed":
        customer_id = objeto.get("customer")
        subscription_id = objeto.get("subscription")
        assinatura = db.query(Assinatura).filter(Assinatura.stripe_customer_id == customer_id).first()
        if assinatura and subscription_id:
            assinatura.stripe_subscription_id = subscription_id
            db.commit()

    elif tipo in ("customer.subscription.created", "customer.subscription.updated"):
        customer_id = objeto.get("customer")
        assinatura = db.query(Assinatura).filter(Assinatura.stripe_customer_id == customer_id).first()
        if assinatura:
            assinatura.stripe_subscription_id = objeto.get("id")
            assinatura.status = objeto.get("status", assinatura.status)
            assinatura.current_period_end = _timestamp_para_datetime(objeto.get("current_period_end"))
            db.commit()

    elif tipo == "customer.subscription.deleted":
        customer_id = objeto.get("customer")
        assinatura = db.query(Assinatura).filter(Assinatura.stripe_customer_id == customer_id).first()
        if assinatura:
            assinatura.status = "canceled"
            db.commit()

    elif tipo == "invoice.payment_failed":
        customer_id = objeto.get("customer")
        assinatura = db.query(Assinatura).filter(Assinatura.stripe_customer_id == customer_id).first()
        if assinatura:
            assinatura.status = "past_due"
            db.commit()
