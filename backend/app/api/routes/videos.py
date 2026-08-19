"""
Vídeos demonstrativos de exercício — salvos por nome (normalizado) e
reusados entre todos os alunos desse Personal. Upload de MP4 fica em disco
(volume persistente `uploads/`, servido em /uploads pelo main.py) ou, se
for link do YouTube, só guarda a URL de embed.
"""
import os
import re
import unicodedata
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.deps import exigir_assinatura_ativa
from app.models.personal import Personal
from app.models.video_exercicio import VideoExercicio
from app.schemas.video_exercicio import VideoExercicioOut

router = APIRouter(prefix="/api/personal/videos-exercicio", tags=["Vídeos de exercício"])

TAMANHO_MAXIMO_BYTES = 30 * 1024 * 1024  # 30MB — ver decisão no chat, protege o disco da VPS
PASTA_UPLOADS = "uploads/videos"
TIPOS_ACEITOS = {"video/mp4", "video/quicktime", "video/webm"}
REGEX_YOUTUBE = re.compile(r"(?:youtube\.com/(?:watch\?v=|embed/|shorts/)|youtu\.be/)([\w-]{11})")


def _normalizar_nome(nome: str) -> str:
    """'Supino Reto ' -> 'supino reto' — pra "Supino reto" e "supino  reto" baterem no mesmo vídeo salvo."""
    sem_acento = unicodedata.normalize("NFKD", nome).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"\s+", " ", sem_acento.strip().lower())


def _extrair_id_youtube(url: str) -> str | None:
    m = REGEX_YOUTUBE.search(url)
    return m.group(1) if m else None


def _buscar_por_nome(nome_exercicio: str, personal: Personal, db: Session) -> VideoExercicio | None:
    return (
        db.query(VideoExercicio)
        .filter(
            VideoExercicio.personal_id == personal.id,
            VideoExercicio.nome_normalizado == _normalizar_nome(nome_exercicio),
        )
        .first()
    )


@router.get("", response_model=VideoExercicioOut | None)
def buscar_video(
    nome_exercicio: str,
    personal: Personal = Depends(exigir_assinatura_ativa),
    db: Session = Depends(get_db),
) -> VideoExercicio | None:
    """Usado no montador de treino: antes de pedir vídeo novo, checa se já existe um salvo com esse nome."""
    return _buscar_por_nome(nome_exercicio, personal, db)


@router.post("", response_model=VideoExercicioOut, status_code=status.HTTP_201_CREATED)
async def salvar_video(
    nome_exercicio: str = Form(..., min_length=1, max_length=120),
    tipo: str = Form(...),
    url_youtube: str | None = Form(None),
    arquivo: UploadFile | None = File(None),
    personal: Personal = Depends(exigir_assinatura_ativa),
    db: Session = Depends(get_db),
) -> VideoExercicio:
    if tipo not in ("upload", "youtube"):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Tipo de vídeo inválido.")

    if tipo == "youtube":
        video_id = _extrair_id_youtube(url_youtube or "")
        if not video_id:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Link do YouTube inválido.")
        url_final = f"https://www.youtube-nocookie.com/embed/{video_id}"
    else:
        if not arquivo:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Envie um arquivo de vídeo.")
        if arquivo.content_type not in TIPOS_ACEITOS:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Formato não suportado — envie um MP4."
            )
        conteudo = await arquivo.read()
        if len(conteudo) > TAMANHO_MAXIMO_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Vídeo muito grande — o limite é 30MB."
            )

        pasta_personal = f"{PASTA_UPLOADS}/{personal.id}"
        os.makedirs(pasta_personal, exist_ok=True)
        nome_arquivo = f"{uuid.uuid4().hex}.mp4"
        with open(f"{pasta_personal}/{nome_arquivo}", "wb") as f:
            f.write(conteudo)
        url_final = f"/uploads/videos/{personal.id}/{nome_arquivo}"

    def _apagar_upload_antigo(video: VideoExercicio) -> None:
        if video.tipo == "upload" and video.url.startswith("/uploads/"):
            caminho = video.url.lstrip("/")
            if os.path.exists(caminho):
                os.remove(caminho)

    existente = _buscar_por_nome(nome_exercicio, personal, db)
    if existente:
        _apagar_upload_antigo(existente)
        existente.nome_exercicio = nome_exercicio
        existente.tipo = tipo
        existente.url = url_final
        db.commit()
        db.refresh(existente)
        return existente

    novo = VideoExercicio(
        personal_id=personal.id,
        nome_exercicio=nome_exercicio,
        nome_normalizado=_normalizar_nome(nome_exercicio),
        tipo=tipo,
        url=url_final,
    )
    db.add(novo)
    db.commit()
    db.refresh(novo)
    return novo


@router.delete("/{video_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_video(
    video_id: int,
    personal: Personal = Depends(exigir_assinatura_ativa),
    db: Session = Depends(get_db),
) -> None:
    video = (
        db.query(VideoExercicio)
        .filter(VideoExercicio.id == video_id, VideoExercicio.personal_id == personal.id)
        .first()
    )
    if not video:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vídeo não encontrado.")
    if video.tipo == "upload" and video.url.startswith("/uploads/"):
        caminho = video.url.lstrip("/")
        if os.path.exists(caminho):
            os.remove(caminho)
    db.delete(video)
    db.commit()
