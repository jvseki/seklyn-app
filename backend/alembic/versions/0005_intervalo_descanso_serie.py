"""intervalo de descanso da série

Revision ID: 0005_intervalo_descanso_serie
Revises: 0004_dia_semana_treino
Create Date: 2026-08-13

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005_intervalo_descanso_serie"
down_revision: Union[str, None] = "0004_dia_semana_treino"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("series", sa.Column("intervalo_descanso", sa.String(20), nullable=True))


def downgrade() -> None:
    op.drop_column("series", "intervalo_descanso")
