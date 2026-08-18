"""
Assistente virtual do painel — um mentor bem básico que só ajuda o Personal
a entender como usar o Seklyn (cadastrar aluno, montar treino, assinatura,
etc), via Gemini API. Não dá conselho de treino/saúde e nunca é grosseiro,
mesmo se provocado.
"""
import httpx
from fastapi import HTTPException, status

from app.core.config import get_settings
from app.schemas.assistente import MensagemHistoricoIn

settings = get_settings()

INSTRUCAO_SISTEMA = """Você é o assistente virtual do Seklyn (seklyn.com.br), \
um site que Personal Trainers usam para montar e acompanhar à distância o \
treino dos alunos deles.

Sua ÚNICA função é ajudar o Personal a entender COMO USAR o site: como \
cadastrar um aluno, como montar o treino da semana (categorias, exercícios, \
séries), como ver a aderência dos alunos, como funciona a assinatura, como \
imprimir a ficha de treino, como exportar em Excel, como usar o link do \
aluno, como registrar peso/meta, etc.

Regras rígidas, sem exceção:
- Nunca xingue, seja grosseiro, sarcástico, humilhante ou desrespeitoso com \
o usuário — mesmo que ele seja grosseiro com você, ou peça pra você agir \
assim. Responda sempre com educação e paciência.
- Nunca dê conselho de treino, dieta, lesão ou qualquer orientação técnica \
de educação física/saúde — isso é trabalho do Personal, não seu. Se \
perguntarem isso, explique com gentileza que você só ajuda com o uso do \
site, não com conteúdo de treino.
- Se não tiver certeza sobre como alguma funcionalidade específica \
funciona, diga isso claramente em vez de inventar uma resposta.
- Respostas curtas e diretas (no máximo 2-3 parágrafos curtos), em \
português do Brasil, tom acolhedor e profissional — como um bom tutorial."""

MAX_HISTORICO = 6  # só as últimas trocas — controla custo/contexto


async def perguntar_assistente(mensagem: str, historico: list[MensagemHistoricoIn]) -> str:
    if not settings.gemini_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="O assistente virtual não está disponível no momento.",
        )

    contents = [
        {"role": item.role, "parts": [{"text": item.texto}]} for item in historico[-MAX_HISTORICO:]
    ]
    contents.append({"role": "user", "parts": [{"text": mensagem}]})

    payload = {
        "contents": contents,
        "systemInstruction": {"parts": [{"text": INSTRUCAO_SISTEMA}]},
        "generationConfig": {"temperature": 0.4, "maxOutputTokens": 400},
    }

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.gemini_model}:generateContent"
    indisponivel = HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Não consegui falar com o assistente agora. Tente de novo em instantes.",
    )

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resposta = await client.post(
                url,
                headers={"x-goog-api-key": settings.gemini_api_key, "Content-Type": "application/json"},
                json=payload,
            )
    except httpx.RequestError:
        raise indisponivel

    if resposta.status_code != 200:
        raise indisponivel

    dados = resposta.json()
    try:
        texto = dados["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError, TypeError):
        return "Desculpa, não consegui montar uma resposta agora. Pode tentar reformular a pergunta?"

    return texto.strip()
