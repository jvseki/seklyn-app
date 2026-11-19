"""parceiro: quando a chave Pix foi conferida no app do banco

Revision ID: 0025_parceiro_chave_verificada
Revises: 0024_venda_forma_pagamento
Create Date: 2026-11-08

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0025_parceiro_chave_verificada"
down_revision: Union[str, None] = "0024_venda_forma_pagamento"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("parceiros", sa.Column("chave_verificada_em", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("parceiros", "chave_verificada_em")
