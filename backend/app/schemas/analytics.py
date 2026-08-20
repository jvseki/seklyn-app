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
    """Uma marcação individual — data e hora REAIS de quando o aluno clicou
    (data_marcacao/hora), separado do dia do treino a que a série pertence
    (data_treino). Os dois só divergem quando o aluno marca atrasado (ex:
    treino de segunda marcado só na terça de noite) — é isso que dá
    transparência de verdade ao personal, não só o check verde."""

    data_marcacao: date
    hora: str  # "HH:MM", já no horário de Brasília
    data_treino: date
    treino_nome: str
    exercicio_nome: str


class AnalyticsDetalhadoOut(BaseModel):
    aluno_id: int
    periodo_dias: int
    desempenho: list[PontoDesempenhoOut] = []
    execucoes_recentes: list[ExecucaoDetalheOut] = []
