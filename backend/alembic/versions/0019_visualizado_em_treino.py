"""visualizado_em do treino (quando o aluno abriu pela primeira vez)

Revision ID: 0019_visualizado_em_treino
Revises: 0018_metas
Create Date: 2026-09-12

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0019_visualizado_em_treino"
down_revision: Union[str, None] = "0018_metas"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("treinos", sa.Column("visualizado_em", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("treinos", "visualizado_em")
