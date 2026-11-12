from datetime import datetime
from decimal import Decimal

from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.core.cpf import cpf_valido, formatar_cpf

from app.schemas.common import OrmModel


class AssinaturaOut(OrmModel):
    status: str
    ativa: bool
    current_period_end: datetime | None
    limite_alunos: int | None = None
    alunos_cadastrados: int = 0
    valor_mensal: Decimal | None = None
    automatica: bool = False  # True = cobrada no cartão pelo Mercado Pago; False = manual/nenhuma
    pagamento_disponivel: bool = False  # Mercado Pago configurado no servidor
    mp_public_key: str | None = None  # pro formulário de cartão (chave pública, feita pro navegador)
    forma_pagamento: str | None = None  # "credito" (automático), "debito", "pix" ou None (admin)
    cancelamento_agendado: bool = False  # cancelou: não renova, ativa até current_period_end
    reembolso_ate: datetime | None = None  # até quando cancelar devolve o dinheiro
    reembolso_horas: int = 0
    dias_para_vencer: int | None = None  # Pix/débito: dias até o acesso vencer
    alerta_vencimento: bool = False  # mostrar o aviso grande de "pague o próximo mês"
    pode_pagar_avulso: bool = False  # Pix/débito liberados agora (assinar ou renovar)
    pode_assinar_credito: bool = False
    pagamento_em_andamento: bool = False  # Pix gerado / débito em análise esperando confirmação


class AssinarCartaoIn(BaseModel):
    # Token de uso único gerado pelo Card Brick do Mercado Pago no navegador.
    card_token: str = Field(min_length=8, max_length=200)
    # "credito" = assinatura automática; "debito" = paga 1 mês agora.
    tipo: Literal["credito", "debito"] = "credito"
    # Só pro débito (vêm do próprio formulário do Mercado Pago):
    payment_method_id: str | None = Field(default=None, max_length=40)
    issuer_id: str | None = Field(default=None, max_length=20)
    documento_tipo: str | None = Field(default=None, max_length=10)
    documento_numero: str | None = Field(default=None, max_length=20)


class PixIn(BaseModel):
    # Só pra conta antiga que ainda não tem CPF (o cadastro novo já pede).
    cpf: str | None = Field(default=None, max_length=14)

    @field_validator("cpf")
    @classmethod
    def cpf_ok(cls, valor: str | None) -> str | None:
        if valor is None or not valor.strip():
            return None
        if not cpf_valido(valor):
            raise ValueError("CPF inválido. Confira os números.")
        return formatar_cpf(valor)


class PixOut(BaseModel):
    pagamento_id: str
    qr_code: str  # Pix copia e cola
    qr_code_base64: str  # imagem PNG do QR code
    ticket_url: str | None = None
    expira_em: datetime | None = None
    valor: float | None = None
