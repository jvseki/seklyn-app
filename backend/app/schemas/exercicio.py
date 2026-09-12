from pydantic import BaseModel, Field

from app.schemas.common import OrmModel
from app.schemas.serie import SerieComExecucaoOut, SerieOut
from app.schemas.video_exercicio import VideoExercicioOut


class ExercicioCriar(BaseModel):
    nome: str = Field(min_length=1, max_length=120)
    ordem: int = 0
    observacoes: str | None = None
    categoria: str | None = Field(default=None, max_length=30)
    video_exercicio_id: int | None = None


class ExercicioAtualizar(BaseModel):
    nome: str | None = Field(default=None, min_length=1, max_length=120)
    ordem: int | None = None
    observacoes: str | None = None
    categoria: str | None = Field(default=None, max_length=30)
    video_exercicio_id: int | None = None


class ReordenarExerciciosIn(BaseModel):
    """IDs de todos os exercícios do treino, na nova ordem (arrastados no
    front com SortableJS) — precisa conter exatamente os mesmos IDs que o
    treino já tem, só que reordenados."""

    exercicio_ids: list[int] = Field(min_length=1)


class ExercicioOut(OrmModel):
    id: int
    treino_id: int
    nome: str
    ordem: int
    observacoes: str | None
    categoria: str | None = None
    series: list[SerieOut] = []
    video: VideoExercicioOut | None = None


class ExercicioComProgressoOut(OrmModel):
    """Usado na visão do aluno: exercício + suas séries com status do dia."""

    id: int
    nome: str
    observacoes: str | None
    categoria: str | None = None
    series: list[SerieComExecucaoOut] = []
    concluido_hoje: bool = False
    video: VideoExercicioOut | None = None
