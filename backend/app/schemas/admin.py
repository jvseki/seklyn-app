from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, EmailStr, Field

# Mesmas 7 chaves com bloco de CSS em variables.css ([data-tema-personalizado="X"]).
# Uma cor nova sempre exige desenhar o bloco de CSS antes — por isso o admin só
# escolhe entre essas, nunca digita livre (evitaria tema "aplicado" sem estilo).
TemaPersonalizado = Literal["rosa", "verde", "azul", "celeste", "choque", "amarelo", "laranja"]


class AdminEmailIn(BaseModel):
    email: EmailStr


class AdminAtivarIn(BaseModel):
    email: EmailStr
    # Quantos alunos esse Personal pode cadastrar (combinado individualmente
    # fora do site). Se omitido, mantém o limite que já estava definido.
    limite_alunos: int | None = None


class AdminAssinaturaOut(BaseModel):
    email: EmailStr
    status: str
    limite_alunos: int | None = None


class AdminLimiteIn(BaseModel):
    limite_alunos: int | None = None


class AdminValorIn(BaseModel):
    # Mensalidade combinada com o Personal (cobrada no cartão via Mercado
    # Pago). None = ainda não combinado — ele não consegue assinar sozinho.
    valor_mensal: Decimal | None = Field(default=None, gt=0, max_digits=10, decimal_places=2)


class AdminTemaIn(BaseModel):
    tema_personalizado: TemaPersonalizado | None = None  # None = tema padrão (roxo)


class AdminPersonalListaOut(BaseModel):
    """Uma linha da tabela do painel de administração (visão geral de todos
    os Personals cadastrados, pra ativar/desativar sem precisar entrar na VPS)."""

    id: int
    nome: str
    email: EmailStr
    email_verificado: bool
    tema_personalizado: str | None
    is_admin: bool
    criado_em: datetime
    assinatura_status: str
    limite_alunos: int | None
    valor_mensal: Decimal | None = None
    cobranca_automatica: bool = False
    total_alunos: int
