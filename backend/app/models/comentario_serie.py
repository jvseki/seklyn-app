from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class ComentarioSerie(Base):
    """
    Nota que o Aluno deixa numa série num dia específico (ex: "doeu o
    joelho aqui") — independente de ter marcado a série como feita ou não,
    fecha um canal de feedback direto sem precisar de WhatsApp. No máximo
    um comentário por (série, dia) — comentar de novo no mesmo dia
    substitui o anterior, igual o toggle de execução.
    """

    __tablename__ = "comentarios_serie"
    __table_args__ = (UniqueConstraint("serie_id", "data", name="uq_comentario_serie_dia"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    serie_id: Mapped[int] = mapped_column(ForeignKey("series.id", ondelete="CASCADE"), nullable=False)
    aluno_id: Mapped[int] = mapped_column(ForeignKey("alunos.id", ondelete="CASCADE"), nullable=False)
    data: Mapped[date] = mapped_column(Date, nullable=False)
    texto: Mapped[str] = mapped_column(String(500), nullable=False)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    serie: Mapped["Serie"] = relationship()
    aluno: Mapped["Aluno"] = relationship()
