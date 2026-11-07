import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";

/**
 * Wallpaper do Seklyn pro iPhone 16 Pro (1206×2622). Layout pensado na
 * tela de bloqueio: topo escuro e limpo pro relógio, arte do meio pra
 * baixo, nada importante nos cantos de baixo (lanterna/câmera).
 * Render:  npx remotion still src/index.ts WallpaperIphone out/seklyn-wallpaper-iphone16pro.png
 */

export const WALL_L = 1206;
export const WALL_A = 2622;

const ROXO = "#7c3aed";

// Partículas de luz em posições fixas (pseudo-aleatório determinístico).
function particulas() {
  const pontos = [];
  let semente = 42;
  const aleatorio = () => {
    semente = (semente * 16807) % 2147483647;
    return semente / 2147483647;
  };
  for (let i = 0; i < 90; i++) {
    const x = aleatorio() * WALL_L;
    const y = 900 + aleatorio() * 1250;
    const tamanho = 2 + aleatorio() * 5;
    const brilho = 0.25 + aleatorio() * 0.75;
    const cor = aleatorio() > 0.75 ? "#f0abfc" : aleatorio() > 0.4 ? "#c4b5fd" : "#ffffff";
    pontos.push(
      <div
        key={i}
        style={{
          position: "absolute",
          left: x,
          top: y,
          width: tamanho,
          height: tamanho,
          borderRadius: "50%",
          background: cor,
          opacity: brilho,
          boxShadow: `0 0 ${tamanho * 4}px ${cor}`,
        }}
      />
    );
  }
  return pontos;
}

export function WallpaperIphone() {
  const centroLogo = 1440;
  const larguraLogo = 1180;
  return (
    <AbsoluteFill style={{ background: "#040209", overflow: "hidden" }}>
      {/* Atmosfera: halo roxo grande atrás do logo + toque magenta embaixo. */}
      <AbsoluteFill
        style={{
          background: `
            radial-gradient(900px 760px at 50% ${centroLogo}px, rgba(91,33,182,0.42), transparent 72%),
            radial-gradient(900px 600px at 50% 2500px, rgba(219,39,119,0.22), transparent 70%),
            linear-gradient(180deg, #020106 0%, #05020d 45%, #0a0418 100%)`,
        }}
      />

      {/* Feixes de luz verticais atrás do logo. */}
      {[-260, -120, 0, 130, 270].map((dx, i) => (
        <div
          key={dx}
          style={{
            position: "absolute",
            left: WALL_L / 2 + dx - 3,
            top: 700,
            width: i === 2 ? 8 : 4,
            height: 1150,
            background: `linear-gradient(180deg, transparent, rgba(196,181,253,${i === 2 ? 0.55 : 0.28}) 55%, transparent)`,
            filter: "blur(2px)",
            transform: `rotate(${dx * 0.02}deg)`,
          }}
        />
      ))}

      {/* Piso quadriculado em perspectiva, sumindo no horizonte. */}
      <div
        style={{
          position: "absolute",
          left: -WALL_L,
          right: -WALL_L,
          top: 1900,
          height: 1400,
          backgroundImage: `linear-gradient(rgba(167,139,250,0.55) 2px, transparent 2px), linear-gradient(90deg, rgba(167,139,250,0.55) 2px, transparent 2px)`,
          backgroundSize: "120px 120px",
          backgroundPosition: "center top",
          transform: "perspective(700px) rotateX(70deg)",
          transformOrigin: "50% 0%",
          WebkitMaskImage: "linear-gradient(180deg, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.5) 40%, transparent 85%)",
          maskImage: "linear-gradient(180deg, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.5) 40%, transparent 85%)",
        }}
      />
      {/* Linha do horizonte acesa. */}
      <div
        style={{
          position: "absolute",
          top: 1896,
          left: 0,
          right: 0,
          height: 6,
          background: `linear-gradient(90deg, transparent, ${ROXO} 25%, #e9d5ff 50%, ${ROXO} 75%, transparent)`,
          boxShadow: "0 0 40px 10px rgba(124,58,237,0.6)",
        }}
      />

      {particulas()}

      {/* Reflexo do logo no piso. */}
      <Img
        src={staticFile("logo-alta.jpeg")}
        style={{
          position: "absolute",
          left: (WALL_L - larguraLogo) / 2,
          top: 1905,
          width: larguraLogo,
          transform: "scaleY(-0.55)",
          transformOrigin: "50% 0%",
          mixBlendMode: "lighten",
          opacity: 0.32,
          WebkitMaskImage: "radial-gradient(closest-side, #000 30%, transparent 75%)",
          maskImage: "radial-gradient(closest-side, #000 30%, transparent 75%)",
          filter: "blur(3px)",
        }}
      />

      {/* O "S": a arte do logo em alta, SÓLIDA (a metade preta cromada
          precisa continuar preta) — só as bordas da imagem somem no fundo
          com a máscara radial, pra não aparecer o quadrado. */}
      <Img
        src={staticFile("logo-alta.jpeg")}
        style={{
          position: "absolute",
          left: (WALL_L - larguraLogo) / 2,
          top: centroLogo - larguraLogo / 2,
          width: larguraLogo,
          WebkitMaskImage: "radial-gradient(closest-side, #000 50%, transparent 78%)",
          maskImage: "radial-gradient(closest-side, #000 50%, transparent 78%)",
          filter: "saturate(1.2) contrast(1.06) brightness(1.1)",
        }}
      />

      {/* Assinatura discreta, acima da barra de gesto. */}
      <div
        style={{
          position: "absolute",
          top: 2240,
          width: "100%",
          textAlign: "center",
          fontFamily: '"Segoe UI", Inter, Arial, sans-serif',
          fontSize: 44,
          fontWeight: 800,
          letterSpacing: 26,
          paddingLeft: 26,
          color: "rgba(233,213,255,0.85)",
          textShadow: "0 0 24px rgba(167,139,250,0.9)",
        }}
      >
        SEKLYN
      </div>
    </AbsoluteFill>
  );
}
