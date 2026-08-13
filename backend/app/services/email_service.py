"""
Envio de e-mail transacional via Resend. Sem RESEND_API_KEY configurada
(ambiente de desenvolvimento), o e-mail só é logado no console — mesma
lógica usada no v1, pra não precisar de provedor real rodando localmente.
"""
import json
import logging
import urllib.error
import urllib.request

from app.core.config import get_settings

settings = get_settings()
logger = logging.getLogger("seklyn.email")

RESEND_URL = "https://api.resend.com/emails"


def enviar_email(destinatario: str, assunto: str, html: str) -> None:
    if not settings.resend_api_key:
        logger.info("EMAIL -> to=%s subject=%s\n%s", destinatario, assunto, html)
        return

    corpo = json.dumps(
        {"from": settings.email_from, "to": [destinatario], "subject": assunto, "html": html}
    ).encode("utf-8")

    requisicao = urllib.request.Request(
        RESEND_URL,
        data=corpo,
        method="POST",
        headers={
            "Authorization": f"Bearer {settings.resend_api_key}",
            "Content-Type": "application/json",
            # Sem um User-Agent "de navegador", o Cloudflare na frente da API
            # do Resend bloqueia a requisição (erro 1010) por parecer bot.
            "User-Agent": "Mozilla/5.0 (compatible; SeklynAPI/1.0; +https://seklyn.com.br)",
        },
    )
    try:
        with urllib.request.urlopen(requisicao, timeout=10) as resposta:
            resposta.read()
    except urllib.error.HTTPError as erro:
        # Falha no envio de e-mail não pode derrubar o cadastro/login do Personal,
        # mas logamos o corpo da resposta do Resend (traz o motivo real do erro).
        corpo_erro = erro.read().decode("utf-8", errors="replace")
        logger.error("Falha ao enviar e-mail via Resend para %s: HTTP %s -> %s", destinatario, erro.code, corpo_erro)
    except Exception:
        logger.exception("Falha ao enviar e-mail via Resend para %s", destinatario)


def enviar_email_confirmacao(destinatario: str, nome: str, link_confirmacao: str) -> None:
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color:#4c1d95;">Confirme seu e-mail — Seklyn</h2>
      <p>Olá, {nome}!</p>
      <p>Falta pouco para começar a usar o Seklyn. Clique no link abaixo para confirmar seu e-mail:</p>
      <p style="margin: 24px 0;">
        <a href="{link_confirmacao}" style="background:#7c3aed;color:#fff;padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:600;">
          Confirmar e-mail
        </a>
      </p>
      <p style="color:#64748b;font-size:0.85rem;">Se você não criou uma conta no Seklyn, pode ignorar este e-mail.</p>
    </div>
    """
    enviar_email(destinatario, "Confirme seu e-mail — Seklyn", html)
