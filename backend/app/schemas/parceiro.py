from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import OrmModel

TipoChave = Literal["cpf", "cnpj", "celular", "email", "aleatoria"]


class ParceiroIn(BaseModel):
    nome: str = Field(min_length=2, max_length=120)
    chave_pix_tipo: TipoChave
    chave_pix: str = Field(min_length=3, max_length=120)
    cidade: str = Field(default="Andradina", min_length=2, max_length=60)
    percentual_parceiro: int = Field(default=50, ge=0, le=100)


class ParceiroOut(OrmModel):
    id: int
    nome: str
    chave_pix_tipo: str
    chave_pix: str
    cidade: str
    percentual_parceiro: int


class VendaIn(BaseModel):
    produto: str = Field(min_length=2, max_length=120)
    valor: Decimal = Field(gt=0, le=100000, max_digits=10, decimal_places=2)
    # Quem paga (o Mercado Pago exige um e-mail; não pode ser o da conta dona).
    email_pagador: str = Field(min_length=5, max_length=120, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class VendaOut(OrmModel):
    id: int
    produto: str
    valor: Decimal
    percentual_parceiro: int
    status: str
    taxa_mp: Decimal | None = None
    parte_parceiro: Decimal | None = None
    parte_dono: Decimal | None = None
    repasse_status: str
    criado_em: datetime | None = None
    paga_em: datetime | None = None
    repassado_em: datetime | None = None


class VendaCriadaOut(BaseModel):
    venda: VendaOut
    pix_qr_code: str
    pix_qr_code_base64: str
    pix_expira_em: datetime | None = None


class PainelParceiroOut(BaseModel):
    parceiro: ParceiroOut | None
    vendas: list[VendaOut]
    total_vendido: Decimal
    total_taxas: Decimal
    a_repassar: Decimal  # parte do parceiro em vendas pagas ainda não repassadas
    ja_repassado: Decimal
    liquido_dono: Decimal
    taxa_pix_estimada: float  # pra simular a divisão antes de vender


class RepasseOut(BaseModel):
    pix_copia_e_cola: str
    valor: Decimal
    chave: str
    nome: str
