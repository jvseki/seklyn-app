"""
Envio de e-mail transacional via Resend. Sem RESEND_API_KEY configurada
(ambiente de desenvolvimento), o e-mail só é logado no console — mesma
lógica usada no v1, pra não precisar de provedor real rodando localmente.
"""
import json
import logging
import urllib.error
import urllib.request
from html import escape

from app.core.config import get_settings

settings = get_settings()
logger = logging.getLogger("seklyn.email")

RESEND_URL = "https://api.resend.com/emails"


def enviar_email(destinatario: str, assunto: str, html: str, texto: str | None = None) -> None:
    if not settings.resend_api_key:
        logger.info("EMAIL -> to=%s subject=%s\n%s", destinatario, assunto, texto or html)
        return

    payload = {"from": settings.email_from, "to": [destinatario], "subject": assunto, "html": html}
    if texto:
        # Versão em texto puro junto do HTML: provedores (Gmail etc.) tratam
        # e-mail só-HTML com mais desconfiança — ajuda a não cair no spam.
        payload["text"] = texto
    corpo = json.dumps(payload).encode("utf-8")

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


def gerar_mensagem_treino_ia(aluno_nome: str, treino_nome: str) -> str | None:
    """
    Ponto de extensão pra gerar a frase de aviso do e-mail de treino via IA
    (ex: Gemini) em vez do texto fixo — recebe o essencial (nome do aluno e
    do treino) pra montar algo mais pessoal ("Bora, João! Hoje é dia de
    Costas e Bíceps..."). Por enquanto retorna None (usa o texto padrão em
    enviar_email_notificacao_treino) — plugar a chamada de verdade aqui é o
    suficiente pra ligar a personalização, sem mexer em mais nada do fluxo.
    """
    return None


# ---------- Layout dos e-mails (a cara do site) ----------
#
# Tabelas + estilos inline de propósito: é o único jeito de renderizar
# igual no Gmail, Outlook e no app de e-mail do iPhone (eles ignoram <style>
# e flexbox/grid). Cabeçalho escuro com o logo e a faixa neon do site; corpo
# branco pra leitura; botão "à prova de Outlook" (tabela com bgcolor).

LOGO_URL = "https://seklyn.com.br/assets/img/logo-s.png"

# Mesma cor principal de cada tema em frontend/assets/css/variables.css —
# o e-mail que o aluno recebe sai na cor da conta do Personal dele.
CORES_TEMA = {
    None: "#7c3aed",
    "rosa": "#db2777",
    "verde": "#16a34a",
    "azul": "#2563eb",
    "celeste": "#0ea5e9",
    "choque": "#c026d3",
    "amarelo": "#d97706",  # amber-600: o amber-500 do site não dá contraste com texto branco
    "laranja": "#ea580c",
}


def _layout(*, titulo: str, previa: str, paragrafos: list[str], botao_texto: str, botao_link: str, rodape: str, cor: str = "#7c3aed") -> str:
    """Monta o HTML completo do e-mail. `paragrafos` já devem vir escapados."""
    corpo = "".join(
        f'<p style="margin:0 0 18px;font-size:17px;line-height:1.65;color:#0f172a;">{p}</p>' for p in paragrafos
    )
    link = escape(botao_link, quote=True)
    fonte = "'Segoe UI',Roboto,Arial,sans-serif"
    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<title>{escape(titulo)}</title>
