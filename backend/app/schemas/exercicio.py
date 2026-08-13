from pydantic import BaseModel, Field

from app.schemas.common import OrmModel
from app.schemas.serie import SerieComExecucaoOut, SerieOut


class ExercicioCriar(BaseModel):
    nome: str = Field(min_length=1, max_length=120)
    ordem: int = 0
    observacoes: str | None = None


class ExercicioAtualizar(BaseModel):
    nome: str | None = Field(default=None, min_length=1, max_length=120)
    ordem: int | None = None
    observacoes: str | None = None


class ExercicioOut(OrmModel):
    id: int
    treino_id: int
    nome: str
    ordem: int
    observacoes: str | None
    series: list[SerieOut] = []


class ExercicioComProgressoOut(OrmModel):
    """Usado na visão do aluno: exercício + suas séries com status do dia."""

    id: int
    nome: str
    observacoes: str | None
    series: list[SerieComExecucaoOut] = []
    concluido_hoje: bool = False
