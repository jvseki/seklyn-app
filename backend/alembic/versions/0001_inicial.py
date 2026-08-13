"""schema inicial do Seklyn

Revision ID: 0001_inicial
Revises:
Create Date: 2026-08-12

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0001_inicial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "personais",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("nome", sa.String(120), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("senha_hash", sa.String(255), nullable=False),
        sa.Column("telefone", sa.String(30), nullable=True),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_personais_email", "personais", ["email"], unique=True)

    op.create_table(
        "alunos",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("personal_id", sa.Integer(), sa.ForeignKey("personais.id", ondelete="CASCADE"), nullable=False),
        sa.Column("nome", sa.String(120), nullable=False),
        sa.Column("hash_token", sa.String(64), nullable=False),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("ativo", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_alunos_hash_token", "alunos", ["hash_token"], unique=True)
    op.create_index("ix_alunos_personal_id", "alunos", ["personal_id"])

    op.create_table(
        "treinos",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("aluno_id", sa.Integer(), sa.ForeignKey("alunos.id", ondelete="CASCADE"), nullable=False),
        sa.Column("nome", sa.String(120), nullable=False),
        sa.Column("ordem", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("ativo", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_treinos_aluno_id", "treinos", ["aluno_id"])

    op.create_table(
        "exercicios",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("treino_id", sa.Integer(), sa.ForeignKey("treinos.id", ondelete="CASCADE"), nullable=False),
        sa.Column("nome", sa.String(120), nullable=False),
        sa.Column("ordem", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("observacoes", sa.Text(), nullable=True),
    )
    op.create_index("ix_exercicios_treino_id", "exercicios", ["treino_id"])

    op.create_table(
        "series",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("exercicio_id", sa.Integer(), sa.ForeignKey("exercicios.id", ondelete="CASCADE"), nullable=False),
        sa.Column("ordem", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("repeticoes_alvo", sa.String(30), nullable=False),
        sa.Column("carga_alvo", sa.String(30), nullable=True),
    )
    op.create_index("ix_series_exercicio_id", "series", ["exercicio_id"])

    op.create_table(
        "execucoes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("serie_id", sa.Integer(), sa.ForeignKey("series.id", ondelete="CASCADE"), nullable=False),
        sa.Column("aluno_id", sa.Integer(), sa.ForeignKey("alunos.id", ondelete="CASCADE"), nullable=False),
        sa.Column("data_execucao", sa.Date(), nullable=False),
        sa.Column("concluida", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("repeticoes_realizadas", sa.Integer(), nullable=True),
        sa.Column("carga_realizada", sa.String(30), nullable=True),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("serie_id", "data_execucao", name="uq_execucao_serie_dia"),
    )
    op.create_index("ix_execucoes_serie_id", "execucoes", ["serie_id"])
    op.create_index("ix_execucoes_aluno_id", "execucoes", ["aluno_id"])
    op.create_index("ix_execucoes_data_execucao", "execucoes", ["data_execucao"])

    op.create_table(
        "assinaturas",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("personal_id", sa.Integer(), sa.ForeignKey("personais.id", ondelete="CASCADE"), nullable=False),
        sa.Column("stripe_customer_id", sa.String(255), nullable=True),
        sa.Column("stripe_subscription_id", sa.String(255), nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="inativa"),
        sa.Column("current_period_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("atualizado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("personal_id", name="uq_assinatura_personal_id"),
    )

    op.create_table(
        "recomendacoes_produtos",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("personal_id", sa.Integer(), sa.ForeignKey("personais.id", ondelete="CASCADE"), nullable=False),
        sa.Column("titulo", sa.String(150), nullable=False),
        sa.Column("descricao", sa.Text(), nullable=True),
        sa.Column("url_afiliado", sa.String(500), nullable=False),
        sa.Column("categoria", sa.String(60), nullable=True),
        sa.Column("ordem", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("ativo", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_recomendacoes_personal_id", "recomendacoes_produtos", ["personal_id"])


def downgrade() -> None:
    op.drop_table("recomendacoes_produtos")
    op.drop_table("assinaturas")
    op.drop_table("execucoes")
    op.drop_table("series")
    op.drop_table("exercicios")
    op.drop_table("treinos")
    op.drop_table("alunos")
    op.drop_table("personais")
