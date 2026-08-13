from datetime import date, datetime

from pydantic import BaseModel

from app.schemas.common import OrmModel


class ExecucaoCriar(BaseModel):
    """Corpo opcional ao marcar uma série como executada."""

    repeticoes_realizadas: int | None = None
    carga_realizada: str | None = None


class ExecucaoOut(OrmModel):
    id: int
    serie_id: int
    data_execucao: date
    concluida: bool
    repeticoes_realizadas: int | None
    carga_realizada: str | None
    criado_em: datetime


class ExecucaoToggleOut(BaseModel):
    """Resposta do toggle: estado atual da série + progresso recalculado do treino."""

    serie_id: int
    concluida_hoje: bool
    treino_progresso_percentual: float
    treino_concluido_hoje: bool
