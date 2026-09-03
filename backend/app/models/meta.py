from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Meta(Base):
    """
    Meta de evolução do Aluno numa métrica só (peso ou uma medida corporal)
    — pode ter várias ao mesmo tempo em métricas diferentes (ex: meta de
    peso E de cintura juntas), mas só uma ATIVA (concluida_em is None) por
    métrica. valor_inicial é o retrato do momento em que a meta foi criada
    (não muda depois); a direção (emagrecer/ganhar) é sempre derivada
    comparando valor_alvo com valor_inicial, nunca guardada à parte.
    Concluída automaticamente quando uma avaliação nova bate o alvo — ver
    app/services/metas.py.
    """

    __tablename__ = "metas"

    id: Mapped[int] = mapped_column(primary_key=True)
    aluno_id: Mapped[int] = mapped_column(ForeignKey("alunos.id", ondelete="CASCADE"), nullable=False)
    metrica: Mapped[str] = mapped_column(String(20), nullable=False)
    valor_inicial: Mapped[float] = mapped_column(Float, nullable=False)
    valor_alvo: Mapped[float] = mapped_column(Float, nullable=False)
    data_alvo: Mapped[date | None] = mapped_column(Date, nullable=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    concluida_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    aluno: Mapped["Aluno"] = relationship(back_populates="metas")
