from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Parceiro(Base):
    """
    Parceiro que vende produtos com o Seklyn dividindo o valor (ex: a loja do
    Douglas). Ainda em TESTE no painel admin: a venda cai na conta Mercado
    Pago do dono do Seklyn e a parte do parceiro é repassada por Pix pra
    chave dele (QR gerado na tela, o dono só confirma no app do banco).
    """

    __tablename__ = "parceiros"

    id: Mapped[int] = mapped_column(primary_key=True)
    nome: Mapped[str] = mapped_column(String(120), nullable=False)
    # "cpf", "cnpj", "celular", "email" ou "aleatoria"
    chave_pix_tipo: Mapped[str] = mapped_column(String(20), nullable=False, default="aleatoria")
    chave_pix: Mapped[str] = mapped_column(String(120), nullable=False)
    cidade: Mapped[str] = mapped_column(String(60), nullable=False, default="Andradina")
    # Quanto do valor LÍQUIDO (já sem a taxa do Mercado Pago) é do parceiro.
    # 50 = metade da venda e metade da taxa pra cada um.
    percentual_parceiro: Mapped[int] = mapped_column(Integer, nullable=False, default=50)
    # Quem paga a taxa do Mercado Pago: "parceiro" (o dono recebe a % dele
    # sobre o valor CHEIO e a taxa sai toda da parte do parceiro) ou
    # "dividida" (a % vale sobre o líquido, cada um paga sua parte da taxa).
    taxa_paga_por: Mapped[str] = mapped_column(String(20), nullable=False, default="parceiro", server_default="parceiro")
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    vendas: Mapped[list["VendaParceiro"]] = relationship(back_populates="parceiro", cascade="all, delete-orphan")


class VendaParceiro(Base):
    __tablename__ = "vendas_parceiro"

    id: Mapped[int] = mapped_column(primary_key=True)
    parceiro_id: Mapped[int] = mapped_column(ForeignKey("parceiros.id", ondelete="CASCADE"), nullable=False, index=True)
    produto: Mapped[str] = mapped_column(String(120), nullable=False)
    valor: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    # Percentual congelado no momento da venda (mudar o parceiro depois não
    # altera vendas antigas).
    percentual_parceiro: Mapped[int] = mapped_column(Integer, nullable=False)
    # Quem paga a taxa do Mercado Pago: "parceiro" (o dono recebe a % dele
    # sobre o valor CHEIO e a taxa sai toda da parte do parceiro) ou
    # "dividida" (a % vale sobre o líquido, cada um paga sua parte da taxa).
    taxa_paga_por: Mapped[str] = mapped_column(String(20), nullable=False, default="parceiro", server_default="parceiro")
    mp_pagamento_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    # "pix", "credito" ou "debito"
    forma_pagamento: Mapped[str] = mapped_column(String(20), nullable=False, default="pix", server_default="pix")
    # "aguardando" (Pix gerado), "paga", "reembolsada", "expirada"
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="aguardando")
    taxa_mp: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    parte_parceiro: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    parte_dono: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    paga_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # "pendente" até o dono confirmar que mandou o Pix pro parceiro.
    repasse_status: Mapped[str] = mapped_column(String(20), nullable=False, default="pendente")
    repassado_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    parceiro: Mapped[Parceiro] = relationship(back_populates="vendas")
