"""
E-mails de aviso com a cara do Seklyn (mesmo layout de services/email_service.py),
enviados pelo Resend:

- Loja de planilhas: compra confirmada (aluno) e nova venda (admin).
- Assinatura do Personal: pagamento confirmado, vencimento chegando (Pix/débito)
  e cancelamento.
- Parcerias: pedido recebido (Personal), novo pedido (admin) e mudança de status.

Tudo sai em segundo plano (thread): e-mail nunca atrasa nem derruba uma compra,
um pagamento ou um webhook.
"""
import logging
import threading
from datetime import datetime
from html import escape

from app.core.config import get_settings
from app.services.email_service import _layout, enviar_email

settings = get_settings()
logger = logging.getLogger("seklyn.email")

SITE = settings.frontend_url.rstrip("/")


_envios: list[threading.Thread] = []


def _em_segundo_plano(funcao, *args, **kwargs) -> None:
    def rodar():
        try:
            funcao(*args, **kwargs)
        except Exception:  # noqa: BLE001
            logger.exception("Falha montando/enviando e-mail %s", getattr(funcao, "__name__", funcao))

    t = threading.Thread(target=rodar, daemon=True)
    _envios.append(t)
    t.start()


def aguardar_envios(timeout: float = 30) -> None:
    """Pros scripts (cron): espera os e-mails saírem antes do processo terminar."""
    for t in list(_envios):
        t.join(timeout)
    _envios.clear()


def emails_admins(db) -> list[str]:
    from app.models.personal import Personal

    return [p.email for p in db.query(Personal).filter(Personal.is_admin.is_(True)).all()]


def _reais(valor) -> str:
    return f"R$ {float(valor):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def _data(d: datetime | None) -> str:
    return d.strftime("%d/%m/%Y") if d else ""


def _primeiro(nome: str | None) -> str:
    return (nome or "").strip().split(" ")[0] or "tudo bem"


def _enviar(
    destinatario: str,
    assunto: str,
    *,
    titulo: str,
    previa: str,
    paragrafos: list[str],
    botao: str,
    link: str,
    rodape: str,
    texto: str,
    icone: str | None = None,
    detalhes: list[tuple[str, str]] | None = None,
    passos: list[str] | None = None,
) -> None:
    html = _layout(
        titulo=titulo,
        previa=previa,
        paragrafos=paragrafos,
        botao_texto=botao,
        botao_link=link,
        rodape=rodape,
        icone=icone,
        detalhes=detalhes,
        passos=passos,
    )
    enviar_email(destinatario, assunto, html, texto)


# ---------- loja de planilhas ----------


def compra_confirmada(email: str, nome: str, produto: str, valor, produto_id: int | None) -> None:
    link = f"{SITE}/planilha-de-treino/minhas.html" + (f"?p={produto_id}" if produto_id else "")
    _em_segundo_plano(
        _enviar,
        email,
        f"Sua planilha está liberada: {produto} — Seklyn",
        icone="🎉",
        titulo="Sua planilha está liberada!",
        previa=f"{produto} já está em Minhas planilhas. Bom treino!",
        paragrafos=[f"Olá, {escape(_primeiro(nome))}! Pagamento confirmado — agora é com você. 💪"],
        detalhes=[("Planilha", produto), ("Valor pago", _reais(valor)), ("Acesso", "Liberado agora")],
        passos=[
            "Entre em <strong>Minhas planilhas</strong> com seu e-mail e senha",
            "Assista ao vídeo de cada exercício antes de treinar",
            "Baixe a planilha e leve no celular pra academia",
        ],
        botao="Abrir minhas planilhas",
        link=link,
        rodape="Você recebeu este e-mail porque comprou uma planilha no Seklyn. Guarde-o como comprovante.",
        texto=f"Olá, {_primeiro(nome)}!\n\nPagamento confirmado: {produto} ({_reais(valor)}).\nAcesse: {link}\n\n— Seklyn",
    )


