"""confirmação de e-mail do Personal

Revision ID: 0002_verificacao_email
Revises: 0001_inicial
Create Date: 2026-08-12

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002_verificacao_email"
down_revision: Union[str, None] = "0001_inicial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "personais", sa.Column("email_verificado", sa.Boolean(), nullable=False, server_default=sa.false())
    )
    op.add_column("personais", sa.Column("token_verificacao", sa.String(64), nullable=True))
    op.add_column("personais", sa.Column("token_verificacao_expira", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_personais_token_verificacao", "personais", ["token_verificacao"])


def downgrade() -> None:
    op.drop_index("ix_personais_token_verificacao", table_name="personais")
    op.drop_column("personais", "token_verificacao_expira")
    op.drop_column("personais", "token_verificacao")
    op.drop_column("personais", "email_verificado")
