"""limite de alunos por plano da assinatura

Revision ID: 0007_limite_alunos
Revises: 0006_cpf_meta_avaliacoes
Create Date: 2026-08-14

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0007_limite_alunos"
down_revision: Union[str, None] = "0006_cpf_meta_avaliacoes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("assinaturas", sa.Column("limite_alunos", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("assinaturas", "limite_alunos")
