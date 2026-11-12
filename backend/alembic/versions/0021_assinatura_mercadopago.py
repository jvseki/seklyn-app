"""assinatura via Mercado Pago (substitui as colunas do Stripe, nunca usadas)

Revision ID: 0021_assinatura_mercadopago
Revises: 0020_notificado_em_treino
Create Date: 2026-11-05

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0021_assinatura_mercadopago"
down_revision: Union[str, None] = "0020_notificado_em_treino"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("assinaturas", sa.Column("valor_mensal", sa.Numeric(10, 2), nullable=True))
    op.add_column("assinaturas", sa.Column("mp_preapproval_id", sa.String(64), nullable=True))
    op.create_index("ix_assinaturas_mp_preapproval_id", "assinaturas", ["mp_preapproval_id"])
    # Conferido em produção antes de remover: nenhuma assinatura usava Stripe.
    op.drop_column("assinaturas", "stripe_customer_id")
    op.drop_column("assinaturas", "stripe_subscription_id")


def downgrade() -> None:
    op.add_column("assinaturas", sa.Column("stripe_subscription_id", sa.String(255), nullable=True))
    op.add_column("assinaturas", sa.Column("stripe_customer_id", sa.String(255), nullable=True))
    op.drop_index("ix_assinaturas_mp_preapproval_id", table_name="assinaturas")
    op.drop_column("assinaturas", "mp_preapproval_id")
    op.drop_column("assinaturas", "valor_mensal")
