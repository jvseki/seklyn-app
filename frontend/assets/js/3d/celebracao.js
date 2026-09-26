// Seklyn — celebração de "treino concluído" na área do aluno: troféu
// dourado 3D caindo com giro, raios de luz na cor da marca do Personal e
// uma chuva de confete disparada de dois canhões + um estouro no centro.
//
// Só é importado (junto com o Three.js) no momento em que o aluno fecha o
// treino — ninguém paga esse download pra só abrir a lista. Sem WebGL ou
// com "reduzir movimento", mostra a mesma tela sem a cena 3D.
import {
  corDoTema,
  criarAmbienteDeMarca,
  criarPalco,
  easeOutBack,
  pode3D,
  texturaBrilho,
} from "./motor.js";
import { escaparHtml } from "../utils.js";

const TROFEU_SVG = `<svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0Z"/><path d="M7 5H4a2 2 0 0 0 2 4"/><path d="M17 5h3a2 2 0 0 1-2 4"/></svg>`;

function criarTrofeu(THREE, corMarca) {
  const ouro = new THREE.MeshPhysicalMaterial({
    color: 0xffd25e,
    metalness: 1,
    roughness: 0.2,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    side: THREE.DoubleSide,
  });
  const ferro = new THREE.MeshPhysicalMaterial({ color: 0x1b1c25, metalness: 0.85, roughness: 0.3, clearcoat: 0.6 });
  const neon = new THREE.MeshBasicMaterial({ color: new THREE.Color(corMarca).lerp(new THREE.Color(0xffffff), 0.15), toneMapped: false });

  const trofeu = new THREE.Group();

  // Taça: um único perfil girado — base, haste, bojo e a borda (o perfil
  // volta por dentro pra taça ter espessura de verdade).
  const perfil = [
    [0.12, -0.8], [0.1, -0.45], [0.2, -0.28], [0.34, -0.12], [0.58, 0.12], [0.78, 0.55], [0.86, 1.02],
    [0.88, 1.12], [0.82, 1.12], [0.79, 1.0], [0.72, 0.58], [0.52, 0.18], [0.2, -0.02], [0, -0.05],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  trofeu.add(new THREE.Mesh(new THREE.LatheGeometry(perfil, 72), ouro));

  // Alças laterais (meio toro cada).
  const geoAlca = new THREE.TorusGeometry(0.3, 0.055, 16, 40, Math.PI);
  for (const lado of [-1, 1]) {
    const alca = new THREE.Mesh(geoAlca, ouro);
    alca.rotation.z = lado * -Math.PI / 2;
    alca.position.set(lado * 0.76, 0.66, 0);
    trofeu.add(alca);
  }

  // Pedestal de ferro com anel de luz na cor da marca.
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.7, 0.34, 64), ferro);
  pedestal.position.y = -0.98;
  trofeu.add(pedestal);
  const anel = new THREE.Mesh(new THREE.TorusGeometry(0.665, 0.018, 10, 80), neon);
  anel.rotation.x = Math.PI / 2;
  anel.position.y = -0.95;
  trofeu.add(anel);
  const topoPedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 0.08, 64), ouro);
  topoPedestal.position.y = -0.77;
  trofeu.add(topoPedestal);

  return trofeu;
}

