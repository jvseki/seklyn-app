"""tema personalizado do Personal + telefone do aluno

Revision ID: 0003_tema_e_telefone_aluno
Revises: 0002_verificacao_email
Create Date: 2026-08-13

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003_tema_e_telefone_aluno"
down_revision: Union[str, None] = "0002_verificacao_email"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("personais", sa.Column("tema_personalizado", sa.String(30), nullable=True))
    op.add_column("alunos", sa.Column("telefone", sa.String(30), nullable=True))


def downgrade() -> None:
    op.drop_column("alunos", "telefone")
    op.drop_column("personais", "tema_personalizado")
