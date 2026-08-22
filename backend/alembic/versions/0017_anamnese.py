"""tabela de anamnese (ficha de avaliação inicial)

Revision ID: 0017_anamnese
Revises: 0016_treino_templates
Create Date: 2026-08-22

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0017_anamnese"
down_revision: Union[str, None] = "0016_treino_templates"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "anamneses",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "aluno_id", sa.Integer(), sa.ForeignKey("alunos.id", ondelete="CASCADE"), unique=True, nullable=False
        ),
        sa.Column("nivel_experiencia", sa.String(20), nullable=True),
        sa.Column("objetivo", sa.Text(), nullable=True),
        sa.Column("lesoes_e_limitacoes", sa.Text(), nullable=True),
        sa.Column("condicoes_saude", sa.Text(), nullable=True),
        sa.Column("observacoes", sa.Text(), nullable=True),
        sa.Column("atualizado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("anamneses")
