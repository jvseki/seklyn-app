"""novidades vistas por conta + pedidos de parceria (Personal quer vender planilhas)

Revision ID: 0028_novidades_parceria
Revises: 0027_comprador_conta_seklyn
Create Date: 2026-11-19

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0028_novidades_parceria"
down_revision: Union[str, None] = "0027_comprador_conta_seklyn"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("personais", sa.Column("novidade_vista", sa.Integer(), nullable=False, server_default="0"))
    op.create_table(
        "solicitacoes_parceria",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("personal_id", sa.Integer(), sa.ForeignKey("personais.id", ondelete="CASCADE"), nullable=False),
        sa.Column("whatsapp", sa.String(30), nullable=False),
        sa.Column("instagram", sa.String(80), nullable=True),
        sa.Column("mensagem", sa.Text(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="nova"),
        sa.Column("nota_admin", sa.Text(), nullable=True),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("atualizado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_solicitacoes_parceria_personal_id", "solicitacoes_parceria", ["personal_id"])


def downgrade() -> None:
    op.drop_index("ix_solicitacoes_parceria_personal_id", table_name="solicitacoes_parceria")
    op.drop_table("solicitacoes_parceria")
    op.drop_column("personais", "novidade_vista")
