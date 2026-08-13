from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class RecomendacaoProduto(Base):
    """
    Link de afiliado cadastrado pelo Personal (Amazon, Growth, etc.).
    Aparece para o Aluno como 'Dicas do seu Personal', em aba separada
    e não-invasiva (não interrompe o fluxo do treino).
    """

    __tablename__ = "recomendacoes_produtos"

    id: Mapped[int] = mapped_column(primary_key=True)
    personal_id: Mapped[int] = mapped_column(ForeignKey("personais.id", ondelete="CASCADE"), nullable=False)
    titulo: Mapped[str] = mapped_column(String(150), nullable=False)
    descricao: Mapped[str | None] = mapped_column(Text, nullable=True)
    url_afiliado: Mapped[str] = mapped_column(String(500), nullable=False)
    categoria: Mapped[str | None] = mapped_column(String(60), nullable=True)  # suplemento, equipamento, roupa...
    ordem: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    personal: Mapped["Personal"] = relationship(back_populates="recomendacoes")
