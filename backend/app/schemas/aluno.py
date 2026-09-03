from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.schemas.avaliacao_fisica import AvaliacaoFisicaOut
from app.schemas.common import OrmModel
from app.schemas.foto_progresso import FotoProgressoOut
from app.schemas.meta import MetaProgressoOut
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
    endereco: str | None = Field(default=None, max_length=200)
    numero: str | None = Field(default=None, max_length=20)
    ativo: bool | None = None


class AlunoOut(OrmModel):
    id: int
    nome: str
    email: EmailStr | None
    telefone: str | None
    cpf: str | None
    endereco: str | None
    numero: str | None
    hash_token: str
    ativo: bool
    criado_em: datetime
    link_acesso: str = ""  # preenchido na rota (depende do FRONTEND_URL)
    dias_sem_treinar: int | None = None  # None = nunca marcou nenhuma série; preenchido na rota


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
    streak_atual: int = 0  # dias seguidos com o treino do dia concluído


class AlunoProgressoOut(BaseModel):
    """Aba 'Progresso' do aluno — só leitura, quem registra continua sendo
    o Personal; o aluno só acompanha peso/medidas, metas e fotos."""

    avaliacoes: list[AvaliacaoFisicaOut] = []
    fotos: list[FotoProgressoOut] = []
    metas: list[MetaProgressoOut] = []
