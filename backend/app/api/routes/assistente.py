from fastapi import APIRouter, Depends

from app.deps import get_current_personal
from app.models.personal import Personal
from app.schemas.assistente import AssistenteMensagemIn, AssistenteRespostaOut
from app.services.assistente_ia import perguntar_assistente

router = APIRouter(prefix="/api/personal/assistente", tags=["Assistente"])


@router.post("", response_model=AssistenteRespostaOut)
async def perguntar(
    dados: AssistenteMensagemIn,
    personal: Personal = Depends(get_current_personal),
) -> AssistenteRespostaOut:
    resposta = await perguntar_assistente(dados.mensagem, dados.historico)
    return AssistenteRespostaOut(resposta=resposta)
