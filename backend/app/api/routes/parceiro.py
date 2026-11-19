"""
Loja do parceiro — TESTE no painel admin (ver services/parceiro_service.py).
Tudo aqui exige admin.
"""
import logging
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.deps import exigir_admin
from app.models.parceiro import Parceiro, VendaParceiro
from app.models.personal import Personal
from app.schemas.parceiro import (
    ConfirmarRepasseIn,
    PainelParceiroOut,
    ParceiroIn,
    ParceiroOut,
    RepasseOut,
    VendaCartaoIn,
    VendaCriadaOut,
    VendaIn,
    VendaOut,
)
from app.services import mercadopago_service as mp
from app.services import parceiro_service as loja

router = APIRouter(prefix="/api/admin/loja", tags=["Admin — loja do parceiro (teste)"], dependencies=[Depends(exigir_admin)])
logger = logging.getLogger("seklyn.loja")


def _parceiro(db: Session) -> Parceiro | None:
    return db.query(Parceiro).order_by(Parceiro.id).first()


def _venda(db: Session, venda_id: int) -> VendaParceiro:
    venda = db.get(VendaParceiro, venda_id)
    if venda is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Venda não encontrada.")
    return venda


def _exigir_mp() -> None:
    if not mp.configurado():
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Mercado Pago não configurado no servidor.")


@router.get("", response_model=PainelParceiroOut)
def painel(db: Session = Depends(get_db)) -> PainelParceiroOut:
    parceiro = _parceiro(db)
    vendas = (
        db.query(VendaParceiro).filter(VendaParceiro.parceiro_id == parceiro.id).order_by(VendaParceiro.id.desc()).all()
        if parceiro
        else []
    )
    # Vendas esperando o Pix: pergunta pro Mercado Pago se já pagaram.
    if mp.configurado():
        for venda in vendas:
            if venda.status == "aguardando":
                try:
                    loja.sincronizar(db, venda)
                except mp.ErroMercadoPago:
                    logger.warning("Não deu pra consultar a venda %s agora", venda.id)
    pagas = [v for v in vendas if v.status == "paga"]
    zero = Decimal("0.00")
    return PainelParceiroOut(
        parceiro=ParceiroOut.model_validate(parceiro) if parceiro else None,
        vendas=[VendaOut.model_validate(v) for v in vendas],
        total_vendido=sum((v.valor for v in pagas), zero),
        total_taxas=sum((v.taxa_mp or zero for v in pagas), zero),
        a_repassar=sum((v.parte_parceiro or zero for v in pagas if v.repasse_status == "pendente"), zero),
        ja_repassado=sum((v.parte_parceiro or zero for v in pagas if v.repasse_status == "feito"), zero),
        liquido_dono=sum((v.parte_dono or zero for v in pagas), zero),
        taxa_pix_estimada=float(loja.TAXA_PIX_ESTIMADA),
        mp_public_key=mp.settings.mercadopago_public_key or None,
    )


@router.put("/parceiro", response_model=ParceiroOut)
def salvar_parceiro(dados: ParceiroIn, db: Session = Depends(get_db)) -> ParceiroOut:
    chave = loja.normalizar_chave(dados.chave_pix_tipo, dados.chave_pix)
    if not loja.chave_valida(dados.chave_pix_tipo, chave):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Essa chave Pix não confere com o tipo escolhido.")
    parceiro = _parceiro(db) or Parceiro()
    if parceiro.chave_pix != chave or parceiro.chave_pix_tipo != dados.chave_pix_tipo:
        parceiro.chave_verificada_em = None  # chave nova: precisa verificar de novo
    parceiro.nome = dados.nome.strip()
    parceiro.chave_pix_tipo = dados.chave_pix_tipo
    parceiro.chave_pix = chave
    parceiro.cidade = dados.cidade.strip()
    parceiro.percentual_parceiro = dados.percentual_parceiro
    parceiro.taxa_paga_por = dados.taxa_paga_por
    db.add(parceiro)
    db.commit()
    db.refresh(parceiro)
    return ParceiroOut.model_validate(parceiro)


def _exigir_parceiro(db: Session) -> Parceiro:
    parceiro = _parceiro(db)
    if parceiro is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cadastre o parceiro (nome e chave Pix) primeiro.")
    return parceiro


@router.get("/parceiro/teste-chave", response_model=RepasseOut)
def pix_teste_da_chave(db: Session = Depends(get_db)) -> RepasseOut:
    """Pix de R$ 0,01 pra chave do parceiro: ao escanear, o app do banco
    mostra o nome do dono da chave (ou "chave não encontrada") — é a única
    forma de conferir, porque a consulta de chaves Pix (DICT do Banco
    Central) não é aberta pra sistemas de fora dos bancos."""
    parceiro = _exigir_parceiro(db)
    return RepasseOut(
        pix_copia_e_cola=loja.pix_para_parceiro(parceiro, Decimal("0.01"), "SEKLYNTESTECHAVE"),
        valor=Decimal("0.01"),
        chave=parceiro.chave_pix,
        nome=parceiro.nome,
    )


@router.post("/parceiro/chave-verificada", response_model=ParceiroOut)
def marcar_chave_verificada(db: Session = Depends(get_db)) -> ParceiroOut:
    parceiro = _exigir_parceiro(db)
    parceiro.chave_verificada_em = datetime.now(timezone.utc)
    db.commit()
    db.refresh(parceiro)
    return ParceiroOut.model_validate(parceiro)


