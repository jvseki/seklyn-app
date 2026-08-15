"""Registro e login do Personal (autenticação padrão email/senha, via JWT)."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import criar_token_acesso, gerar_token_verificacao, hash_senha, verificar_senha
from app.deps import get_current_personal
from app.models.assinatura import Assinatura
from app.models.personal import Personal
from app.schemas.personal import (
    ConfirmarEmailIn,
    PersonalAtualizar,
    PersonalCriar,
    PersonalLogin,
    PersonalOut,
    TokenOut,
    TrocarSenhaIn,
)
from app.services.email_service import enviar_email_confirmacao

router = APIRouter(prefix="/api/auth/personal", tags=["Autenticação"])
settings = get_settings()


def _enviar_confirmacao(db: Session, personal: Personal) -> None:
    token, expira_em = gerar_token_verificacao()
    personal.token_verificacao = token
    personal.token_verificacao_expira = expira_em
    db.commit()

    link = f"{settings.frontend_url}/personal/confirmar-email.html?token={token}"
    enviar_email_confirmacao(personal.email, personal.nome, link)


@router.post("/registrar", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def registrar(dados: PersonalCriar, db: Session = Depends(get_db)) -> TokenOut:
    ja_existe = db.query(Personal).filter(Personal.email == dados.email).first()
    if ja_existe:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Já existe uma conta com esse e-mail.")

    personal = Personal(
        nome=dados.nome,
        email=dados.email,
        senha_hash=hash_senha(dados.senha),
        telefone=dados.telefone,
    )
    db.add(personal)
    db.commit()
    db.refresh(personal)

    # Toda conta nasce com uma assinatura "inativa" até passar pelo checkout do Stripe.
    db.add(Assinatura(personal_id=personal.id, status="inativa"))
    db.commit()

    # A conta já funciona normalmente; a confirmação de e-mail fica pendente
    # (mesmo comportamento do v1) — não bloqueia o uso.
    _enviar_confirmacao(db, personal)

    token = criar_token_acesso(personal.id)
    return TokenOut(access_token=token, personal=PersonalOut.model_validate(personal))


@router.post("/login", response_model=TokenOut)
def login(dados: PersonalLogin, db: Session = Depends(get_db)) -> TokenOut:
    credenciais_invalidas = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED, detail="E-mail ou senha incorretos."
    )
    personal = db.query(Personal).filter(Personal.email == dados.email).first()
    if personal is None or not verificar_senha(dados.senha, personal.senha_hash):
        raise credenciais_invalidas

    token = criar_token_acesso(personal.id)
    return TokenOut(access_token=token, personal=PersonalOut.model_validate(personal))


@router.get("/me", response_model=PersonalOut)
def me(personal: Personal = Depends(get_current_personal)) -> Personal:
    return personal


@router.post("/confirmar-email", response_model=PersonalOut)
def confirmar_email(dados: ConfirmarEmailIn, db: Session = Depends(get_db)) -> Personal:
    personal = db.query(Personal).filter(Personal.token_verificacao == dados.token).first()

    invalido = HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST, detail="Link de confirmação inválido ou expirado."
    )
    if personal is None or personal.token_verificacao_expira is None:
        raise invalido
    if personal.token_verificacao_expira < datetime.now(timezone.utc):
        raise invalido

    personal.email_verificado = True
    personal.token_verificacao = None
    personal.token_verificacao_expira = None
    db.commit()
    db.refresh(personal)
    return personal


@router.post("/reenviar-confirmacao", status_code=status.HTTP_204_NO_CONTENT)
def reenviar_confirmacao(
    personal: Personal = Depends(get_current_personal),
    db: Session = Depends(get_db),
) -> None:
    if personal.email_verificado:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Seu e-mail já está confirmado.")
    _enviar_confirmacao(db, personal)


@router.put("/me", response_model=PersonalOut)
def atualizar_meus_dados(
    dados: PersonalAtualizar,
    personal: Personal = Depends(get_current_personal),
    db: Session = Depends(get_db),
) -> Personal:
    for campo, valor in dados.model_dump(exclude_unset=True).items():
        setattr(personal, campo, valor)
    db.commit()
    db.refresh(personal)
    return personal


@router.post("/trocar-senha", status_code=status.HTTP_204_NO_CONTENT)
def trocar_senha(
    dados: TrocarSenhaIn,
    personal: Personal = Depends(get_current_personal),
    db: Session = Depends(get_db),
) -> None:
    if not verificar_senha(dados.senha_atual, personal.senha_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Senha atual incorreta.")
    personal.senha_hash = hash_senha(dados.senha_nova)
    db.commit()
