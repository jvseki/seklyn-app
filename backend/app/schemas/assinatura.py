from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field

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
    mp_public_key: str | None = None  # pro formulário de cartão (chave pública, feita pro navegador)


class AssinarCartaoIn(BaseModel):
    # Token de uso único gerado pelo Card Brick do Mercado Pago no navegador.
    card_token: str = Field(min_length=8, max_length=200)
