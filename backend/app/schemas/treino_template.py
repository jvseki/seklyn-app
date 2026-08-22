from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.common import OrmModel
from app.schemas.treino import DiaSemana, SerieRapidaIn


class TreinoTemplateExercicioIn(BaseModel):
    nome: str = Field(min_length=1, max_length=120)
    categoria: str | None = Field(default=None, max_length=30)
    observacoes: str | None = Field(default=None, max_length=500)
    series: list[SerieRapidaIn] = Field(min_length=1)


class TreinoTemplateCriar(BaseModel):
    nome: str = Field(min_length=1, max_length=120)
    exercicios: list[TreinoTemplateExercicioIn] = Field(min_length=1)


class TreinoTemplateOut(OrmModel):
    id: int
    nome: str
    dados_json: dict
    criado_em: datetime


class AplicarTemplateIn(BaseModel):
    dia_semana: DiaSemana
    nome_treino: str | None = Field(default=None, max_length=120)  # se omitido, usa o nome do template
