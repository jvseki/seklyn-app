from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Comprador(Base):
    """
    Aluno que compra planilhas de treino na loja pública
    (seklyn.com.br/planilha-de-treino). Conta separada da do Personal: só
    compra e acessa o que comprou (vídeos e arquivos).
    """

    __tablename__ = "compradores"

    id: Mapped[int] = mapped_column(primary_key=True)
    nome: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    senha_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    cpf: Mapped[str] = mapped_column(String(14), nullable=False)
    telefone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Produto(Base):
    """Planilha/programa de treino vendido na loja (cadastrado no Admin)."""

    __tablename__ = "produtos"

    id: Mapped[int] = mapped_column(primary_key=True)
    parceiro_id: Mapped[int] = mapped_column(ForeignKey("parceiros.id", ondelete="CASCADE"), nullable=False, index=True)
    titulo: Mapped[str] = mapped_column(String(120), nullable=False)
    slug: Mapped[str] = mapped_column(String(140), unique=True, index=True, nullable=False)
    subtitulo: Mapped[str | None] = mapped_column(String(200), nullable=True)
    descricao: Mapped[str | None] = mapped_column(Text, nullable=True)
    preco: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    # Imagem de capa (pública): /uploads/fotos/produtos/<arquivo>
    capa_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    nivel: Mapped[str | None] = mapped_column(String(40), nullable=True)  # ex: "Iniciante", "Intermediário"
    duracao: Mapped[str | None] = mapped_column(String(40), nullable=True)  # ex: "8 semanas"
    ativo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    ordem: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    conteudos: Mapped[list["ConteudoProduto"]] = relationship(
        back_populates="produto", cascade="all, delete-orphan", order_by="ConteudoProduto.ordem"
    )


class ConteudoProduto(Base):
    """
    O que o aluno recebe ao comprar: vídeo (enviado ou do YouTube) ou
    arquivo pra baixar (PDF, planilha). Arquivos ficam em pasta PRIVADA
    (uploads/privado/...), servidos só com link assinado pra quem comprou.
    """

    __tablename__ = "conteudos_produto"

    id: Mapped[int] = mapped_column(primary_key=True)
    produto_id: Mapped[int] = mapped_column(ForeignKey("produtos.id", ondelete="CASCADE"), nullable=False, index=True)
    tipo: Mapped[str] = mapped_column(String(20), nullable=False)  # "video", "arquivo", "youtube"
    titulo: Mapped[str] = mapped_column(String(160), nullable=False)
    caminho: Mapped[str | None] = mapped_column(String(255), nullable=True)  # arquivo privado no disco
    nome_original: Mapped[str | None] = mapped_column(String(200), nullable=True)
    tamanho_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    url_youtube: Mapped[str | None] = mapped_column(String(255), nullable=True)
    ordem: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    produto: Mapped[Produto] = relationship(back_populates="conteudos")
