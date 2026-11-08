"""
Rotas de administração manual — enquanto o pagamento é combinado fora do
site (DM/WhatsApp) em vez de checkout automático, é aqui que a assinatura
de um Personal é ativada/desativada por e-mail, sem precisar entrar na VPS.

Protegido por uma chave simples (header X-Admin-Key), não por login de
Personal — é uma rota de uso do dono do produto, não de cliente.
"""
from fastapi import APIRouter, Depends, Header, HTTPException, Path, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.deps import exigir_admin
from app.models.aluno import Aluno
from app.models.assinatura import Assinatura
from app.models.personal import Personal
from app.services import mercadopago_service as mp
from app.schemas.admin import (
    AdminAssinaturaOut,
    AdminAtivarIn,
    AdminEmailIn,
    AdminLimiteIn,
    AdminPersonalListaOut,
    AdminTemaIn,
    AdminTesteCartaoConfigOut,
    AdminTesteCartaoIn,
    AdminTesteCartaoOut,
    AdminTesteReembolsoOut,
    AdminTesteAvulsoOut,
    AdminTestePixIn,
    AdminTesteDebitoIn,
    AdminValorIn,
)

router = APIRouter(prefix="/api/admin", tags=["Admin"])
settings = get_settings()


def exigir_chave_admin(x_admin_key: str | None = Header(default=None)) -> None:
    if not settings.admin_secret_key or x_admin_key != settings.admin_secret_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Chave de admin inválida.")


def _obter_ou_criar_assinatura(db: Session, personal: Personal) -> Assinatura:
    assinatura = db.query(Assinatura).filter(Assinatura.personal_id == personal.id).first()
    if assinatura is None:
        assinatura = Assinatura(personal_id=personal.id, status="inativa")
        db.add(assinatura)
        db.commit()
        db.refresh(assinatura)
    return assinatura


def _obter_personal_por_email(db: Session, email: str) -> Personal:
    personal = db.query(Personal).filter(Personal.email == email).first()
    if personal is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Nenhum Personal com esse e-mail.")
    return personal


@router.post("/ativar-assinatura", response_model=AdminAssinaturaOut, dependencies=[Depends(exigir_chave_admin)])
def ativar_assinatura(dados: AdminAtivarIn, db: Session = Depends(get_db)) -> AdminAssinaturaOut:
    personal = _obter_personal_por_email(db, dados.email)
    assinatura = _obter_ou_criar_assinatura(db, personal)
    assinatura.status = "active"
    assinatura.forma_pagamento = None  # liberada pelo admin: não vence sozinha
    assinatura.cancelamento_agendado = False
    if dados.limite_alunos is not None:
        assinatura.limite_alunos = dados.limite_alunos
    db.commit()
    return AdminAssinaturaOut(email=personal.email, status=assinatura.status, limite_alunos=assinatura.limite_alunos)


@router.post("/desativar-assinatura", response_model=AdminAssinaturaOut, dependencies=[Depends(exigir_chave_admin)])
def desativar_assinatura(dados: AdminEmailIn, db: Session = Depends(get_db)) -> AdminAssinaturaOut:
    personal = _obter_personal_por_email(db, dados.email)
    assinatura = _obter_ou_criar_assinatura(db, personal)
    assinatura.status = "inativa"
    db.commit()
    return AdminAssinaturaOut(email=personal.email, status=assinatura.status)


# --- Painel de administração (login normal do Personal + is_admin=true) ---
# Diferente das rotas acima (chave fixa em header, usadas por script/SSH),
# estas exigem estar logado como o super admin — é o que alimenta a tela
# /personal/admin.html.


def _linha_admin(db: Session, personal: Personal) -> AdminPersonalListaOut:
    assinatura = _obter_ou_criar_assinatura(db, personal)
    total_alunos = db.query(func.count(Aluno.id)).filter(Aluno.personal_id == personal.id).scalar() or 0
    return AdminPersonalListaOut(
        id=personal.id,
        nome=personal.nome,
        email=personal.email,
        email_verificado=personal.email_verificado,
        tema_personalizado=personal.tema_personalizado,
        is_admin=personal.is_admin,
        criado_em=personal.criado_em,
        assinatura_status=assinatura.status,
        limite_alunos=assinatura.limite_alunos,
        valor_mensal=assinatura.valor_mensal,
        cobranca_automatica=bool(assinatura.mp_preapproval_id),
        total_alunos=total_alunos,
    )


