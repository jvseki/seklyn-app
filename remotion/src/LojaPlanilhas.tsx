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
 * Vídeo vertical (WhatsApp/Instagram) pra mostrar pro Douglas a loja de
 * planilhas que já está no ar (seklyn.com.br/planilha-de-treino), com um
 * avatar treinando, prints reais da página e a regra da divisão (taxa do
 * Mercado Pago dividida entre os dois). Trilha original:
 * scripts/gerar_trilha_loja.py.
 */

const ROXO = "#8b5cf6";
const ROSA = "#ec4899";
const CIANO = "#22d3ee";
const VERDE = "#22c55e";
const FONTE = '"Segoe UI", Inter, Arial, sans-serif';

const CENAS = {
  abertura: { de: 0, dura: 120 },
  treino: { de: 120, dura: 270 },
  pagina: { de: 390, dura: 240 },
  compra: { de: 630, dura: 240 },
  minhas: { de: 870, dura: 240 },
  divisao: { de: 1110, dura: 270 },
  passos: { de: 1380, dura: 210 },
  fechamento: { de: 1590, dura: 150 },
};
export const DURACAO_LOJA = 1740;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

function useEntrada(atraso = 0) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: f - atraso, fps, config: { damping: 17 } });
}

function Cena({ dura, children }: { dura: number; children: React.ReactNode }) {
  const f = useCurrentFrame();
  return <AbsoluteFill style={{ opacity: interpolate(f, [0, 12, dura - 12, dura], [0, 1, 1, 0], clamp) }}>{children}</AbsoluteFill>;
}

function Titulo({ texto, sub, topo = 140 }: { texto: React.ReactNode; sub?: React.ReactNode; topo?: number }) {
  const e = useEntrada();
  return (
    <div style={{ position: "absolute", top: topo, left: 70, right: 70, textAlign: "center", opacity: e, transform: `translateY(${(1 - e) * 40}px)` }}>
      <div style={{ fontSize: 70, fontWeight: 900, color: "#fff", lineHeight: 1.08, letterSpacing: -1.5 }}>{texto}</div>
      {sub && <div style={{ fontSize: 36, color: "#c4b5fd", marginTop: 18, lineHeight: 1.3 }}>{sub}</div>}
    </div>
  );
}

function Fundo() {
  const f = useCurrentFrame();
  const a = f / 40;
  return (
    <AbsoluteFill style={{ background: "#07040f" }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at ${45 + Math.sin(a) * 20}% ${20 + Math.cos(a / 1.3) * 8}%, ${ROXO}99, transparent 52%),
                       radial-gradient(circle at ${70 + Math.cos(a / 1.7) * 15}% 90%, ${ROSA}66, transparent 48%),
                       radial-gradient(circle at 15% 60%, ${CIANO}22, transparent 40%)`,
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage: "linear-gradient(rgba(196,181,253,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(196,181,253,.06) 1px,transparent 1px)",
          backgroundSize: "70px 70px",
          maskImage: "radial-gradient(ellipse at 50% 30%, #000 25%, transparent 75%)",
        }}
      />
    </AbsoluteFill>
  );
}

// ---------- avatar treinando (SVG animado) ----------

function Halter({ x, y, ang = 0, larg = 90 }: { x: number; y: number; ang?: number; larg?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${ang})`}>
      <rect x={-larg / 2} y={-5} width={larg} height={10} rx={5} fill="#cbd5e1" />
      <rect x={-larg / 2 - 14} y={-26} width={22} height={52} rx={6} fill="#1e1b2e" stroke={ROXO} strokeWidth={4} />
      <rect x={larg / 2 - 8} y={-26} width={22} height={52} rx={6} fill="#1e1b2e" stroke={ROXO} strokeWidth={4} />
    </g>
  );
}

function Membro({ pontos, cor, largura = 30 }: { pontos: [number, number][]; cor: string; largura?: number }) {
  return <polyline points={pontos.map((p) => p.join(",")).join(" ")} fill="none" stroke={cor} strokeWidth={largura} strokeLinecap="round" strokeLinejoin="round" />;
}

