from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class FotoProgresso(Base):
    """
    Foto de progresso do Aluno numa data (antes/depois) — o Personal vai
    subindo aos poucos, junto ou não com uma avaliação de peso. Puramente
    visual, sem relação obrigatória com AvaliacaoFisica.
    """

    __tablename__ = "fotos_progresso"

    id: Mapped[int] = mapped_column(primary_key=True)
    aluno_id: Mapped[int] = mapped_column(ForeignKey("alunos.id", ondelete="CASCADE"), nullable=False)
    data: Mapped[date] = mapped_column(Date, nullable=False)
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    observacoes: Mapped[str | None] = mapped_column(String(255), nullable=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    aluno: Mapped["Aluno"] = relationship(back_populates="fotos_progresso")
