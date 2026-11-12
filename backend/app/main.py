"""
Ponto de entrada da API do Seklyn.
Rodar em desenvolvimento: uvicorn app.main:app --reload
"""
import logging
import os

from fastapi import FastAPI, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routes import admin, aluno, assinatura, auth, personal, recomendacoes, videos, parceiro
from app.core.config import get_settings
from app.core.erros import tratar_erro_validacao

settings = get_settings()
logger_seguranca = logging.getLogger("seklyn.seguranca")

app = FastAPI(
    title="Seklyn API",
    description="API do Seklyn — acompanhamento de treinos para Personal Trainers e seus alunos.",
    version="0.1.0",
    docs_url="/docs" if settings.mostrar_docs else None,
    redoc_url="/redoc" if settings.mostrar_docs else None,
    openapi_url="/openapi.json" if settings.mostrar_docs else None,
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
app.include_router(assinatura.router)
app.include_router(admin.router)
app.include_router(parceiro.router)
app.include_router(videos.router)

# Vídeos e fotos enviados (upload direto) — fica em uploads/, montado no
# volume persistente do Docker pra sobreviver a rebuild/restart do container.
os.makedirs("uploads/videos", exist_ok=True)
os.makedirs("uploads/fotos", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


@app.post("/api/csp-report", status_code=204, include_in_schema=False)
async def relatorio_csp(request: Request) -> Response:
    """
    Recebe os avisos da Content-Security-Policy (o navegador manda quando
    algo bloqueado/suspeito tenta carregar no site). Por enquanto a política
    roda em modo "só relatar": isso mostra o que precisa ser liberado antes
    de passar a bloquear de verdade (sem quebrar o pagamento).
    """
    corpo = (await request.body())[:2000]
    logger_seguranca.warning("CSP: %s", corpo.decode("utf-8", errors="replace"))
    return Response(status_code=204)


@app.get("/api/saude", tags=["Saúde"])
def saude() -> dict:
    """Endpoint simples para checar se a API está no ar."""
    return {"status": "ok", "servico": "Seklyn API"}
