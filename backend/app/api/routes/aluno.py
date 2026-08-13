"""
Rotas públicas do Aluno: protegidas apenas pelo `hash_token` na URL,
sem exigir login/senha (acesso via link único, sem fricção).
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.deps import get_aluno_por_hash_token
from app.models.aluno import Aluno
from app.models.exercicio import Exercicio
from app.models.recomendacao import RecomendacaoProduto
from app.models.serie import Serie
from app.models.treino import Treino
from app.schemas.aluno import AlunoPainelOut, AlunoPublicoOut
from app.schemas.execucao import ExecucaoToggleOut
from app.schemas.recomendacao import RecomendacaoOut
from app.schemas.treino import TreinoDetalheOut
from app.services.progresso import alternar_execucao_serie, montar_treino_detalhe, montar_treino_resumo

router = APIRouter(prefix="/api/aluno", tags=["Aluno"])


@router.get("/{hash_token}", response_model=AlunoPainelOut)
def painel_aluno(
    aluno: Aluno = Depends(get_aluno_por_hash_token),
    db: Session = Depends(get_db),
) -> AlunoPainelOut:
    treinos = (
        db.query(Treino)
        .options(joinedload(Treino.exercicios).joinedload(Exercicio.series))
        .filter(Treino.aluno_id == aluno.id, Treino.ativo.is_(True))
        .order_by(Treino.ordem)
        .all()
    )
    return AlunoPainelOut(
        aluno=AlunoPublicoOut(id=aluno.id, nome=aluno.nome, personal_nome=aluno.personal.nome),
        treinos=[montar_treino_resumo(db, t) for t in treinos],
    )


@router.get("/{hash_token}/treinos/{treino_id}", response_model=TreinoDetalheOut)
def detalhe_treino_aluno(
    treino_id: int,
    aluno: Aluno = Depends(get_aluno_por_hash_token),
    db: Session = Depends(get_db),
) -> TreinoDetalheOut:
    treino = (
        db.query(Treino)
        .options(joinedload(Treino.exercicios).joinedload(Exercicio.series))
        .filter(Treino.id == treino_id, Treino.aluno_id == aluno.id)
        .first()
    )
    if treino is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Treino não encontrado.")
    return montar_treino_detalhe(db, treino)


@router.post("/{hash_token}/series/{serie_id}/executar", response_model=ExecucaoToggleOut)
def executar_serie(
    serie_id: int,
    aluno: Aluno = Depends(get_aluno_por_hash_token),
    db: Session = Depends(get_db),
) -> ExecucaoToggleOut:
    """Alterna (marca/desmarca) a conclusão de uma série do dia."""
    serie = (
        db.query(Serie)
        .join(Exercicio, Serie.exercicio_id == Exercicio.id)
        .join(Treino, Exercicio.treino_id == Treino.id)
        .filter(Serie.id == serie_id, Treino.aluno_id == aluno.id)
        .first()
    )
    if serie is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Série não encontrada.")

    concluida_hoje = alternar_execucao_serie(db, serie, aluno.id)

    treino = db.get(Treino, serie.exercicio.treino_id)
    resumo = montar_treino_resumo(db, treino)

    return ExecucaoToggleOut(
        serie_id=serie.id,
        concluida_hoje=concluida_hoje,
        treino_progresso_percentual=resumo.progresso_percentual,
        treino_concluido_hoje=resumo.concluido_hoje,
    )


@router.get("/{hash_token}/recomendacoes", response_model=list[RecomendacaoOut])
def recomendacoes_aluno(
    aluno: Aluno = Depends(get_aluno_por_hash_token),
    db: Session = Depends(get_db),
) -> list[RecomendacaoProduto]:
    """'Dicas do seu Personal' — links de afiliado curados, não-invasivos."""
    return (
        db.query(RecomendacaoProduto)
        .filter(RecomendacaoProduto.personal_id == aluno.personal_id, RecomendacaoProduto.ativo.is_(True))
        .order_by(RecomendacaoProduto.ordem)
        .all()
    )
