from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Exercicio(Base):
    """Um exercício dentro de um treino (ex: 'Supino reto')."""

    __tablename__ = "exercicios"

    id: Mapped[int] = mapped_column(primary_key=True)
    treino_id: Mapped[int] = mapped_column(ForeignKey("treinos.id", ondelete="CASCADE"), nullable=False)
    nome: Mapped[str] = mapped_column(String(120), nullable=False)
    ordem: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    observacoes: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Vídeo demonstrativo (reusado de outros alunos com o mesmo exercício,
    # ou anexado na hora) — None = sem vídeo, o normal.
    video_exercicio_id: Mapped[int | None] = mapped_column(
        ForeignKey("videos_exercicio.id", ondelete="SET NULL"), nullable=True
    )

    treino: Mapped["Treino"] = relationship(back_populates="exercicios")
    series: Mapped[list["Serie"]] = relationship(
        back_populates="exercicio", cascade="all, delete-orphan", order_by="Serie.ordem"
    )
    video: Mapped["VideoExercicio | None"] = relationship()
