from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

# Mesmas métricas rastreadas em AvaliacaoFisica (peso + as 5 medidas).
Metrica = Literal["peso_kg", "cintura_cm", "quadril_cm", "braco_cm", "coxa_cm", "peito_cm"]


class MetaCriar(BaseModel):
    metrica: Metrica
    valor_alvo: float = Field(gt=0, le=500)
    data_alvo: date | None = None


class MetaProgressoOut(BaseModel):
    """Meta + todo o cálculo já pronto (percentual, marcos, se bateu) —
    pra não duplicar a mesma conta no frontend do Personal e do Aluno."""

    id: int
    metrica: str
    valor_inicial: float
    valor_atual: float | None  # None = ainda não tem avaliação com essa métrica desde a meta
    valor_alvo: float
    data_alvo: date | None
    percentual: float
    marcos: list[float]  # 2 valores intermediários entre o inicial e o alvo
    concluida: bool
    concluida_em: datetime | None
    criado_em: datetime
