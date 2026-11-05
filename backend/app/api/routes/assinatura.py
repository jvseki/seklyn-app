"""
Assinatura mensal do Personal via Mercado Pago: status, início do checkout,
cancelamento e o webhook que mantém tudo sincronizado. Ver
services/mercadopago_service.py.
"""
import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.deps import get_current_personal
from app.models.aluno import Aluno
from app.models.personal import Personal
from app.schemas.assinatura import AssinaturaOut, CheckoutSessionOut
from app.services import mercadopago_service as mp

router = APIRouter(tags=["Assinatura"])
logger = logging.getLogger("seklyn.mercadopago")


def _saida(db: Session, personal: Personal) -> AssinaturaOut:
    assinatura = mp.obter_ou_criar_assinatura(db, personal)
    return AssinaturaOut(
        status=assinatura.status,
        ativa=assinatura.ativa,
        current_period_end=assinatura.current_period_end,
        limite_alunos=assinatura.limite_alunos,
        alunos_cadastrados=db.query(Aluno).filter(Aluno.personal_id == personal.id).count(),
        valor_mensal=assinatura.valor_mensal,
        automatica=bool(assinatura.mp_preapproval_id),
        pagamento_disponivel=mp.configurado(),
    )


@router.get("/api/personal/assinatura", response_model=AssinaturaOut)
def status_assinatura(
    personal: Personal = Depends(get_current_personal),
    db: Session = Depends(get_db),
) -> AssinaturaOut:
    return _saida(db, personal)


@router.post("/api/personal/assinatura/checkout", response_model=CheckoutSessionOut)
def iniciar_checkout(
    personal: Personal = Depends(get_current_personal),
    db: Session = Depends(get_db),
) -> CheckoutSessionOut:
    if not mp.configurado():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Pagamento com cartão ainda não está disponível. Fale com o suporte.",
        )
    assinatura = mp.obter_ou_criar_assinatura(db, personal)
    if not assinatura.valor_mensal:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Seu plano ainda não foi definido. Fale com o suporte pra combinar o valor.",
        )
    if assinatura.ativa and assinatura.mp_preapproval_id:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Sua assinatura já está ativa.")
    try:
        url = mp.iniciar_assinatura(db, personal, assinatura)
    except mp.ErroMercadoPago as erro:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Não foi possível abrir o pagamento agora. Tente novamente em instantes.",
        ) from erro
    return CheckoutSessionOut(checkout_url=url)


@router.post("/api/personal/assinatura/cancelar", response_model=AssinaturaOut)
def cancelar(
    personal: Personal = Depends(get_current_personal),
    db: Session = Depends(get_db),
) -> AssinaturaOut:
    assinatura = mp.obter_ou_criar_assinatura(db, personal)
    if not assinatura.mp_preapproval_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Sua assinatura não é cobrada no cartão — fale com o suporte pra alterar.",
        )
    try:
        mp.cancelar_assinatura(db, assinatura)
    except mp.ErroMercadoPago as erro:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Não foi possível cancelar agora. Tente novamente em instantes.",
        ) from erro
    return _saida(db, personal)


@router.post("/api/mercadopago/webhook")
async def webhook_mercadopago(request: Request, db: Session = Depends(get_db)) -> dict:
    """
    Notificações do Mercado Pago (configuradas em Suas integrações > Webhooks,
    eventos "Planos e assinaturas"). Aceita o formato novo (?type=&data.id=)
    e o antigo (?topic=&id=). Responde 200 pra tudo que não nos interessa —
    senão o Mercado Pago fica reenviando a cada 15 minutos.
    """
    corpo: dict = {}
    try:
        corpo = json.loads(await request.body() or b"{}")
    except ValueError:
        pass
    parametros = request.query_params
    tipo = parametros.get("type") or corpo.get("type") or parametros.get("topic") or corpo.get("topic")
    recurso_id = parametros.get("data.id") or (corpo.get("data") or {}).get("id") or parametros.get("id")
    recurso_id = str(recurso_id) if recurso_id else None

    if mp.settings.mercadopago_webhook_secret:
        if not mp.assinatura_webhook_valida(
            request.headers.get("x-signature"), request.headers.get("x-request-id"), parametros.get("data.id")
        ):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Assinatura do webhook inválida.")
    else:
        # Sem secret configurado ainda: seguimos, porque o estado é sempre
        # relido da API com o nosso token (notificação forjada não ativa nada).
        logger.warning("MERCADOPAGO_WEBHOOK_SECRET não configurado — webhook sem validação de assinatura.")

    if not recurso_id:
        return {"recebido": True}
    try:
        if tipo in ("subscription_preapproval", "preapproval"):
            mp.sincronizar_preapproval(db, recurso_id)
        elif tipo in ("subscription_authorized_payment", "authorized_payment"):
            mp.tratar_pagamento_autorizado(db, recurso_id)
    except mp.ErroMercadoPago as erro:
        # Falha consultando a API: 500 faz o Mercado Pago tentar de novo depois.
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Falha temporária.") from erro
    return {"recebido": True}
