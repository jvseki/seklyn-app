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
 * Vídeo vertical (WhatsApp, com trilha original — scripts/gerar_trilha_parceria.py) explicando de novo a parceria pro Douglas, agora
 * com os números REAIS do teste feito em 08/11/2026 na tela "Loja (teste)":
 * Pix de R$ 1,00 (taxa R$ 0,01) e crédito de R$ 1,00 (taxa R$ 0,02), divisão
 * com a taxa saindo da parte do parceiro, repasse feito — e o próximo passo
 * (conta Mercado Pago dele → divisão automática).
 */

const ROXO = "#7c3aed";
const ROXO_CLARO = "#c4b5fd";
const VERDE = "#22c55e";
const TEAL = "#14b8a6";
const AMBAR = "#f59e0b";
const FONTE = '"Segoe UI", Inter, Arial, sans-serif';

const CENAS = {
  abertura: { de: 0, dura: 120 },
  teste: { de: 120, dura: 300 },
  regra: { de: 420, dura: 330 },
  formas: { de: 750, dura: 240 },
  hoje: { de: 990, dura: 210 },
  proximo: { de: 1200, dura: 300 },
  fechamento: { de: 1500, dura: 150 },
};
export const DURACAO_PARCERIA = 1650;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

function Cena({ dura, children }: { dura: number; children: React.ReactNode }) {
  const f = useCurrentFrame();
  const opacidade = interpolate(f, [0, 12, dura - 12, dura], [0, 1, 1, 0], clamp);
  return <AbsoluteFill style={{ opacity: opacidade }}>{children}</AbsoluteFill>;
}

function useEntrada(atraso = 0) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: f - atraso, fps, config: { damping: 18 } });
}

function Titulo({ texto, sub, topo = 150 }: { texto: string; sub?: string; topo?: number }) {
  const e = useEntrada();
  return (
    <div
      style={{
        position: "absolute",
        top: topo,
        left: 70,
        right: 70,
        textAlign: "center",
        opacity: e,
        transform: `translateY(${(1 - e) * 40}px)`,
      }}
    >
      <div style={{ fontSize: 68, fontWeight: 800, color: "#fff", lineHeight: 1.1, letterSpacing: -1.5 }}>{texto}</div>
      {sub && <div style={{ fontSize: 36, color: ROXO_CLARO, marginTop: 20, fontWeight: 500, lineHeight: 1.3 }}>{sub}</div>}
    </div>
  );
}

/** Cartão branco que entra deslizando. */
function Cartao({
  atraso,
  topo,
  children,
  altura,
}: {
  atraso: number;
  topo: number;
  children: React.ReactNode;
  altura?: number;
}) {
  const e = useEntrada(atraso);
  return (
    <div
      style={{
        position: "absolute",
        top: topo,
        left: 80,
        right: 80,
        height: altura,
        background: "#ffffff",
        borderRadius: 40,
        padding: "34px 40px",
        boxShadow: "0 40px 100px -30px rgba(124,58,237,0.7)",
        color: "#0f172a",
        opacity: e,
        transform: `translateY(${(1 - e) * 80}px) scale(${0.96 + e * 0.04})`,
      }}
    >
      {children}
    </div>
  );
}

function Linha({ rotulo, valor, cor = "#0f172a", forte = false }: { rotulo: string; valor: string; cor?: string; forte?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        padding: "14px 0",
        borderBottom: "2px dashed #ede9fe",
        fontSize: forte ? 44 : 38,
      }}
    >
      <span style={{ color: "#475569" }}>{rotulo}</span>
      <strong style={{ color: cor, fontWeight: 800 }}>{valor}</strong>
    </div>
  );
}

function Selo({ texto, cor }: { texto: string; cor: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "8px 20px",
        borderRadius: 999,
        fontSize: 30,
        fontWeight: 800,
        color: cor,
        background: `${cor}22`,
      }}
    >
      {texto}
    </span>
  );
}

function Fundo() {
  const f = useCurrentFrame();
  const giro = f * 0.4;
  return (
    <AbsoluteFill style={{ background: "#0b0716", fontFamily: FONTE }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at ${50 + Math.sin(giro / 30) * 18}% ${22 + Math.cos(giro / 40) * 8}%, ${ROXO}88, transparent 55%),
                       radial-gradient(circle at 15% 95%, #ec489955, transparent 45%)`,
        }}
      />
    </AbsoluteFill>
  );
}

// ---------- cenas ----------

