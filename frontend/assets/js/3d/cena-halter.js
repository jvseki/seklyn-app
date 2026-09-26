// Seklyn — cena 3D do hero da landing: um halter hexagonal de ferro com
// pegador cromado e faixa de luz na cor da marca, anilhas flutuando ao
// fundo e "poeira de magnésio" subindo. Tudo gerado em código (nenhum
// arquivo de modelo pra baixar).
//
// Interação: segue o mouse no desktop; no celular dá pra girar arrastando
// o dedo na horizontal (a rolagem vertical continua normal); o scroll da
// página inclina e afasta o halter.
import {
  aoMudarTema,
  corDoTema,
  criarAmbienteDeMarca,
  criarPalco,
  easeOutExpo,
  suavizar,
  texturaBrilho,
} from "./motor.js";

function materiais(THREE, corMarca) {
  const neon = new THREE.Color(corMarca).lerp(new THREE.Color(0xffffff), 0.12);
  return {
    cromo: new THREE.MeshPhysicalMaterial({
      color: 0xf4f4f8,
      metalness: 1,
      roughness: 0.13,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
    }),
    ferro: new THREE.MeshPhysicalMaterial({
      color: 0x1b1c25,
      metalness: 0.88,
      roughness: 0.33,
      clearcoat: 0.75,
      clearcoatRoughness: 0.22,
    }),
    neon: new THREE.MeshBasicMaterial({ color: neon, toneMapped: false }),
  };
}

function hexagono(THREE, raio, raioFuro = 0) {
  const forma = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    const angulo = (Math.PI / 3) * i + Math.PI / 6;
    const x = Math.cos(angulo) * raio;
    const y = Math.sin(angulo) * raio;
    if (i === 0) forma.moveTo(x, y);
    else forma.lineTo(x, y);
  }
  forma.closePath();
  if (raioFuro) {
    const furo = new THREE.Path();
    for (let i = 0; i < 6; i++) {
      const angulo = (Math.PI / 3) * i + Math.PI / 6;
      const x = Math.cos(angulo) * raioFuro;
      const y = Math.sin(angulo) * raioFuro;
      if (i === 0) furo.moveTo(x, y);
      else furo.lineTo(x, y);
    }
    furo.closePath();
    forma.holes.push(furo);
  }
  return forma;
}

/** Halter montado ao longo do eixo X, centrado na origem. */
function criarHalter(THREE, mat) {
  const halter = new THREE.Group();

  // Pegador: perfil girado (lathe) com o recartilhado no meio feito de
  // sulcos alternados — pega luz de um jeito que parece aço usinado.
  const perfil = [new THREE.Vector2(0, -1.12), new THREE.Vector2(0.23, -1.12), new THREE.Vector2(0.235, -0.95)];
  perfil.push(new THREE.Vector2(0.2, -0.9), new THREE.Vector2(0.155, -0.87), new THREE.Vector2(0.15, -0.66));
  for (let y = -0.62; y <= 0.62; y += 0.04) {
    perfil.push(new THREE.Vector2(0.153, y), new THREE.Vector2(0.143, y + 0.02));
  }
  perfil.push(new THREE.Vector2(0.15, 0.66), new THREE.Vector2(0.155, 0.87), new THREE.Vector2(0.2, 0.9));
  perfil.push(new THREE.Vector2(0.235, 0.95), new THREE.Vector2(0.23, 1.12), new THREE.Vector2(0, 1.12));
  const pegador = new THREE.Mesh(new THREE.LatheGeometry(perfil, 56), mat.cromo);
  pegador.rotation.z = -Math.PI / 2;
  halter.add(pegador);

  // Cabeças hexagonais de ferro, com bisel (é o bisel que desenha as
  // quinas brilhantes quando a luz passa).
  const profundidade = 0.44;
  const geoCabeca = new THREE.ExtrudeGeometry(hexagono(THREE, 0.56), {
    depth: profundidade,
    bevelEnabled: true,
    bevelThickness: 0.06,
    bevelSize: 0.055,
    bevelSegments: 5,
    curveSegments: 1,
  });
  geoCabeca.center();
  geoCabeca.rotateY(Math.PI / 2);

  // Faixa de luz em volta de cada cabeça (o "neon" da marca).
  const geoFaixa = new THREE.ExtrudeGeometry(hexagono(THREE, 0.63, 0.5), {
    depth: 0.045,
    bevelEnabled: false,
    curveSegments: 1,
  });
  geoFaixa.center();
  geoFaixa.rotateY(Math.PI / 2);

  // Tampa cromada + anel de luz na face externa.
  const geoTampa = new THREE.CylinderGeometry(0.22, 0.22, 0.05, 48);
  geoTampa.rotateZ(Math.PI / 2);
  const geoAnel = new THREE.TorusGeometry(0.34, 0.016, 10, 64);
  geoAnel.rotateY(Math.PI / 2);

  const centroCabeca = 1.37;
  const faceExterna = centroCabeca + profundidade / 2 + 0.06;
  for (const lado of [-1, 1]) {
    const cabeca = new THREE.Mesh(geoCabeca, mat.ferro);
    cabeca.position.x = lado * centroCabeca;
    halter.add(cabeca);

    const faixa = new THREE.Mesh(geoFaixa, mat.neon);
    faixa.position.x = lado * (centroCabeca + 0.09);
    halter.add(faixa);

    const tampa = new THREE.Mesh(geoTampa, mat.cromo);
    tampa.position.x = lado * (faceExterna + 0.02);
    halter.add(tampa);

    const anel = new THREE.Mesh(geoAnel, mat.neon);
    anel.position.x = lado * (faceExterna + 0.005);
    halter.add(anel);
  }
  return halter;
}

