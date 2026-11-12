"""
Configurações da aplicação, lidas do arquivo .env (veja .env.example).
"""
from decimal import Decimal
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Banco de dados
    database_url: str = "postgresql+psycopg2://seklyn:seklyn@localhost:5432/seklyn"

    # Segurança / JWT
    jwt_secret: str = "troque-este-valor-em-producao"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 30  # 30 dias — evita deslogar sozinho a cada dia que reabre o site

    # Frontend (CORS + geração de links do aluno)
    frontend_url: str = "http://localhost:5500"

    # Mercado Pago — assinatura mensal do Personal (Assinaturas / preapproval).
    # O valor cobrado é por Personal (Assinatura.valor_mensal, definido no admin),
    # porque o preço é negociado individualmente. Sem token configurado, o botão
    # de assinar responde "indisponível" em vez de quebrar.
    # Use as credenciais de TESTE (TEST-...) em desenvolvimento.
    mercadopago_access_token: str = ""
    # Chave PÚBLICA (vai pro navegador, é feita pra isso): carrega o formulário
    # de cartão do Mercado Pago (Card Brick) dentro da página de assinatura.
    mercadopago_public_key: str = ""
    # Chave secreta dos webhooks (Suas integrações > Webhooks), pra validar o
    # header x-signature das notificações.
    mercadopago_webhook_secret: str = ""
    # Quantas horas depois de um pagamento o Personal ainda pode cancelar com
    # reembolso total. Passou disso, cancelar só para a renovação e o acesso
    # continua até o fim do mês já pago. 0 = sem reembolso.
    reembolso_horas: int = 10
    # Mensalidade de quem ainda não tem valor combinado no admin. Em teste: 1.00.
    # Mude no .env (VALOR_MENSAL_PADRAO=89.90) quando for lançar; 0 = sem padrão.
    valor_mensal_padrao: Decimal = Decimal("1.00")
    # Pix e débito não renovam sozinhos: a partir de quantos dias antes do
    # vencimento o aviso grande de "pague o próximo mês" aparece.
    dias_alerta_vencimento: int = 5

    # E-mail transacional (confirmação de cadastro) via Resend.
    # Sem chave configurada, o e-mail só é logado no console (modo dev).
    resend_api_key: str = ""
    email_from: str = "Seklyn <nao-responda@seklyn.com.br>"

    # Chave simples pra ativar/desativar assinatura manualmente (enquanto o
    # pagamento é combinado fora do site, sem checkout automático ainda).
    admin_secret_key: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
