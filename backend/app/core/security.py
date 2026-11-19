"""
Funções de segurança: hash de senha, geração/validação de JWT do Personal
e geração do hash_token único do Aluno (acesso sem login).
"""
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import get_settings

settings = get_settings()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_senha(senha: str) -> str:
    return pwd_context.hash(senha)


def verificar_senha(senha: str, senha_hash: str) -> bool:
    return pwd_context.verify(senha, senha_hash)


def criar_token_acesso(personal_id: int) -> str:
    """Gera o JWT usado pelo Personal para autenticar chamadas à API."""
    expira_em = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    payload: dict[str, Any] = {"sub": str(personal_id), "exp": expira_em}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decodificar_token_acesso(token: str) -> int | None:
    """Retorna o id do Personal contido no token, ou None se inválido/expirado.
    Token de comprador da loja (tipo "comprador") NUNCA vale como Personal —
    os ids são de tabelas diferentes e poderiam coincidir."""
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        if payload.get("tipo", "personal") != "personal":
            return None
        personal_id = payload.get("sub")
        return int(personal_id) if personal_id is not None else None
    except (JWTError, ValueError):
        return None


def gerar_hash_token() -> str:
    """
    Gera o token único usado na URL de acesso do Aluno
    (ex: https://.../aluno/treino.html?t=<hash_token>).
    URL-safe, sem necessidade de login/senha.
    """
    return secrets.token_urlsafe(24)


def gerar_token_verificacao() -> tuple[str, datetime]:
    """Token de confirmação de e-mail + validade (48h)."""
    token = secrets.token_urlsafe(32)
    expira_em = datetime.now(timezone.utc) + timedelta(hours=48)
    return token, expira_em


# ---------- Comprador da loja (aluno que compra planilhas) ----------


def criar_token_comprador(comprador_id: int) -> str:
    expira_em = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    payload: dict[str, Any] = {"sub": str(comprador_id), "tipo": "comprador", "exp": expira_em}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decodificar_token_comprador(token: str) -> int | None:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        if payload.get("tipo") != "comprador":
            return None
        return int(payload["sub"])
    except (JWTError, ValueError, KeyError):
        return None


# ---------- Link temporário pros arquivos pagos (vídeo/download) ----------
# O <video> e o download não conseguem mandar o cabeçalho Authorization, então
# o site pede um link assinado (válido por algumas horas) pra cada arquivo.


def assinar_link_conteudo(conteudo_id: int, comprador_id: int, horas: int = 6) -> str:
    expira = int((datetime.now(timezone.utc) + timedelta(hours=horas)).timestamp())
    msg = f"{conteudo_id}:{comprador_id}:{expira}".encode()
    assinatura = hmac.new(settings.jwt_secret.encode(), msg, hashlib.sha256).hexdigest()[:40]
    return f"{comprador_id}.{expira}.{assinatura}"


def validar_link_conteudo(conteudo_id: int, token: str) -> bool:
    try:
        comprador_id, expira, assinatura = token.split(".")
        if int(expira) < datetime.now(timezone.utc).timestamp():
            return False
        msg = f"{conteudo_id}:{int(comprador_id)}:{int(expira)}".encode()
        esperado = hmac.new(settings.jwt_secret.encode(), msg, hashlib.sha256).hexdigest()[:40]
        return hmac.compare_digest(esperado, assinatura)
    except (ValueError, AttributeError):
        return False
