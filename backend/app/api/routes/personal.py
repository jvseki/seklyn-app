"""
Rotas de gestão do Personal: alunos, treinos, exercícios, séries e
analytics de aderência. Leitura é liberada para qualquer Personal logado;
criação/edição/exclusão exige assinatura ativa.
"""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy.orm import Session, joinedload

from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import gerar_hash_token
from app.core.tempo import hoje as hoje_brasil
from app.deps import (
    exigir_assinatura_ativa,
    get_current_personal,
    obter_aluno_do_personal,
    obter_avaliacao_do_personal,
    obter_exercicio_do_personal,
    obter_serie_do_personal,
    obter_treino_do_personal,
)
from app.models.aluno import Aluno
from app.models.assinatura import Assinatura
from app.models.avaliacao_fisica import AvaliacaoFisica
from app.models.exercicio import Exercicio
from app.models.personal import Personal
from app.models.serie import Serie
from app.models.treino import Treino
from app.schemas.aluno import AlunoAtualizar, AlunoCriar, AlunoOut
from app.schemas.analytics import AderenciaOut, AnalyticsDetalhadoOut
from app.schemas.avaliacao_fisica import AvaliacaoFisicaCriar, AvaliacaoFisicaOut
from app.schemas.exercicio import ExercicioAtualizar, ExercicioCriar, ExercicioOut
from app.schemas.serie import SerieAtualizar, SerieCriar, SerieOut
from app.schemas.treino import MontarTreinoIn, TreinoAtualizar, TreinoCriar, TreinoOut
from app.services.aluno_export import build_aluno_xlsx
from app.services.progresso import calcular_aderencia, calcular_analytics_detalhado

router = APIRouter(prefix="/api/personal", tags=["Personal"])
settings = get_settings()


def _aluno_out(aluno: Aluno) -> AlunoOut:
    saida = AlunoOut.model_validate(aluno)
    saida.link_acesso = f"{settings.frontend_url}/aluno/treino.html?t={aluno.hash_token}"
    return saida


# ---------- Alunos ----------


@router.get("/alunos", response_model=list[AlunoOut])
def listar_alunos(
    personal: Personal = Depends(get_current_personal),
    db: Session = Depends(get_db),
) -> list[AlunoOut]:
    alunos = db.query(Aluno).filter(Aluno.personal_id == personal.id).order_by(Aluno.nome).all()
    return [_aluno_out(a) for a in alunos]


@router.post("/alunos", response_model=AlunoOut, status_code=status.HTTP_201_CREATED)
def criar_aluno(
    dados: AlunoCriar,
    personal: Personal = Depends(exigir_assinatura_ativa),
    db: Session = Depends(get_db),
) -> AlunoOut:
    assinatura = db.query(Assinatura).filter(Assinatura.personal_id == personal.id).first()
    if assinatura and assinatura.limite_alunos is not None:
        total_atual = db.query(Aluno).filter(Aluno.personal_id == personal.id).count()
        if total_atual >= assinatura.limite_alunos:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail=f"Seu plano permite até {assinatura.limite_alunos} alunos. Fale com o suporte pra aumentar o limite.",
            )

    aluno = Aluno(
        personal_id=personal.id,
        nome=dados.nome,
        email=dados.email,
        telefone=dados.telefone,
        cpf=dados.cpf,
        hash_token=gerar_hash_token(),
    )
    db.add(aluno)
    db.commit()
    db.refresh(aluno)
    return _aluno_out(aluno)


@router.get("/alunos/{aluno_id}", response_model=AlunoOut)
def obter_aluno(
    aluno_id: int,
    personal: Personal = Depends(get_current_personal),
    db: Session = Depends(get_db),
) -> AlunoOut:
    aluno = obter_aluno_do_personal(aluno_id, personal, db)
    return _aluno_out(aluno)


@router.put("/alunos/{aluno_id}", response_model=AlunoOut)
def atualizar_aluno(
    aluno_id: int,
    dados: AlunoAtualizar,
    personal: Personal = Depends(exigir_assinatura_ativa),
    db: Session = Depends(get_db),
) -> AlunoOut:
    aluno = obter_aluno_do_personal(aluno_id, personal, db)
    for campo, valor in dados.model_dump(exclude_unset=True).items():
        setattr(aluno, campo, valor)
    db.commit()
    db.refresh(aluno)
    return _aluno_out(aluno)


