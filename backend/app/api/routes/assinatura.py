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
from app.schemas.assinatura import AssinarCartaoIn, AssinaturaOut, PixOut
from app.services import mercadopago_service as mp
from app.services import parceiro_service

router = APIRouter(tags=["Assinatura"])
logger = logging.getLogger("seklyn.mercadopago")


def _saida(db: Session, personal: Personal) -> AssinaturaOut:
    assinatura = mp.obter_ou_criar_assinatura(db, personal)
    disponivel = mp.configurado() and bool(mp.settings.mercadopago_public_key)
    dias = mp.dias_para_vencer(assinatura)
    automatica = (
        assinatura.forma_pagamento == "credito" and bool(assinatura.mp_preapproval_id) and not assinatura.cancelamento_agendado
    )
    return AssinaturaOut(
        status="vencida" if assinatura.vencida else assinatura.status,
        ativa=assinatura.ativa,
        current_period_end=assinatura.current_period_end,
        limite_alunos=assinatura.limite_alunos,
        alunos_cadastrados=db.query(Aluno).filter(Aluno.personal_id == personal.id).count(),
        valor_mensal=assinatura.valor_mensal,
        automatica=automatica,
        pagamento_disponivel=disponivel,
        mp_public_key=mp.settings.mercadopago_public_key or None,
        forma_pagamento=assinatura.forma_pagamento,
        cancelamento_agendado=assinatura.cancelamento_agendado,
        reembolso_ate=mp.janela_reembolso_ate(assinatura),
        reembolso_horas=mp.settings.reembolso_horas,
        dias_para_vencer=dias,
        alerta_vencimento=(
            assinatura.forma_pagamento in ("debito", "pix")
            and not assinatura.cancelamento_agendado
            and dias is not None
            and dias <= mp.settings.dias_alerta_vencimento
        ),
        pode_pagar_avulso=disponivel and mp.pode_pagar_avulso(assinatura),
        pode_assinar_credito=disponivel and bool(assinatura.valor_mensal) and not (automatica and assinatura.ativa),
        pagamento_em_andamento=bool(assinatura.pagamento_pendente_id),
    )


@router.get("/api/personal/assinatura", response_model=AssinaturaOut)
def status_assinatura(
    personal: Personal = Depends(get_current_personal),
    db: Session = Depends(get_db),
) -> AssinaturaOut:
    # Aguardando pagamento: além de esperar o webhook, pergunta direto pro
    # Mercado Pago — se o webhook não estiver configurado (ou atrasar), a
    # assinatura ativa do mesmo jeito quando o Personal volta pra tela.
    assinatura = mp.obter_ou_criar_assinatura(db, personal)
    if mp.configurado():
        # Crédito: pendente, ou passou da data da cobrança sem notícia.
        fim = assinatura.fim_do_periodo
        atrasada = fim is not None and fim <= mp._agora() and assinatura.forma_pagamento == "credito"
        if assinatura.mp_preapproval_id and (assinatura.status == "pendente" or atrasada):
            try:
                mp.sincronizar_preapproval(db, assinatura.mp_preapproval_id)
            except mp.ErroMercadoPago:
                logger.warning("Não deu pra consultar o preapproval %s agora", assinatura.mp_preapproval_id)
        # Pix gerado / débito em análise: já foi pago?
        if assinatura.pagamento_pendente_id:
            try:
                mp.sincronizar_pagamento_avulso(db, assinatura.pagamento_pendente_id)
            except mp.ErroMercadoPago:
                logger.warning("Não deu pra consultar o pagamento %s agora", assinatura.pagamento_pendente_id)
    return _saida(db, personal)


@router.post("/api/personal/assinatura/cartao", response_model=AssinaturaOut)
def assinar_com_cartao(
    dados: AssinarCartaoIn,
    personal: Personal = Depends(get_current_personal),
    db: Session = Depends(get_db),
) -> AssinaturaOut:
    """Recebe só o card_token gerado pelo formulário do Mercado Pago (o
    número do cartão nunca passa por aqui). Crédito: cria a assinatura
    automática. Débito: paga 1 mês agora (renova manualmente)."""
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
    if dados.tipo == "credito":
        automatica = (
            assinatura.forma_pagamento == "credito" and assinatura.mp_preapproval_id and not assinatura.cancelamento_agendado
        )
        if assinatura.ativa and automatica:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Sua assinatura já está ativa.")
    elif not mp.pode_pagar_avulso(assinatura):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Seu mês atual ainda não está perto de vencer: o pagamento libera {mp.settings.dias_alerta_vencimento} dias antes.",
        )
    elif not dados.payment_method_id:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Dados do cartão de débito incompletos.")
    try:
        if dados.tipo == "credito":
            mp.assinar_com_cartao(db, personal, assinatura, dados.card_token)
        else:
            mp.pagar_com_debito(
                db,
                personal,
                assinatura,
                dados.card_token,
                dados.payment_method_id,
                dados.issuer_id,
                dados.documento_tipo,
                dados.documento_numero,
            )
    except mp.CartaoRecusado as recusa:
        raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail=recusa.mensagem) from recusa
    except mp.ErroMercadoPago as erro:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Não foi possível falar com o Mercado Pago agora. Nenhuma cobrança foi feita — tente de novo em instantes.",
        ) from erro
    return _saida(db, personal)


@router.post("/api/personal/assinatura/pix", response_model=PixOut)
def gerar_pix(
    personal: Personal = Depends(get_current_personal),
    db: Session = Depends(get_db),
) -> PixOut:
    """Gera o Pix de 1 mês (ou devolve o que ainda está em aberto)."""
    if not mp.configurado():
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Pagamento ainda não está disponível.")
    assinatura = mp.obter_ou_criar_assinatura(db, personal)
    if not assinatura.valor_mensal:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Seu plano ainda não foi definido. Fale com o suporte pra combinar o valor.",
        )
    if not mp.pode_pagar_avulso(assinatura):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Seu mês atual ainda não está perto de vencer: o Pix libera {mp.settings.dias_alerta_vencimento} dias antes.",
        )
    try:
        return PixOut(**mp.gerar_pix(db, personal, assinatura))
    except mp.ErroMercadoPago as erro:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Não deu pra gerar o Pix agora. Tente de novo em instantes ou pague com cartão.",
        ) from erro


@router.post("/api/personal/assinatura/cancelar", response_model=AssinaturaOut)
def cancelar(
    personal: Personal = Depends(get_current_personal),
    db: Session = Depends(get_db),
) -> AssinaturaOut:
    assinatura = mp.obter_ou_criar_assinatura(db, personal)
    if not assinatura.forma_pagamento or not assinatura.ativa:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Não há assinatura paga pra cancelar. Fale com o suporte se precisar.",
        )
    if assinatura.cancelamento_agendado:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Sua assinatura já está cancelada.")
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
        elif tipo == "payment":
            pagamento = mp._requisitar("GET", f"/v1/payments/{recurso_id}")
            if (pagamento.get("external_reference") or "").startswith(parceiro_service.PREFIXO_VENDA):
                parceiro_service.aplicar_pagamento(db, pagamento)  # venda da loja do parceiro (teste)
            else:
                mp.sincronizar_pagamento_avulso(db, recurso_id)  # Pix/débito da assinatura (ignora o resto)
    except mp.ErroMercadoPago as erro:
        # Falha consultando a API: 500 faz o Mercado Pago tentar de novo depois.
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Falha temporária.") from erro
    return {"recebido": True}
