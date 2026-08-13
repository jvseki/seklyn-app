from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Execucao(Base):
    """
    Log individual de uma série executada pelo aluno em um dia específico.
    É a fonte de verdade para a lógica hierárquica de conclusão
    (Série -> Exercício -> Treino) e para os analytics de aderência.

    No máximo um registro por (serie_id, data_execucao): marcar/desmarcar
    a série no dia cria ou remove essa linha.
    """

    __tablename__ = "execucoes"
    __table_args__ = (UniqueConstraint("serie_id", "data_execucao", name="uq_execucao_serie_dia"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    serie_id: Mapped[int] = mapped_column(ForeignKey("series.id", ondelete="CASCADE"), nullable=False)
    aluno_id: Mapped[int] = mapped_column(ForeignKey("alunos.id", ondelete="CASCADE"), nullable=False)
    data_execucao: Mapped[date] = mapped_column(Date, nullable=False)
    concluida: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    repeticoes_realizadas: Mapped[int | None] = mapped_column(Integer, nullable=True)
    carga_realizada: Mapped[str | None] = mapped_column(String(30), nullable=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    serie: Mapped["Serie"] = relationship(back_populates="execucoes")
    aluno: Mapped["Aluno"] = relationship(back_populates="execucoes")
