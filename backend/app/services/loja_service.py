"""
Loja de planilhas de treino (seklyn.com.br/planilha-de-treino).

- Produtos e conteúdos são cadastrados no Admin.
- O comprador cria conta (nome, e-mail, CPF), paga por Pix/crédito/débito
  na conta Mercado Pago do Seklyn e a venda entra na divisão com o parceiro
  (services/parceiro_service.py — mesma tabela de vendas da "Loja (teste)").
- Conteúdo pago fica em pasta PRIVADA (uploads/privado/...), que NÃO é
  servida como estática: só sai por /api/loja/arquivo/<id>?t=<link assinado>,
  e o link só é gerado pra quem tem a venda paga. Vídeo com suporte a Range
  (pular pra frente, tocar no iPhone).
"""
import os
import re
import unicodedata
import uuid
from collections.abc import Iterator

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.models.loja import Comprador, ConteudoProduto, Produto
from app.models.parceiro import VendaParceiro

PASTA_PRIVADA = os.path.join("uploads", "privado", "produtos")
PASTA_CAPAS = os.path.join("uploads", "fotos", "produtos")

TIPOS_VIDEO = {"video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm"}
TIPOS_ARQUIVO = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/vnd.ms-excel": "xls",
    "text/csv": "csv",
    "application/zip": "zip",
    "application/x-zip-compressed": "zip",
}
TIPOS_CAPA = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
LIMITE_VIDEO = 1024 * 1024 * 1024  # 1 GB
LIMITE_ARQUIVO = 50 * 1024 * 1024
LIMITE_CAPA = 5 * 1024 * 1024
BLOCO = 1024 * 1024


def gerar_slug(db: Session, titulo: str, ignorar_id: int | None = None) -> str:
    base = unicodedata.normalize("NFKD", titulo).encode("ascii", "ignore").decode().lower()
    base = re.sub(r"[^a-z0-9]+", "-", base).strip("-")[:120] or "planilha"
    slug, n = base, 2
    while True:
        q = db.query(Produto).filter(Produto.slug == slug)
        if ignorar_id:
            q = q.filter(Produto.id != ignorar_id)
        if not q.first():
            return slug
        slug, n = f"{base}-{n}", n + 1


async def salvar_upload(arquivo: UploadFile, pasta: str, extensao: str, limite: int) -> tuple[str, int]:
    """Grava em pedaços (não carrega o vídeo inteiro na memória) e respeita o limite."""
    os.makedirs(pasta, exist_ok=True)
    caminho = os.path.join(pasta, f"{uuid.uuid4().hex}.{extensao}")
    total = 0
    try:
        with open(caminho, "wb") as destino:
            while bloco := await arquivo.read(BLOCO):
                total += len(bloco)
                if total > limite:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"Arquivo grande demais (limite {limite // (1024 * 1024)} MB).",
                    )
                destino.write(bloco)
    except Exception:
        if os.path.exists(caminho):
            os.remove(caminho)
        raise
    return caminho, total


def apagar_arquivo(caminho: str | None) -> None:
    if caminho and os.path.exists(caminho) and os.path.abspath(caminho).startswith(os.path.abspath("uploads")):
        os.remove(caminho)


def tem_acesso(db: Session, comprador_id: int, produto_id: int) -> bool:
    return (
        db.query(VendaParceiro.id)
        .filter(
            VendaParceiro.comprador_id == comprador_id,
            VendaParceiro.produto_id == produto_id,
            VendaParceiro.status == "paga",
        )
        .first()
        is not None
    )


def pagador_do_comprador(comprador: Comprador) -> dict:
    partes = comprador.nome.strip().split()
    pagador: dict = {"email": comprador.email, "first_name": partes[0], "last_name": " ".join(partes[1:]) or partes[0]}
    cpf = re.sub(r"\D", "", comprador.cpf or "")
    if len(cpf) == 11:
        pagador["identification"] = {"type": "CPF", "number": cpf}
    return pagador


def id_youtube(url: str) -> str | None:
    m = re.search(r"(?:youtu\.be/|youtube\.com/(?:watch\?v=|embed/|shorts/|live/))([A-Za-z0-9_-]{11})", url or "")
    return m.group(1) if m else None


def intervalo_do_range(cabecalho: str | None, tamanho: int) -> tuple[int, int] | None:
    """'bytes=100-' → (100, tamanho-1). None = sem Range (manda tudo)."""
    if not cabecalho or not cabecalho.startswith("bytes="):
        return None
    inicio_txt, _, fim_txt = cabecalho[6:].split(",")[0].strip().partition("-")
    try:
        if inicio_txt == "":
            inicio = max(tamanho - int(fim_txt), 0)
            fim = tamanho - 1
        else:
            inicio = int(inicio_txt)
            fim = int(fim_txt) if fim_txt else tamanho - 1
    except ValueError:
        return None
    if inicio >= tamanho or inicio > fim:
        raise HTTPException(status_code=status.HTTP_416_REQUESTED_RANGE_NOT_SATISFIABLE, detail="Intervalo inválido.")
    return inicio, min(fim, tamanho - 1)


def ler_pedaco(caminho: str, inicio: int, fim: int) -> Iterator[bytes]:
    with open(caminho, "rb") as f:
        f.seek(inicio)
        restante = fim - inicio + 1
        while restante > 0:
            bloco = f.read(min(BLOCO, restante))
            if not bloco:
                break
            restante -= len(bloco)
            yield bloco


def contar_itens(produto: Produto) -> tuple[int, int]:
    videos = sum(1 for c in produto.conteudos if c.tipo in ("video", "youtube"))
    return videos, sum(1 for c in produto.conteudos if c.tipo == "arquivo")


def apagar_conteudo(conteudo: ConteudoProduto) -> None:
    apagar_arquivo(conteudo.caminho)
