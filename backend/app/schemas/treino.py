from datetime import date, datetime
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


class SerieRapidaIn(BaseModel):
    # Mesmo limite de SerieCriar — dá espaço pra notas de técnica avançada
    # tipo "Cluster set 4x 2+2+2+2+2" (30 chars estourava fácil).
    repeticoes_alvo: str = Field(min_length=1, max_length=60)
    carga_alvo: str | None = Field(default=None, max_length=60)
    intervalo_descanso: str | None = Field(default=None, max_length=20)


class ExercicioRapidoIn(BaseModel):
    nome: str = Field(min_length=1, max_length=120)
    series: list[SerieRapidaIn] = Field(min_length=1)
    video_exercicio_id: int | None = None
    observacoes: str | None = Field(default=None, max_length=500)


class MontarTreinoIn(BaseModel):
    """
    Cria (ou substitui) o treino de um dia da semana inteiro numa tacada só —
    usado pelo montador assistido por categoria, pra não precisar de uma
    chamada de API por exercício/série (lento e arriscado de ficar pela metade).
    """

    nome: str = Field(min_length=1, max_length=120)
    ordem: int = 0
    dia_semana: DiaSemana | None = None
    exercicios: list[ExercicioRapidoIn] = Field(min_length=1)


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


class DiaSemanaAlunoOut(BaseModel):
    """Um dos 7 dias da semana atual do aluno, com data real e status daquele dia."""

    data: date
    dia_semana: str
    hoje: bool
    treino_id: int | None = None
    treino_nome: str | None = None
    total_series: int = 0
    series_concluidas: int = 0
    progresso_percentual: float = 0.0
    concluido: bool = False
