from datetime import datetime
from typing import Literal

from app.schemas.common import OrmModel


class VideoExercicioOut(OrmModel):
    id: int
    nome_exercicio: str
    tipo: Literal["upload", "youtube"]
    url: str
    criado_em: datetime
