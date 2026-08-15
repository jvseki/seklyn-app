from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Serie(Base):
    """
    Uma série planejada de um exercício (o 'plano'). O que de fato foi
    executado pelo aluno fica registrado em `Execucao`.
    """

    __tablename__ = "series"

    id: Mapped[int] = mapped_column(primary_key=True)
    exercicio_id: Mapped[int] = mapped_column(ForeignKey("exercicios.id", ondelete="CASCADE"), nullable=False)
    ordem: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    repeticoes_alvo: Mapped[str] = mapped_column(String(60), nullable=False)  # ex: "12", "10-12" ou uma nota de técnica
    carga_alvo: Mapped[str | None] = mapped_column(String(60), nullable=True)  # ex: "20kg"
    intervalo_descanso: Mapped[str | None] = mapped_column(String(20), nullable=True)  # ex: "60s", "2min"

    exercicio: Mapped["Exercicio"] = relationship(back_populates="series")
    execucoes: Mapped[list["Execucao"]] = relationship(back_populates="serie", cascade="all, delete-orphan")
