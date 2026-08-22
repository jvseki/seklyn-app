from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class TreinoTemplate(Base):
    """
    Modelo de treino reutilizável do Personal — "Peito e Tríceps padrão",
    por exemplo — aplicável em qualquer aluno com um clique, em vez de
    remontar tudo no assistente toda vez. dados_json guarda a mesma forma
    de exercícios/séries do MontarTreinoIn (ver schemas/treino.py), sem
    precisar de tabelas relacionais próprias — é sempre "carimbado" em
    Treino/Exercicio/Serie de verdade na hora de aplicar.
    """

    __tablename__ = "treino_templates"

    id: Mapped[int] = mapped_column(primary_key=True)
    personal_id: Mapped[int] = mapped_column(ForeignKey("personais.id", ondelete="CASCADE"), nullable=False)
    nome: Mapped[str] = mapped_column(String(120), nullable=False)
    dados_json: Mapped[dict] = mapped_column(JSONB, nullable=False)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    personal: Mapped["Personal"] = relationship()
