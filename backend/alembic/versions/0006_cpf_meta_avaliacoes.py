"""cpf e meta de peso do aluno + histórico de avaliações físicas

Revision ID: 0006_cpf_meta_avaliacoes
Revises: 0005_intervalo_descanso_serie
Create Date: 2026-08-14

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0006_cpf_meta_avaliacoes"
down_revision: Union[str, None] = "0005_intervalo_descanso_serie"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("alunos", sa.Column("cpf", sa.String(14), nullable=True))
    op.add_column("alunos", sa.Column("peso_meta_kg", sa.Float(), nullable=True))

    op.create_table(
        "avaliacoes_fisicas",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("aluno_id", sa.Integer(), sa.ForeignKey("alunos.id", ondelete="CASCADE"), nullable=False),
        sa.Column("data", sa.Date(), nullable=False),
        sa.Column("peso_kg", sa.Float(), nullable=True),
        sa.Column("observacoes", sa.String(255), nullable=True),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_avaliacoes_fisicas_aluno_id", "avaliacoes_fisicas", ["aluno_id"])


def downgrade() -> None:
    op.drop_index("ix_avaliacoes_fisicas_aluno_id", table_name="avaliacoes_fisicas")
    op.drop_table("avaliacoes_fisicas")
    op.drop_column("alunos", "peso_meta_kg")
    op.drop_column("alunos", "cpf")
