from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Aluno(Base):
    """
    Aluno de um Personal. Não possui login/senha: o acesso é feito
    via URL com o `hash_token` único (sem fricção).
    """

    __tablename__ = "alunos"

    id: Mapped[int] = mapped_column(primary_key=True)
    personal_id: Mapped[int] = mapped_column(ForeignKey("personais.id", ondelete="CASCADE"), nullable=False)
    nome: Mapped[str] = mapped_column(String(120), nullable=False)
    hash_token: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    personal: Mapped["Personal"] = relationship(back_populates="alunos")
    treinos: Mapped[list["Treino"]] = relationship(
        back_populates="aluno", cascade="all, delete-orphan", order_by="Treino.ordem"
    )
    execucoes: Mapped[list["Execucao"]] = relationship(back_populates="aluno", cascade="all, delete-orphan")
