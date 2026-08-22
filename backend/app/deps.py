"""
Dependencies do FastAPI: autenticação do Personal (JWT), resolução do
Aluno via hash_token, exigência de assinatura ativa e checagens de posse
(um Personal só pode mexer nos próprios alunos/treinos).
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decodificar_token_acesso
from app.models.aluno import Aluno
from app.models.assinatura import Assinatura
from app.models.avaliacao_fisica import AvaliacaoFisica
from app.models.exercicio import Exercicio
from app.models.foto_progresso import FotoProgresso
from app.models.personal import Personal
from app.models.serie import Serie
from app.models.treino import Treino

# tokenUrl é só informativo para a doc do Swagger; o login real é via JSON.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/personal/login", auto_error=False)


def get_current_personal(
    token: str | None = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> Personal:
    credenciais_invalidas = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Não autenticado. Faça login novamente.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credenciais_invalidas

    personal_id = decodificar_token_acesso(token)
    if personal_id is None:
        raise credenciais_invalidas

    personal = db.get(Personal, personal_id)
    if personal is None:
        raise credenciais_invalidas
    return personal


def exigir_admin(personal: Personal = Depends(get_current_personal)) -> Personal:
    """Bloqueia as rotas do painel de administração pra quem não é super admin."""
    if not personal.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso restrito ao administrador.")
    return personal


def exigir_assinatura_ativa(
    personal: Personal = Depends(get_current_personal),
    db: Session = Depends(get_db),
) -> Personal:
    """Bloqueia ações que exigem assinatura Stripe ativa (ou em trial)."""
    assinatura = db.query(Assinatura).filter(Assinatura.personal_id == personal.id).first()
    if assinatura is None or not assinatura.ativa:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Assine o Seklyn para continuar usando essa funcionalidade.",
        )
    return personal


def get_aluno_por_hash_token(hash_token: str, db: Session = Depends(get_db)) -> Aluno:
    """Resolve o Aluno a partir do token único da URL (sem exigir login)."""
    aluno = db.query(Aluno).filter(Aluno.hash_token == hash_token, Aluno.ativo.is_(True)).first()
    if aluno is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Link de acesso inválido ou inativo.")
    return aluno


def obter_aluno_do_personal(aluno_id: int, personal: Personal, db: Session) -> Aluno:
    """Garante que o aluno pertence ao Personal autenticado."""
    aluno = db.get(Aluno, aluno_id)
    if aluno is None or aluno.personal_id != personal.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aluno não encontrado.")
    return aluno


def obter_treino_do_personal(treino_id: int, personal: Personal, db: Session) -> Treino:
    """Garante que o treino pertence a um aluno do Personal autenticado."""
    treino = db.get(Treino, treino_id)
    if treino is None or treino.aluno.personal_id != personal.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Treino não encontrado.")
    return treino


def obter_exercicio_do_personal(exercicio_id: int, personal: Personal, db: Session) -> Exercicio:
    """Garante que o exercício pertence a um treino/aluno do Personal autenticado."""
    exercicio = db.get(Exercicio, exercicio_id)
    if exercicio is None or exercicio.treino.aluno.personal_id != personal.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exercício não encontrado.")
    return exercicio


def obter_serie_do_personal(serie_id: int, personal: Personal, db: Session) -> Serie:
    """Garante que a série pertence a um exercício/treino/aluno do Personal autenticado."""
    serie = db.get(Serie, serie_id)
    if serie is None or serie.exercicio.treino.aluno.personal_id != personal.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Série não encontrada.")
    return serie


def obter_avaliacao_do_personal(avaliacao_id: int, personal: Personal, db: Session) -> AvaliacaoFisica:
    """Garante que a avaliação física pertence a um aluno do Personal autenticado."""
    avaliacao = db.get(AvaliacaoFisica, avaliacao_id)
    if avaliacao is None or avaliacao.aluno.personal_id != personal.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Avaliação não encontrada.")
    return avaliacao


def obter_foto_do_personal(foto_id: int, personal: Personal, db: Session) -> FotoProgresso:
    """Garante que a foto de progresso pertence a um aluno do Personal autenticado."""
    foto = db.get(FotoProgresso, foto_id)
    if foto is None or foto.aluno.personal_id != personal.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Foto não encontrada.")
    return foto
