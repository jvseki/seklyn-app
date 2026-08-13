from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.schemas.common import OrmModel
from app.schemas.treino import TreinoResumoOut


class AlunoCriar(BaseModel):
    nome: str = Field(min_length=2, max_length=120)
    email: EmailStr | None = None


class AlunoAtualizar(BaseModel):
    nome: str | None = Field(default=None, min_length=2, max_length=120)
    email: EmailStr | None = None
    ativo: bool | None = None


class AlunoOut(OrmModel):
    id: int
    nome: str
    email: EmailStr | None
    hash_token: str
    ativo: bool
    criado_em: datetime
    link_acesso: str = ""  # preenchido na rota (depende do FRONTEND_URL)


class AlunoPublicoOut(BaseModel):
    """O que o próprio aluno vê sobre si mesmo (rota pública via hash_token)."""

    id: int
    nome: str
    personal_nome: str


class AlunoPainelOut(BaseModel):
    """Painel inicial do aluno: dados básicos + lista de treinos com progresso do dia."""

    aluno: AlunoPublicoOut
    treinos: list[TreinoResumoOut] = []
