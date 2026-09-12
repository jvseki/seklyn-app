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
    # Dia da semana fixo desse treino (segunda..domingo), ou None se não tiver dia fixo.
    dia_semana: Mapped[str | None] = mapped_column(String(10), nullable=True)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    # Quando o aluno abriu esse treino pela primeira vez (link de acesso dele).
    # Nunca sobrescrito depois de definido — ver detalhe_treino_aluno() em api/routes/aluno.py.
    visualizado_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Última vez que o e-mail de "treino atualizado" foi disparado pro aluno —
    # só controla o throttle de envio (não aparece pro Personal), ver
    # _notificar_aluno_treino_atualizado() em api/routes/personal.py.
    notificado_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    aluno: Mapped["Aluno"] = relationship(back_populates="treinos")
    exercicios: Mapped[list["Exercicio"]] = relationship(
        back_populates="treino", cascade="all, delete-orphan", order_by="Exercicio.ordem"
    )
