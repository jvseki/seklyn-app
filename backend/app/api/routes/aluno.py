"""
Rotas públicas do Aluno: protegidas apenas pelo `hash_token` na URL,
sem exigir login/senha (acesso via link único, sem fricção).
"""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.tempo import hoje as hoje_brasil
from app.deps import get_aluno_por_hash_token
from app.models.aluno import Aluno
from app.models.exercicio import Exercicio
from app.models.recomendacao import RecomendacaoProduto
from app.models.serie import Serie
from app.models.treino import Treino
from app.schemas.aluno import AlunoPainelOut, AlunoPublicoOut
from app.schemas.execucao import ExecucaoToggleOut, ExecutarSerieIn
from app.schemas.recomendacao import RecomendacaoOut
from app.schemas.treino import DiaSemanaAlunoOut, TreinoDetalheOut
from app.services.progresso import (
    DIAS_SEMANA_CHAVES,
    alternar_execucao_serie,
    calcular_streak,
    datas_semana_atual,
    montar_treino_detalhe,
    montar_treino_resumo,
)

router = APIRouter(prefix="/api/aluno", tags=["Aluno"])


def _validar_data_na_semana_atual(data: date) -> None:
    if data not in datas_semana_atual():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Só é possível marcar ou ver dias da semana atual.",
        )


@router.get("/{hash_token}", response_model=AlunoPainelOut)
def painel_aluno(
    aluno: Aluno = Depends(get_aluno_por_hash_token),
    db: Session = Depends(get_db),
) -> AlunoPainelOut:
    treinos = (
        db.query(Treino)
        .options(
            joinedload(Treino.exercicios).joinedload(Exercicio.series),
            joinedload(Treino.exercicios).joinedload(Exercicio.video),
        )
        .filter(Treino.aluno_id == aluno.id, Treino.ativo.is_(True))
        .all()
    )
    treino_por_dia = {t.dia_semana: t for t in treinos if t.dia_semana}

    hoje = hoje_brasil()
    dias_da_semana = []
    for data_dia, chave_dia in zip(datas_semana_atual(hoje), DIAS_SEMANA_CHAVES):
        treino = treino_por_dia.get(chave_dia)
        if treino is None:
            dias_da_semana.append(
                DiaSemanaAlunoOut(data=data_dia, dia_semana=chave_dia, hoje=data_dia == hoje)
            )
            continue
        resumo = montar_treino_resumo(db, treino, dia=data_dia)
        dias_da_semana.append(
            DiaSemanaAlunoOut(
                data=data_dia,
                dia_semana=chave_dia,
                hoje=data_dia == hoje,
                treino_id=treino.id,
                treino_nome=treino.nome,
                total_series=resumo.total_series,
                series_concluidas=resumo.series_concluidas_hoje,
                progresso_percentual=resumo.progresso_percentual,
                concluido=resumo.concluido_hoje,
            )
        )

    return AlunoPainelOut(
        aluno=AlunoPublicoOut(
            id=aluno.id,
            nome=aluno.nome,
            personal_nome=aluno.personal.nome,
            personal_tema=aluno.personal.tema_personalizado,
        ),
        semana=dias_da_semana,
        streak_atual=calcular_streak(db, aluno),
    )


@router.get("/{hash_token}/treinos/{treino_id}", response_model=TreinoDetalheOut)
def detalhe_treino_aluno(
    treino_id: int,
    data: date | None = Query(default=None, description="Dia da semana atual sendo visto/marcado (padrão: hoje)"),
    aluno: Aluno = Depends(get_aluno_por_hash_token),
    db: Session = Depends(get_db),
) -> TreinoDetalheOut:
    treino = (
        db.query(Treino)
        .options(
            joinedload(Treino.exercicios).joinedload(Exercicio.series),
            joinedload(Treino.exercicios).joinedload(Exercicio.video),
        )
        .filter(Treino.id == treino_id, Treino.aluno_id == aluno.id)
        .first()
    )
    if treino is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Treino não encontrado.")
    dia = data or hoje_brasil()
    _validar_data_na_semana_atual(dia)
    return montar_treino_detalhe(db, treino, dia=dia)


@router.post("/{hash_token}/series/{serie_id}/executar", response_model=ExecucaoToggleOut)
def executar_serie(
    serie_id: int,
    dados: ExecutarSerieIn | None = None,
    aluno: Aluno = Depends(get_aluno_por_hash_token),
    db: Session = Depends(get_db),
) -> ExecucaoToggleOut:
    """Alterna (marca/desmarca) a conclusão de uma série num dia da semana atual."""
    serie = (
        db.query(Serie)
        .join(Exercicio, Serie.exercicio_id == Exercicio.id)
        .join(Treino, Exercicio.treino_id == Treino.id)
        .filter(Serie.id == serie_id, Treino.aluno_id == aluno.id)
        .first()
    )
    if serie is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Série não encontrada.")

    dia = (dados.data if dados else None) or hoje_brasil()
    _validar_data_na_semana_atual(dia)

    concluida = alternar_execucao_serie(db, serie, aluno.id, dia=dia)

    treino = db.get(Treino, serie.exercicio.treino_id)
    resumo = montar_treino_resumo(db, treino, dia=dia)

    return ExecucaoToggleOut(
        serie_id=serie.id,
        concluida_hoje=concluida,
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