/** Avatar estilizado. modo "agachamento" (goblet squat) ou "rosca" (rosca direta). */
function Avatar({ modo, ciclo }: { modo: "agachamento" | "rosca"; ciclo: number }) {
  const fase = (1 - Math.cos(ciclo * Math.PI * 2)) / 2; // 0 → 1 → 0 a cada repetição
  const pele = "#f5c9a6";
  const camisa = "url(#gradCamisa)";
  const calca = "#1f1640";
  let corpo: React.ReactNode;
  if (modo === "agachamento") {
    const d = fase * 95;
    const abre = fase * 34;
    const quadril: [number, number] = [200, 300 + d];
    const ombroY = 185 + d * 0.92;
    corpo = (
      <>
        <Membro pontos={[[184, quadril[1]], [158 - abre, 390 + d * 0.35], [160, 468]]} cor={calca} largura={34} />
        <Membro pontos={[[216, quadril[1]], [242 + abre, 390 + d * 0.35], [240, 468]]} cor={calca} largura={34} />
        <rect x={140} y={460} width={44} height={18} rx={9} fill="#e2e8f0" />
        <rect x={218} y={460} width={44} height={18} rx={9} fill="#e2e8f0" />
        <rect x={158} y={ombroY} width={84} height={quadril[1] - ombroY + 14} rx={30} fill={camisa} />
        <text x={200} y={ombroY + 62} textAnchor="middle" fontSize={34} fontWeight={900} fill="#fff" fontFamily={FONTE}>S</text>
        <Membro pontos={[[166, ombroY + 18], [176, ombroY + 70], [200, ombroY + 55]]} cor={pele} largura={22} />
        <Membro pontos={[[234, ombroY + 18], [224, ombroY + 70], [200, ombroY + 55]]} cor={pele} largura={22} />
        <Halter x={200} y={ombroY + 52} ang={90} larg={40} />
        <circle cx={200} cy={ombroY - 38} r={36} fill={pele} />
        <path d={`M164 ${ombroY - 48} q36 -40 72 0 q-6 -34 -36 -36 q-30 2 -36 36z`} fill="#2a1a12" />
      </>
    );
  } else {
    const ang = 90 - fase * 145; // antebraço: pra baixo (90°) → dobrado pra cima
    const rad = (ang * Math.PI) / 180;
    const cotE: [number, number] = [140, 285];
    const cotD: [number, number] = [260, 285];
    // vista de frente: a mão sobe na frente do cotovelo, um pouco pra dentro
    const maoE: [number, number] = [cotE[0] + Math.cos(rad) * 14, cotE[1] + Math.sin(rad) * 70];
    const maoD: [number, number] = [cotD[0] - Math.cos(rad) * 14, cotD[1] + Math.sin(rad) * 70];
    corpo = (
      <>
        <Membro pontos={[[184, 305], [178, 390], [172, 468]]} cor={calca} largura={34} />
        <Membro pontos={[[216, 305], [222, 390], [228, 468]]} cor={calca} largura={34} />
        <rect x={150} y={460} width={44} height={18} rx={9} fill="#e2e8f0" />
        <rect x={208} y={460} width={44} height={18} rx={9} fill="#e2e8f0" />
        <rect x={158} y={185} width={84} height={134} rx={30} fill={camisa} />
        <text x={200} y={247} textAnchor="middle" fontSize={34} fontWeight={900} fill="#fff" fontFamily={FONTE}>S</text>
        <Membro pontos={[[150, 205], cotE, maoE]} cor={pele} largura={22} />
        <Membro pontos={[[250, 205], cotD, maoD]} cor={pele} largura={22} />
        {/* halter visto de frente: o disco na mão */}
        <circle cx={maoE[0]} cy={maoE[1]} r={24} fill="#1e1b2e" stroke={ROXO} strokeWidth={5} />
        <circle cx={maoE[0]} cy={maoE[1]} r={7} fill="#cbd5e1" />
        <circle cx={maoD[0]} cy={maoD[1]} r={24} fill="#1e1b2e" stroke={ROXO} strokeWidth={5} />
        <circle cx={maoD[0]} cy={maoD[1]} r={7} fill="#cbd5e1" />
        <circle cx={200} cy={147} r={36} fill={pele} />
        <path d="M164 137 q36 -40 72 0 q-6 -34 -36 -36 q-30 2 -36 36z" fill="#2a1a12" />
      </>
    );
  }
  return (
    <svg viewBox="0 0 400 500" width="100%" height="100%">
      <defs>
        <linearGradient id="gradCamisa" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7c3aed" />
          <stop offset="1" stopColor={ROSA} />
        </linearGradient>
        <radialGradient id="gradChao">
          <stop offset="0" stopColor={ROXO} stopOpacity="0.55" />
          <stop offset="1" stopColor={ROXO} stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx={200} cy={482} rx={150} ry={20} fill="url(#gradChao)" />
      {corpo}
    </svg>
  );
}

