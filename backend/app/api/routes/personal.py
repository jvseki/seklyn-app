"""
Rotas de gestão do Personal: alunos, treinos, exercícios, séries e
analytics de aderência. Leitura é liberada para qualquer Personal logado;
criação/edição/exclusão exige assinatura ativa.
"""
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session, joinedload

from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import gerar_hash_token
from app.deps import (
    exigir_assinatura_ativa,
    get_current_personal,
    obter_aluno_do_personal,
    obter_exercicio_do_personal,
    obter_serie_do_personal,
    obter_treino_do_personal,
)
from app.models.aluno import Aluno
from app.models.exercicio import Exercicio
from app.models.personal import Personal
from app.models.serie import Serie
from app.models.treino import Treino
from app.schemas.aluno import AlunoAtualizar, AlunoCriar, AlunoOut
from app.schemas.analytics import AderenciaOut
from app.schemas.exercicio import ExercicioAtualizar, ExercicioCriar, ExercicioOut
from app.schemas.serie import SerieAtualizar, SerieCriar, SerieOut
from app.schemas.treino import TreinoAtualizar, TreinoCriar, TreinoOut
from app.services.progresso import calcular_aderencia

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
    aluno = Aluno(
        personal_id=personal.id,
        nome=dados.nome,
        email=dados.email,
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
    treino = Treino(aluno_id=aluno.id, nome=dados.nome, ordem=dados.ordem)
    db.add(treino)
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
