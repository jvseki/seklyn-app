"""endereco e numero do aluno

Revision ID: 0009_endereco_numero_aluno
Revises: 0008_amplia_repeticoes_carga
Create Date: 2026-08-15

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0009_endereco_numero_aluno"
down_revision: Union[str, None] = "0008_amplia_repeticoes_carga"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("alunos", sa.Column("endereco", sa.String(200), nullable=True))
    op.add_column("alunos", sa.Column("numero", sa.String(20), nullable=True))


def downgrade() -> None:
    op.drop_column("alunos", "numero")
    op.drop_column("alunos", "endereco")
