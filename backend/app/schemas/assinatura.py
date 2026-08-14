from datetime import datetime

from pydantic import BaseModel

from app.schemas.common import OrmModel


class AssinaturaOut(OrmModel):
    status: str
    ativa: bool
    current_period_end: datetime | None
    limite_alunos: int | None = None
    alunos_cadastrados: int = 0


class CheckoutSessionOut(BaseModel):
    checkout_url: str
