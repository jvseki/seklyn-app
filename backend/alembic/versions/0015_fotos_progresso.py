"""tabela de fotos de progresso

Revision ID: 0015_fotos_progresso
Revises: 0014_medidas_corporais
Create Date: 2026-08-22

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0015_fotos_progresso"
down_revision: Union[str, None] = "0014_medidas_corporais"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "fotos_progresso",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("aluno_id", sa.Integer(), sa.ForeignKey("alunos.id", ondelete="CASCADE"), nullable=False),
        sa.Column("data", sa.Date(), nullable=False),
        sa.Column("url", sa.String(500), nullable=False),
        sa.Column("observacoes", sa.String(255), nullable=True),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_fotos_progresso_aluno_id", "fotos_progresso", ["aluno_id"])


def downgrade() -> None:
    op.drop_index("ix_fotos_progresso_aluno_id", table_name="fotos_progresso")
    op.drop_table("fotos_progresso")
