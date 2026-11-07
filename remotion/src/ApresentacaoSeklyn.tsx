import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

/**
 * Reel de apresentação do Seklyn (1080×1920, 36s, com trilha original —
 * scripts/gerar_trilha_apresentacao.py). Usa capturas REAIS do sistema
 * (public/apresentacao/*.png, dados fictícios de demonstração).
 *
 * Áreas seguras do Reels: nada importante acima de ~200px (nome do perfil)
 * nem abaixo de ~1650px (legenda e botões do Instagram).
 */

const ROXO = "#7c3aed";
const ROXO_CLARO = "#a78bfa";
const VERDE = "#22c55e";
const FONTE = '"Segoe UI", Inter, Arial, sans-serif';
const FPS = 30;
const s = (segundos: number) => Math.round(segundos * FPS);

export const DURACAO_APRESENTACAO = s(36);

// Mesmos tempos da trilha (CORTES / TOQUES / POPS em gerar_trilha_apresentacao.py).
const CENAS = {
  gancho: [0, 3],
  logo: [3, 5],
  montar: [5, 10],
  link: [10, 13.5],
  marcar: [13.5, 19],
  trofeu: [19, 23],
  quemAbriu: [23, 26],
  recados: [26, 29],
  evolucao: [29, 32],
  cta: [32, 36],
} as const;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const saidaSuave = (t: number) => 1 - Math.pow(1 - t, 3);

// Capturas: 780×1688 (390×844 com densidade 2x).
const IMG_L = 780;
const IMG_A = 1688;
const TELA_L = 524;
const ESCALA = TELA_L / IMG_L;
const TELA_A = Math.round(IMG_A * ESCALA);
const BORDA = 16;
const CEL_TOPO = 470;

// ---------------- peças ----------------

function Cena({ dura, children }: { dura: number; children: React.ReactNode }) {
  const f = useCurrentFrame();
  const opacidade = interpolate(f, [0, 8, dura - 8, dura], [0, 1, 1, 0], clamp);
  return <AbsoluteFill style={{ opacity: opacidade }}>{children}</AbsoluteFill>;
}

