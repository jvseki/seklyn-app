from pydantic import BaseModel, Field


class MensagemHistoricoIn(BaseModel):
    role: str = Field(pattern="^(user|model)$")
    texto: str = Field(max_length=2000)


class AssistenteMensagemIn(BaseModel):
    mensagem: str = Field(min_length=1, max_length=500)
    # Só as últimas trocas — o serviço também limita, isso aqui evita mandar
    # um payload gigante sem necessidade.
    historico: list[MensagemHistoricoIn] = Field(default_factory=list, max_length=12)


class AssistenteRespostaOut(BaseModel):
    resposta: str
