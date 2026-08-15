"""amplia repeticoes_alvo/carga_alvo de 30 para 60 chars

Revision ID: 0008_amplia_repeticoes_carga
Revises: 0007_limite_alunos
Create Date: 2026-08-14

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0008_amplia_repeticoes_carga"
down_revision: Union[str, None] = "0007_limite_alunos"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("series", "repeticoes_alvo", type_=sa.String(60), existing_type=sa.String(30))
    op.alter_column("series", "carga_alvo", type_=sa.String(60), existing_type=sa.String(30))


def downgrade() -> None:
    op.alter_column("series", "repeticoes_alvo", type_=sa.String(30), existing_type=sa.String(60))
    op.alter_column("series", "carga_alvo", type_=sa.String(30), existing_type=sa.String(60))
