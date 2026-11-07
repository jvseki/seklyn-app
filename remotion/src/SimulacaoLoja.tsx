import React from "react";
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

/**
 * Simulação (vertical, sem áudio, com legendas) da ideia da loja de treinos
 * dentro do Seklyn — pra apresentar a parceria pro Douglas: ele cadastra o
 * programa, o aluno compra, o pagamento se divide sozinho (split do Mercado
 * Pago, taxa dividida meio a meio) e o conteúdo fica na biblioteca do aluno.
 * Telas ilustrativas — não são capturas do sistema (a loja ainda não existe).
 */

const ROXO = "#7c3aed";
const ROXO_CLARO = "#a78bfa";
const VERDE = "#16a34a";
const FONTE = '"Segoe UI", Inter, Arial, sans-serif';

const CENAS = {
  abertura: { de: 0, dura: 120 },
  cadastro: { de: 120, dura: 270 },
  loja: { de: 390, dura: 210 },
  pagamento: { de: 600, dura: 210 },
  divisao: { de: 810, dura: 330 },
  biblioteca: { de: 1140, dura: 240 },
  fechamento: { de: 1380, dura: 180 },
};
export const DURACAO_SIMULACAO = 1560;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// ---------- peças reutilizáveis ----------

/** Fade de entrada/saída de cada cena (dentro de uma <Sequence>). */
function Cena({ dura, children }: { dura: number; children: React.ReactNode }) {
  const f = useCurrentFrame();
  const opacidade = interpolate(f, [0, 12, dura - 12, dura], [0, 1, 1, 0], clamp);
  return <AbsoluteFill style={{ opacity: opacidade }}>{children}</AbsoluteFill>;
}

function Legenda({ titulo, sub }: { titulo: string; sub?: string }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entrada = spring({ frame: f, fps, config: { damping: 18 } });
  return (
    <div
      style={{
        position: "absolute",
        top: 120,
        left: 70,
        right: 70,
        textAlign: "center",
        transform: `translateY(${(1 - entrada) * 40}px)`,
        opacity: entrada,
      }}
    >
      <div style={{ fontSize: 66, fontWeight: 800, color: "#fff", lineHeight: 1.1, letterSpacing: -1.5 }}>{titulo}</div>
      {sub && <div style={{ fontSize: 36, color: "#c4b5fd", marginTop: 18, fontWeight: 500 }}>{sub}</div>}
    </div>
  );
}

/** Moldura de celular; o conteúdo é a "tela" do app (tema claro). */
function Celular({ children, topo = 420 }: { children: React.ReactNode; topo?: number }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entrada = spring({ frame: f - 4, fps, config: { damping: 16 } });
  return (
    <div
      style={{
        position: "absolute",
        top: topo,
        left: (1080 - 680) / 2,
        width: 680,
        height: 1360,
        borderRadius: 78,
        background: "#16161f",
        padding: 18,
        boxShadow: `0 60px 140px -30px rgba(124,58,237,0.65), 0 0 0 2px #2a2a38`,
        transform: `translateY(${(1 - entrada) * 120}px) scale(${0.94 + entrada * 0.06})`,
        opacity: entrada,
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          borderRadius: 62,
          overflow: "hidden",
          background: "#f8f7fc",
          fontFamily: FONTE,
          color: "#0f172a",
        }}
      >
        <div style={{ height: 54, display: "flex", justifyContent: "center", alignItems: "center" }}>
          <div style={{ width: 150, height: 34, borderRadius: 20, background: "#16161f" }} />
        </div>
        {children}
      </div>
    </div>
  );
}

