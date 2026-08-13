"""
Configurações da aplicação, lidas do arquivo .env (veja .env.example).
"""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Banco de dados
    database_url: str = "postgresql+psycopg2://seklyn:seklyn@localhost:5432/seklyn"

    # Segurança / JWT
    jwt_secret: str = "troque-este-valor-em-producao"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24

    # Frontend (CORS + geração de links do aluno)
    frontend_url: str = "http://localhost:5500"

    # Stripe (o valor cobrado é definido no Price configurado no painel do Stripe,
    # não fica hardcoded aqui — o preço passou a ser negociado por Personal)
    stripe_secret_key: str = ""
    stripe_publishable_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_price_id: str = ""

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
