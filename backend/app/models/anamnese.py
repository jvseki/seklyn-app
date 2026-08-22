from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Anamnese(Base):
    """
    Ficha de avaliação inicial do Aluno — um registro só por aluno (não é
    histórico como AvaliacaoFisica), atualizado conforme muda. Dá cara de
    profissional/clínica ao cadastro, não só "app de treino".
    """

    __tablename__ = "anamneses"

    id: Mapped[int] = mapped_column(primary_key=True)
    aluno_id: Mapped[int] = mapped_column(
        ForeignKey("alunos.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    nivel_experiencia: Mapped[str | None] = mapped_column(String(20), nullable=True)  # iniciante/intermediario/avancado
    objetivo: Mapped[str | None] = mapped_column(Text, nullable=True)
    lesoes_e_limitacoes: Mapped[str | None] = mapped_column(Text, nullable=True)
    condicoes_saude: Mapped[str | None] = mapped_column(Text, nullable=True)
    observacoes: Mapped[str | None] = mapped_column(Text, nullable=True)
    atualizado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    aluno: Mapped["Aluno"] = relationship(back_populates="anamnese")
