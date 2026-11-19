from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.core.cpf import cpf_valido, formatar_cpf
from app.schemas.common import OrmModel

# ---------- vitrine (público) ----------


class ItemConteudoPublico(BaseModel):
    tipo: str
    titulo: str


class ProdutoPublicoOut(BaseModel):
    id: int
    titulo: str
    slug: str
    subtitulo: str | None = None
    descricao: str | None = None
    preco: Decimal
    capa_url: str | None = None
    nivel: str | None = None
    duracao: str | None = None
    qtd_videos: int = 0
    qtd_arquivos: int = 0
    itens: list[ItemConteudoPublico] = []  # só os títulos (o conteúdo é de quem comprou)


class LojaConfigOut(BaseModel):
    pagamento_disponivel: bool
    mp_public_key: str | None = None
    parceiro_nome: str | None = None


# ---------- conta do comprador ----------


class CompradorCriar(BaseModel):
    nome: str = Field(min_length=2, max_length=120)
    email: EmailStr
    senha: str = Field(min_length=8, max_length=100)
    cpf: str = Field(min_length=11, max_length=14)
    telefone: str | None = Field(default=None, max_length=30)

    @field_validator("cpf")
    @classmethod
    def cpf_ok(cls, valor: str) -> str:
        if not cpf_valido(valor):
            raise ValueError("CPF inválido. Confira os números.")
        return formatar_cpf(valor)


class CompradorLogin(BaseModel):
    email: EmailStr
    senha: str = Field(max_length=100)


class CompradorOut(OrmModel):
    id: int
    nome: str
    email: EmailStr
    cpf: str
    telefone: str | None = None


class CompradorTokenOut(BaseModel):
    access_token: str
    comprador: CompradorOut


class CompraOut(BaseModel):
    venda_id: int
    produto: ProdutoPublicoOut | None
    status: str  # "aguardando", "paga", "reembolsada", "expirada"
    forma_pagamento: str
    valor: Decimal
    criado_em: datetime | None = None
    paga_em: datetime | None = None


class CompraPixOut(BaseModel):
    venda_id: int
    qr_code: str
    qr_code_base64: str
    expira_em: datetime | None = None
    valor: Decimal


class CompraCartaoIn(BaseModel):
    card_token: str = Field(min_length=8, max_length=200)
    payment_method_id: str = Field(min_length=2, max_length=40)
    issuer_id: str | None = Field(default=None, max_length=20)
    documento_tipo: str | None = Field(default=None, max_length=10)
    documento_numero: str | None = Field(default=None, max_length=20)


class CompraStatusOut(BaseModel):
    venda_id: int
    status: str
    produto_id: int | None = None


class ConteudoLiberadoOut(BaseModel):
    id: int
    tipo: str
    titulo: str
    url: str | None = None  # vídeo: link assinado / embed do YouTube
    download_url: str | None = None  # arquivo: link assinado pra baixar
    nome_original: str | None = None
    tamanho_bytes: int | None = None


class ProdutoLiberadoOut(BaseModel):
    produto: ProdutoPublicoOut
    conteudos: list[ConteudoLiberadoOut]


# ---------- admin ----------


class ProdutoIn(BaseModel):
    titulo: str = Field(min_length=2, max_length=120)
    subtitulo: str | None = Field(default=None, max_length=200)
    descricao: str | None = Field(default=None, max_length=5000)
    preco: Decimal = Field(gt=0, le=100000, max_digits=10, decimal_places=2)
    nivel: str | None = Field(default=None, max_length=40)
    duracao: str | None = Field(default=None, max_length=40)
    ativo: bool = True
    ordem: int = 0


class ConteudoAdminOut(OrmModel):
    id: int
    tipo: str
    titulo: str
    nome_original: str | None = None
    tamanho_bytes: int | None = None
    url_youtube: str | None = None
    ordem: int = 0


class ProdutoAdminOut(OrmModel):
    id: int
    titulo: str
    slug: str
    subtitulo: str | None = None
    descricao: str | None = None
    preco: Decimal
    capa_url: str | None = None
    nivel: str | None = None
    duracao: str | None = None
    ativo: bool
    ordem: int
    conteudos: list[ConteudoAdminOut] = []
    vendas_pagas: int = 0


TipoConteudo = Literal["video", "arquivo", "youtube"]
