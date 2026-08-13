"""
CRUD dos links de afiliado do Personal (Amazon, Growth, etc.), que
aparecem para o aluno como 'Dicas do seu Personal'.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.deps import exigir_assinatura_ativa, get_current_personal
from app.models.personal import Personal
from app.models.recomendacao import RecomendacaoProduto
from app.schemas.recomendacao import RecomendacaoAtualizar, RecomendacaoCriar, RecomendacaoOut

router = APIRouter(prefix="/api/personal/recomendacoes", tags=["Recomendações"])


def _obter_recomendacao_do_personal(recomendacao_id: int, personal: Personal, db: Session) -> RecomendacaoProduto:
    recomendacao = db.get(RecomendacaoProduto, recomendacao_id)
    if recomendacao is None or recomendacao.personal_id != personal.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recomendação não encontrada.")
    return recomendacao


@router.get("", response_model=list[RecomendacaoOut])
def listar_recomendacoes(
    personal: Personal = Depends(get_current_personal),
    db: Session = Depends(get_db),
) -> list[RecomendacaoProduto]:
    return (
        db.query(RecomendacaoProduto)
        .filter(RecomendacaoProduto.personal_id == personal.id)
        .order_by(RecomendacaoProduto.ordem)
        .all()
    )


@router.post("", response_model=RecomendacaoOut, status_code=status.HTTP_201_CREATED)
def criar_recomendacao(
    dados: RecomendacaoCriar,
    personal: Personal = Depends(exigir_assinatura_ativa),
    db: Session = Depends(get_db),
) -> RecomendacaoProduto:
    recomendacao = RecomendacaoProduto(personal_id=personal.id, **dados.model_dump())
    db.add(recomendacao)
    db.commit()
    db.refresh(recomendacao)
    return recomendacao


@router.put("/{recomendacao_id}", response_model=RecomendacaoOut)
def atualizar_recomendacao(
    recomendacao_id: int,
    dados: RecomendacaoAtualizar,
    personal: Personal = Depends(exigir_assinatura_ativa),
    db: Session = Depends(get_db),
) -> RecomendacaoProduto:
    recomendacao = _obter_recomendacao_do_personal(recomendacao_id, personal, db)
    for campo, valor in dados.model_dump(exclude_unset=True).items():
        setattr(recomendacao, campo, valor)
    db.commit()
    db.refresh(recomendacao)
    return recomendacao


@router.delete("/{recomendacao_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_recomendacao(
    recomendacao_id: int,
    personal: Personal = Depends(exigir_assinatura_ativa),
    db: Session = Depends(get_db),
) -> None:
    recomendacao = _obter_recomendacao_do_personal(recomendacao_id, personal, db)
    db.delete(recomendacao)
    db.commit()