function Abertura() {
  const e = useEntrada(0);
  return (
    <>
      <div
        style={{
          position: "absolute",
          top: 560,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          opacity: e,
          transform: `scale(${0.8 + e * 0.2})`,
        }}
      >
        <div style={{ background: "#fff", borderRadius: 48, padding: 22, boxShadow: `0 0 120px ${ROXO}` }}>
          <Img src={staticFile("logo-s.png")} style={{ width: 170, height: 170, objectFit: "contain", display: "block" }} />
        </div>
      </div>
      <Titulo texto="Seklyn × Douglas Personal" sub="Como a parceria funciona — com o teste de verdade que já fizemos" topo={880} />
    </>
  );
}

function Teste() {
  const f = useCurrentFrame();
  const check = interpolate(f, [200, 230], [0, 1], clamp);
  return (
    <>
      <Titulo texto="O teste foi feito ✅" sub="08/11 · vendas reais de R$ 1,00 na tela da loja" />
      <Cartao atraso={20} topo={520}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong style={{ fontSize: 44 }}>Venda no Pix</strong>
          <Selo texto="Paga" cor={VERDE} />
        </div>
        <Linha rotulo="Valor" valor="R$ 1,00" />
        <Linha rotulo="Taxa Mercado Pago" valor="− R$ 0,01" cor="#dc2626" />
      </Cartao>
      <Cartao atraso={70} topo={930}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong style={{ fontSize: 44 }}>Venda no crédito</strong>
          <Selo texto="Paga" cor={VERDE} />
        </div>
        <Linha rotulo="Valor" valor="R$ 1,00" />
        <Linha rotulo="Taxa Mercado Pago" valor="− R$ 0,02" cor="#dc2626" />
      </Cartao>
      <div
        style={{
          position: "absolute",
          top: 1380,
          left: 80,
          right: 80,
          textAlign: "center",
          fontSize: 40,
          color: "#fff",
          lineHeight: 1.4,
          opacity: check,
          transform: `translateY(${(1 - check) * 30}px)`,
        }}
      >
        Dinheiro caiu ✓ · Divisão calculada ✓ · <span style={{ color: VERDE, fontWeight: 800 }}>Repasse feito ✓</span>
      </div>
    </>
  );
}

function Regra() {
  const f = useCurrentFrame();
  const barra = interpolate(f, [90, 150], [0, 1], { ...clamp, easing: (t) => 1 - Math.pow(1 - t, 3) });
  return (
    <>
      <Titulo texto="Como o valor se divide" sub="Seklyn fica com 50% do valor cheio. A taxa do Mercado Pago sai da parte do parceiro." />
      <Cartao atraso={30} topo={620}>
        <div style={{ fontSize: 36, color: "#475569", marginBottom: 10 }}>Exemplo: venda de R$ 100,00 no Pix</div>
        <div style={{ display: "flex", height: 70, borderRadius: 20, overflow: "hidden", margin: "18px 0 10px" }}>
          {/* proporção ilustrativa: a taxa aparece maior pra dar pra ver */}
          <div style={{ width: `${50 * barra}%`, background: ROXO }} />
          <div style={{ width: `${47 * barra}%`, background: TEAL }} />
          <div style={{ width: `${3 * barra}%`, background: "#dc2626" }} />
        </div>
        <Linha rotulo="Seklyn (50%)" valor="R$ 50,00" cor={ROXO} forte />
        <Linha rotulo="Taxa Pix (~0,99%)" valor="− R$ 0,99" cor="#dc2626" />
        <Linha rotulo="Douglas" valor="R$ 49,01" cor={TEAL} forte />
      </Cartao>
      <Cartao atraso={150} topo={1290}>
        <div style={{ fontSize: 34, color: "#475569", marginBottom: 6 }}>No teste de R$ 1,00:</div>
        <Linha rotulo="Pix → Seklyn / Douglas" valor="0,50 / 0,49" />
        <Linha rotulo="Crédito → Seklyn / Douglas" valor="0,50 / 0,48" />
      </Cartao>
    </>
  );
}

function Opcao({ nome, detalhe, cor, atraso, selecionado }: { nome: string; detalhe: string; cor: string; atraso: number; selecionado?: boolean }) {
  const e = useEntrada(atraso);
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 32,
        padding: "30px 34px",
        display: "flex",
        alignItems: "center",
        gap: 28,
        border: `5px solid ${selecionado ? ROXO : "#e2e8f0"}`,
        opacity: e,
        transform: `translateX(${(1 - e) * -120}px)`,
        marginBottom: 26,
      }}
    >
      <div style={{ width: 90, height: 90, borderRadius: 24, background: cor, flexShrink: 0 }} />
      <div>
        <div style={{ fontSize: 50, fontWeight: 800, color: "#0f172a" }}>{nome}</div>
        <div style={{ fontSize: 32, color: "#475569", marginTop: 4 }}>{detalhe}</div>
      </div>
    </div>
  );
}

