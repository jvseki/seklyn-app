from datetime import date, datetime

from pydantic import BaseModel, Field

from app.schemas.common import OrmModel


class AvaliacaoFisicaCriar(BaseModel):
    data: date | None = None  # se omitido, a rota usa a data de hoje
    peso_kg: float = Field(gt=0, le=500)
    observacoes: str | None = Field(default=None, max_length=255)


class AvaliacaoFisicaOut(OrmModel):
    id: int
    data: date
    peso_kg: float | None
    observacoes: str | None
    criado_em: datetime
