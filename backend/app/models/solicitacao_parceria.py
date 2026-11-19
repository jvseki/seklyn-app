from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class SolicitacaoParceria(Base):
    """
    Personal que quer vender planilhas na loja do Seklyn. O dono recebe por
    e-mail, vê no Admin e entra em contato pra combinar a parceria (a %
    de cada um e como o dinheiro chega).
    """

    __tablename__ = "solicitacoes_parceria"

    id: Mapped[int] = mapped_column(primary_key=True)
    personal_id: Mapped[int] = mapped_column(ForeignKey("personais.id", ondelete="CASCADE"), nullable=False, index=True)
    whatsapp: Mapped[str] = mapped_column(String(30), nullable=False)
    instagram: Mapped[str | None] = mapped_column(String(80), nullable=True)
    mensagem: Mapped[str | None] = mapped_column(Text, nullable=True)  # o que pretende vender
    # "nova", "em_contato", "aprovada", "recusada"
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="nova")
    nota_admin: Mapped[str | None] = mapped_column(Text, nullable=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    atualizado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    personal = relationship("Personal")