/** Legenda grande no topo: parte normal + parte em destaque (degradê). */
function Legenda({ antes, destaque, depois = "", sub }: { antes: string; destaque: string; depois?: string; sub?: string }) {
  const f = useCurrentFrame();
  const entrada = spring({ frame: f, fps: FPS, config: { damping: 16 } });
  const entradaSub = spring({ frame: f - 8, fps: FPS, config: { damping: 18 } });
  return (
    <div style={{ position: "absolute", top: 220, left: 60, right: 60, textAlign: "center", fontFamily: FONTE }}>
      <div
        style={{
          fontSize: 76,
          fontWeight: 900,
          lineHeight: 1.04,
          letterSpacing: -2,
          color: "#fff",
          opacity: entrada,
          transform: `translateY(${(1 - entrada) * 40}px) scale(${0.92 + entrada * 0.08})`,
        }}
      >
        {antes}{" "}
        <span
          style={{
            background: `linear-gradient(100deg, ${ROXO_CLARO}, #f472b6)`,
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          {destaque}
        </span>
        {depois}
      </div>
      {sub && (
        <div style={{ fontSize: 38, fontWeight: 600, color: "#cbd5e1", marginTop: 18, opacity: entradaSub }}>{sub}</div>
      )}
    </div>
  );
}

type Retangulo = { x1: number; y1: number; x2: number; y2: number; aparece: number };
type Toque = { x: number; y: number; quando: number };

/**
 * Celular com uma captura real dentro. Coordenadas de destaques/toques são
 * em pixels da captura (780×1688). `zoom` aproxima devagar num ponto.
 */
function Celular({
  src,
  zoom = 1,
  foco = { x: IMG_L / 2, y: IMG_A / 2 },
  destaques = [],
  toques = [],
  entrada = true,
}: {
  src: string;
  zoom?: number;
  foco?: { x: number; y: number };
  destaques?: Retangulo[];
  toques?: Toque[];
  entrada?: boolean;
}) {
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const chegou = entrada ? spring({ frame: f, fps: FPS, config: { damping: 15 } }) : 1;
  const z = interpolate(f, [0, durationInFrames], [1, zoom], clamp);
  return (
    <div
      style={{
        position: "absolute",
        top: CEL_TOPO,
        left: (1080 - TELA_L - BORDA * 2) / 2,
        width: TELA_L + BORDA * 2,
        height: TELA_A + BORDA * 2,
        borderRadius: 70,
        padding: BORDA,
        background: "linear-gradient(145deg, #2c2c3a, #0d0d14)",
        boxShadow: "0 50px 120px -30px rgba(124,58,237,0.75), 0 0 0 2px #3a3a4c",
        transform: `translateY(${(1 - chegou) * 140}px) rotate(${(1 - chegou) * -4}deg)`,
        opacity: chegou,
      }}
    >
      <div style={{ position: "relative", width: TELA_L, height: TELA_A, borderRadius: 56, overflow: "hidden", background: "#fff" }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: `scale(${z})`,
            transformOrigin: `${foco.x * ESCALA}px ${foco.y * ESCALA}px`,
          }}
        >
          <Img src={staticFile(src)} style={{ width: TELA_L, height: TELA_A, display: "block" }} />
          {destaques.map((r, i) => {
            const aparece = spring({ frame: f - r.aparece, fps: FPS, config: { damping: 12 } });
            const pulso = 0.5 + 0.5 * Math.sin((f - r.aparece) / 5);
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: r.x1 * ESCALA - 6,
                  top: r.y1 * ESCALA - 6,
                  width: (r.x2 - r.x1) * ESCALA + 12,
                  height: (r.y2 - r.y1) * ESCALA + 12,
                  borderRadius: 18,
                  border: `4px solid ${ROXO_CLARO}`,
                  boxShadow: `0 0 ${20 + pulso * 25}px rgba(167,139,250,${0.6 + pulso * 0.3})`,
                  opacity: f >= r.aparece ? aparece : 0,
                  transform: `scale(${1.15 - aparece * 0.15})`,
                }}
              />
            );
          })}
          {toques.map((t, i) => {
            const p = interpolate(f, [t.quando, t.quando + 16], [0, 1], clamp);
            if (f < t.quando - 6) return null;
            const dedo = interpolate(f, [t.quando - 6, t.quando, t.quando + 8, t.quando + 14], [0, 1, 1, 0], clamp);
            return (
              <React.Fragment key={i}>
                <div
                  style={{
                    position: "absolute",
                    left: t.x * ESCALA - 50,
                    top: t.y * ESCALA - 50,
                    width: 100,
                    height: 100,
                    borderRadius: "50%",
                    border: `5px solid ${ROXO}`,
                    transform: `scale(${0.3 + p * 1.2})`,
                    opacity: (1 - p) * (f >= t.quando ? 1 : 0),
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    left: t.x * ESCALA - 30,
                    top: t.y * ESCALA - 30,
                    width: 60,
                    height: 60,
                    borderRadius: "50%",
                    background: "rgba(255,255,255,0.85)",
                    border: "3px solid rgba(15,23,42,0.3)",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
                    opacity: dedo,
                    transform: `scale(${f >= t.quando && f < t.quando + 4 ? 0.82 : 1})`,
                  }}
                />
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------- cenas ----------------

function Gancho() {
  const f = useCurrentFrame();
  const l1 = spring({ frame: f, fps: FPS, config: { damping: 10, mass: 0.6 } });
  const bolha = spring({ frame: f - s(0.55), fps: FPS, config: { damping: 12 } });
  const l2 = spring({ frame: f - s(1.5), fps: FPS, config: { damping: 12 } });
  const tremor = f >= s(1.5) && f < s(1.5) + 6 ? Math.sin(f * 3) * 8 : 0;
  return (
    <AbsoluteFill style={{ fontFamily: FONTE, justifyContent: "center", alignItems: "center", padding: "0 70px", transform: `translateX(${tremor}px)` }}>
      <div style={{ fontSize: 112, fontWeight: 900, color: "#fff", letterSpacing: -3, transform: `scale(${l1})` }}>Personal,</div>
      <div
        style={{
          alignSelf: "flex-start",
          marginTop: 50,
          marginLeft: 40,
          padding: "26px 40px",
          borderRadius: "40px 40px 40px 8px",
          background: "#1f2937",
          color: "#fff",
          fontSize: 50,
          fontWeight: 600,
          opacity: bolha,
          transform: `scale(${bolha})`,
          transformOrigin: "left bottom",
        }}
      >
        "fiz sim, professor 💪"
        <div style={{ fontSize: 26, color: "#94a3b8", marginTop: 8, fontWeight: 500 }}>aluno · 22:47</div>
      </div>
      <div
        style={{
          marginTop: 70,
          textAlign: "center",
          fontSize: 78,
          fontWeight: 900,
          lineHeight: 1.08,
          letterSpacing: -2,
          color: "#fff",
          opacity: l2,
          transform: `translateY(${(1 - l2) * 50}px)`,
        }}
      >
        ele treinou mesmo… <br />
        <span style={{ background: `linear-gradient(100deg, ${ROXO_CLARO}, #f472b6)`, WebkitBackgroundClip: "text", color: "transparent" }}>
          ou só disse que treinou?
        </span>
      </div>
    </AbsoluteFill>
  );
}

function Logo() {
  const f = useCurrentFrame();
  const logo = spring({ frame: f, fps: FPS, config: { damping: 9, mass: 0.8 } });
  const texto = spring({ frame: f - 10, fps: FPS, config: { damping: 15 } });
  const brilho = 40 + Math.sin(f / 4) * 20;
  return (
    <AbsoluteFill style={{ fontFamily: FONTE, justifyContent: "center", alignItems: "center" }}>
      <Img
        src={staticFile("logo-s.png")}
        style={{
          width: 380,
          transform: `scale(${logo}) rotate(${(1 - logo) * -40}deg)`,
          filter: `drop-shadow(0 0 ${brilho}px rgba(167,139,250,0.9))`,
        }}
      />
      <div style={{ marginTop: 60, textAlign: "center", opacity: texto, transform: `translateY(${(1 - texto) * 30}px)` }}>
        <div style={{ fontSize: 50, fontWeight: 600, color: "#c4b5fd", letterSpacing: 6, textTransform: "uppercase" }}>Conheça o</div>
        <div style={{ fontSize: 150, fontWeight: 900, color: "#fff", letterSpacing: -5, lineHeight: 1 }}>
          Sek<span style={{ color: ROXO_CLARO }}>lyn</span>
        </div>
      </div>
    </AbsoluteFill>
  );
}

function Montar() {
  const troca = s(2.6);
  return (
    <>
      <Legenda antes="Monte o treino" destaque="em segundos" sub="Escolha o grupo, os exercícios e pronto" />
      <Sequence durationInFrames={troca + 8}>
        <Celular
          src="apresentacao/personal-montar-treino.png"
          toques={[
            { x: 237, y: 595, quando: s(0.8) },
            { x: 543, y: 868, quando: s(1.4) },
          ]}
        />
      </Sequence>
      <Sequence from={troca} durationInFrames={s(5) - troca}>
        <Celular src="apresentacao/personal-treino-aberto.png" entrada={false} zoom={1.06} foco={{ x: 390, y: 700 }} />
      </Sequence>
    </>
  );
}

function Link() {
  const f = useCurrentFrame();
  const msg = spring({ frame: f - s(0.6), fps: FPS, config: { damping: 13 } });
  const resposta = spring({ frame: f - s(1.9), fps: FPS, config: { damping: 13 } });
  return (
    <>
      <Legenda antes="Mande um" destaque="link" sub="Sem app pra baixar. Sem senha." />
      <div style={{ position: "absolute", top: 560, left: 80, right: 80, fontFamily: FONTE }}>
        <div
          style={{
            marginLeft: "auto",
            width: 720,
            padding: 30,
            borderRadius: "40px 40px 8px 40px",
            background: `linear-gradient(135deg, ${ROXO}, #6d28d9)`,
            color: "#fff",
            opacity: msg,
            transform: `scale(${msg})`,
            transformOrigin: "right bottom",
            boxShadow: "0 30px 60px -20px rgba(124,58,237,0.8)",
          }}
        >
          <div style={{ fontSize: 42, fontWeight: 700 }}>Seu treino da semana tá aqui 👇</div>
          <div style={{ marginTop: 22, padding: 24, borderRadius: 24, background: "rgba(255,255,255,0.15)", display: "flex", gap: 22, alignItems: "center" }}>
            <Img src={staticFile("logo-s.png")} style={{ width: 84 }} />
            <div>
              <div style={{ fontSize: 36, fontWeight: 800 }}>Treinos do João</div>
              <div style={{ fontSize: 28, opacity: 0.85 }}>seklyn.com.br</div>
            </div>
          </div>
          <div style={{ textAlign: "right", fontSize: 24, opacity: 0.8, marginTop: 12 }}>Rafael · 07:02 ✓✓</div>
        </div>
        <div
          style={{
            marginTop: 40,
            width: 560,
            padding: "26px 34px",
            borderRadius: "40px 40px 40px 8px",
            background: "#1f2937",
            color: "#fff",
            fontSize: 44,
            fontWeight: 600,
            opacity: resposta,
            transform: `scale(${resposta})`,
            transformOrigin: "left bottom",
          }}
        >
          Abri aqui, bora! 🔥
          <div style={{ fontSize: 24, color: "#94a3b8", marginTop: 6, fontWeight: 500 }}>João · 07:03</div>
        </div>
      </div>
    </>
  );
}

function Marcar() {
  const troca = s(1.8);
  return (
    <>
      <Legenda antes="O aluno marca" destaque="série por série" />
      <Sequence durationInFrames={troca + 8}>
        <Celular src="apresentacao/aluno-semana.png" toques={[{ x: 588, y: 917, quando: s(1.5) }]} />
      </Sequence>
      <Sequence from={troca} durationInFrames={s(5.5) - troca}>
        <Celular
          src="apresentacao/aluno-marcando.png"
          entrada={false}
          zoom={1.12}
          foco={{ x: 300, y: 900 }}
          toques={[
            { x: 110, y: 684, quando: s(2.5) - troca },
            { x: 110, y: 906, quando: s(3.1) - troca },
            { x: 110, y: 1128, quando: s(3.7) - troca },
          ]}
        />
      </Sequence>
    </>
  );
}

function Trofeu() {
  return (
    <>
      <Legenda antes="E comemora" destaque="cada treino" sub="Treino concluído vira conquista" />
      <Celular src="apresentacao/aluno-celebracao.png" zoom={1.08} foco={{ x: 390, y: 700 }} toques={[{ x: 390, y: 1467, quando: s(2.6) }]} />
    </>
  );
}

function QuemAbriu() {
  return (
    <>
      <Legenda antes="Você vê" destaque="quem abriu" sub="o treino, e quando abriu" />
      <Celular
        src="apresentacao/personal-semana.png"
        zoom={1.18}
        foco={{ x: 320, y: 1110 }}
        destaques={[{ x1: 74, y1: 1086, x2: 562, y2: 1138, aparece: s(0.6) }]}
      />
    </>
  );
}

function Recados() {
  return (
    <>
      <Legenda antes="E o que cada aluno" destaque="sentiu" sub="Recado direto na série" />
      <Celular
        src="apresentacao/personal-dashboard.png"
        zoom={1.12}
        foco={{ x: 390, y: 840 }}
        destaques={[{ x1: 98, y1: 684, x2: 700, y2: 912, aparece: s(0.6) }]}
      />
    </>
  );
}

function Evolucao() {
  return (
    <>
      <Legenda antes="Metas e" destaque="evolução" sub="pro aluno ver o próprio progresso" />
      <Celular
        src="apresentacao/aluno-progresso.png"
        zoom={1.1}
        foco={{ x: 390, y: 400 }}
        destaques={[{ x1: 34, y1: 266, x2: 746, y2: 478, aparece: s(0.6) }]}
      />
    </>
  );
}

function Cta() {
  const f = useCurrentFrame();
  const halter = spring({ frame: f, fps: FPS, config: { damping: 11 } });
  const t1 = spring({ frame: f - 8, fps: FPS, config: { damping: 15 } });
  const botao = spring({ frame: f - 22, fps: FPS, config: { damping: 9 } });
  const flutua = Math.sin(f / 9) * 14;
  return (
    <AbsoluteFill style={{ fontFamily: FONTE, alignItems: "center" }}>
      <Img
        src={staticFile("apresentacao/halter.png")}
        style={{
          position: "absolute",
          top: 230,
          width: 760,
          transform: `translateY(${flutua + (1 - halter) * -200}px) scale(${0.7 + halter * 0.3}) rotate(${(1 - halter) * 25}deg)`,
          opacity: halter,
          filter: "drop-shadow(0 40px 60px rgba(124,58,237,0.55))",
        }}
      />
      <div style={{ position: "absolute", top: 990, left: 60, right: 60, textAlign: "center", opacity: t1, transform: `translateY(${(1 - t1) * 40}px)` }}>
        <div style={{ fontSize: 74, fontWeight: 900, color: "#fff", lineHeight: 1.05, letterSpacing: -2 }}>
          Acompanhe seus alunos{" "}
          <span style={{ background: `linear-gradient(100deg, ${ROXO_CLARO}, #f472b6)`, WebkitBackgroundClip: "text", color: "transparent" }}>
            de verdade.
          </span>
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          top: 1290,
          padding: "34px 70px",
          borderRadius: 999,
          background: `linear-gradient(135deg, ${ROXO}, #db2777)`,
          color: "#fff",
          fontSize: 56,
          fontWeight: 900,
          transform: `scale(${botao})`,
          boxShadow: "0 30px 80px -20px rgba(219,39,119,0.8)",
        }}
      >
        Crie sua conta grátis
      </div>
      <div style={{ position: "absolute", top: 1460, fontSize: 46, fontWeight: 700, color: "#e9d5ff", opacity: botao, letterSpacing: 1 }}>
        seklyn.com.br
      </div>
    </AbsoluteFill>
  );
}

const COMPONENTES: Record<keyof typeof CENAS, React.FC> = {
  gancho: Gancho,
  logo: Logo,
  montar: Montar,
  link: Link,
  marcar: Marcar,
  trofeu: Trofeu,
  quemAbriu: QuemAbriu,
  recados: Recados,
  evolucao: Evolucao,
  cta: Cta,
};

export function ApresentacaoSeklyn() {
  const f = useCurrentFrame();
  const ciclo = (f / DURACAO_APRESENTACAO) * Math.PI * 2;
  // O fundo "acende" junto com o drop da batida (logo, aos 3s).
  const energia = interpolate(f, [s(2.6), s(3.1)], [0.45, 1], { ...clamp, easing: saidaSuave });
  return (
    <AbsoluteFill style={{ background: "#05030d" }}>
      <AbsoluteFill
        style={{
          opacity: energia,
          background: `radial-gradient(900px 900px at ${50 + Math.sin(ciclo * 2) * 22}% ${38 + Math.cos(ciclo * 2) * 12}%, rgba(124,58,237,0.42), transparent 62%),
            radial-gradient(760px 760px at ${18 + Math.cos(ciclo * 3) * 14}% 88%, rgba(219,39,119,0.22), transparent 60%)`,
        }}
      />
      {(Object.keys(CENAS) as (keyof typeof CENAS)[]).map((chave) => {
        const [de, ate] = CENAS[chave];
        const Componente = COMPONENTES[chave];
        return (
          <Sequence key={chave} from={s(de)} durationInFrames={s(ate - de)}>
            <Cena dura={s(ate - de)}>
              <Componente />
            </Cena>
          </Sequence>
        );
      })}
      <Audio src={staticFile("apresentacao/trilha.wav")} />
    </AbsoluteFill>
  );
}
