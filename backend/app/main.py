"""
Ponto de entrada da API do Seklyn.
Rodar em desenvolvimento: uvicorn app.main:app --reload
"""
import os

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routes import admin, aluno, auth, personal, recomendacoes, stripe_webhook, videos
from app.core.config import get_settings
from app.core.erros import tratar_erro_validacao

settings = get_settings()

app = FastAPI(
    title="Seklyn API",
    description="API do Seklyn — acompanhamento de treinos para Personal Trainers e seus alunos.",
    version="0.1.0",
)

# Erros de validação (campo muito longo, obrigatório faltando, etc.) vêm em
# inglês por padrão do Pydantic — traduzido pra PT-BR antes de chegar no site.
app.add_exception_handler(RequestValidationError, tratar_erro_validacao)

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
app.include_router(admin.router)
app.include_router(videos.router)

# Vídeos enviados (upload direto) — fica em uploads/, montado no volume
# persistente do Docker pra sobreviver a rebuild/restart do container.
os.makedirs("uploads/videos", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


@app.get("/api/saude", tags=["Saúde"])
def saude() -> dict:
    """Endpoint simples para checar se a API está no ar."""
    return {"status": "ok", "servico": "Seklyn API"}
