"""tabela de vídeos de exercício + referência no exercicio

Revision ID: 0012_videos_exercicio
Revises: 0011_is_admin_personal
Create Date: 2026-08-18

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0012_videos_exercicio"
down_revision: Union[str, None] = "0011_is_admin_personal"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "videos_exercicio",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("personal_id", sa.Integer(), sa.ForeignKey("personais.id", ondelete="CASCADE"), nullable=False),
        sa.Column("nome_exercicio", sa.String(120), nullable=False),
        sa.Column("nome_normalizado", sa.String(120), nullable=False),
        sa.Column("tipo", sa.String(10), nullable=False),
        sa.Column("url", sa.String(500), nullable=False),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("personal_id", "nome_normalizado", name="uq_video_personal_nome"),
    )
    op.create_index("ix_videos_exercicio_nome_normalizado", "videos_exercicio", ["nome_normalizado"])
    op.add_column(
        "exercicios",
        sa.Column(
            "video_exercicio_id",
            sa.Integer(),
            sa.ForeignKey("videos_exercicio.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("exercicios", "video_exercicio_id")
    op.drop_index("ix_videos_exercicio_nome_normalizado", table_name="videos_exercicio")
    op.drop_table("videos_exercicio")