def nova_venda_admin(emails: list[str], produto: str, valor, comprador_nome: str | None, parte_parceiro, parte_dono) -> None:
    link = f"{SITE}/personal/loja-parceiro.html"
    for email in emails:
        _em_segundo_plano(
            _enviar,
            email,
            f"Nova venda: {produto} ({_reais(valor)}) — Seklyn",
            icone="💸",
            titulo="Nova venda na loja!",
            previa=f"{comprador_nome or 'Um aluno'} comprou {produto}.",
            paragrafos=["Caiu mais uma venda na loja de planilhas. Resumo:"],
            detalhes=[
                ("Planilha", produto),
                ("Aluno", comprador_nome or "—"),
                ("Valor", _reais(valor)),
                ("Parte do parceiro", _reais(parte_parceiro or 0)),
                ("Sua parte", _reais(parte_dono or 0)),
            ],
            botao="Ver no painel da loja",
            link=link,
            rodape="Aviso automático das vendas da loja de planilhas.",
            texto=f"Nova venda: {produto} por {_reais(valor)} ({comprador_nome or 'aluno'}).\n{link}",
        )


# ---------- assinatura do Personal ----------

FORMAS = {"credito": "Cartão de crédito", "debito": "Cartão de débito", "pix": "Pix"}


def assinatura_paga(email: str, nome: str, valor, forma: str | None, ate: datetime | None, automatica: bool) -> None:
    link = f"{SITE}/personal/assinatura.html"
    detalhes = [("Valor", _reais(valor)), ("Forma", FORMAS.get(forma or "", "—"))]
    if ate:
        detalhes.append(("Próxima cobrança automática" if automatica else "Acesso garantido até", _data(ate)))
    _em_segundo_plano(
        _enviar,
        email,
        "Pagamento confirmado — Seklyn",
        icone="✅",
        titulo="Assinatura ativa!",
        previa=f"Recebemos {_reais(valor)} — obrigado por fazer parte do Seklyn.",
        paragrafos=[
            f"Olá, {escape(_primeiro(nome))}! Seu pagamento caiu e a assinatura está ativa.",
            "No cartão de crédito ela renova sozinha todo mês."
            if automatica
            else "Pix e débito não renovam sozinhos: alguns dias antes do vencimento te mandamos um lembrete.",
        ],
        detalhes=detalhes,
        botao="Ver minha assinatura",
        link=link,
        rodape="Comprovante de pagamento da sua assinatura do Seklyn.",
        texto=f"Olá, {_primeiro(nome)}!\n\nPagamento de {_reais(valor)} confirmado. Assinatura ativa até {_data(ate)}.\n{link}",
    )


def vencimento_proximo(email: str, nome: str, dias: int, ate: datetime | None) -> None:
    link = f"{SITE}/personal/assinatura.html"
    quando = "hoje" if dias <= 0 else ("amanhã" if dias == 1 else f"em {dias} dias")
    _em_segundo_plano(
        _enviar,
        email,
        f"Sua assinatura vence {quando} — Seklyn",
        icone="⏰",
        titulo=f"Sua assinatura vence {quando}",
        previa=f"Pague o próximo mês até {_data(ate)} e continue usando sem parar.",
        paragrafos=[
            f"Olá, {escape(_primeiro(nome))}! Passando pra lembrar: Pix e débito não renovam sozinhos.",
            "Pagando antes, o mês novo começa quando o atual acaba — você não perde nenhum dia.",
        ],
        detalhes=[("Vence em", _data(ate)), ("Seus alunos e treinos", "continuam salvos")],
        passos=["Abra <strong>Assinatura</strong> no Seklyn", "Escolha <strong>Pix</strong> ou <strong>débito</strong>", "Pronto: mais um mês garantido"],
        botao="Pagar o próximo mês",
        link=link,
        rodape="Prefere não se preocupar com isso? Mude pra cobrança automática no cartão de crédito.",
        texto=f"Olá, {_primeiro(nome)}!\n\nSua assinatura vence {quando} ({_data(ate)}). Pague aqui: {link}",
    )


