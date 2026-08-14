from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Assinatura(Base):
    """
    Assinatura Stripe do Personal (1:1). `status` espelha o status da
    subscription no Stripe (trialing, active, past_due, canceled, etc).
    """

    __tablename__ = "assinaturas"

    id: Mapped[int] = mapped_column(primary_key=True)
    personal_id: Mapped[int] = mapped_column(
        ForeignKey("personais.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    stripe_customer_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    stripe_subscription_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
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