/** Raios de luz girando atrás do troféu (textura desenhada em canvas). */
function criarRaios(THREE, corMarca) {
  const tamanho = 512;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = tamanho;
  const ctx = canvas.getContext("2d");
  ctx.translate(tamanho / 2, tamanho / 2);
  const raios = 18;
  for (let i = 0; i < raios; i++) {
    ctx.rotate((Math.PI * 2) / raios);
    const gradiente = ctx.createLinearGradient(0, 0, tamanho / 2, 0);
    gradiente.addColorStop(0, "rgba(255,255,255,0.9)");
    gradiente.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradiente;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(tamanho / 2, -18);
    ctx.lineTo(tamanho / 2, 18);
    ctx.closePath();
    ctx.fill();
  }
  const textura = new THREE.CanvasTexture(canvas);
  textura.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({
    map: textura,
    color: corMarca,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(7, 7), material);
}

function criarConfete(THREE, quantidade, corMarca) {
  const geometria = new THREE.PlaneGeometry(0.09, 0.16);
  const material = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, metalness: 0.35, roughness: 0.4 });
  const malha = new THREE.InstancedMesh(geometria, material, quantidade);
  malha.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  const marca = new THREE.Color(corMarca);
  const paleta = [
    marca,
    marca.clone().lerp(new THREE.Color(0xffffff), 0.45),
    new THREE.Color(0xffc94d),
    new THREE.Color(0xffffff),
    marca.clone().lerp(new THREE.Color(0xff4fa3), 0.5),
  ];

  const particulas = [];
  for (let i = 0; i < quantidade; i++) {
    // 40% do canhão esquerdo, 40% do direito, 20% estouro no centro (atrasado).
    const tipo = i < quantidade * 0.4 ? -1 : i < quantidade * 0.8 ? 1 : 0;
    const p = {
      atraso: tipo === 0 ? 0.35 + Math.random() * 0.15 : Math.random() * 0.12,
      pos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      rot: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6),
      giro: new THREE.Vector3((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12),
      escala: 0.7 + Math.random() * 0.7,
      fase: Math.random() * Math.PI * 2,
    };
    if (tipo === 0) {
      p.pos.set(0, 0.6, 0.3);
      const angulo = Math.random() * Math.PI * 2;
      const forca = 3 + Math.random() * 4;
      p.vel.set(Math.cos(angulo) * forca, Math.sin(angulo) * forca + 2, (Math.random() - 0.5) * 3);
    } else {
      p.pos.set(tipo * 4.2, -3.6, 0.5);
      p.vel.set(-tipo * (2.2 + Math.random() * 3.2), 7.5 + Math.random() * 4.5, (Math.random() - 0.5) * 3);
    }
    particulas.push(p);
    malha.setColorAt(i, paleta[i % paleta.length]);
  }
  malha.instanceColor.needsUpdate = true;
  return { malha, particulas };
}

async function montarCena(canvas) {
  const FOV = 38;
  const palco = await criarPalco(canvas, { fov: FOV, distancia: 7.5 });
  const { THREE, renderer, cena, camera, celular } = palco;

  // Tela em pé (celular): afasta a câmera até o troféu ocupar ~55% da
  // largura — senão as alças encostavam nas bordas.
  const aspecto = canvas.clientWidth / Math.max(canvas.clientHeight, 1);
  if (aspecto < 1) {
    const meiaLarguraDesejada = 2.0;
    camera.position.z = Math.max(7.5, meiaLarguraDesejada / (Math.tan((FOV * Math.PI) / 360) * aspecto));
  }
  const corMarca = corDoTema();
  cena.environment = criarAmbienteDeMarca(THREE, renderer, corMarca);
  // Ouro reflete o ambiente (sala escura) — mais intensidade pra não
  // parecer bronze apagado.
  cena.environmentIntensity = 1.7;

  const trofeu = criarTrofeu(THREE, corMarca);
  trofeu.position.y = 0.9;
  trofeu.scale.setScalar(0.001);
  cena.add(trofeu);

  const raios = criarRaios(THREE, corMarca);
  raios.position.set(0, 1.1, -1.5);
  cena.add(raios);

  const brilho = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texturaBrilho(THREE), color: corMarca, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  brilho.scale.set(5, 5, 1);
  brilho.position.set(0, 1, -1);
  cena.add(brilho);

  const luz = new THREE.PointLight(0xffffff, 45, 0, 2);
  luz.position.set(2, 3, 4);
  cena.add(luz);
  const luzFrente = new THREE.DirectionalLight(0xfff2d6, 2.2);
  luzFrente.position.set(-1, 1.5, 6);
  cena.add(luzFrente);

  const confete = criarConfete(THREE, celular ? 220 : 460, corMarca);
  cena.add(confete.malha);

  const auxiliar = new THREE.Object3D();
  const GRAVIDADE = 6.5;

  palco.aCadaQuadro((dt, t) => {
    // Troféu: entra com "overshoot" girando, depois gira devagar flutuando.
    const entrada = Math.min(t / 0.9, 1);
    trofeu.scale.setScalar(Math.max(0.001, easeOutBack(entrada)));
    trofeu.rotation.y = (1 - entrada) * -Math.PI * 3 + t * 0.7;
    trofeu.position.y = 0.9 + Math.sin(t * 1.6) * 0.06;

    raios.rotation.z = t * 0.18;
    raios.material.opacity = Math.min(t / 0.6, 1) * 0.28;

    confete.particulas.forEach((p, i) => {
      const vivo = t > p.atraso;
      if (vivo) {
        p.vel.y -= GRAVIDADE * dt;
        p.vel.multiplyScalar(1 - 0.9 * dt); // resistência do ar
        p.pos.addScaledVector(p.vel, dt);
        p.pos.x += Math.sin(t * 5 + p.fase) * 0.25 * dt; // "flutuar" caindo
        p.rot.x += p.giro.x * dt;
        p.rot.y += p.giro.y * dt;
        p.rot.z += p.giro.z * dt;
      }
      auxiliar.position.copy(p.pos);
      auxiliar.rotation.copy(p.rot);
      auxiliar.scale.setScalar(vivo && p.pos.y > -6 ? p.escala : 0);
      auxiliar.updateMatrix();
      confete.malha.setMatrixAt(i, auxiliar.matrix);
    });
    confete.malha.instanceMatrix.needsUpdate = true;
  });

  palco.iniciar();
  return () => palco.destruir();
}