/** Dedo "tocando" a tela: aparece, vai até (x, y) e afunda no frame `toque`. */
function Dedo({ x, y, toque, deX = 560, deY = 1400 }: { x: number; y: number; toque: number; deX?: number; deY?: number }) {
  const f = useCurrentFrame();
  const chegada = interpolate(f, [toque - 28, toque - 4], [0, 1], { ...clamp, easing: (t) => 1 - Math.pow(1 - t, 3) });
  const aperto = interpolate(f, [toque - 3, toque, toque + 6], [1, 0.78, 1], clamp);
  const visivel = interpolate(f, [toque - 30, toque - 24, toque + 20, toque + 30], [0, 1, 1, 0], clamp);
  const onda = interpolate(f, [toque, toque + 18], [0, 1], clamp);
  const px = deX + (x - deX) * chegada;
  const py = deY + (y - deY) * chegada;
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: x - 70,
          top: y - 70,
          width: 140,
          height: 140,
          borderRadius: "50%",
          border: `5px solid ${ROXO_CLARO}`,
          opacity: (1 - onda) * (onda > 0 ? 0.9 : 0),
          transform: `scale(${0.4 + onda})`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: px - 38,
          top: py - 38,
          width: 76,
          height: 76,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.92)",
          border: "4px solid rgba(15,23,42,0.25)",
          boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
          transform: `scale(${aperto})`,
          opacity: visivel,
        }}
      />
    </>
  );
}

function IconeVideo({ cor = ROXO, tamanho = 44 }: { cor?: string; tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24">
      <rect x="2" y="5" width="15" height="14" rx="3" fill={cor} />
      <path d="M17 10l5-3v10l-5-3z" fill={cor} />
    </svg>
  );
}

function IconeDoc({ cor = "#0ea5e9", tamanho = 44 }: { cor?: string; tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24">
      <path d="M6 2h8l5 5v15H6z" fill={cor} />
      <path d="M14 2v5h5" fill="rgba(255,255,255,0.5)" />
    </svg>
  );
}

function Check({ tamanho = 40, cor = "#fff" }: { tamanho?: number; cor?: string }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke={cor} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// ---------- cenas ----------

function Abertura() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logo = spring({ frame: f, fps, config: { damping: 12 } });
  const texto = spring({ frame: f - 18, fps, config: { damping: 18 } });
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", fontFamily: FONTE }}>
      <Img
        src={staticFile("logo-s.png")}
        style={{
          width: 300,
          transform: `scale(${logo}) rotate(${(1 - logo) * -25}deg)`,
          filter: "drop-shadow(0 0 60px rgba(167,139,250,0.8))",
        }}
      />
      <div style={{ marginTop: 70, textAlign: "center", opacity: texto, transform: `translateY(${(1 - texto) * 30}px)` }}>
        <div style={{ fontSize: 46, color: "#c4b5fd", fontWeight: 600, letterSpacing: 4, textTransform: "uppercase" }}>
          Proposta de parceria
        </div>
        <div style={{ fontSize: 84, color: "#fff", fontWeight: 800, lineHeight: 1.05, marginTop: 24, letterSpacing: -2, padding: "0 60px" }}>
          Sua loja de treinos dentro do Seklyn
        </div>
      </div>
    </AbsoluteFill>
  );
}

function Campo({ rotulo, valor, ativo }: { rotulo: string; valor: string; ativo?: boolean }) {
  return (
    <div style={{ marginBottom: 26 }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: "#64748b", marginBottom: 10 }}>{rotulo}</div>
      <div
        style={{
          fontSize: 30,
          fontWeight: 600,
          padding: "20px 22px",
          borderRadius: 18,
          background: "#fff",
          border: `2px solid ${ativo ? ROXO : "#e2e8f0"}`,
          minHeight: 40,
          boxShadow: ativo ? `0 0 0 6px rgba(124,58,237,0.15)` : "none",
        }}
      >
        {valor}
      </div>
    </div>
  );
}

