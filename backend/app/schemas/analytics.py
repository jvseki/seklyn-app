from datetime import date

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


class PontoDesempenhoOut(BaseModel):
    """Um dia no gráfico de desempenho: % do treino daquele dia concluído."""

    data: date
    percentual: float
    suspeito: bool = False  # muitas séries marcadas numa janela curta de tempo


class ExecucaoDetalheOut(BaseModel):
    """Uma marcação individual, com hora real — pra dar transparência ao personal."""

    data: date
    hora: str  # "HH:MM", já no horário de Brasília
    treino_nome: str
    exercicio_nome: str


class AnalyticsDetalhadoOut(BaseModel):
    aluno_id: int
    periodo_dias: int
    desempenho: list[PontoDesempenhoOut] = []
    execucoes_recentes: list[ExecucaoDetalheOut] = []
