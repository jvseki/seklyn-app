"""
Reúne todos os models para que `Base.metadata` os enxergue
(necessário para o autogenerate do Alembic e para criar as tabelas).
"""
from app.models.personal import Personal
from app.models.aluno import Aluno
from app.models.treino import Treino
from app.models.exercicio import Exercicio
from app.models.serie import Serie
from app.models.execucao import Execucao
from app.models.assinatura import Assinatura
from app.models.recomendacao import RecomendacaoProduto
from app.models.avaliacao_fisica import AvaliacaoFisica
from app.models.video_exercicio import VideoExercicio
from app.models.foto_progresso import FotoProgresso
from app.models.treino_template import TreinoTemplate
from app.models.anamnese import Anamnese
from app.models.meta import Meta
from app.models.comentario_serie import ComentarioSerie

__all__ = [
    "Personal",
    "Aluno",
    "Treino",
    "Exercicio",
    "Serie",
    "Execucao",
    "Assinatura",
    "RecomendacaoProduto",
    "AvaliacaoFisica",
    "VideoExercicio",
    "FotoProgresso",
    "TreinoTemplate",
    "Anamnese",
    "Meta",
    "ComentarioSerie",
]
