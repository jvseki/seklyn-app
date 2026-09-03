"""
Lógica das metas: cálculo de progresso (mesma conta usada tanto pelo
Personal quanto pelo próprio Aluno, pra nunca divergir) e a checagem de
conclusão automática, disparada toda vez que uma avaliação nova é criada.
"""
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.avaliacao_fisica import AvaliacaoFisica
from app.models.meta import Meta
from app.schemas.meta import MetaProgressoOut

METRICAS_VALIDAS = ("peso_kg", "cintura_cm", "quadril_cm", "braco_cm", "coxa_cm", "peito_cm")


def _valor_atual(db: Session, aluno_id: int, metrica: str) -> float | None:
    """Última avaliação que tem essa métrica preenchida (nem toda avaliação
    tem todos os campos — o Personal registra só o que acompanha)."""
    coluna = getattr(AvaliacaoFisica, metrica)
    avaliacao = (
        db.query(AvaliacaoFisica)
        .filter(AvaliacaoFisica.aluno_id == aluno_id, coluna.isnot(None))
        .order_by(AvaliacaoFisica.data.desc())
        .first()
    )
    return getattr(avaliacao, metrica) if avaliacao else None


def _bateu_meta(meta: Meta, valor_atual: float) -> bool:
    """Direção sempre derivada comparando alvo com o inicial — nunca
    guardada à parte. Alvo menor que o inicial = quer diminuir (emagrecer,
    afinar cintura); alvo maior = quer aumentar (hipertrofia)."""
    if meta.valor_alvo <= meta.valor_inicial:
        return valor_atual <= meta.valor_alvo
    return valor_atual >= meta.valor_alvo


def montar_progresso(db: Session, meta: Meta) -> MetaProgressoOut:
    valor_atual = _valor_atual(db, meta.aluno_id, meta.metrica)
    distancia_total = meta.valor_alvo - meta.valor_inicial

    if valor_atual is None or distancia_total == 0:
        percentual = 100.0 if meta.concluida_em else 0.0
    else:
        andado = valor_atual - meta.valor_inicial
        percentual = max(0.0, min(100.0, round((andado / distancia_total) * 100, 1)))

    marcos = [
        round(meta.valor_inicial + distancia_total * fracao, 1) for fracao in (1 / 3, 2 / 3)
    ]

    return MetaProgressoOut(
        id=meta.id,
        metrica=meta.metrica,
        valor_inicial=meta.valor_inicial,
        valor_atual=valor_atual,
        valor_alvo=meta.valor_alvo,
        data_alvo=meta.data_alvo,
        percentual=percentual,
        marcos=marcos,
        concluida=meta.concluida_em is not None,
        concluida_em=meta.concluida_em,
        criado_em=meta.criado_em,
    )


def verificar_conclusao(db: Session, aluno_id: int, avaliacao: AvaliacaoFisica) -> list[Meta]:
    """Roda depois de criar uma avaliação nova: pra cada meta ainda ativa
    cuja métrica foi preenchida nessa avaliação, checa se bateu o alvo.
    Retorna as que acabaram de virar concluídas agora (pra comemorar no
    frontend) — metas que já estavam concluídas antes não entram aqui de novo."""
    ativas = db.query(Meta).filter(Meta.aluno_id == aluno_id, Meta.concluida_em.is_(None)).all()
    concluidas_agora = []
    for meta in ativas:
        valor = getattr(avaliacao, meta.metrica, None)
        if valor is None:
            continue
        if _bateu_meta(meta, valor):
            meta.concluida_em = datetime.now(timezone.utc)
            concluidas_agora.append(meta)
    if concluidas_agora:
        db.commit()
    return concluidas_agora