/** Anilha olímpica (disco com aro grosso, alma fina e cubo) girada em Y. */
function criarAnilha(THREE, mat) {
  const pontos = [
    [0.14, 0.07], [0.3, 0.07], [0.34, 0.035], [0.78, 0.035], [0.82, 0.08], [0.93, 0.08], [0.955, 0.055],
    [0.955, -0.055], [0.93, -0.08], [0.82, -0.08], [0.78, -0.035], [0.34, -0.035], [0.3, -0.07], [0.14, -0.07],
    [0.14, 0.07],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const anilha = new THREE.Group();
  anilha.add(new THREE.Mesh(new THREE.LatheGeometry(pontos, 64), mat.ferro));

  const cubo = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.15, 40, 1, true), mat.cromo);
  anilha.add(cubo);

  const anel = new THREE.Mesh(new THREE.TorusGeometry(0.86, 0.012, 8, 96), mat.neon);
  anel.rotation.x = Math.PI / 2;
  anel.position.y = 0.082;
  anilha.add(anel);
  return anilha;
}

function criarPoeira(THREE, quantidade, textura) {
  const posicoes = new Float32Array(quantidade * 3);
  const velocidades = new Float32Array(quantidade);
  for (let i = 0; i < quantidade; i++) {
    posicoes[i * 3] = (Math.random() - 0.5) * 11;
    posicoes[i * 3 + 1] = (Math.random() - 0.5) * 7;
    posicoes[i * 3 + 2] = -Math.random() * 7 + 1.5;
    velocidades[i] = 0.05 + Math.random() * 0.14;
  }
  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute("position", new THREE.BufferAttribute(posicoes, 3));
  const material = new THREE.PointsMaterial({
    size: 0.065,
    map: textura,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const pontos = new THREE.Points(geometria, material);
  return { pontos, velocidades };
}

/**
 * Monta a cena no canvas. Retorna `{ destruir }`, ou null se não der
 * (a página continua com o fallback estático do CSS nesse caso).
 */
export async function montarHeroHalter(canvas, { aoMoverPonteiro } = {}) {
  const palco = await criarPalco(canvas, { fov: 32, distancia: 9.4 });
  const { THREE, renderer, cena, camera, celular } = palco;

  let corMarca = corDoTema();
  const mat = materiais(THREE, corMarca);
  cena.environment = criarAmbienteDeMarca(THREE, renderer, corMarca);
  cena.environmentIntensity = 1;

  const raiz = new THREE.Group();
  cena.add(raiz);

  const halter = criarHalter(THREE, mat);
  halter.rotation.set(0.35, -0.5, -0.32);
  raiz.add(halter);

  const brilho = texturaBrilho(THREE);
  const aura = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: brilho, color: corMarca, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  aura.scale.set(7.5, 7.5, 1);
  aura.position.z = -2.5;
  raiz.add(aura);

  const anilhas = [
    { x: -2.7, y: 1.45, z: -2.6, s: 0.62, vr: 0.18 },
    { x: 2.8, y: -1.35, z: -2.2, s: 0.72, vr: -0.14 },
    { x: 1.5, y: 2.2, z: -5, s: 0.5, vr: 0.22 },
  ]
    .slice(0, celular ? 2 : 3)
    .map((cfg) => {
      const anilha = criarAnilha(THREE, mat);
      anilha.position.set(cfg.x, cfg.y, cfg.z);
      anilha.scale.setScalar(cfg.s);
      anilha.rotation.set(Math.random() * 2, Math.random() * 2, 0);
      anilha.userData = { ...cfg, base: new THREE.Vector3(cfg.x, cfg.y, cfg.z) };
      raiz.add(anilha);
      return anilha;
    });

  const poeira = criarPoeira(THREE, celular ? 180 : 480, brilho);
  raiz.add(poeira.pontos);

  // Luzes: uma de recorte branca fixa + uma na cor da marca orbitando, que
  // faz os reflexos "passearem" pelo cromo (é o que dá sensação de vida).
  const luzChave = new THREE.DirectionalLight(0xffffff, 1.6);
  luzChave.position.set(3, 4, 5);
  cena.add(luzChave);
  const luzMarca = new THREE.PointLight(corMarca, 40, 0, 2);
  cena.add(luzMarca);

  function aplicarCores() {
    corMarca = corDoTema();
    const escuro = document.documentElement.dataset.theme === "escuro";
    const neon = new THREE.Color(corMarca).lerp(new THREE.Color(0xffffff), 0.12);
    mat.neon.color.copy(neon);
    luzMarca.color.set(corMarca);
    aura.material.color.set(corMarca);
    aura.material.opacity = escuro ? 0.42 : 0.28;
    // No tema claro a poeira branca some no fundo — vira cor da marca.
    poeira.pontos.material.color.set(escuro ? 0xffffff : corMarca);
    poeira.pontos.material.opacity = escuro ? 0.75 : 0.55;
    cena.environment?.dispose();
    cena.environment = criarAmbienteDeMarca(THREE, renderer, corMarca);
  }
  aplicarCores();
  const pararDeOuvirTema = aoMudarTema(aplicarCores);

  // --- Interação ---
  const ponteiro = { x: 0, y: 0, alvoX: 0, alvoY: 0 };
  const giro = { angulo: 0, velocidade: 0.28, arrastando: false, ultimoX: 0 };

  function aoMoverMouse(evento) {
    if (evento.pointerType !== "mouse") return;
    ponteiro.alvoX = (evento.clientX / window.innerWidth) * 2 - 1;
    ponteiro.alvoY = (evento.clientY / window.innerHeight) * 2 - 1;
  }
  window.addEventListener("pointermove", aoMoverMouse, { passive: true });

  // Arrastar pra girar (dedo ou mouse) — com inércia ao soltar.
  canvas.addEventListener("pointerdown", (evento) => {
    giro.arrastando = true;
    giro.ultimoX = evento.clientX;
    canvas.setPointerCapture(evento.pointerId);
  });
  canvas.addEventListener("pointermove", (evento) => {
    if (!giro.arrastando) return;
    const dx = evento.clientX - giro.ultimoX;
    giro.ultimoX = evento.clientX;
    giro.angulo += dx * 0.012;
    giro.velocidade = dx * 0.6;
  });
  const soltar = () => (giro.arrastando = false);
  canvas.addEventListener("pointerup", soltar);
  canvas.addEventListener("pointercancel", soltar);

  let rolagem = 0;
  function aoRolar() {
    const altura = canvas.parentElement.getBoundingClientRect().height || window.innerHeight;
    rolagem = Math.min(Math.max(window.scrollY / altura, 0), 1.2);
  }
  window.addEventListener("scroll", aoRolar, { passive: true });
  aoRolar();

  // --- Animação ---
  const DURACAO_ENTRADA = 1.9;
  palco.aCadaQuadro((dt, t) => {
    const entrada = easeOutExpo(Math.min(t / DURACAO_ENTRADA, 1));

    ponteiro.x = suavizar(ponteiro.x, ponteiro.alvoX, 4, dt);
    ponteiro.y = suavizar(ponteiro.y, ponteiro.alvoY, 4, dt);

    if (!giro.arrastando) {
      giro.velocidade = suavizar(giro.velocidade, 0.28, 1.5, dt);
      giro.angulo += giro.velocidade * dt;
    }

    halter.rotation.x = 0.35 + ponteiro.y * 0.35 + rolagem * 0.6;
    halter.rotation.y = -0.5 + giro.angulo + (1 - entrada) * Math.PI * 1.6;
    halter.rotation.z = -0.32 + ponteiro.x * 0.18 - rolagem * 0.5;
    halter.position.y = Math.sin(t * 1.1) * 0.09 + rolagem * 1.4;
    halter.position.z = (1 - entrada) * -7 - rolagem * 2.2;
    halter.scale.setScalar(0.6 + entrada * 0.4);

    raiz.position.x = ponteiro.x * 0.25;
    raiz.position.y = -ponteiro.y * 0.15;

    anilhas.forEach((anilha, i) => {
      const { base, vr } = anilha.userData;
      anilha.rotation.x += vr * dt;
      anilha.rotation.y += vr * 0.6 * dt;
      anilha.position.x = base.x + ponteiro.x * (0.35 + i * 0.15);
      anilha.position.y = base.y + Math.sin(t * 0.7 + i * 2) * 0.18 - ponteiro.y * 0.2 + rolagem * (1 + i * 0.4);
      anilha.scale.setScalar(anilha.userData.s * entrada);
    });

    const pos = poeira.pontos.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i) + poeira.velocidades[i] * dt;
      if (y > 3.6) y = -3.6;
      pos.setY(i, y);
    }
    pos.needsUpdate = true;

    luzMarca.position.set(Math.cos(t * 0.6) * 3.2, Math.sin(t * 0.9) * 1.6, 2 + Math.sin(t * 0.6) * 1.2);
    aura.material.rotation = t * 0.05;

    aoMoverPonteiro?.(ponteiro.x, ponteiro.y);
  });

  palco.iniciar();

  return {
    destruir() {
      pararDeOuvirTema();
      window.removeEventListener("pointermove", aoMoverMouse);
      window.removeEventListener("scroll", aoRolar);
      palco.destruir();
    },
  };
}