function CenaTreino() {
  const f = useCurrentFrame();
  const metade = 135;
  const modo = f < metade ? "agachamento" : "rosca";
  const local = f < metade ? f : f - metade;
  const porRep = 45;
  const reps = Math.floor(local / porRep) + 1;
  const e = useEntrada(8);
  return (
    <>
      <Titulo texto={<>Seu aluno treina<br />com vídeo de cada exercício</>} topo={120} />
      <div style={{ position: "absolute", top: 520, left: 140, width: 800, height: 1000, opacity: e, transform: `scale(${0.9 + e * 0.1})` }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: 60, background: "radial-gradient(circle at 50% 40%, rgba(139,92,246,.35), transparent 65%)" }} />
        <Avatar modo={modo} ciclo={local / porRep} />
      </div>
      <div
        style={{
          position: "absolute",
          top: 560,
          right: 90,
          padding: "18px 28px",
          borderRadius: 28,
          background: "rgba(24,16,44,.75)",
          border: "2px solid rgba(196,181,253,.25)",
          color: "#fff",
          fontSize: 40,
          fontWeight: 800,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 26, color: "#c4b5fd", fontWeight: 600 }}>{modo === "agachamento" ? "Agachamento" : "Rosca direta"}</div>
        {Math.min(reps, 3)}/3
      </div>
      <div style={{ position: "absolute", bottom: 230, left: 0, right: 0, textAlign: "center", fontSize: 38, color: "#e9e3ff" }}>
        🎥 Execução certinha · 📄 planilha pra baixar
      </div>
    </>
  );
}

function Celular({ src, topo = 470, rolar = 0, escala = 1 }: { src: string; topo?: number; rolar?: number; escala?: number }) {
  const e = useEntrada(6);
  const L = 560 * escala;
  return (
    <div
      style={{
        position: "absolute",
        top: topo,
        left: (1080 - L) / 2,
        width: L,
        height: L * 2.1,
        borderRadius: 64 * escala,
        background: "#14111f",
        padding: 14 * escala,
        boxShadow: `0 60px 140px -30px ${ROXO}cc, 0 0 0 2px #2a2440`,
        opacity: e,
        transform: `translateY(${(1 - e) * 120}px)`,
      }}
    >
      <div style={{ width: "100%", height: "100%", borderRadius: 52 * escala, overflow: "hidden", position: "relative", background: "#07040f" }}>
        <Img src={staticFile(src)} style={{ width: "100%", position: "absolute", top: -rolar }} />
      </div>
    </div>
  );
}