function Cadastro() {
  const f = useCurrentFrame();
  const nome = "Programa Hipertrofia 12 semanas";
  const letras = Math.floor(interpolate(f, [24, 84], [0, nome.length], clamp));
  const preco = f > 92 ? "R$ 100,00" : "";
  const itens = [
    { icone: <IconeVideo />, nome: "Semana 1 — Treino A", inicio: 104 },
    { icone: <IconeVideo />, nome: "Semana 1 — Treino B", inicio: 122 },
    { icone: <IconeDoc />, nome: "Planilha de cargas.pdf", inicio: 140 },
  ];
  const publicado = f > 214;
  const toast = spring({ frame: f - 214, fps: 30, config: { damping: 14 } });
  return (
    <>
      <Legenda titulo="1. O Douglas cadastra o treino" sub="Vídeos e planilhas, com o preço que ele quiser" />
      <Celular>
        <div style={{ padding: "18px 40px" }}>
          <div style={{ fontSize: 44, fontWeight: 800, marginBottom: 6 }}>Meus produtos</div>
          <div style={{ fontSize: 24, color: "#64748b", marginBottom: 36 }}>Novo produto na sua loja</div>
          <Campo rotulo="Nome" valor={nome.slice(0, letras)} ativo={f > 20 && f < 90} />
          <Campo rotulo="Preço" valor={preco} ativo={f > 88 && f < 104} />
          <div style={{ fontSize: 24, fontWeight: 700, color: "#64748b", margin: "8px 0 14px" }}>Conteúdo</div>
          {itens.map((item) => {
            const p = interpolate(f, [item.inicio, item.inicio + 50], [0, 1], clamp);
            if (f < item.inicio) return null;
            return (
              <div
                key={item.nome}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 18,
                  background: "#fff",
                  borderRadius: 18,
                  padding: "18px 20px",
                  marginBottom: 14,
                  border: "2px solid #e2e8f0",
                }}
              >
                {item.icone}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 27, fontWeight: 700 }}>{item.nome}</div>
                  <div style={{ height: 8, borderRadius: 8, background: "#e2e8f0", marginTop: 10, overflow: "hidden" }}>
                    <div style={{ width: `${p * 100}%`, height: "100%", background: p >= 1 ? VERDE : ROXO }} />
                  </div>
                </div>
                {p >= 1 && <Check tamanho={34} cor={VERDE} />}
              </div>
            );
          })}
          <div
            style={{
              marginTop: 30,
              padding: "28px 0",
              borderRadius: 22,
              textAlign: "center",
              fontSize: 34,
              fontWeight: 800,
              color: "#fff",
              background: publicado ? VERDE : `linear-gradient(135deg, ${ROXO}, #6d28d9)`,
              boxShadow: "0 18px 40px -14px rgba(124,58,237,0.7)",
            }}
          >
            {publicado ? "Publicado na loja ✓" : "Publicar na loja"}
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            left: 40,
            right: 40,
            bottom: 60,
            padding: "26px 30px",
            borderRadius: 24,
            background: "#0f172a",
            color: "#fff",
            fontSize: 28,
            fontWeight: 600,
            opacity: toast,
            transform: `translateY(${(1 - toast) * 60}px)`,
          }}
        >
          Pronto! Já está à venda em seklyn.com.br/loja/douglas
        </div>
      </Celular>
      <Dedo x={540} y={1385} toque={208} />
    </>
  );
}