@router.delete("/alunos/{aluno_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_aluno(
    aluno_id: int,
    personal: Personal = Depends(exigir_assinatura_ativa),
    db: Session = Depends(get_db),
) -> None:
    aluno = obter_aluno_do_personal(aluno_id, personal, db)
    db.delete(aluno)
    db.commit()


@router.post("/alunos/{aluno_id}/regenerar-link", response_model=AlunoOut)
def regenerar_link_aluno(
    aluno_id: int,
    personal: Personal = Depends(exigir_assinatura_ativa),
    db: Session = Depends(get_db),
) -> AlunoOut:
    """Invalida o link antigo do aluno e gera um novo hash_token."""
    aluno = obter_aluno_do_personal(aluno_id, personal, db)
    aluno.hash_token = gerar_hash_token()
    db.commit()
    db.refresh(aluno)
    return _aluno_out(aluno)


@router.get("/alunos/{aluno_id}/analytics", response_model=AderenciaOut)
def analytics_aluno(
    aluno_id: int,
    periodo_dias: int = 30,
    personal: Personal = Depends(get_current_personal),
    db: Session = Depends(get_db),
) -> AderenciaOut:
    aluno = obter_aluno_do_personal(aluno_id, personal, db)
    return calcular_aderencia(db, aluno, periodo_dias=periodo_dias)


@router.get("/alunos/{aluno_id}/analytics-detalhado", response_model=AnalyticsDetalhadoOut)
def analytics_detalhado_aluno(
    aluno_id: int,
    periodo_dias: int = 30,
    personal: Personal = Depends(get_current_personal),
    db: Session = Depends(get_db),
) -> AnalyticsDetalhadoOut:
    aluno = obter_aluno_do_personal(aluno_id, personal, db)
    return calcular_analytics_detalhado(db, aluno, periodo_dias=periodo_dias)


@router.get("/alunos/{aluno_id}/exportar-excel")
def exportar_aluno_excel(
    aluno_id: int,
    personal: Personal = Depends(get_current_personal),
    db: Session = Depends(get_db),
) -> Response:
    """Baixa a ficha completa do aluno (treinos + peso/meta) num Excel profissional."""
    aluno = (
        db.query(Aluno)
        .options(joinedload(Aluno.treinos).joinedload(Treino.exercicios).joinedload(Exercicio.series))
        .filter(Aluno.id == aluno_id, Aluno.personal_id == personal.id)
        .first()
    )
    if aluno is None:
        aluno = obter_aluno_do_personal(aluno_id, personal, db)  # dispara o 404 padrão

    avaliacoes = (
        db.query(AvaliacaoFisica).filter(AvaliacaoFisica.aluno_id == aluno.id).order_by(AvaliacaoFisica.data).all()
    )
    payload = build_aluno_xlsx(aluno, avaliacoes)
    nome_arquivo = f"seklyn-{aluno.nome.lower().replace(' ', '-')}.xlsx"
    return Response(
        content=payload,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{nome_arquivo}"'},
    )


# ---------- Treinos ----------


@router.get("/alunos/{aluno_id}/treinos", response_model=list[TreinoOut])
def listar_treinos(
    aluno_id: int,
    personal: Personal = Depends(get_current_personal),
    db: Session = Depends(get_db),
) -> list[Treino]:
    aluno = obter_aluno_do_personal(aluno_id, personal, db)
    return (
        db.query(Treino)
        .options(joinedload(Treino.exercicios).joinedload(Exercicio.series))
        .filter(Treino.aluno_id == aluno.id)
        .order_by(Treino.ordem)
        .all()
    )