/**
 * Mostra a celebração em tela cheia. Fecha no botão, tocando fora do
 * texto ou com Esc. Retorna uma Promise que resolve quando fechar.
 */
export function celebrarTreinoConcluido({ titulo = "Treino concluído!", subtitulo = "" } = {}) {
  navigator.vibrate?.([40, 50, 90]);

  const overlay = document.createElement("div");
  overlay.className = "celebracao";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", titulo);
  overlay.innerHTML = `
    <canvas class="celebracao-canvas" aria-hidden="true"></canvas>
    <div class="celebracao-trofeu-estatico" aria-hidden="true">${TROFEU_SVG}</div>
    <div class="celebracao-conteudo">
      <h2>${escaparHtml(titulo)}</h2>
      ${subtitulo ? `<p>${escaparHtml(subtitulo)}</p>` : ""}
      <button type="button" class="btn btn-primary celebracao-fechar">Bora!</button>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("visivel"));

  const botao = overlay.querySelector(".celebracao-fechar");
  botao.focus({ preventScroll: true });

  let destruir3D = null;
  let fechada = false;
  if (pode3D()) {
    montarCena(overlay.querySelector(".celebracao-canvas"))
      .then((destruir) => {
        // Fechou antes do 3D terminar de carregar: libera na hora, senão a
        // cena ficaria órfã segurando memória de vídeo.
        if (fechada) return destruir();
        destruir3D = destruir;
        overlay.classList.add("com-3d");
      })
      .catch((erro) => console.warn("Celebração 3D indisponível — usando o troféu estático.", erro));
  }

  return new Promise((resolver) => {
    let fechando = false;
    function fechar() {
      if (fechando) return;
      fechando = true;
      fechada = true;
      document.removeEventListener("keydown", aoTeclar);
      overlay.classList.remove("visivel");
      setTimeout(() => {
        destruir3D?.();
        overlay.remove();
        resolver();
      }, 320);
    }
    function aoTeclar(evento) {
      if (evento.key === "Escape") fechar();
    }
    botao.addEventListener("click", fechar);
    overlay.addEventListener("click", (evento) => {
      if (!evento.target.closest(".celebracao-conteudo")) fechar();
    });
    document.addEventListener("keydown", aoTeclar);
  });
}