function Formas() {
  return (
    <>
      <Titulo texto="O cliente escolhe como pagar" />
      <div style={{ position: "absolute", top: 470, left: 80, right: 80 }}>
        <Opcao nome="Crédito" detalhe="À vista no cartão" cor={ROXO} atraso={20} selecionado />
        <Opcao nome="Débito" detalhe="Sai na hora da conta" cor="#8b5cf6" atraso={45} />
        <Opcao nome="Pix" detalhe="QR na tela · menor taxa" cor={TEAL} atraso={70} />
      </div>
      <div
        style={{
          position: "absolute",
          top: 1330,
          left: 90,
          right: 90,
          textAlign: "center",
          fontSize: 34,
          color: ROXO_CLARO,
          lineHeight: 1.4,
          opacity: useEntrada(110),
        }}
      >
        Cartão que é crédito e débito no mesmo número (tipo Nubank) passa no crédito ou no Pix.
      </div>
    </>
  );
}

function Hoje() {
  return (
    <>
      <Titulo texto="Hoje (no teste)" sub="O dinheiro cai na conta do Seklyn e o repasse pro Douglas é um Pix" />
      <Cartao atraso={30} topo={640}>
        <div style={{ fontSize: 40, lineHeight: 1.5 }}>
          <div>
            1. Cliente paga → <strong>conta do Seklyn</strong>
          </div>
          <div>
            2. Sistema calcula a parte do Douglas
          </div>
          <div>
            3. QR de repasse pronto, <strong>chave verificada</strong>
          </div>
          <div style={{ color: AMBAR, fontWeight: 800, marginTop: 10 }}>⚠ O envio ainda é manual (um toque no app)</div>
        </div>
      </Cartao>
    </>
  );
}

function Passo({ n, texto, atraso }: { n: number; texto: React.ReactNode; atraso: number }) {
  const e = useEntrada(atraso);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 28,
        marginBottom: 34,
        opacity: e,
        transform: `translateY(${(1 - e) * 40}px)`,
      }}
    >
      <div
        style={{
          width: 86,
          height: 86,
          borderRadius: "50%",
          background: ROXO,
          color: "#fff",
          display: "grid",
          placeItems: "center",
          fontSize: 44,
          fontWeight: 800,
          flexShrink: 0,
          boxShadow: `0 0 40px ${ROXO}`,
        }}
      >
        {n}
      </div>
      <div style={{ fontSize: 42, color: "#fff", lineHeight: 1.3 }}>{texto}</div>
    </div>
  );
}

function Proximo() {
  return (
    <>
      <Titulo texto="Próximo passo: automático" sub="Sem repasse manual — cada um recebe direto" />
      <div style={{ position: "absolute", top: 560, left: 90, right: 90 }}>
        <Passo n={1} atraso={25} texto={<>Douglas cria uma conta <strong>grátis</strong> no Mercado Pago (só CPF)</>} />
        <Passo n={2} atraso={70} texto={<>Conecta essa conta no Seklyn <strong>uma vez</strong></>} />
        <Passo n={3} atraso={115} texto={<>Cada venda <strong>se divide sozinha</strong> na hora do pagamento</>} />
        <Passo
          n={4}
          atraso={160}
          texto={
            <>
              A parte do Douglas cai <strong style={{ color: TEAL }}>direto na conta dele</strong> — e só a parte dele conta como renda dele
            </>
          }
        />
      </div>
    </>
  );
}

function Fechamento() {
  const e = useEntrada(0);
  return (
    <>
      <div style={{ position: "absolute", top: 640, left: 0, right: 0, display: "flex", justifyContent: "center", opacity: e }}>
        <div style={{ background: "#fff", borderRadius: 44, padding: 20, boxShadow: `0 0 120px ${ROXO}` }}>
          <Img src={staticFile("logo-s.png")} style={{ width: 150, height: 150, objectFit: "contain", display: "block" }} />
        </div>
      </div>
      <Titulo texto="Bora fazer acontecer?" sub="Cria a conta no Mercado Pago e me avisa 💜" topo={920} />
    </>
  );
}

export const ExplicacaoParceria: React.FC = () => {
  const lista: [keyof typeof CENAS, React.FC][] = [
    ["abertura", Abertura],
    ["teste", Teste],
    ["regra", Regra],
    ["formas", Formas],
    ["hoje", Hoje],
    ["proximo", Proximo],
    ["fechamento", Fechamento],
  ];
  return (
    <AbsoluteFill style={{ fontFamily: FONTE }}>
      <Audio src={staticFile("parceria/trilha.wav")} />
      <Fundo />
      {lista.map(([nome, Componente]) => (
        <Sequence key={nome} from={CENAS[nome].de} durationInFrames={CENAS[nome].dura}>
          <Cena dura={CENAS[nome].dura}>
            <Componente />
          </Cena>
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