function CardProduto({ titulo, preco, destaque, escala = 1 }: { titulo: string; preco: number; destaque?: boolean; escala?: number }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 20,
        alignItems: "center",
        background: "#fff",
        borderRadius: 24,
        padding: 18,
        marginBottom: 18,
        border: `2px solid ${destaque ? ROXO : "#e2e8f0"}`,
        transform: `scale(${escala})`,
        boxShadow: destaque ? "0 20px 40px -18px rgba(124,58,237,0.6)" : "none",
      }}
    >
      <div
        style={{
          width: 130,
          height: 130,
          borderRadius: 18,
          background: `linear-gradient(135deg, #1b1c25, ${ROXO})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <IconeVideo cor="#fff" tamanho={52} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 29, fontWeight: 800, lineHeight: 1.2 }}>{titulo}</div>
        <div style={{ fontSize: 30, fontWeight: 800, color: ROXO, marginTop: 8 }}>{reais(preco)}</div>
      </div>
    </div>
  );
}

function Loja() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tocouCard = interpolate(f, [116, 122, 130], [1, 0.96, 1], clamp);
  const detalhe = spring({ frame: f - 132, fps, config: { damping: 18 } });
  return (
    <>
      <Legenda titulo="2. O aluno encontra na loja" sub="Cria a conta dele em segundos" />
      <Celular>
        <div style={{ margin: "6px 30px 0", padding: "14px 22px", borderRadius: 16, background: "#eceaf4", fontSize: 24, color: "#475569" }}>
          🔒 seklyn.com.br/loja/douglas
        </div>
        <div style={{ padding: "30px 34px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 34 }}>
            <div
              style={{
                width: 96,
                height: 96,
                borderRadius: "50%",
                background: `linear-gradient(135deg, ${ROXO}, #ec4899)`,
                color: "#fff",
                fontSize: 46,
                fontWeight: 800,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              D
            </div>
            <div>
              <div style={{ fontSize: 36, fontWeight: 800 }}>Douglas Personal</div>
              <div style={{ fontSize: 24, color: "#64748b" }}>Personal Trainer · treinos online</div>
            </div>
          </div>
          <CardProduto titulo="Programa Hipertrofia 12 semanas" preco={100} destaque escala={tocouCard} />
          <CardProduto titulo="Planilha Emagrecimento" preco={49} />
          <CardProduto titulo="Mobilidade em 15 minutos" preco={39} />
        </div>
        {/* Detalhe do produto deslizando por cima */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            top: 54,
            background: "#f8f7fc",
            transform: `translateX(${(1 - detalhe) * 100}%)`,
            padding: "0 0 40px",
          }}
        >
          <div
            style={{
              height: 420,
              background: `linear-gradient(135deg, #1b1c25 20%, ${ROXO})`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ width: 130, height: 130, borderRadius: "50%", background: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="56" height="56" viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z" fill="#fff" /></svg>
            </div>
          </div>
          <div style={{ padding: "34px 40px" }}>
            <div style={{ fontSize: 44, fontWeight: 800, lineHeight: 1.1 }}>Programa Hipertrofia 12 semanas</div>
            <div style={{ fontSize: 28, color: "#64748b", marginTop: 16 }}>36 vídeos · planilha de cargas · por Douglas Personal</div>
            <div style={{ fontSize: 26, color: "#0f172a", marginTop: 26, lineHeight: 1.45 }}>
              ✓ Acesso pra sempre{"\n"}
              <br />✓ Assiste no celular, na academia
              <br />✓ Atualizações inclusas
            </div>
            <div
              style={{
                marginTop: 40,
                padding: "30px 0",
                borderRadius: 22,
                textAlign: "center",
                fontSize: 36,
                fontWeight: 800,
                color: "#fff",
                background: `linear-gradient(135deg, ${ROXO}, #6d28d9)`,
                boxShadow: "0 18px 40px -14px rgba(124,58,237,0.7)",
              }}
            >
              Comprar — R$ 100,00
            </div>
          </div>
        </div>
      </Celular>
      <Dedo x={540} y={800} toque={118} />
      <Dedo x={540} y={1372} toque={186} />
    </>
  );
}

function QrCode() {
  // Padrão determinístico (não é um Pix real — só ilustração).
  const celulas = [];
  for (let l = 0; l < 21; l++) {
    for (let c = 0; c < 21; c++) {
      const canto = (l < 7 && c < 7) || (l < 7 && c > 13) || (l > 13 && c < 7);
      const borda = canto && (l % 6 === 0 || c % 6 === 0 || (l > 1 && l < 5 && c > 1 && c < 5) || l === 14 || l === 20 || c === 14 || c === 20);
      const ruido = !canto && ((l * 7 + c * 13 + l * c) % 5 < 2);
      if (borda || ruido) celulas.push(<rect key={`${l}-${c}`} x={c} y={l} width="1" height="1" fill="#0f172a" />);
    }
  }
  return (
    <svg width="300" height="300" viewBox="0 0 21 21" style={{ background: "#fff", padding: 12, borderRadius: 16 }}>
      {celulas}
    </svg>
  );
}

function Pagamento() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const processando = f > 110 && f < 140;
  const aprovado = spring({ frame: f - 140, fps, config: { damping: 11 } });
  return (
    <>
      <Legenda titulo="3. Paga com Pix ou cartão" sub="Checkout seguro do Mercado Pago" />
      <Celular>
        <div style={{ padding: "26px 40px" }}>
          <div style={{ fontSize: 26, color: "#64748b", fontWeight: 600 }}>🔒 Pagamento seguro</div>
          <div style={{ fontSize: 40, fontWeight: 800, marginTop: 14 }}>Programa Hipertrofia 12 semanas</div>
          <div style={{ fontSize: 64, fontWeight: 800, color: ROXO, marginTop: 10 }}>R$ 100,00</div>
          <div style={{ display: "flex", gap: 18, marginTop: 34 }}>
            {["Pix", "Cartão"].map((meio, i) => (
              <div
                key={meio}
                style={{
                  flex: 1,
                  textAlign: "center",
                  padding: "24px 0",
                  borderRadius: 20,
                  fontSize: 32,
                  fontWeight: 800,
                  background: i === 0 ? "#f5f3ff" : "#fff",
                  border: `3px solid ${i === 0 ? ROXO : "#e2e8f0"}`,
                  color: i === 0 ? ROXO : "#0f172a",
                }}
              >
                {meio}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 46 }}>
            <QrCode />
            <div style={{ fontSize: 26, color: "#64748b", marginTop: 22 }}>Aponte a câmera do app do banco</div>
          </div>
        </div>
        {(processando || f >= 140) && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(248,247,252,0.96)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {processando ? (
              <div
                style={{
                  width: 110,
                  height: 110,
                  borderRadius: "50%",
                  border: "10px solid #ede9fe",
                  borderTopColor: ROXO,
                  transform: `rotate(${f * 14}deg)`,
                }}
              />
            ) : (
              <>
                <div
                  style={{
                    width: 200,
                    height: 200,
                    borderRadius: "50%",
                    background: VERDE,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transform: `scale(${aprovado})`,
                    boxShadow: "0 0 0 24px rgba(22,163,74,0.15)",
                  }}
                >
                  <Check tamanho={110} />
                </div>
                <div style={{ fontSize: 50, fontWeight: 800, marginTop: 50, opacity: aprovado }}>Pagamento aprovado</div>
              </>
            )}
          </div>
        )}
      </Celular>
    </>
  );
}

function Carteira({ nome, detalhe, valor, cor, lado, chegada }: { nome: string; detalhe: string; valor: number; cor: string; lado: "esq" | "dir"; chegada: number }) {
  return (
    <div
      style={{
        position: "absolute",
        top: 1180,
        [lado === "esq" ? "left" : "right"]: 60,
        width: 450,
        padding: "40px 34px",
        borderRadius: 36,
        background: "rgba(255,255,255,0.06)",
        border: `3px solid ${chegada > 0.98 ? cor : "rgba(255,255,255,0.14)"}`,
        boxShadow: chegada > 0.98 ? `0 0 60px -10px ${cor}` : "none",
        fontFamily: FONTE,
        color: "#fff",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 40, fontWeight: 800 }}>{nome}</div>
      <div style={{ fontSize: 24, color: "#cbd5e1", marginTop: 8 }}>{detalhe}</div>
      <div style={{ fontSize: 66, fontWeight: 800, marginTop: 26, color: cor }}>+ {reais(valor * chegada)}</div>
    </div>
  );
}

function Divisao() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entrada = spring({ frame: f - 6, fps, config: { damping: 14 } });
  const taxaSai = interpolate(f, [60, 110], [0, 1], { ...clamp, easing: (t) => t * t });
  const restante = interpolate(f, [60, 110], [100, 95], clamp);
  const divide = interpolate(f, [140, 200], [0, 1], { ...clamp, easing: (t) => 1 - Math.pow(1 - t, 3) });
  const chegada = interpolate(f, [195, 250], [0, 1], clamp);
  const nota = interpolate(f, [250, 270], [0, 1], clamp);

  const moeda = (x: number, y: number, valor: number, escala: number, opacidade = 1) => (
    <div
      style={{
        position: "absolute",
        left: x - 190 * escala,
        top: y - 190 * escala,
        width: 380 * escala,
        height: 380 * escala,
        borderRadius: "50%",
        background: "radial-gradient(circle at 30% 30%, #fff3c4, #ffc94d 45%, #c98a12)",
        boxShadow: "0 30px 80px -20px rgba(255,201,77,0.6), inset 0 -10px 30px rgba(0,0,0,0.2)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONTE,
        fontWeight: 900,
        fontSize: 74 * escala,
        color: "#5a3a00",
        opacity: opacidade,
      }}
    >
      {reais(valor)}
    </div>
  );

  return (
    <>
      <Legenda titulo="4. O dinheiro se divide sozinho" sub="Cai na hora, direto na conta de cada um" />
      <AbsoluteFill style={{ transform: `scale(${0.9 + entrada * 0.1})`, opacity: entrada }}>
        {divide < 0.02 && moeda(540, 820, restante, 1)}
        {divide >= 0.02 && (
          <>
            {/* cada metade "cai" dentro da carteira e some, enquanto o valor dela conta */}
            {moeda(540 - divide * 250, 820 + divide * 320 + chegada * 170, 47.5, (0.62 + (1 - divide) * 0.25) * (1 - chegada * 0.6), 1 - chegada)}
            {moeda(540 + divide * 250, 820 + divide * 320 + chegada * 170, 47.5, (0.62 + (1 - divide) * 0.25) * (1 - chegada * 0.6), 1 - chegada)}
          </>
        )}
        {/* fatia da taxa saindo pro lado */}
        <div
          style={{
            position: "absolute",
            left: 760 + taxaSai * 120,
            top: 640 - taxaSai * 60,
            opacity: f > 58 ? 1 - Math.max(0, (f - 150) / 30) : 0,
            fontFamily: FONTE,
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: "50%",
              background: "radial-gradient(circle at 30% 30%, #e2e8f0, #94a3b8)",
              margin: "0 auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 30,
              fontWeight: 900,
              color: "#334155",
            }}
          >
            R$ 5
          </div>
          <div style={{ fontSize: 24, color: "#cbd5e1", marginTop: 12, width: 220, marginLeft: -50 }}>taxa do Mercado Pago (exemplo)</div>
        </div>
        <Carteira nome="Douglas" detalhe="na conta Mercado Pago dele" valor={47.5} cor="#4ade80" lado="esq" chegada={chegada} />
        <Carteira nome="Seklyn" detalhe="plataforma, loja e entrega" valor={47.5} cor={ROXO_CLARO} lado="dir" chegada={chegada} />
        <div
          style={{
            position: "absolute",
            top: 1560,
            left: 80,
            right: 80,
            textAlign: "center",
            fontFamily: FONTE,
            fontSize: 30,
            color: "#cbd5e1",
            lineHeight: 1.4,
            opacity: nota,
          }}
        >
          Meio a meio, inclusive a taxa. O Seklyn nunca segura o dinheiro do Douglas.
          <div style={{ fontSize: 24, color: "#94a3b8", marginTop: 14 }}>Valores ilustrativos — a taxa real depende do meio de pagamento.</div>
        </div>
      </AbsoluteFill>
    </>
  );
}

