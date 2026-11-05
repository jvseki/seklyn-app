from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel

from app.schemas.common import OrmModel


class AssinaturaOut(OrmModel):
    status: str
    ativa: bool
    current_period_end: datetime | None
    limite_alunos: int | None = None
    alunos_cadastrados: int = 0
    valor_mensal: Decimal | None = None
    automatica: bool = False  # True = cobrada no cartão pelo Mercado Pago; False = manual/nenhuma
    pagamento_disponivel: bool = False  # Mercado Pago configurado no servidor


class CheckoutSessionOut(BaseModel):
    checkout_url: str
