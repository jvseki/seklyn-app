from datetime import date, datetime

from pydantic import BaseModel

from app.schemas.common import OrmModel


class FotoProgressoOut(OrmModel):
    id: int
    data: date
    url: str
    observacoes: str | None
    criado_em: datetime
