"""dia da semana do treino

Revision ID: 0004_dia_semana_treino
Revises: 0003_tema_e_telefone_aluno
Create Date: 2026-08-13

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004_dia_semana_treino"
down_revision: Union[str, None] = "0003_tema_e_telefone_aluno"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("treinos", sa.Column("dia_semana", sa.String(10), nullable=True))


def downgrade() -> None:
    op.drop_column("treinos", "dia_semana")
