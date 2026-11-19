"""parceiros e vendas com divisão de valor (teste da loja do parceiro no admin)

Revision ID: 0023_parceiros
Revises: 0022_assinatura_pix_debito
Create Date: 2026-11-08

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0023_parceiros"
down_revision: Union[str, None] = "0022_assinatura_pix_debito"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "parceiros",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("nome", sa.String(120), nullable=False),
        sa.Column("chave_pix_tipo", sa.String(20), nullable=False),
        sa.Column("chave_pix", sa.String(120), nullable=False),
        sa.Column("cidade", sa.String(60), nullable=False),
        sa.Column("percentual_parceiro", sa.Integer(), nullable=False),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "vendas_parceiro",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("parceiro_id", sa.Integer(), sa.ForeignKey("parceiros.id", ondelete="CASCADE"), nullable=False),
        sa.Column("produto", sa.String(120), nullable=False),
        sa.Column("valor", sa.Numeric(10, 2), nullable=False),
        sa.Column("percentual_parceiro", sa.Integer(), nullable=False),
        sa.Column("mp_pagamento_id", sa.String(64), nullable=True),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("taxa_mp", sa.Numeric(10, 2), nullable=True),
        sa.Column("parte_parceiro", sa.Numeric(10, 2), nullable=True),
        sa.Column("parte_dono", sa.Numeric(10, 2), nullable=True),
        sa.Column("paga_em", sa.DateTime(timezone=True), nullable=True),
        sa.Column("repasse_status", sa.String(20), nullable=False),
        sa.Column("repassado_em", sa.DateTime(timezone=True), nullable=True),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_vendas_parceiro_parceiro_id", "vendas_parceiro", ["parceiro_id"])
    op.create_index("ix_vendas_parceiro_mp_pagamento_id", "vendas_parceiro", ["mp_pagamento_id"])


def downgrade() -> None:
    op.drop_index("ix_vendas_parceiro_mp_pagamento_id", table_name="vendas_parceiro")
    op.drop_index("ix_vendas_parceiro_parceiro_id", table_name="vendas_parceiro")
    op.drop_table("vendas_parceiro")
    op.drop_table("parceiros")