function Biblioteca() {
  const f = useCurrentFrame();
  const progressoVideo = interpolate(f, [60, 230], [0.08, 0.62], clamp);
  const aulas = ["Semana 1 — Treino A", "Semana 1 — Treino B", "Semana 2 — Treino A", "Planilha de cargas"];
  return (
    <>
      <Legenda titulo="5. É do aluno pra sempre" sub="Fica na biblioteca dele, em qualquer celular" />
      <Celular>
        <div style={{ padding: "18px 0 0" }}>
          <div style={{ padding: "0 40px", fontSize: 44, fontWeight: 800 }}>Minha biblioteca</div>
          <div style={{ margin: "26px 40px 0", borderRadius: 26, overflow: "hidden", background: "#0f172a" }}>
            <div
              style={{
                height: 330,
                background: `linear-gradient(135deg, #1b1c25 25%, ${ROXO})`,
                display: "flex",
                alignItems: "flex-end",
              }}
            >
              <div style={{ width: "100%", padding: 20 }}>
                <div style={{ height: 8, borderRadius: 8, background: "rgba(255,255,255,0.25)" }}>
                  <div style={{ width: `${progressoVideo * 100}%`, height: "100%", borderRadius: 8, background: ROXO_CLARO }} />
                </div>
              </div>
            </div>
            <div style={{ padding: "22px 26px", color: "#fff" }}>
              <div style={{ fontSize: 30, fontWeight: 800 }}>Programa Hipertrofia 12 semanas</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, fontSize: 24, color: "#4ade80", fontWeight: 700 }}>
                <Check tamanho={26} cor="#4ade80" /> Comprado · acesso vitalício
              </div>
            </div>
          </div>
          <div style={{ padding: "26px 40px" }}>
            {aulas.map((aula, i) => {
              const aparece = interpolate(f, [20 + i * 12, 34 + i * 12], [0, 1], clamp);
              const feita = i === 0;
              return (
                <div
                  key={aula}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 18,
                    padding: "22px 20px",
                    marginBottom: 14,
                    borderRadius: 18,
                    background: "#fff",
                    border: `2px solid ${i === 1 ? ROXO : "#e2e8f0"}`,
                    opacity: aparece,
                    transform: `translateY(${(1 - aparece) * 20}px)`,
                  }}
                >
                  {i === 3 ? <IconeDoc tamanho={40} /> : <IconeVideo tamanho={40} cor={feita ? VERDE : ROXO} />}
                  <div style={{ flex: 1, fontSize: 28, fontWeight: 700 }}>{aula}</div>
                  {feita && <Check tamanho={30} cor={VERDE} />}
                  {i === 1 && <div style={{ fontSize: 22, fontWeight: 800, color: ROXO }}>ASSISTINDO</div>}
                </div>
              );
            })}
          </div>
        </div>
      </Celular>
    </>
  );
}

