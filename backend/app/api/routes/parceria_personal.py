"""
Novidades (aviso que aparece uma vez por conta) e pedido de parceria: o
Personal pede pra vender planilhas na loja; o dono recebe por e-mail e
acompanha/responde no Admin.
"""
import logging
import re
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.deps import exigir_admin, get_current_personal
from app.models.personal import Personal
from app.models.solicitacao_parceria import SolicitacaoParceria
from app.services import email_avisos

router = APIRouter(tags=["Novidades e parcerias"])
logger = logging.getLogger("seklyn.parceria")
settings = get_settings()

STATUS = ("nova", "em_contato", "aprovada", "recusada")


class NovidadeVistaIn(BaseModel):
    versao: int = Field(ge=1, le=1000)


class SolicitacaoIn(BaseModel):
    whatsapp: str = Field(min_length=10, max_length=30)
    instagram: str | None = Field(default=None, max_length=80)
    mensagem: str | None = Field(default=None, max_length=2000)


class SolicitacaoOut(BaseModel):
    id: int
    status: str
    whatsapp: str
    instagram: str | None = None
    mensagem: str | None = None
    criado_em: datetime | None = None


class SolicitacaoAdminOut(SolicitacaoOut):
    personal_id: int
    personal_nome: str
    personal_email: str
    nota_admin: str | None = None


class SolicitacaoAdminIn(BaseModel):
    status: str = Field(pattern="^(nova|em_contato|aprovada|recusada)$")
    nota_admin: str | None = Field(default=None, max_length=2000)


def _out(s: SolicitacaoParceria) -> SolicitacaoOut:
    return SolicitacaoOut(id=s.id, status=s.status, whatsapp=s.whatsapp, instagram=s.instagram, mensagem=s.mensagem, criado_em=s.criado_em)


@router.post("/api/personal/novidades/vista", status_code=status.HTTP_204_NO_CONTENT)
def marcar_novidade_vista(
    dados: NovidadeVistaIn, personal: Personal = Depends(get_current_personal), db: Session = Depends(get_db)
) -> None:
    if dados.versao > (personal.novidade_vista or 0):
        personal.novidade_vista = dados.versao
        db.commit()


@router.get("/api/personal/parceria/solicitacao", response_model=SolicitacaoOut | None)
def minha_solicitacao(personal: Personal = Depends(get_current_personal), db: Session = Depends(get_db)) -> SolicitacaoOut | None:
    s = (
        db.query(SolicitacaoParceria)
        .filter(SolicitacaoParceria.personal_id == personal.id)
        .order_by(SolicitacaoParceria.id.desc())
        .first()
    )
    return _out(s) if s else None


@router.post("/api/personal/parceria/solicitacao", response_model=SolicitacaoOut, status_code=status.HTTP_201_CREATED)
def solicitar_parceria(
    dados: SolicitacaoIn,
    personal: Personal = Depends(get_current_personal),
    db: Session = Depends(get_db),
) -> SolicitacaoOut:
    aberta = (
        db.query(SolicitacaoParceria)
        .filter(SolicitacaoParceria.personal_id == personal.id, SolicitacaoParceria.status.in_(("nova", "em_contato")))
        .first()
    )
    if aberta:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Seu pedido já foi enviado — logo entramos em contato pelo WhatsApp.")
    if len(re.sub(r"\D", "", dados.whatsapp)) < 10:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="WhatsApp inválido — coloque o DDD.")
    s = SolicitacaoParceria(
        personal_id=personal.id,
        whatsapp=dados.whatsapp.strip(),
        instagram=(dados.instagram or "").strip().lstrip("@") or None,
        mensagem=(dados.mensagem or "").strip() or None,
        status="nova",
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    email_avisos.pedido_parceria_admin(
        email_avisos.emails_admins(db), personal.nome, personal.email, s.whatsapp, s.instagram, s.mensagem
    )
    email_avisos.pedido_parceria_recebido(personal.email, personal.nome)
    return _out(s)


@router.get("/api/admin/parceria/solicitacoes", response_model=list[SolicitacaoAdminOut], dependencies=[Depends(exigir_admin)])
def listar_solicitacoes(db: Session = Depends(get_db)) -> list[SolicitacaoAdminOut]:
    saida = []
    for s in db.query(SolicitacaoParceria).order_by(SolicitacaoParceria.id.desc()).all():
        saida.append(
            SolicitacaoAdminOut(
                **_out(s).model_dump(),
                personal_id=s.personal_id,
                personal_nome=s.personal.nome if s.personal else "—",
                personal_email=s.personal.email if s.personal else "—",
                nota_admin=s.nota_admin,
            )
        )
    return saida


@router.put("/api/admin/parceria/solicitacoes/{solicitacao_id}", response_model=SolicitacaoAdminOut, dependencies=[Depends(exigir_admin)])
def atualizar_solicitacao(solicitacao_id: int, dados: SolicitacaoAdminIn, db: Session = Depends(get_db)) -> SolicitacaoAdminOut:
    s = db.get(SolicitacaoParceria, solicitacao_id)
    if s is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pedido não encontrado.")
    mudou = s.status != dados.status
    s.status = dados.status
    s.nota_admin = (dados.nota_admin or "").strip() or None
    if mudou and s.personal:
        email_avisos.parceria_status(s.personal.email, s.personal.nome, s.status)
    db.commit()
    db.refresh(s)
    return SolicitacaoAdminOut(
        **_out(s).model_dump(),
        personal_id=s.personal_id,
        personal_nome=s.personal.nome,
        personal_email=s.personal.email,
        nota_admin=s.nota_admin,
    )
