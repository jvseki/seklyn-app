"""medidas corporais na avaliação física

Revision ID: 0014_medidas_corporais
Revises: 0013_categoria_exercicio
Create Date: 2026-08-22

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0014_medidas_corporais"
down_revision: Union[str, None] = "0013_categoria_exercicio"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("avaliacoes_fisicas", sa.Column("cintura_cm", sa.Float(), nullable=True))
    op.add_column("avaliacoes_fisicas", sa.Column("quadril_cm", sa.Float(), nullable=True))
    op.add_column("avaliacoes_fisicas", sa.Column("braco_cm", sa.Float(), nullable=True))
    op.add_column("avaliacoes_fisicas", sa.Column("coxa_cm", sa.Float(), nullable=True))
    op.add_column("avaliacoes_fisicas", sa.Column("peito_cm", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("avaliacoes_fisicas", "peito_cm")
    op.drop_column("avaliacoes_fisicas", "coxa_cm")
    op.drop_column("avaliacoes_fisicas", "braco_cm")
    op.drop_column("avaliacoes_fisicas", "quadril_cm")
    op.drop_column("avaliacoes_fisicas", "cintura_cm")
