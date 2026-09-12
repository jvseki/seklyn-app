"""notificado_em do treino (throttle do e-mail automático pro aluno)

Revision ID: 0020_notificado_em_treino
Revises: 0019_visualizado_em_treino
Create Date: 2026-09-12

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0020_notificado_em_treino"
down_revision: Union[str, None] = "0019_visualizado_em_treino"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("treinos", sa.Column("notificado_em", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("treinos", "notificado_em")
