"""cpf, endereco e numero do personal

Revision ID: 0010_cpf_endereco_personal
Revises: 0009_endereco_numero_aluno
Create Date: 2026-08-15

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0010_cpf_endereco_personal"
down_revision: Union[str, None] = "0009_endereco_numero_aluno"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("personais", sa.Column("cpf", sa.String(14), nullable=True))
    op.add_column("personais", sa.Column("endereco", sa.String(200), nullable=True))
    op.add_column("personais", sa.Column("numero", sa.String(20), nullable=True))


def downgrade() -> None:
    op.drop_column("personais", "numero")
    op.drop_column("personais", "endereco")
    op.drop_column("personais", "cpf")
