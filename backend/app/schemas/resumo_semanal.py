from pydantic import BaseModel


class ResumoSemanalOut(BaseModel):
    """Digest pro topo do dashboard — o que merece atenção essa semana,
    sem precisar abrir aluno por aluno pra descobrir."""

    alunos_sumidos: int
    metas_concluidas_na_semana: int
    aderencia_media_percentual: float
    comentarios_novos_na_semana: int
