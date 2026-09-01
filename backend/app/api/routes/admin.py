"""
Rotas de administração manual — enquanto o pagamento é combinado fora do
site (DM/WhatsApp) em vez de checkout automático, é aqui que a assinatura
de um Personal é ativada/desativada por e-mail, sem precisar entrar na VPS.

Protegido por uma chave simples (header X-Admin-Key), não por login de
Personal — é uma rota de uso do dono do produto, não de cliente.
"""
from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.deps import exigir_admin
from app.models.aluno import Aluno
from app.models.assinatura import Assinatura
from app.models.personal import Personal
from app.schemas.admin import (
    AdminAssinaturaOut,
    AdminAtivarIn,
    AdminEmailIn,
    AdminLimiteIn,
    AdminPersonalListaOut,
    AdminTemaIn,
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
    "/personais/{personal_id}/tema", response_model=AdminPersonalListaOut, dependencies=[Depends(exigir_admin)]
)
def definir_tema_personal(personal_id: int, dados: AdminTemaIn, db: Session = Depends(get_db)) -> AdminPersonalListaOut:
    """Troca a cor da conta entre as 7 já desenhadas em variables.css (ou
    volta pro roxo padrão com null) — sem precisar de SSH/SQL direto."""
    personal = _obter_personal_por_id(db, personal_id)
    personal.tema_personalizado = dados.tema_personalizado
    db.commit()
    return _linha_admin(db, personal)
