from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Personal(Base):
    """O Personal Trainer: usuário pagante que gerencia alunos e treinos."""

    __tablename__ = "personais"

    id: Mapped[int] = mapped_column(primary_key=True)
    nome: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    senha_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    telefone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Confirmação de e-mail (a conta funciona normalmente antes de confirmar,
    # igual ao fluxo do v1 — a confirmação só fica pendente).
    email_verificado: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    token_verificacao: Mapped[str | None] = mapped_column(String(64), nullable=True)
    token_verificacao_expira: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    alunos: Mapped[list["Aluno"]] = relationship(back_populates="personal", cascade="all, delete-orphan")
    assinatura: Mapped["Assinatura | None"] = relationship(
        back_populates="personal", uselist=False, cascade="all, delete-orphan"
    )
    recomendacoes: Mapped[list["RecomendacaoProduto"]] = relationship(
        back_populates="personal", cascade="all, delete-orphan"
    )
