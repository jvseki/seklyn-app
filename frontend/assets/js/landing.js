// Seklyn — landing page: se o Personal já tem sessão salva, troca
// "Entrar"/"Criar conta grátis" por "Olá, Nome" + "Ir para o painel",
// em vez de sempre parecer deslogado só por estar na home.
import { api, estaAutenticado } from "./api.js";
import { $ } from "./utils.js";
import { pode3D } from "./3d/motor.js";

async function refletirLoginNaNav() {
  if (!estaAutenticado()) return; // já mostra o estado padrão (não logado)

  try {
    const personal = await api.me();
    const naoLogado = $("#landing-nao-logado");
    const logado = $("#landing-logado");
    const nomeEl = $("#landing-nome-personal");
    if (!naoLogado || !logado || !nomeEl) return;

    nomeEl.textContent = `Olá, ${personal.nome.split(" ")[0]}!`;
    naoLogado.hidden = true;
    logado.hidden = false;
  } catch {
    // token expirado/inválido — mantém o estado padrão (não logado)
  }
}

refletirLoginNaNav();

// --- Hero 3D: halter em tempo real (WebGL). Sem suporte, fica a imagem estática. ---
function usarImagemEstatica(palco) {
  const imagem = palco.querySelector(".hero-palco-fallback");
  if (imagem && !imagem.src) imagem.src = imagem.dataset.src;
  palco.classList.add("sem-3d");
}

async function iniciarHero3D() {
  const palco = $("#hero-palco");
  const canvas = $("#hero-canvas");
  if (!palco || !canvas) return;
  if (!pode3D()) {
    usarImagemEstatica(palco);
    return;
  }
  try {
    const { montarHeroHalter } = await import("./3d/cena-halter.js");
    await montarHeroHalter(canvas, {
      // Os chips de interface em volta do halter acompanham o mouse em
      // camadas diferentes — dá a profundidade de "estão no mesmo espaço".
      aoMoverPonteiro(x, y) {
        palco.style.setProperty("--px", x.toFixed(3));
        palco.style.setProperty("--py", y.toFixed(3));
      },
    });
    palco.classList.add("com-3d");
  } catch (erro) {
    console.warn("Hero 3D indisponível, usando imagem estática.", erro);
    usarImagemEstatica(palco);
  }
}

iniciarHero3D();
