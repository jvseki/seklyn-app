from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import OrmModel
from app.schemas.exercicio import ExercicioComProgressoOut, ExercicioOut

DiaSemana = Literal["segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo"]


class TreinoCriar(BaseModel):
    nome: str = Field(min_length=1, max_length=120)
    ordem: int = 0
    dia_semana: DiaSemana | None = None


class TreinoAtualizar(BaseModel):
    nome: str | None = Field(default=None, min_length=1, max_length=120)
    ordem: int | None = None
    dia_semana: DiaSemana | None = None
    ativo: bool | None = None


class TreinoOut(OrmModel):
    id: int
    aluno_id: int
    nome: str
    ordem: int
    dia_semana: str | None
    ativo: bool
    criado_em: datetime
    exercicios: list[ExercicioOut] = []


class TreinoResumoOut(BaseModel):
    """Card resumido do treino para a lista inicial do aluno."""

    id: int
    nome: str
    ordem: int
    dia_semana: str | None = None
    total_series: int
    series_concluidas_hoje: int
    progresso_percentual: float
    concluido_hoje: bool


class TreinoDetalheOut(BaseModel):
    """Detalhe do treino com todos os exercícios/séries + status do dia, para execução."""

    id: int
    nome: str
    dia_semana: str | None = None
    exercicios: list[ExercicioComProgressoOut] = []
    progresso_percentual: float
    concluido_hoje: bool
