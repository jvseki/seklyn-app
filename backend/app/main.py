"""
Ponto de entrada da API do Seklyn.
Rodar em desenvolvimento: uvicorn app.main:app --reload
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import aluno, auth, personal, recomendacoes, stripe_webhook
from app.core.config import get_settings

settings = get_settings()

app = FastAPI(
    title="Seklyn API",
    description="API do Seklyn — acompanhamento de treinos para Personal Trainers e seus alunos.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(personal.router)
app.include_router(aluno.router)
app.include_router(recomendacoes.router)
app.include_router(stripe_webhook.router)


@app.get("/api/saude", tags=["Saúde"])
def saude() -> dict:
    """Endpoint simples para checar se a API está no ar."""
    return {"status": "ok", "servico": "Seklyn API"}