@router.post("/alunos/{aluno_id}/treinos", response_model=TreinoOut, status_code=status.HTTP_201_CREATED)
def criar_treino(
    aluno_id: int,
    dados: TreinoCriar,
    personal: Personal = Depends(exigir_assinatura_ativa),
    db: Session = Depends(get_db),
) -> Treino:
    aluno = obter_aluno_do_personal(aluno_id, personal, db)
    treino = Treino(aluno_id=aluno.id, nome=dados.nome, ordem=dados.ordem, dia_semana=dados.dia_semana)
    db.add(treino)
    db.commit()
    db.refresh(treino)
    return treino


@router.post(
    "/alunos/{aluno_id}/treinos/montar",
    response_model=TreinoOut,
    status_code=status.HTTP_201_CREATED,
)
def montar_treino(
    aluno_id: int,
    dados: MontarTreinoIn,
    personal: Personal = Depends(exigir_assinatura_ativa),
    db: Session = Depends(get_db),
) -> Treino:
    """
    Cria (ou refaz do zero) o treino de um dia inteiro numa única requisição:
    usado pelo montador assistido por categoria. Se já existir um treino
    nesse dia, os exercícios/séries antigos são substituídos pelos novos.
    """
    aluno = obter_aluno_do_personal(aluno_id, personal, db)

    treino = None
    if dados.dia_semana:
        treino = (
            db.query(Treino)
            .filter(Treino.aluno_id == aluno.id, Treino.dia_semana == dados.dia_semana)
            .first()
        )

    if treino:
        treino.nome = dados.nome
        treino.ordem = dados.ordem
        # Cascade da relação já apaga exercícios/séries antigos ao limpar a lista.
        treino.exercicios.clear()
        db.flush()
    else:
        treino = Treino(aluno_id=aluno.id, nome=dados.nome, ordem=dados.ordem, dia_semana=dados.dia_semana)
        db.add(treino)
        db.flush()

    for ordem_exercicio, exercicio_in in enumerate(dados.exercicios):
        exercicio = Exercicio(treino_id=treino.id, nome=exercicio_in.nome, ordem=ordem_exercicio)
        db.add(exercicio)
        db.flush()
        for ordem_serie, serie_in in enumerate(exercicio_in.series):
            db.add(
                Serie(
                    exercicio_id=exercicio.id,
                    ordem=ordem_serie,
                    repeticoes_alvo=serie_in.repeticoes_alvo,
                    carga_alvo=serie_in.carga_alvo,
                    intervalo_descanso=serie_in.intervalo_descanso,
                )
            )

    db.commit()
    db.refresh(treino)
    return treino


@router.put("/treinos/{treino_id}", response_model=TreinoOut)
def atualizar_treino(
    treino_id: int,
    dados: TreinoAtualizar,
    personal: Personal = Depends(exigir_assinatura_ativa),
    db: Session = Depends(get_db),
) -> Treino:
    treino = obter_treino_do_personal(treino_id, personal, db)
    for campo, valor in dados.model_dump(exclude_unset=True).items():
        setattr(treino, campo, valor)
    db.commit()
    db.refresh(treino)
    return treino


@router.delete("/treinos/{treino_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_treino(
    treino_id: int,
    personal: Personal = Depends(exigir_assinatura_ativa),
    db: Session = Depends(get_db),
) -> None:
    treino = obter_treino_do_personal(treino_id, personal, db)
    db.delete(treino)
    db.commit()


# ---------- Exercícios ----------


@router.post("/treinos/{treino_id}/exercicios", response_model=ExercicioOut, status_code=status.HTTP_201_CREATED)
def criar_exercicio(
    treino_id: int,
    dados: ExercicioCriar,
    personal: Personal = Depends(exigir_assinatura_ativa),
    db: Session = Depends(get_db),
) -> Exercicio:
    treino = obter_treino_do_personal(treino_id, personal, db)
    exercicio = Exercicio(treino_id=treino.id, nome=dados.nome, ordem=dados.ordem, observacoes=dados.observacoes)
    db.add(exercicio)
    db.commit()
    db.refresh(exercicio)
    return exercicio


