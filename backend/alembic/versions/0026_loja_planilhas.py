"""loja de planilhas: compradores, produtos, conteúdos; venda ligada ao comprador/produto

Revision ID: 0026_loja_planilhas
Revises: 0025_parceiro_chave_verificada
Create Date: 2026-11-19

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0026_loja_planilhas"
down_revision: Union[str, None] = "0025_parceiro_chave_verificada"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "compradores",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("nome", sa.String(120), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("senha_hash", sa.String(255), nullable=False),
        sa.Column("cpf", sa.String(14), nullable=False),
        sa.Column("telefone", sa.String(30), nullable=True),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_compradores_email", "compradores", ["email"], unique=True)
    op.create_table(
        "produtos",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("parceiro_id", sa.Integer(), sa.ForeignKey("parceiros.id", ondelete="CASCADE"), nullable=False),
        sa.Column("titulo", sa.String(120), nullable=False),
        sa.Column("slug", sa.String(140), nullable=False),
        sa.Column("subtitulo", sa.String(200), nullable=True),
        sa.Column("descricao", sa.Text(), nullable=True),
        sa.Column("preco", sa.Numeric(10, 2), nullable=False),
        sa.Column("capa_url", sa.String(255), nullable=True),
        sa.Column("nivel", sa.String(40), nullable=True),
        sa.Column("duracao", sa.String(40), nullable=True),
        sa.Column("ativo", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("ordem", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_produtos_parceiro_id", "produtos", ["parceiro_id"])
    op.create_index("ix_produtos_slug", "produtos", ["slug"], unique=True)
    op.create_table(
        "conteudos_produto",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("produto_id", sa.Integer(), sa.ForeignKey("produtos.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tipo", sa.String(20), nullable=False),
        sa.Column("titulo", sa.String(160), nullable=False),
        sa.Column("caminho", sa.String(255), nullable=True),
        sa.Column("nome_original", sa.String(200), nullable=True),
        sa.Column("tamanho_bytes", sa.Integer(), nullable=True),
        sa.Column("url_youtube", sa.String(255), nullable=True),
        sa.Column("ordem", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_conteudos_produto_produto_id", "conteudos_produto", ["produto_id"])
    op.add_column("vendas_parceiro", sa.Column("comprador_id", sa.Integer(), sa.ForeignKey("compradores.id", ondelete="SET NULL"), nullable=True))
    op.add_column("vendas_parceiro", sa.Column("produto_id", sa.Integer(), sa.ForeignKey("produtos.id", ondelete="SET NULL"), nullable=True))
    op.create_index("ix_vendas_parceiro_comprador_id", "vendas_parceiro", ["comprador_id"])
    # A partir daqui a taxa do Mercado Pago é dividida entre os dois (decisão de 19/11).
    op.alter_column("parceiros", "taxa_paga_por", server_default="dividida")
    op.execute("UPDATE parceiros SET taxa_paga_por = 'dividida'")


def downgrade() -> None:
    op.alter_column("parceiros", "taxa_paga_por", server_default="parceiro")
    op.drop_index("ix_vendas_parceiro_comprador_id", table_name="vendas_parceiro")
    op.drop_column("vendas_parceiro", "produto_id")
    op.drop_column("vendas_parceiro", "comprador_id")
    op.drop_index("ix_conteudos_produto_produto_id", table_name="conteudos_produto")
    op.drop_table("conteudos_produto")
    op.drop_index("ix_produtos_slug", table_name="produtos")
    op.drop_index("ix_produtos_parceiro_id", table_name="produtos")
    op.drop_table("produtos")
    op.drop_index("ix_compradores_email", table_name="compradores")
    op.drop_table("compradores")
