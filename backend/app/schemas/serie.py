from pydantic import BaseModel, Field

from app.schemas.common import OrmModel


class SerieCriar(BaseModel):
    ordem: int = 0
    repeticoes_alvo: str = Field(min_length=1, max_length=30)
    carga_alvo: str | None = Field(default=None, max_length=30)
    intervalo_descanso: str | None = Field(default=None, max_length=20)


class SerieAtualizar(BaseModel):
    ordem: int | None = None
    repeticoes_alvo: str | None = Field(default=None, min_length=1, max_length=30)
    carga_alvo: str | None = Field(default=None, max_length=30)
    intervalo_descanso: str | None = Field(default=None, max_length=20)


class SerieOut(OrmModel):
    id: int
    exercicio_id: int
    ordem: int
    repeticoes_alvo: str
    carga_alvo: str | None
    intervalo_descanso: str | None = None


class SerieComExecucaoOut(SerieOut):
    """Usado na visão do aluno: inclui se a série já foi concluída hoje."""

    concluida_hoje: bool = False
