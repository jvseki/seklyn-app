from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class AvaliacaoFisica(Base):
    """
    Registro histórico do peso (e observações) de um Aluno numa data —
    o Personal vai lançando aos poucos e o app mostra a evolução até a
    meta (Aluno.peso_meta_kg). Serve também como destino de uma futura
    importação de planilha de avaliações antigas.
    """

    __tablename__ = "avaliacoes_fisicas"

    id: Mapped[int] = mapped_column(primary_key=True)
    aluno_id: Mapped[int] = mapped_column(ForeignKey("alunos.id", ondelete="CASCADE"), nullable=False)
    data: Mapped[date] = mapped_column(Date, nullable=False)
    peso_kg: Mapped[float | None] = mapped_column(Float, nullable=True)
    observacoes: Mapped[str | None] = mapped_column(String(255), nullable=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    aluno: Mapped["Aluno"] = relationship(back_populates="avaliacoes")