@router.put("/exercicios/{exercicio_id}", response_model=ExercicioOut)
def atualizar_exercicio(
    exercicio_id: int,
    dados: ExercicioAtualizar,
    personal: Personal = Depends(exigir_assinatura_ativa),
    db: Session = Depends(get_db),
) -> Exercicio:
    exercicio = obter_exercicio_do_personal(exercicio_id, personal, db)
    for campo, valor in dados.model_dump(exclude_unset=True).items():
        setattr(exercicio, campo, valor)
    db.commit()
    db.refresh(exercicio)
    return exercicio


@router.delete("/exercicios/{exercicio_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_exercicio(
    exercicio_id: int,
    personal: Personal = Depends(exigir_assinatura_ativa),
    db: Session = Depends(get_db),
) -> None:
    exercicio = obter_exercicio_do_personal(exercicio_id, personal, db)
    db.delete(exercicio)
    db.commit()


# ---------- Séries ----------


@router.post("/exercicios/{exercicio_id}/series", response_model=SerieOut, status_code=status.HTTP_201_CREATED)
def criar_serie(
    exercicio_id: int,
    dados: SerieCriar,
    personal: Personal = Depends(exigir_assinatura_ativa),
    db: Session = Depends(get_db),
) -> Serie:
    exercicio = obter_exercicio_do_personal(exercicio_id, personal, db)
    serie = Serie(
        exercicio_id=exercicio.id,
        ordem=dados.ordem,
        repeticoes_alvo=dados.repeticoes_alvo,
        carga_alvo=dados.carga_alvo,
        intervalo_descanso=dados.intervalo_descanso,
    )
    db.add(serie)
    db.commit()
    db.refresh(serie)
    return serie


@router.put("/series/{serie_id}", response_model=SerieOut)
def atualizar_serie(
    serie_id: int,
    dados: SerieAtualizar,
    personal: Personal = Depends(exigir_assinatura_ativa),
    db: Session = Depends(get_db),
) -> Serie:
    serie = obter_serie_do_personal(serie_id, personal, db)
    for campo, valor in dados.model_dump(exclude_unset=True).items():
        setattr(serie, campo, valor)
    db.commit()
    db.refresh(serie)
    return serie


@router.delete("/series/{serie_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_serie(
    serie_id: int,
    personal: Personal = Depends(exigir_assinatura_ativa),
    db: Session = Depends(get_db),
) -> None:
    serie = obter_serie_do_personal(serie_id, personal, db)
    db.delete(serie)
    db.commit()


# ---------- Avaliações físicas (peso ao longo do tempo, pra medir a meta) ----------


@router.get("/alunos/{aluno_id}/avaliacoes", response_model=list[AvaliacaoFisicaOut])
def listar_avaliacoes(
    aluno_id: int,
    personal: Personal = Depends(get_current_personal),
    db: Session = Depends(get_db),
) -> list[AvaliacaoFisica]:
    aluno = obter_aluno_do_personal(aluno_id, personal, db)
    return (
        db.query(AvaliacaoFisica)
        .filter(AvaliacaoFisica.aluno_id == aluno.id)
        .order_by(AvaliacaoFisica.data.desc())
        .all()
    )


@router.post(
    "/alunos/{aluno_id}/avaliacoes", response_model=AvaliacaoFisicaOut, status_code=status.HTTP_201_CREATED
)
def criar_avaliacao(
    aluno_id: int,
    dados: AvaliacaoFisicaCriar,
    personal: Personal = Depends(exigir_assinatura_ativa),
    db: Session = Depends(get_db),
) -> AvaliacaoFisica:
    aluno = obter_aluno_do_personal(aluno_id, personal, db)
    avaliacao = AvaliacaoFisica(
        aluno_id=aluno.id,
        data=dados.data or hoje_brasil(),
        peso_kg=dados.peso_kg,
        observacoes=dados.observacoes,
    )
    db.add(avaliacao)
    db.commit()
    db.refresh(avaliacao)
    return avaliacao


@router.delete("/avaliacoes/{avaliacao_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_avaliacao(
    avaliacao_id: int,
    personal: Personal = Depends(exigir_assinatura_ativa),
    db: Session = Depends(get_db),
) -> None:
    avaliacao = obter_avaliacao_do_personal(avaliacao_id, personal, db)
    db.delete(avaliacao)
    db.commit()