def assinatura_cancelada(email: str, nome: str, ate: datetime | None, reembolsado: bool) -> None:
    link = f"{SITE}/personal/assinatura.html"
    if reembolsado:
        detalhes = [("Reembolso", "Pedido — aparece no banco em alguns dias")]
    elif ate:
        detalhes = [("Você continua usando até", _data(ate)), ("Renovação", "Desligada")]
    else:
        detalhes = [("Assinatura", "Encerrada")]
    _em_segundo_plano(
        _enviar,
        email,
        "Assinatura cancelada — Seklyn",
        icone="👋",
        titulo="Assinatura cancelada",
        previa="Seus alunos e treinos continuam salvos.",
        paragrafos=[
            f"Olá, {escape(_primeiro(nome))}. Confirmamos o cancelamento da sua assinatura.",
            "Seus alunos e treinos continuam salvos — quando quiser voltar, é só assinar de novo.",
        ],
        detalhes=detalhes,
        botao="Voltar a assinar",
        link=link,
        rodape="Se não foi você que cancelou, responda este e-mail.",
        texto=f"Olá, {_primeiro(nome)}.\n\nSua assinatura do Seklyn foi cancelada.\n{link}",
    )


# ---------- parcerias ----------


def pedido_parceria_recebido(email: str, nome: str) -> None:
    _em_segundo_plano(
        _enviar,
        email,
        "Recebemos seu pedido pra vender planilhas — Seklyn",
        icone="🤝",
        titulo="Pedido recebido!",
        previa="Logo te chamamos no WhatsApp pra combinar tudo.",
        paragrafos=[f"Olá, {escape(_primeiro(nome))}! Que bom que você quer vender suas planilhas no Seklyn. Os próximos passos:"],
        passos=[
            "A gente te chama no <strong>WhatsApp</strong>",
            "Combinamos as planilhas, o <strong>preço</strong> e a <strong>divisão</strong> de cada venda",
            "Você grava os vídeos e a gente publica na loja",
        ],
        botao="Ver a loja de planilhas",
        link=f"{SITE}/planilha-de-treino/",
        rodape="Você recebeu este e-mail porque pediu pra vender planilhas no Seklyn.",
        texto=f"Olá, {_primeiro(nome)}!\n\nRecebemos seu pedido pra vender planilhas no Seklyn. Logo entramos em contato pelo WhatsApp.",
    )


def pedido_parceria_admin(emails: list[str], nome: str, email_personal: str, whatsapp: str, instagram: str | None, mensagem: str | None) -> None:
    import re

    numero = re.sub(r"\D", "", whatsapp)
    if len(numero) <= 11:
        numero = "55" + numero
    for email in emails:
        _em_segundo_plano(
            _enviar,
            email,
            f"{nome} quer vender planilhas — Seklyn",
            icone="🤝",
            titulo="Novo pedido de parceria",
            previa=f"{nome} quer vender planilhas na loja.",
            paragrafos=[f"<strong>{escape(nome)}</strong> quer vender planilhas na loja do Seklyn."],
            detalhes=[("Personal", nome), ("E-mail", email_personal), ("WhatsApp", whatsapp), ("Instagram", instagram or "—")],
            passos=[f"O que pretende vender: {escape(mensagem)}"] if mensagem else None,
            botao="Chamar no WhatsApp",
            link=f"https://wa.me/{numero}",
            rodape="Você também vê esse pedido no Admin → Pedidos de parceria.",
            texto=f"{nome} ({email_personal}) quer vender planilhas. WhatsApp: {whatsapp}. Instagram: {instagram or '-'}.\n{mensagem or ''}",
        )


STATUS_TEXTO = {
    "em_contato": ("📲", "Estamos falando com você", "Já vimos seu pedido e vamos conversar pelo WhatsApp pra acertar os detalhes."),
    "aprovada": ("🚀", "Parceria aprovada!", "Bora vender! Vamos te ajudar a cadastrar suas planilhas na loja."),
    "recusada": ("💬", "Sobre seu pedido de parceria", "Por enquanto não vamos seguir com a parceria. Obrigado pelo interesse — podemos conversar de novo no futuro."),
}


def parceria_status(email: str, nome: str, status: str) -> None:
    if status not in STATUS_TEXTO:
        return
    icone, titulo, texto = STATUS_TEXTO[status]
    _em_segundo_plano(
        _enviar,
        email,
        f"{titulo} — Seklyn",
        icone=icone,
        titulo=titulo,
        previa=texto,
        paragrafos=[f"Olá, {escape(_primeiro(nome))}!", escape(texto)],
        botao="Abrir o Seklyn",
        link=f"{SITE}/personal/dashboard.html",
        rodape="Aviso sobre o seu pedido pra vender planilhas no Seklyn.",
        texto=f"Olá, {_primeiro(nome)}!\n\n{texto}",
    )
