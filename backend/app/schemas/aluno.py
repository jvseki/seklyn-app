from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.schemas.common import OrmModel
from app.schemas.treino import DiaSemanaAlunoOut


class AlunoCriar(BaseModel):
    nome: str = Field(min_length=2, max_length=120)
    email: EmailStr | None = None
    telefone: str | None = Field(default=None, max_length=30)
    cpf: str | None = Field(default=None, max_length=14)


class AlunoAtualizar(BaseModel):
    nome: str | None = Field(default=None, min_length=2, max_length=120)
    email: EmailStr | None = None
    telefone: str | None = Field(default=None, max_length=30)
    cpf: str | None = Field(default=None, max_length=14)
    peso_meta_kg: float | None = None
    ativo: bool | None = None


class AlunoOut(OrmModel):
    id: int
    nome: str
    email: EmailStr | None
    telefone: str | None
    cpf: str | None
    peso_meta_kg: float | None
    hash_token: str
    ativo: bool
    criado_em: datetime
    link_acesso: str = ""  # preenchido na rota (depende do FRONTEND_URL)


class AlunoPublicoOut(BaseModel):
    """O que o próprio aluno vê sobre si mesmo (rota pública via hash_token)."""

    id: int
    nome: str
    personal_nome: str
    personal_tema: str | None = None


class AlunoPainelOut(BaseModel):
    """Painel inicial do aluno: dados básicos + os 7 dias da semana atual, com data real."""

    aluno: AlunoPublicoOut
    semana: list[DiaSemanaAlunoOut] = []
