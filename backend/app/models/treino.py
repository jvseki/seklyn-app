from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Treino(Base):
    """Um treino planejado pelo Personal para um Aluno (ex: 'Treino A - Peito e Tríceps')."""

    __tablename__ = "treinos"

    id: Mapped[int] = mapped_column(primary_key=True)
    aluno_id: Mapped[int] = mapped_column(ForeignKey("alunos.id", ondelete="CASCADE"), nullable=False)
    nome: Mapped[str] = mapped_column(String(120), nullable=False)
    ordem: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    aluno: Mapped["Aluno"] = relationship(back_populates="treinos")
    exercicios: Mapped[list["Exercicio"]] = relationship(
        back_populates="treino", cascade="all, delete-orphan", order_by="Exercicio.ordem"
    )
