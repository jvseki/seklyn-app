"""categoria (grupo muscular) no exercício

Revision ID: 0013_categoria_exercicio
Revises: 0012_videos_exercicio
Create Date: 2026-08-21

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0013_categoria_exercicio"
down_revision: Union[str, None] = "0012_videos_exercicio"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("exercicios", sa.Column("categoria", sa.String(30), nullable=True))


def downgrade() -> None:
    op.drop_column("exercicios", "categoria")
