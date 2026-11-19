"""vendas do parceiro: forma de pagamento (pix, crédito ou débito) e quem paga a taxa

Revision ID: 0024_venda_forma_pagamento
Revises: 0023_parceiros
Create Date: 2026-11-08

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0024_venda_forma_pagamento"
down_revision: Union[str, None] = "0023_parceiros"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Quem paga a taxa do Mercado Pago ("parceiro" = o dono recebe a % dele
    # sobre o valor cheio). Vendas antigas foram feitas com a taxa dividida.
    op.add_column("parceiros", sa.Column("taxa_paga_por", sa.String(20), nullable=False, server_default="parceiro"))
    op.add_column("vendas_parceiro", sa.Column("taxa_paga_por", sa.String(20), nullable=False, server_default="parceiro"))
    op.execute("UPDATE vendas_parceiro SET taxa_paga_por = 'dividida'")
    op.add_column(
        "vendas_parceiro",
        sa.Column("forma_pagamento", sa.String(20), nullable=False, server_default="pix"),
    )


def downgrade() -> None:
    op.drop_column("vendas_parceiro", "forma_pagamento")
    op.drop_column("vendas_parceiro", "taxa_paga_por")
    op.drop_column("parceiros", "taxa_paga_por")
