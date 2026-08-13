from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.common import OrmModel


class RecomendacaoCriar(BaseModel):
    titulo: str = Field(min_length=1, max_length=150)
    descricao: str | None = None
    url_afiliado: str = Field(min_length=3, max_length=500)
    categoria: str | None = Field(default=None, max_length=60)
    ordem: int = 0


class RecomendacaoAtualizar(BaseModel):
    titulo: str | None = Field(default=None, min_length=1, max_length=150)
    descricao: str | None = None
    url_afiliado: str | None = Field(default=None, min_length=3, max_length=500)
    categoria: str | None = Field(default=None, max_length=60)
    ordem: int | None = None
    ativo: bool | None = None


class RecomendacaoOut(OrmModel):
    id: int
    titulo: str
    descricao: str | None
    url_afiliado: str
    categoria: str | None
    ordem: int
    ativo: bool
    criado_em: datetime