function CenaPagina() {
  return (
    <>
      <Titulo texto="A página já está no ar" sub="seklyn.com.br/planilha-de-treino" topo={110} />
      <div style={{ position: "absolute", top: 400, left: 70, right: 70, borderRadius: 30, overflow: "hidden", boxShadow: `0 50px 120px -30px ${ROXO}cc`, opacity: useEntrada(10) }}>
        <Img src={staticFile("loja/pl-pc-hero.png")} style={{ width: "100%", display: "block" }} />
      </div>
      <Celular src="loja/pl-cel-rolando-1.png" topo={930} escala={0.85} />
    </>
  );
}

function CenaCompra() {
  const f = useCurrentFrame();
  const mostraPix = f > 120;
  return (
    <>
      <Titulo texto="Cria a conta e paga" sub={<>Pix, crédito ou débito — Mercado Pago</>} topo={110} />
      <Celular src={mostraPix ? "loja/pl-cel-pix.png" : "loja/pl-cel-pagamento.png"} topo={430} />
    </>
  );
}

function CenaMinhas() {
  const f = useCurrentFrame();
  const flash = interpolate(f, [20, 40], [0, 1], clamp);
  return (
    <>
      <Titulo texto="Libera na hora" sub="Assiste os vídeos no site e baixa a planilha" topo={110} />
      <Celular src="loja/pl-cel-minhas.png" topo={430} />
      <div
        style={{
          position: "absolute",
          top: 360,
          right: 120,
          padding: "14px 26px",
          borderRadius: 999,
          background: `linear-gradient(120deg, ${VERDE}, #14b8a6)`,
          color: "#fff",
          fontSize: 34,
          fontWeight: 900,
          opacity: flash,
          transform: `scale(${0.7 + flash * 0.3})`,
        }}
      >
        ✓ Pagamento confirmado
      </div>
    </>
  );
}

function Barra({ cor, pct, atraso }: { cor: string; pct: number; atraso: number }) {
  const f = useCurrentFrame();
  const v = interpolate(f, [atraso, atraso + 40], [0, pct], { ...clamp, easing: (t) => 1 - Math.pow(1 - t, 3) });
  return <div style={{ width: `${v}%`, background: cor, height: "100%" }} />;
}

function Linha({ r, v, cor = "#0f172a", forte = false }: { r: string; v: string; cor?: string; forte?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 0", borderBottom: "2px dashed #ede9fe", fontSize: forte ? 46 : 38 }}>
      <span style={{ color: "#475569" }}>{r}</span>
      <strong style={{ color: cor }}>{v}</strong>
    </div>
  );
}

function CenaDivisao() {
  const e = useEntrada(20);
  return (
    <>
      <Titulo texto="Como o dinheiro se divide" sub="A taxa do Mercado Pago sai dos dois — justo pra todo mundo" topo={110} />
      <div style={{ position: "absolute", top: 520, left: 80, right: 80, background: "#fff", borderRadius: 40, padding: "36px 42px", color: "#0f172a", opacity: e, transform: `translateY(${(1 - e) * 60}px)` }}>
        <div style={{ fontSize: 36, color: "#475569" }}>Exemplo: planilha de R$ 100,00 no Pix</div>
        <div style={{ display: "flex", height: 64, borderRadius: 18, overflow: "hidden", margin: "22px 0 8px", background: "#f1f5f9" }}>
          <Barra cor={ROXO} pct={49.5} atraso={50} />
          <Barra cor={CIANO} pct={49.5} atraso={70} />
          <Barra cor="#dc2626" pct={1} atraso={90} />
        </div>
        <Linha r="Taxa Pix (~1%)" v="− R$ 0,99" cor="#dc2626" />
        <Linha r="Douglas (metade)" v="R$ 49,51" cor="#0891b2" forte />
        <Linha r="Seklyn (metade)" v="R$ 49,50" cor="#7c3aed" forte />
        <div style={{ fontSize: 30, color: "#64748b", marginTop: 18, lineHeight: 1.4 }}>No cartão a taxa é maior, e também é dividida meio a meio.</div>
      </div>
      <div style={{ position: "absolute", top: 1180, left: 90, right: 90, display: "grid", gap: 24, opacity: useEntrada(110) }}>
        {["Cada venda aparece no painel com a parte de cada um", "Venda reembolsada? O acesso do aluno é cortado sozinho"].map((t) => (
          <div key={t} style={{ padding: "26px 30px", borderRadius: 28, background: "rgba(24,16,44,.75)", border: "2px solid rgba(196,181,253,.22)", color: "#f5f3ff", fontSize: 36, lineHeight: 1.3 }}>
            ✓ {t}
          </div>
        ))}
      </div>
    </>
  );
}