</head>
<body style="margin:0;padding:0;background:#f3f1fa;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">{escape(previa)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f1fa;">
<tr><td align="center" style="padding:32px 14px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:540px;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 18px 40px -20px rgba(76,29,149,0.35);">
    <tr><td bgcolor="#0b0716" style="background:#0b0716;background-image:radial-gradient(circle at 80% 0%,{cor}88,transparent 62%),linear-gradient(135deg,#0b0716,#1e1035);padding:34px 32px 30px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="vertical-align:middle;background:#ffffff;border-radius:12px;padding:6px;"><img src="{LOGO_URL}" width="34" height="33" alt="Seklyn" style="display:block;border:0;"></td>
        <td style="vertical-align:middle;padding-left:12px;font-family:{fonte};font-size:22px;font-weight:800;color:#ffffff;">Sek<span style="color:#c4b5fd;">lyn</span></td>
      </tr></table>
      <h1 style="margin:26px 0 0;font-family:{fonte};font-size:27px;line-height:1.2;font-weight:800;color:#ffffff;">{escape(titulo)}</h1>
    </td></tr>
    <tr><td height="4" style="height:4px;line-height:4px;font-size:0;background:{cor};background-image:linear-gradient(90deg,{cor},#ec4899);">&nbsp;</td></tr>
    <tr><td style="padding:32px 32px 8px;font-family:{fonte};">
      {corpo}
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:10px 0 26px;"><tr>
        <td bgcolor="{cor}" style="border-radius:14px;background:{cor};background-image:linear-gradient(135deg,{cor},#4c1d95);">
          <a href="{link}" style="display:inline-block;padding:15px 30px;font-family:{fonte};font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:14px;">{escape(botao_texto)} &rarr;</a>
        </td>
      </tr></table>
      <p style="margin:0 0 26px;font-size:14px;line-height:1.55;color:#475569;">Se o botão não funcionar, copie e cole no navegador:<br><a href="{link}" style="color:{cor};font-weight:600;word-break:break-all;">{escape(botao_link)}</a></p>
    </td></tr>
    <tr><td style="padding:20px 32px 28px;border-top:1px solid #e2e8f0;background:#faf9ff;font-family:{fonte};">
      <p style="margin:0;font-size:13px;line-height:1.65;color:#475569;">{rodape}<br><strong style="color:#0f172a;">Seklyn</strong> · acompanhamento de treinos série por série · <a href="https://seklyn.com.br" style="color:#475569;text-decoration:underline;">seklyn.com.br</a></p>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>"""


def enviar_email_notificacao_treino(
    destinatario: str,
    aluno_nome: str,
    treino_nome: str,
    link_treino: str,
    personal_nome: str | None = None,
    tema_personal: str | None = None,
) -> None:
    """E-mail automático avisando que o treino do aluno foi criado/atualizado
    pelo Personal — ver _notificar_aluno_treino_atualizado() em
    api/routes/personal.py pra quando isso é disparado. Sai na cor da conta
    do Personal (o mesmo tema que o aluno vê no app)."""
    primeiro_nome = aluno_nome.split(" ")[0]
    quem = personal_nome.split(" ")[0] if personal_nome else "Seu Personal"
    intro_ia = gerar_mensagem_treino_ia(aluno_nome, treino_nome)
    paragrafos = [
        f"Olá, {escape(primeiro_nome)}!",
        escape(intro_ia)
        if intro_ia
        else f"{escape(quem)} atualizou o seu treino <strong>{escape(treino_nome)}</strong>. Já está tudo pronto pra você abrir e marcar série por série.",
    ]
    html = _layout(
        titulo="Seu treino foi atualizado 💪",
        previa=f"{treino_nome} — já está no seu app.",
        paragrafos=paragrafos,
        botao_texto="Abrir meu treino",
        botao_link=link_treino,
        rodape="Você recebe este aviso sempre que seu Personal mexe no seu treino.",
        cor=CORES_TEMA.get(tema_personal, CORES_TEMA[None]),
    )
    texto = (
        f"Olá, {primeiro_nome}!\n\n"
        f'{quem} atualizou o seu treino "{treino_nome}".\n'
        f"Abra aqui: {link_treino}\n\n— Seklyn · seklyn.com.br"
    )
    enviar_email(destinatario, f'Seu treino "{treino_nome}" foi atualizado — Seklyn', html, texto)


def enviar_email_confirmacao(destinatario: str, nome: str, link_confirmacao: str) -> None:
    primeiro_nome = nome.split(" ")[0]
    html = _layout(
        titulo="Confirme seu e-mail",
        previa="Falta só um clique pra liberar sua conta no Seklyn.",
        paragrafos=[
            f"Olá, {escape(primeiro_nome)}! Que bom ter você no Seklyn.",
            "Falta só um passo: confirme seu e-mail pra deixar sua conta segura e receber os avisos dos seus alunos.",
        ],
        botao_texto="Confirmar meu e-mail",
        botao_link=link_confirmacao,
        rodape="Se você não criou uma conta no Seklyn, pode ignorar este e-mail.",
    )
    texto = (
        f"Olá, {primeiro_nome}!\n\nConfirme seu e-mail no Seklyn: {link_confirmacao}\n\n"
        "Se você não criou uma conta, ignore este e-mail.\n— Seklyn · seklyn.com.br"
    )
    enviar_email(destinatario, "Confirme seu e-mail — Seklyn", html, texto)
