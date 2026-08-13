from datetime import datetime

from pydantic import BaseModel

from app.schemas.common import OrmModel


class AssinaturaOut(OrmModel):
    status: str
    ativa: bool
    current_period_end: datetime | None


class CheckoutSessionOut(BaseModel):
    checkout_url: str