def _vendas_a_repassar(db: Session, parceiro: Parceiro) -> list[VendaParceiro]:
    return (
        db.query(VendaParceiro)
        .filter(
            VendaParceiro.parceiro_id == parceiro.id,
            VendaParceiro.status == "paga",
            VendaParceiro.repasse_status == "pendente",
        )
        .order_by(VendaParceiro.id)
        .all()
    )


@router.get("/repasse-pendente", response_model=RepasseOut)
def repasse_pendente(db: Session = Depends(get_db)) -> RepasseOut:
    """Um Pix só com a soma de tudo que ainda não foi repassado."""
    parceiro = _exigir_parceiro(db)
    vendas = [v for v in _vendas_a_repassar(db, parceiro) if v.parte_parceiro and v.parte_parceiro > 0]
    if not vendas:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Nada pendente pra repassar.")
    total = sum((v.parte_parceiro for v in vendas), Decimal("0.00"))
    return RepasseOut(
        pix_copia_e_cola=loja.pix_para_parceiro(parceiro, total, f"SEKLYNREPASSE{vendas[-1].id}"),
        valor=total,
        chave=parceiro.chave_pix,
        nome=parceiro.nome,
        vendas=[v.id for v in vendas],
    )


@router.post("/repasse-pendente/confirmar", response_model=list[VendaOut])
def confirmar_repasse(dados: ConfirmarRepasseIn, db: Session = Depends(get_db)) -> list[VendaOut]:
    parceiro = _exigir_parceiro(db)
    agora = datetime.now(timezone.utc)
    marcadas = []
    for venda in _vendas_a_repassar(db, parceiro):
        if venda.id in dados.vendas:
            venda.repasse_status = "feito"
            venda.repassado_em = agora
            marcadas.append(venda)
    db.commit()
    return [VendaOut.model_validate(v) for v in marcadas]


@router.post("/vendas", response_model=VendaCriadaOut)
def nova_venda(dados: VendaIn, admin: Personal = Depends(exigir_admin), db: Session = Depends(get_db)) -> VendaCriadaOut:
    _exigir_mp()
    parceiro = _parceiro(db)
    if parceiro is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cadastre o parceiro (nome e chave Pix) primeiro.")
    try:
        venda, pix = loja.criar_venda_pix(db, parceiro, dados.produto.strip(), dados.valor, dados.email_pagador.strip())
    except mp.ErroMercadoPago as erro:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="O Mercado Pago não gerou o Pix. Confira se o e-mail do pagador é diferente do da sua conta e tente de novo.",
        ) from erro
    return VendaCriadaOut(
        venda=VendaOut.model_validate(venda),
        pix_qr_code=pix["qr_code"],
        pix_qr_code_base64=pix["qr_code_base64"],
        pix_expira_em=pix["expira_em"],
    )


@router.post("/vendas/cartao", response_model=VendaOut)
def nova_venda_cartao(dados: VendaCartaoIn, db: Session = Depends(get_db)) -> VendaOut:
    """Venda no cartão de crédito ou débito (à vista), digitado no formulário
    do Mercado Pago — só o token de uso único chega aqui."""
    _exigir_mp()
    parceiro = _parceiro(db)
    if parceiro is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cadastre o parceiro (nome e chave Pix) primeiro.")
    try:
        venda = loja.criar_venda_cartao(
            db,
            parceiro,
            dados.produto.strip(),
            dados.valor,
            dados.email_pagador.strip(),
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
            detail="Não deu pra falar com o Mercado Pago agora. Nenhuma cobrança foi feita.",
        ) from erro
    return VendaOut.model_validate(venda)


@router.get("/vendas/{venda_id}", response_model=VendaOut)
def consultar_venda(venda_id: int, db: Session = Depends(get_db)) -> VendaOut:
    venda = _venda(db, venda_id)
    if mp.configurado():
        try:
            loja.sincronizar(db, venda)
        except mp.ErroMercadoPago:
            logger.warning("Não deu pra consultar a venda %s agora", venda.id)
    return VendaOut.model_validate(venda)


@router.get("/vendas/{venda_id}/repasse", response_model=RepasseOut)
def pix_do_repasse(venda_id: int, db: Session = Depends(get_db)) -> RepasseOut:
    venda = _venda(db, venda_id)
    if venda.status != "paga" or not venda.parte_parceiro:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Só dá pra repassar venda paga.")
    return RepasseOut(
        pix_copia_e_cola=loja.pix_repasse(venda),
        valor=venda.parte_parceiro,
        chave=venda.parceiro.chave_pix,
        nome=venda.parceiro.nome,
    )


@router.post("/vendas/{venda_id}/repassado", response_model=VendaOut)
def marcar_repassado(venda_id: int, db: Session = Depends(get_db)) -> VendaOut:
    venda = _venda(db, venda_id)
    if venda.status != "paga":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Só dá pra repassar venda paga.")
    venda.repasse_status = "feito"
    venda.repassado_em = datetime.now(timezone.utc)
    db.commit()
    return VendaOut.model_validate(venda)


@router.post("/vendas/{venda_id}/reembolsar", response_model=VendaOut)
def reembolsar_venda(venda_id: int, db: Session = Depends(get_db)) -> VendaOut:
    _exigir_mp()
    venda = _venda(db, venda_id)
    if venda.status != "paga":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Só dá pra reembolsar venda paga.")
    try:
        loja.reembolsar(db, venda)
    except mp.ErroMercadoPago as erro:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="O Mercado Pago não aceitou o reembolso agora.") from erro
    return VendaOut.model_validate(venda)