@router.get("/personais", response_model=list[AdminPersonalListaOut], dependencies=[Depends(exigir_admin)])
def listar_personais(db: Session = Depends(get_db)) -> list[AdminPersonalListaOut]:
    personais = db.query(Personal).order_by(Personal.criado_em.desc()).all()
    return [_linha_admin(db, personal) for personal in personais]


def _obter_personal_por_id(db: Session, personal_id: int) -> Personal:
    personal = db.get(Personal, personal_id)
    if personal is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Personal não encontrado.")
    return personal


@router.post(
    "/personais/{personal_id}/ativar", response_model=AdminPersonalListaOut, dependencies=[Depends(exigir_admin)]
)
def ativar_personal(personal_id: int, db: Session = Depends(get_db)) -> AdminPersonalListaOut:
    personal = _obter_personal_por_id(db, personal_id)
    assinatura = _obter_ou_criar_assinatura(db, personal)
    assinatura.status = "active"
    assinatura.forma_pagamento = None  # liberada pelo admin: não vence sozinha
    assinatura.cancelamento_agendado = False
    db.commit()
    return _linha_admin(db, personal)


@router.post(
    "/personais/{personal_id}/desativar", response_model=AdminPersonalListaOut, dependencies=[Depends(exigir_admin)]
)
def desativar_personal(personal_id: int, db: Session = Depends(get_db)) -> AdminPersonalListaOut:
    personal = _obter_personal_por_id(db, personal_id)
    assinatura = _obter_ou_criar_assinatura(db, personal)
    assinatura.status = "inativa"
    db.commit()
    return _linha_admin(db, personal)


@router.put(
    "/personais/{personal_id}/limite", response_model=AdminPersonalListaOut, dependencies=[Depends(exigir_admin)]
)
def definir_limite_personal(
    personal_id: int, dados: AdminLimiteIn, db: Session = Depends(get_db)
) -> AdminPersonalListaOut:
    personal = _obter_personal_por_id(db, personal_id)
    assinatura = _obter_ou_criar_assinatura(db, personal)
    assinatura.limite_alunos = dados.limite_alunos
    db.commit()
    return _linha_admin(db, personal)


@router.put(
    "/personais/{personal_id}/valor", response_model=AdminPersonalListaOut, dependencies=[Depends(exigir_admin)]
)
def definir_valor_personal(
    personal_id: int, dados: AdminValorIn, db: Session = Depends(get_db)
) -> AdminPersonalListaOut:
    """Mensalidade combinada com o Personal. Vale pra próxima assinatura que
    ele fizer — uma assinatura já ativa no cartão mantém o valor dela."""
    personal = _obter_personal_por_id(db, personal_id)
    assinatura = _obter_ou_criar_assinatura(db, personal)
    assinatura.valor_mensal = dados.valor_mensal
    db.commit()
    return _linha_admin(db, personal)


@router.put(
    "/personais/{personal_id}/tema", response_model=AdminPersonalListaOut, dependencies=[Depends(exigir_admin)]
)
def definir_tema_personal(personal_id: int, dados: AdminTemaIn, db: Session = Depends(get_db)) -> AdminPersonalListaOut:
    """Troca a cor da conta entre as 7 já desenhadas em variables.css (ou
    volta pro roxo padrão com null) — sem precisar de SSH/SQL direto."""
    personal = _obter_personal_por_id(db, personal_id)
    personal.tema_personalizado = dados.tema_personalizado
    db.commit()
    return _linha_admin(db, personal)


# --- Teste de cobrança real no cartão (R$ 1,00, depois cancela e reembolsa) ---
# Pra o dono do produto validar a integração com o Mercado Pago com o
# próprio cartão, sem mexer na assinatura de nenhum Personal (nem na dele).


def _erro_mp_amigavel(erro: Exception) -> HTTPException:
    if isinstance(erro, mp.CartaoRecusado):
        return HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail=erro.mensagem)
    if isinstance(erro, ValueError):
        return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(erro))
    return HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail="Não foi possível falar com o Mercado Pago agora. Tente de novo em instantes.",
    )


ID_MP = r"^[A-Za-z0-9_-]{1,64}$"  # IDs do Mercado Pago: nada de / ? # na URL


