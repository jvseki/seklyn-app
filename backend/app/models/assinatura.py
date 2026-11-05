from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Assinatura(Base):
    """
    Assinatura do Personal (1:1), cobrada todo mês no cartão via Mercado Pago
    (preapproval) — ou ativada manualmente pelo admin, pra exceções.

    `status`: "active" / "trialing" liberam o uso; "pendente" = checkout
    iniciado e ainda sem cartão aprovado; "past_due" = cobrança recusada ou
    pausada; "canceled" / "inativa" bloqueiam. Ver
    services/mercadopago_service.py pro mapeamento a partir do Mercado Pago.
    """

    __tablename__ = "assinaturas"

    id: Mapped[int] = mapped_column(primary_key=True)
    personal_id: Mapped[int] = mapped_column(
        ForeignKey("personais.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    # Valor da mensalidade negociado com esse Personal (definido no admin).
    # None = ainda não combinado — o Personal não consegue assinar sozinho.
    valor_mensal: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    mp_preapproval_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(30), default="inativa", nullable=False)
    current_period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Quantos alunos esse Personal pode cadastrar no plano dele. None = sem limite
    # (ex: contas antigas/de teste). Definido manualmente pelo admin na ativação,
    # já que o preço/plano ainda é negociado individualmente por fora do site.
    limite_alunos: Mapped[int | None] = mapped_column(Integer, nullable=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    atualizado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    personal: Mapped["Personal"] = relationship(back_populates="assinatura")

    @property
    def ativa(self) -> bool:
        return self.status in ("active", "trialing")
