import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

type Props = {
  claro?: boolean;
};

/**
 * Fundo animado do hero (logo Seklyn "S" flutuando + blobs roxos, igual à
 * identidade visual do site). Loop perfeito: toda animação usa seno/cosseno
 * sincronizados com a duração total, então o frame final volta exatamente
 * pro estado do frame inicial. `claro` alterna pro fundo branco (modo claro
 * do site) — cores/glow são recalibrados porque glow "aceso" some no branco.
 */
export function LogoHero({ claro = false }: Props) {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();

  // Progresso de 0 a 2π ao longo do vídeo inteiro — base de tudo que precisa
  // dar loop sem soluço (blob, rotação, brilho, sweep de luz).
  const ciclo = (frame / durationInFrames) * Math.PI * 2;

  const escalaBase = Math.min(width, height) / 720;

  // Logo: rotação 3D de verdade (perspective + rotateY/rotateX), bem mais
  // ampla que um "tremor" — pra dar pra perceber o movimento de longe.
  const rotY = Math.sin(ciclo) * 26; // graus, -26 a +26 — vira de lado o suficiente pra mostrar profundidade
  const rotX = Math.cos(ciclo * 0.7) * 8; // leve inclinação cruzada, dá mais 3D ainda
  const rotZ = Math.sin(ciclo * 0.5) * 3;
  const escalaLogo = 1 + Math.sin(ciclo) * 0.07;
  const flutuarY = Math.sin(ciclo) * 16 * escalaBase;

  // Brilho: pulsa mais forte no fundo escuro (glow "acende" bem); no fundo
  // claro vira sombra colorida por baixo (senão o glow simplesmente some).
  const intensidadeBrilho = 55 + Math.sin(ciclo) * 30;

  // Sweep de luz diagonal cruzando o logo — efeito "metal polido" clássico.
  const posicaoSweep = ((frame / durationInFrames) * 260 - 30) % 260;

  const corFundo = claro ? "#f7f5ff" : "#020617";
  const corBlob1 = claro ? "#c4b5fd" : "#8b5cf6";
  const corBlob2 = claro ? "#a78bfa" : "#4c1d95";
  const corBlob3 = claro ? "#ddd6fe" : "#a78bfa";
  const opacidadeBlob = claro ? 0.55 : 0.55;

  const filtroLogo = claro
    ? `brightness(1.08) saturate(1.15) drop-shadow(0 ${18 * escalaBase}px ${28 * escalaBase}px rgba(76, 29, 149, 0.35)) drop-shadow(0 0 ${intensidadeBrilho * 0.5}px rgba(139, 92, 246, 0.45))`
    : `brightness(1.25) saturate(1.2) drop-shadow(0 0 ${intensidadeBrilho}px rgba(167, 139, 250, 0.95)) drop-shadow(0 0 ${intensidadeBrilho * 2}px rgba(139, 92, 246, 0.6)) drop-shadow(0 ${10 * escalaBase}px ${20 * escalaBase}px rgba(2, 6, 23, 0.6))`;

  // Blobs: cada um numa órbita elíptica com fase diferente.
  const blob1X = 50 + Math.cos(ciclo) * 14;
  const blob1Y = 30 + Math.sin(ciclo) * 10;
  const blob2X = 75 + Math.cos(ciclo + Math.PI * 0.66) * 12;
  const blob2Y = 60 + Math.sin(ciclo + Math.PI * 0.66) * 12;
  const blob3X = 25 + Math.cos(ciclo + Math.PI * 1.33) * 10;
  const blob3Y = 70 + Math.sin(ciclo + Math.PI * 1.33) * 10;

  const tamanhoLogo = Math.min(width, height) * 0.36;

  return (
    <AbsoluteFill style={{ background: corFundo, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          left: `${blob1X}%`,
          top: `${blob1Y}%`,
          width: 620 * escalaBase,
          height: 620 * escalaBase,
          transform: "translate(-50%, -50%)",
          borderRadius: "50%",
          background: `radial-gradient(circle, ${corBlob1} 0%, transparent 70%)`,
          opacity: opacidadeBlob,
          filter: "blur(4px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: `${blob2X}%`,
          top: `${blob2Y}%`,
          width: 560 * escalaBase,
          height: 560 * escalaBase,
          transform: "translate(-50%, -50%)",
          borderRadius: "50%",
          background: `radial-gradient(circle, ${corBlob2} 0%, transparent 70%)`,
          opacity: opacidadeBlob + 0.05,
          filter: "blur(4px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: `${blob3X}%`,
          top: `${blob3Y}%`,
          width: 480 * escalaBase,
          height: 480 * escalaBase,
          transform: "translate(-50%, -50%)",
          borderRadius: "50%",
          background: `radial-gradient(circle, ${corBlob3} 0%, transparent 70%)`,
          opacity: opacidadeBlob - 0.15,
          filter: "blur(4px)",
        }}
      />

      {/* Logo "S" com rotação 3D real (perspective) + glow pulsante + sweep de luz */}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", perspective: 1400 * escalaBase }}>
        <div
          style={{
            position: "relative",
            transform: `translateY(${flutuarY}px) rotateY(${rotY}deg) rotateX(${rotX}deg) rotateZ(${rotZ}deg) scale(${escalaLogo})`,
            transformStyle: "preserve-3d",
          }}
        >
          <div style={{ filter: filtroLogo, position: "relative" }}>
            <Img src={staticFile("logo-s.png")} style={{ width: tamanhoLogo, height: "auto", display: "block" }} />
            {/* Sweep de luz diagonal — "brilho de metal polido" passando por cima do logo */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `linear-gradient(115deg, transparent ${posicaoSweep - 18}%, rgba(255,255,255,0.75) ${posicaoSweep}%, transparent ${posicaoSweep + 18}%)`,
                mixBlendMode: "overlay",
                pointerEvents: "none",
              }}
            />
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
