"""comprador: entra com a conta Seklyn (personal_id) e CPF opcional

Revision ID: 0027_comprador_conta_seklyn
Revises: 0026_loja_planilhas
Create Date: 2026-11-19

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0027_comprador_conta_seklyn"
down_revision: Union[str, None] = "0026_loja_planilhas"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("compradores", "cpf", existing_type=sa.String(14), nullable=True)
    op.add_column("compradores", sa.Column("personal_id", sa.Integer(), sa.ForeignKey("personais.id", ondelete="SET NULL"), nullable=True))
    op.create_unique_constraint("uq_compradores_personal_id", "compradores", ["personal_id"])


def downgrade() -> None:
    op.drop_constraint("uq_compradores_personal_id", "compradores", type_="unique")
    op.drop_column("compradores", "personal_id")
    op.alter_column("compradores", "cpf", existing_type=sa.String(14), nullable=False)
