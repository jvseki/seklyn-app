// Seklyn — player de vídeo demonstrativo de exercício, reusado em 3 lugares:
// o montador de treino (preview ao anexar), o editor do Personal e o
// checklist do aluno. Renderiza inline no site — nunca redireciona pro
// YouTube nem faz download, sempre abre embutido.
import { API_BASE_URL } from "./api.js";

// Uploads (MP4) ficam servidos pela API (api.seklyn.com.br), não pelo site
// estático (seklyn.com.br) — deriva a origem tirando o sufixo "/api".
const ORIGEM_UPLOADS = API_BASE_URL.replace(/\/api\/?$/, "");

/** Devolve o HTML do player pra um vídeo (objeto {tipo, url} vindo da API),
 * ou string vazia se não houver vídeo. */
export function renderizarPlayerVideo(video, { altura = 220 } = {}) {
  if (!video) return "";

  if (video.tipo === "youtube") {
    return `
      <div class="video-exercicio-player" style="aspect-ratio:16/9;max-height:${altura}px;">
        <iframe src="${video.url}" title="Vídeo do exercício" frameborder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen loading="lazy"></iframe>
      </div>
    `;
  }

  const srcCompleto = video.url.startsWith("http") ? video.url : `${ORIGEM_UPLOADS}${video.url}`;
  return `
    <div class="video-exercicio-player" style="max-height:${altura}px;">
      <video src="${srcCompleto}" controls preload="metadata" playsinline></video>
    </div>
  `;
}