function Fechamento() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const linhas = [
    { texto: "Douglas grava e monta.", cor: "#fff", tam: 70 },
    { texto: "O Seklyn cuida do resto:", cor: "#c4b5fd", tam: 46 },
    { texto: "loja, pagamento, entrega e suporte.", cor: "#c4b5fd", tam: 46 },
    { texto: "Metade pra cada, direto na conta.", cor: "#4ade80", tam: 52 },
  ];
  const bora = spring({ frame: f - 100, fps, config: { damping: 9 } });
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", fontFamily: FONTE, textAlign: "center", padding: "0 70px" }}>
      <Img src={staticFile("logo-s.png")} style={{ width: 170, marginBottom: 60, filter: "drop-shadow(0 0 40px rgba(167,139,250,0.7))" }} />
      {linhas.map((linha, i) => {
        const e = spring({ frame: f - 10 - i * 16, fps, config: { damping: 18 } });
        return (
          <div
            key={linha.texto}
            style={{
              fontSize: linha.tam,
              fontWeight: 800,
              color: linha.cor,
              lineHeight: 1.2,
              marginBottom: i === 0 ? 34 : 12,
              opacity: e,
              transform: `translateY(${(1 - e) * 30}px)`,
            }}
          >
            {linha.texto}
          </div>
        );
      })}
      <div
        style={{
          marginTop: 80,
          padding: "34px 90px",
          borderRadius: 999,
          background: `linear-gradient(135deg, ${ROXO}, #ec4899)`,
          color: "#fff",
          fontSize: 64,
          fontWeight: 900,
          transform: `scale(${bora})`,
          boxShadow: "0 30px 80px -20px rgba(236,72,153,0.7)",
        }}
      >
        Bora?
      </div>
    </AbsoluteFill>
  );
}

