from datetime import date, datetime

from pydantic import BaseModel, Field

from app.schemas.common import OrmModel


class ComentarioSerieCriar(BaseModel):
    texto: str = Field(max_length=500)  # vazio = apaga o comentário do dia
    data: date | None = None  # se omitido, a rota usa hoje


class ComentarioSerieOut(OrmModel):
    id: int
    serie_id: int
    data: date
    texto: str
    criado_em: datetime


class ComentarioSerieContextoOut(ComentarioSerieOut):
    """Mesmo comentário, mas com o contexto pra listar no painel do Personal
    sem ele ter que ir série por série descobrir de quem é o quê."""

    aluno_id: int
    aluno_nome: str
    exercicio_nome: str
    treino_nome: str
