"""tabela de templates de treino reutilizáveis

Revision ID: 0016_treino_templates
Revises: 0015_fotos_progresso
Create Date: 2026-08-22

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0016_treino_templates"
down_revision: Union[str, None] = "0015_fotos_progresso"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "treino_templates",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("personal_id", sa.Integer(), sa.ForeignKey("personais.id", ondelete="CASCADE"), nullable=False),
        sa.Column("nome", sa.String(120), nullable=False),
        sa.Column("dados_json", postgresql.JSONB(), nullable=False),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_treino_templates_personal_id", "treino_templates", ["personal_id"])


def downgrade() -> None:
    op.drop_index("ix_treino_templates_personal_id", table_name="treino_templates")
    op.drop_table("treino_templates")
