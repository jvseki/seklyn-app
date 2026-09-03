from datetime import date, datetime

from pydantic import BaseModel, Field

from app.schemas.common import OrmModel
from app.schemas.meta import MetaProgressoOut


class AvaliacaoFisicaCriar(BaseModel):
    data: date | None = None  # se omitido, a rota usa a data de hoje
    peso_kg: float = Field(gt=0, le=500)
    cintura_cm: float | None = Field(default=None, gt=0, le=300)
    quadril_cm: float | None = Field(default=None, gt=0, le=300)
    braco_cm: float | None = Field(default=None, gt=0, le=100)
    coxa_cm: float | None = Field(default=None, gt=0, le=150)
    peito_cm: float | None = Field(default=None, gt=0, le=300)
    observacoes: str | None = Field(default=None, max_length=255)


class AvaliacaoFisicaOut(OrmModel):
    id: int
    data: date
    peso_kg: float | None
    cintura_cm: float | None
    quadril_cm: float | None
    braco_cm: float | None
    coxa_cm: float | None
    peito_cm: float | None
    observacoes: str | None
    criado_em: datetime


class AvaliacaoCriadaOut(BaseModel):
    """Resposta do POST /avaliacoes: a avaliação salva + quais metas
    acabaram de ser batidas com ela (pra comemorar no frontend)."""

    avaliacao: AvaliacaoFisicaOut
    metas_concluidas_agora: list[MetaProgressoOut] = []
