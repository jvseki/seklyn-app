"""
Fluxo de assinatura via Stripe: criação da Checkout Session, consulta do
status atual e o endpoint de webhook que mantém tudo sincronizado.
"""
import stripe
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.deps import get_current_personal
from app.models.assinatura import Assinatura
from app.models.personal import Personal
from app.schemas.assinatura import AssinaturaOut, CheckoutSessionOut
from app.services.stripe_service import criar_checkout_session_url, tratar_evento_webhook

router = APIRouter(tags=["Assinatura"])
settings = get_settings()


@router.post("/api/stripe/criar-checkout-session", response_model=CheckoutSessionOut)
def criar_checkout_session(
    personal: Personal = Depends(get_current_personal),
    db: Session = Depends(get_db),
) -> CheckoutSessionOut:
    url = criar_checkout_session_url(db, personal)
    return CheckoutSessionOut(checkout_url=url)


@router.get("/api/personal/assinatura", response_model=AssinaturaOut)
def status_assinatura(
    personal: Personal = Depends(get_current_personal),
    db: Session = Depends(get_db),
) -> Assinatura:
    assinatura = db.query(Assinatura).filter(Assinatura.personal_id == personal.id).first()
    if assinatura is None:
        assinatura = Assinatura(personal_id=personal.id, status="inativa")
        db.add(assinatura)
        db.commit()
        db.refresh(assinatura)
    return assinatura


@router.post("/api/stripe/webhook", status_code=status.HTTP_200_OK)
async def webhook_stripe(request: Request, db: Session = Depends(get_db)) -> dict:
    """
    Recebe eventos do Stripe (checkout concluído, assinatura criada/alterada/
    cancelada, cobrança falhada) e valida a assinatura via STRIPE_WEBHOOK_SECRET.
    """
    payload = await request.body()
    assinatura_header = request.headers.get("stripe-signature")

    try:
        evento = stripe.Webhook.construct_event(payload, assinatura_header, settings.stripe_webhook_secret)
    except (ValueError, stripe.error.SignatureVerificationError) as erro:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Webhook inválido.") from erro

    tratar_evento_webhook(db, evento)
    return {"recebido": True}
