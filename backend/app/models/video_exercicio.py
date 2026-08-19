from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class VideoExercicio(Base):
    """
    Vídeo demonstrativo de um exercício, salvo pelo NOME (normalizado) —
    reusável entre todos os alunos desse Personal, sem precisar subir/colar
    o mesmo vídeo de novo pra cada aluno que fizer o mesmo exercício.
    """

    __tablename__ = "videos_exercicio"
    __table_args__ = (UniqueConstraint("personal_id", "nome_normalizado", name="uq_video_personal_nome"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    personal_id: Mapped[int] = mapped_column(ForeignKey("personais.id", ondelete="CASCADE"), nullable=False)
    nome_exercicio: Mapped[str] = mapped_column(String(120), nullable=False)
    nome_normalizado: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    tipo: Mapped[str] = mapped_column(String(10), nullable=False)  # "upload" | "youtube"
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    personal: Mapped["Personal"] = relationship()
