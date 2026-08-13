from pydantic import BaseModel


class ExercicioPuladoOut(BaseModel):
    exercicio_id: int
    exercicio_nome: str
    treino_nome: str
    vezes_planejado: int
    vezes_concluido: int
    percentual_aderencia: float


class AderenciaOut(BaseModel):
    aluno_id: int
    periodo_dias: int
    percentual_geral_aderencia: float
    dias_com_algum_treino: int
    exercicios_mais_pulados: list[ExercicioPuladoOut] = []