// ---------- composição ----------

export function SimulacaoLoja() {
  const f = useCurrentFrame();
  const ciclo = (f / DURACAO_SIMULACAO) * Math.PI * 2;
  return (
    <AbsoluteFill style={{ background: "#05030d", fontFamily: FONTE }}>
      {/* fundo: holofotes roxos se movendo devagar */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(900px 900px at ${50 + Math.sin(ciclo) * 20}% ${30 + Math.cos(ciclo) * 10}%, rgba(124,58,237,0.38), transparent 60%),
            radial-gradient(700px 700px at ${20 + Math.cos(ciclo * 1.3) * 15}% 85%, rgba(236,72,153,0.18), transparent 60%)`,
        }}
      />
      {(Object.keys(CENAS) as (keyof typeof CENAS)[]).map((chave) => {
        const { de, dura } = CENAS[chave];
        const Componente = {
          abertura: Abertura,
          cadastro: Cadastro,
          loja: Loja,
          pagamento: Pagamento,
          divisao: Divisao,
          biblioteca: Biblioteca,
          fechamento: Fechamento,
        }[chave];
        return (
          <Sequence key={chave} from={de} durationInFrames={dura}>
            <Cena dura={dura}>
              <Componente />
            </Cena>
          </Sequence>
        );
      })}
      <div
        style={{
          position: "absolute",
          bottom: 46,
          width: "100%",
          textAlign: "center",
          fontSize: 24,
          color: "rgba(255,255,255,0.45)",
          letterSpacing: 2,
        }}
      >
        SIMULAÇÃO ILUSTRATIVA · SEKLYN
      </div>
    </AbsoluteFill>
  );
}
