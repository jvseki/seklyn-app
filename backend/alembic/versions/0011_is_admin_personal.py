"""is_admin do personal (super admin do painel)

Revision ID: 0011_is_admin_personal
Revises: 0010_cpf_endereco_personal
Create Date: 2026-08-16

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0011_is_admin_personal"
down_revision: Union[str, None] = "0010_cpf_endereco_personal"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "personais",
        sa.Column("is_admin", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("personais", "is_admin")
