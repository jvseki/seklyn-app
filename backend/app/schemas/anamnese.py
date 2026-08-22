from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.common import OrmModel

NivelExperiencia = str  # "iniciante" | "intermediario" | "avancado" — validado só no frontend (select fechado)


class AnamneseAtualizar(BaseModel):
    nivel_experiencia: str | None = Field(default=None, max_length=20)
    objetivo: str | None = Field(default=None, max_length=1000)
    lesoes_e_limitacoes: str | None = Field(default=None, max_length=1000)
    condicoes_saude: str | None = Field(default=None, max_length=1000)
    observacoes: str | None = Field(default=None, max_length=1000)


class AnamneseOut(OrmModel):
    nivel_experiencia: str | None
    objetivo: str | None
    lesoes_e_limitacoes: str | None
    condicoes_saude: str | None
    observacoes: str | None
    atualizado_em: datetime
