// Seklyn — motor 3D compartilhado ("Ferro e Luz").
//
// Three.js só é baixado quando alguma tela realmente vai desenhar 3D
// (import dinâmico direto do CDN, versão fixa) — quem não tem WebGL, ou
// pediu "reduzir movimento" no sistema, nunca paga esse download.
//
// A assinatura visual: metal (cromo / ferro escuro) refletindo um
// ambiente iluminado com a COR DA MARCA do Personal (--cor-primaria). Ou
// seja, cada conta com tema próprio ganha um 3D que brilha na cor dela,
// sem nenhuma configuração extra — o motor lê a cor do CSS na hora.

const URL_THREE = "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

let promessaThree = null;

export function carregarThree() {
  promessaThree ??= import(URL_THREE);
  return promessaThree;
}

export function prefereMenosMovimento() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function temWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

/** 3D só quando faz sentido: tem WebGL e a pessoa não pediu menos movimento. */
export function pode3D() {
  return temWebGL() && !prefereMenosMovimento();
}

export function ehCelular() {
  return window.matchMedia("(max-width: 767px), (pointer: coarse)").matches;
}

/** Lê uma cor do tema atual (já considerando claro/escuro + tema do Personal). */
export function corDoTema(variavel = "--cor-primaria", padrao = "#7c3aed") {
  return getComputedStyle(document.documentElement).getPropertyValue(variavel).trim() || padrao;
}

/** Chama `callback` sempre que a cor da marca puder ter mudado (troca de
 * tema claro/escuro ou tema personalizado do Personal aplicado depois). */
export function aoMudarTema(callback) {
  const observador = new MutationObserver(() => callback());
  observador.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme", "data-tema-personalizado"],
  });
  return () => observador.disconnect();
}

/**
 * Ambiente de reflexo "estúdio": uma sala escura com softboxes brancos
 * (brilho do cromo) e painéis na cor da marca (o tom que o metal devolve).
 * Vira um mapa PMREM usado como `scene.environment` — é isso que faz o
 * metal parecer metal de verdade, sem precisar de nenhum arquivo HDR.
 */
export function criarAmbienteDeMarca(THREE, renderer, corMarca) {
  const sala = new THREE.Scene();
  const marca = new THREE.Color(corMarca);

  const paredes = new THREE.Mesh(
    new THREE.BoxGeometry(20, 20, 20),
    new THREE.MeshBasicMaterial({ color: 0x0b0b12, side: THREE.BackSide })
  );
  sala.add(paredes);

  function painel(cor, intensidade, largura, altura, x, y, z) {
    const material = new THREE.MeshBasicMaterial({ color: new THREE.Color(cor).multiplyScalar(intensidade) });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(largura, altura), material);
    mesh.position.set(x, y, z);
    mesh.lookAt(0, 0, 0);
    sala.add(mesh);
  }

  // Softboxes brancos: o "brilho" principal do cromo.
  painel(0xffffff, 6, 8, 2.2, 0, 7, 3);
  painel(0xffffff, 3, 3, 7, -8, 1, 4);
  // Painéis na cor da marca: laterais e fundo — o metal devolve esse tom.
  painel(marca, 5, 3, 9, 8.5, 0, -1);
  painel(marca, 3.5, 9, 3, 0, -7, -4);
  painel(marca, 2.5, 4, 4, -6, -3, -7);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const textura = pmrem.fromScene(sala, 0.035).texture;
  pmrem.dispose();
  sala.traverse((obj) => {
    obj.geometry?.dispose();
    obj.material?.dispose();
  });
  return textura;
}

/** Textura de "ponto de luz" (círculo com borda suave) pra partículas e brilhos. */
export function texturaBrilho(THREE, tamanho = 64) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = tamanho;
  const ctx = canvas.getContext("2d");
  const gradiente = ctx.createRadialGradient(tamanho / 2, tamanho / 2, 0, tamanho / 2, tamanho / 2, tamanho / 2);
  gradiente.addColorStop(0, "rgba(255,255,255,1)");
  gradiente.addColorStop(0.25, "rgba(255,255,255,0.75)");
  gradiente.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradiente;
  ctx.fillRect(0, 0, tamanho, tamanho);
  const textura = new THREE.CanvasTexture(canvas);
  textura.colorSpace = THREE.SRGBColorSpace;
  return textura;
}

/**
 * Monta renderer + cena + câmera num <canvas> e cuida do ciclo de vida:
 * redimensiona junto com o elemento pai, pausa o loop quando o canvas sai
 * da tela ou a aba fica em segundo plano (bateria do celular agradece), e
 * libera tudo no `destruir()`.
 */
export async function criarPalco(canvas, { fov = 35, distancia = 7, transparente = true } = {}) {
  const THREE = await carregarThree();
  const celular = ehCelular();

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !celular || window.devicePixelRatio < 2,
    alpha: transparente,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, celular ? 1.75 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);

  const cena = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 100);
  camera.position.set(0, 0, distancia);

  function redimensionar() {
    const largura = canvas.clientWidth || canvas.parentElement.clientWidth;
    const altura = canvas.clientHeight || canvas.parentElement.clientHeight;
    if (!largura || !altura) return;
    renderer.setSize(largura, altura, false);
    camera.aspect = largura / altura;
    camera.updateProjectionMatrix();
  }
  redimensionar();
  const observadorTamanho = new ResizeObserver(redimensionar);
  observadorTamanho.observe(canvas);

  const tarefas = new Set();
  const relogio = new THREE.Clock();
  let visivelNaTela = true;
  let rodando = false;
  let idQuadro = 0;

  function quadro() {
    idQuadro = requestAnimationFrame(quadro);
    const dt = Math.min(relogio.getDelta(), 1 / 20); // evita "pulo" ao voltar de aba
    const t = relogio.elapsedTime;
    tarefas.forEach((tarefa) => tarefa(dt, t));
    renderer.render(cena, camera);
  }

  function atualizarLoop() {
    const deveRodar = visivelNaTela && !document.hidden;
    if (deveRodar && !rodando) {
      rodando = true;
      relogio.getDelta();
      quadro();
    } else if (!deveRodar && rodando) {
      rodando = false;
      cancelAnimationFrame(idQuadro);
    }
  }

  const observadorVisibilidade = new IntersectionObserver(([entrada]) => {
    visivelNaTela = entrada.isIntersecting;
    atualizarLoop();
  });
  observadorVisibilidade.observe(canvas);
  document.addEventListener("visibilitychange", atualizarLoop);

  return {
    THREE,
    renderer,
    cena,
    camera,
    celular,
    /** Registra uma função chamada a cada quadro: (dt, tempoTotal) => {}. */
    aCadaQuadro(tarefa) {
      tarefas.add(tarefa);
      return () => tarefas.delete(tarefa);
    },
    iniciar() {
      atualizarLoop();
    },
    /** Desenha um único quadro (usado quando o loop ainda não começou). */
    desenhar() {
      renderer.render(cena, camera);
    },
    destruir() {
      cancelAnimationFrame(idQuadro);
      rodando = false;
      observadorTamanho.disconnect();
      observadorVisibilidade.disconnect();
      document.removeEventListener("visibilitychange", atualizarLoop);
      cena.traverse((obj) => {
        obj.geometry?.dispose();
        const materiais = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
        materiais.forEach((m) => {
          m.map?.dispose();
          m.dispose();
        });
      });
      cena.environment?.dispose();
      renderer.dispose();
    },
  };
}

export const suavizar = (atual, alvo, fator, dt) => atual + (alvo - atual) * (1 - Math.exp(-fator * dt));
export const easeOutExpo = (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));
export const easeOutBack = (x) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};
