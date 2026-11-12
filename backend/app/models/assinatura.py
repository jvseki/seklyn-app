from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, false, func
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
    # Como o Personal paga: "credito" = cobrança automática todo mês
    # (preapproval); "debito" / "pix" = paga um mês por vez e o acesso vence
    # em current_period_end se não pagar de novo; None = ativada pelo admin.
    forma_pagamento: Mapped[str | None] = mapped_column(String(20), nullable=True)
    # Último pagamento aprovado (id do pagamento no Mercado Pago) — é o que
    # dá pra reembolsar dentro da janela de settings.reembolso_horas.
    ultimo_pagamento_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    ultimo_pagamento_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Pix gerado (ou débito em análise) esperando confirmação.
    pagamento_pendente_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    # Cancelou depois da janela de reembolso: não renova, mas continua ativa
    # até current_period_end.
    cancelamento_agendado: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false(), nullable=False)
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
    def vence_sozinha(self) -> bool:
        """Pix/débito, ou cancelada com acesso até o fim do mês: o acesso
        acaba em current_period_end se nada for pago."""
        return self.forma_pagamento in ("debito", "pix") or self.cancelamento_agendado

    @property
    def fim_do_periodo(self) -> datetime | None:
        fim = self.current_period_end
        if fim is not None and fim.tzinfo is None:
            fim = fim.replace(tzinfo=timezone.utc)
        return fim

    @property
    def vencida(self) -> bool:
        if self.status not in ("active", "trialing") or not self.vence_sozinha:
            return False
        fim = self.fim_do_periodo
        return fim is not None and fim <= datetime.now(timezone.utc)

    @property
    def ativa(self) -> bool:
        return self.status in ("active", "trialing") and not self.vencida
