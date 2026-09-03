"""tabela de metas (substitui alunos.peso_meta_kg) + comentários de série

Revision ID: 0018_metas
Revises: 0017_anamnese
Create Date: 2026-08-23

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0018_metas"
down_revision: Union[str, None] = "0017_anamnese"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "metas",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("aluno_id", sa.Integer(), sa.ForeignKey("alunos.id", ondelete="CASCADE"), nullable=False),
        sa.Column("metrica", sa.String(20), nullable=False),
        sa.Column("valor_inicial", sa.Float(), nullable=False),
        sa.Column("valor_alvo", sa.Float(), nullable=False),
        sa.Column("data_alvo", sa.Date(), nullable=True),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("concluida_em", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_metas_aluno_id", "metas", ["aluno_id"])

    # Migra quem já tinha peso_meta_kg definido pra uma Meta de verdade,
    # usando o peso mais recente registrado como valor_inicial (ou o
    # próprio valor_alvo se o aluno nunca teve avaliação nenhuma).
    conexao = op.get_bind()
    conexao.execute(
        sa.text(
            """
            INSERT INTO metas (aluno_id, metrica, valor_inicial, valor_alvo, criado_em)
            SELECT
                a.id,
                'peso_kg',
                COALESCE(
                    (SELECT av.peso_kg FROM avaliacoes_fisicas av
                     WHERE av.aluno_id = a.id AND av.peso_kg IS NOT NULL
                     ORDER BY av.data DESC LIMIT 1),
                    a.peso_meta_kg
                ),
                a.peso_meta_kg,
                now()
            FROM alunos a
            WHERE a.peso_meta_kg IS NOT NULL
            """
        )
    )

    op.drop_column("alunos", "peso_meta_kg")

    op.create_table(
        "comentarios_serie",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("serie_id", sa.Integer(), sa.ForeignKey("series.id", ondelete="CASCADE"), nullable=False),
        sa.Column("aluno_id", sa.Integer(), sa.ForeignKey("alunos.id", ondelete="CASCADE"), nullable=False),
        sa.Column("data", sa.Date(), nullable=False),
        sa.Column("texto", sa.String(500), nullable=False),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("serie_id", "data", name="uq_comentario_serie_dia"),
    )
    op.create_index("ix_comentarios_serie_aluno_id", "comentarios_serie", ["aluno_id"])


def downgrade() -> None:
    op.drop_index("ix_comentarios_serie_aluno_id", table_name="comentarios_serie")
    op.drop_table("comentarios_serie")
    op.add_column("alunos", sa.Column("peso_meta_kg", sa.Float(), nullable=True))
    op.drop_index("ix_metas_aluno_id", table_name="metas")
    op.drop_table("metas")
