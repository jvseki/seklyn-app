from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.schemas.common import OrmModel


class PersonalCriar(BaseModel):
    nome: str = Field(min_length=2, max_length=120)
    email: EmailStr
    senha: str = Field(min_length=8, max_length=100)
    telefone: str | None = Field(default=None, max_length=30)


class PersonalLogin(BaseModel):
    email: EmailStr
    senha: str


class PersonalAtualizar(BaseModel):
    nome: str | None = Field(default=None, min_length=2, max_length=120)
    telefone: str | None = Field(default=None, max_length=30)
    cpf: str | None = Field(default=None, max_length=14)
    endereco: str | None = Field(default=None, max_length=200)
    numero: str | None = Field(default=None, max_length=20)


class TrocarSenhaIn(BaseModel):
    senha_atual: str
    senha_nova: str = Field(min_length=8, max_length=100)


class PersonalOut(OrmModel):
    id: int
    nome: str
    email: EmailStr
    telefone: str | None
    cpf: str | None
    endereco: str | None
    numero: str | None
    email_verificado: bool
    tema_personalizado: str | None
    is_admin: bool
    criado_em: datetime


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    personal: PersonalOut


class ConfirmarEmailIn(BaseModel):
    token: str