function Passo({ n, txt, atraso, cor }: { n: number; txt: React.ReactNode; atraso: number; cor: string }) {
  const e = useEntrada(atraso);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 28, marginBottom: 40, opacity: e, transform: `translateX(${(1 - e) * -80}px)` }}>
      <div style={{ width: 90, height: 90, borderRadius: 26, background: cor, color: "#fff", display: "grid", placeItems: "center", fontSize: 46, fontWeight: 900, flexShrink: 0, boxShadow: `0 0 40px ${cor}` }}>{n}</div>
      <div style={{ fontSize: 44, color: "#fff", lineHeight: 1.25 }}>{txt}</div>
    </div>
  );
}

function CenaPassos() {
  return (
    <>
      <Titulo texto="O que falta pra lançar" topo={150} />
      <div style={{ position: "absolute", top: 480, left: 90, right: 90 }}>
        <Passo n={1} cor={ROXO} atraso={15} txt={<>Gravar os <b>vídeos</b> e montar as <b>planilhas</b></>} />
        <Passo n={2} cor={ROSA} atraso={55} txt={<>Douglas cria a conta <b>grátis</b> no Mercado Pago → a divisão passa a ser <b>automática</b></>} />
        <Passo n={3} cor={CIANO} atraso={95} txt={<>Divulgar o link no <b>Instagram</b> 🚀</>} />
      </div>
    </>
  );
}

function CenaAbertura() {
  const e = useEntrada(0);
  return (
    <>
      <div style={{ position: "absolute", top: 560, left: 0, right: 0, display: "flex", justifyContent: "center", opacity: e, transform: `scale(${0.75 + e * 0.25})` }}>
        <div style={{ background: "#fff", borderRadius: 48, padding: 22, boxShadow: `0 0 140px ${ROXO}` }}>
          <Img src={staticFile("logo-s.png")} style={{ width: 170, height: 170, objectFit: "contain", display: "block" }} />
        </div>
      </div>
      <Titulo texto={<>Planilhas de treino</>} sub="Douglas Personal × Seklyn" topo={880} />
    </>
  );
}

function CenaFechamento() {
  const e = useEntrada(0);
  const f = useCurrentFrame();
  return (
    <>
      <div style={{ position: "absolute", top: 380, left: 140, width: 800, height: 700, opacity: e }}>
        <Avatar modo="rosca" ciclo={f / 45} />
      </div>
      <Titulo texto="Bora?" sub={<>seklyn.com.br/<b>planilha-de-treino</b></>} topo={1150} />
    </>
  );
}

export const LojaPlanilhas: React.FC = () => {
  const lista: [keyof typeof CENAS, React.FC][] = [
    ["abertura", CenaAbertura],
    ["treino", CenaTreino],
    ["pagina", CenaPagina],
    ["compra", CenaCompra],
    ["minhas", CenaMinhas],
    ["divisao", CenaDivisao],
    ["passos", CenaPassos],
    ["fechamento", CenaFechamento],
  ];
  return (
    <AbsoluteFill style={{ fontFamily: FONTE }}>
      <Audio src={staticFile("loja/trilha.wav")} />
      <Fundo />
      {lista.map(([nome, C]) => (
        <Sequence key={nome} from={CENAS[nome].de} durationInFrames={CENAS[nome].dura}>
          <Cena dura={CENAS[nome].dura}>
            <C />
          </Cena>
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
