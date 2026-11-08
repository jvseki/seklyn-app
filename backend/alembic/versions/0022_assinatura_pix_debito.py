"""assinatura: Pix e débito (mês a mês), reembolso em até N horas e cancelamento agendado

Revision ID: 0022_assinatura_pix_debito
Revises: 0021_assinatura_mercadopago
Create Date: 2026-11-08

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0022_assinatura_pix_debito"
down_revision: Union[str, None] = "0021_assinatura_mercadopago"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("assinaturas", sa.Column("forma_pagamento", sa.String(20), nullable=True))
    op.add_column("assinaturas", sa.Column("ultimo_pagamento_id", sa.String(64), nullable=True))
    op.add_column("assinaturas", sa.Column("ultimo_pagamento_em", sa.DateTime(timezone=True), nullable=True))
    op.add_column("assinaturas", sa.Column("pagamento_pendente_id", sa.String(64), nullable=True))
    op.add_column(
        "assinaturas",
        sa.Column("cancelamento_agendado", sa.Boolean(), server_default=sa.false(), nullable=False),
    )
    # Quem já assinou no cartão até aqui foi no crédito automático.
    op.execute("UPDATE assinaturas SET forma_pagamento = 'credito' WHERE mp_preapproval_id IS NOT NULL")


def downgrade() -> None:
    op.drop_column("assinaturas", "cancelamento_agendado")
    op.drop_column("assinaturas", "pagamento_pendente_id")
    op.drop_column("assinaturas", "ultimo_pagamento_em")
    op.drop_column("assinaturas", "ultimo_pagamento_id")
    op.drop_column("assinaturas", "forma_pagamento")
