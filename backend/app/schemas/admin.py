from datetime import datetime

from pydantic import BaseModel, EmailStr


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
    total_alunos: int