@router.get("/teste-cartao/config", response_model=AdminTesteCartaoConfigOut)
def config_teste_cartao(admin: Personal = Depends(exigir_admin)) -> AdminTesteCartaoConfigOut:
    return AdminTesteCartaoConfigOut(
        disponivel=mp.configurado() and bool(settings.mercadopago_public_key),
        public_key=settings.mercadopago_public_key or None,
        email_sugerido=admin.email,
        valor=mp.VALOR_TESTE,
    )


@router.post("/teste-cartao", response_model=AdminTesteCartaoOut, dependencies=[Depends(exigir_admin)])
def criar_teste_cartao(dados: AdminTesteCartaoIn) -> AdminTesteCartaoOut:
    if not mp.configurado():
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Mercado Pago não configurado no servidor.")
    try:
        criado = mp.criar_assinatura_teste(dados.card_token, dados.payer_email)
    except (mp.CartaoRecusado, mp.ErroMercadoPago) as erro:
        raise _erro_mp_amigavel(erro) from erro
    return AdminTesteCartaoOut(preapproval_id=criado["preapproval_id"], status=criado["status"])


@router.get("/teste-cartao/{preapproval_id}", response_model=AdminTesteCartaoOut, dependencies=[Depends(exigir_admin)])
def consultar_teste_cartao(preapproval_id: str = Path(pattern=ID_MP)) -> AdminTesteCartaoOut:
    try:
        return AdminTesteCartaoOut(**mp.consultar_teste(preapproval_id))
    except (ValueError, mp.ErroMercadoPago) as erro:
        raise _erro_mp_amigavel(erro) from erro


@router.post(
    "/teste-cartao/{preapproval_id}/reembolsar", response_model=AdminTesteReembolsoOut, dependencies=[Depends(exigir_admin)]
)
def reembolsar_teste_cartao(preapproval_id: str = Path(pattern=ID_MP)) -> AdminTesteReembolsoOut:
    try:
        return AdminTesteReembolsoOut(**mp.cancelar_e_reembolsar_teste(preapproval_id))
    except (ValueError, mp.ErroMercadoPago) as erro:
        raise _erro_mp_amigavel(erro) from erro


# ---------- Teste avulso: débito ou Pix de R$ 1,00 (com reembolso) ----------


@router.post("/teste-pagamento/debito", response_model=AdminTesteAvulsoOut, dependencies=[Depends(exigir_admin)])
def criar_teste_debito(dados: AdminTesteDebitoIn) -> AdminTesteAvulsoOut:
    if not mp.configurado():
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Mercado Pago não configurado no servidor.")
    try:
        return AdminTesteAvulsoOut(
            **mp.criar_pagamento_teste_debito(
                dados.card_token,
                dados.payment_method_id,
                dados.payer_email,
                dados.issuer_id,
                dados.documento_tipo,
                dados.documento_numero,
            )
        )
    except mp.CartaoRecusado as recusa:
        raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail=recusa.mensagem) from recusa
    except mp.ErroMercadoPago as erro:
        raise _erro_mp_amigavel(erro) from erro


@router.post("/teste-pagamento/pix", response_model=AdminTesteAvulsoOut, dependencies=[Depends(exigir_admin)])
def criar_teste_pix(dados: AdminTestePixIn) -> AdminTesteAvulsoOut:
    if not mp.configurado():
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Mercado Pago não configurado no servidor.")
    try:
        return AdminTesteAvulsoOut(**mp.criar_pix_teste(dados.payer_email))
    except mp.ErroMercadoPago as erro:
        raise _erro_mp_amigavel(erro) from erro


@router.get("/teste-pagamento/{pagamento_id}", response_model=AdminTesteAvulsoOut, dependencies=[Depends(exigir_admin)])
def consultar_teste_pagamento(pagamento_id: str = Path(pattern=ID_MP)) -> AdminTesteAvulsoOut:
    try:
        return AdminTesteAvulsoOut(**mp.consultar_pagamento_teste(pagamento_id))
    except (ValueError, mp.ErroMercadoPago) as erro:
        raise _erro_mp_amigavel(erro) from erro


@router.post(
    "/teste-pagamento/{pagamento_id}/reembolsar", response_model=AdminTesteAvulsoOut, dependencies=[Depends(exigir_admin)]
)
def reembolsar_teste_pagamento(pagamento_id: str = Path(pattern=ID_MP)) -> AdminTesteAvulsoOut:
    try:
        return AdminTesteAvulsoOut(**mp.reembolsar_pagamento_teste(pagamento_id))
    except (ValueError, mp.ErroMercadoPago) as erro:
        raise _erro_mp_amigavel(erro) from erro
