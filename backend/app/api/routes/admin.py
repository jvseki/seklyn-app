"""
Rotas de administração manual — enquanto o pagamento é combinado fora do
site (DM/WhatsApp) em vez de checkout automático, é aqui que a assinatura
de um Personal é ativada/desativada por e-mail, sem precisar entrar na VPS.

Protegido por uma chave simples (header X-Admin-Key), não por login de
Personal — é uma rota de uso do dono do produto, não de cliente.
"""
from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.models.assinatura import Assinatura
from app.models.personal import Personal
from app.schemas.admin import AdminAssinaturaOut, AdminAtivarIn, AdminEmailIn

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
