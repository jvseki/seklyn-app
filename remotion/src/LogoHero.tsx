import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

/**
 * Fundo animado do hero (logo Seklyn "S" flutuando + blobs roxos, igual à
 * identidade visual do site). Feito pra dar loop perfeito: toda animação
 * usa seno/cosseno sincronizados com a duração total, então o frame final
 * volta exatamente pro estado do frame inicial.
 */
export function LogoHero() {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();

  // Progresso de 0 a 2π ao longo do vídeo inteiro — base de tudo que precisa
  // dar loop sem soluço (blob, rotação, brilho).
  const ciclo = (frame / durationInFrames) * Math.PI * 2;

  const escalaBase = Math.min(width, height) / 720;

  // Logo: flutua sutil (não gira 360 — só um "respirar" de poucos graus) e
  // pulsa um brilho leve.
  const rotacao = Math.sin(ciclo) * 4; // graus, -4 a +4
  const escalaLogo = 1 + Math.sin(ciclo * 1) * 0.035;
  const brilho = 40 + Math.sin(ciclo) * 25; // px de blur do glow
  const flutuarY = Math.sin(ciclo) * 14 * escalaBase;

  // Blobs decorativos: cada um numa órbita elíptica com fase diferente,
  // ecoando os .blob do CSS do site (mesmas cores).
  const blob1X = 50 + Math.cos(ciclo) * 14;
  const blob1Y = 30 + Math.sin(ciclo) * 10;
  const blob2X = 75 + Math.cos(ciclo + Math.PI * 0.66) * 12;
  const blob2Y = 60 + Math.sin(ciclo + Math.PI * 0.66) * 12;
  const blob3X = 25 + Math.cos(ciclo + Math.PI * 1.33) * 10;
  const blob3Y = 70 + Math.sin(ciclo + Math.PI * 1.33) * 10;

  const tamanhoLogo = Math.min(width, height) * 0.34;

  return (
    <AbsoluteFill style={{ background: "#020617", overflow: "hidden" }}>
      {/* Blobs roxos, mesmas cores da marca */}
      <div
        style={{
          position: "absolute",
          left: `${blob1X}%`,
          top: `${blob1Y}%`,
          width: 620 * escalaBase,
          height: 620 * escalaBase,
          transform: "translate(-50%, -50%)",
          borderRadius: "50%",
          background: "radial-gradient(circle, #8b5cf6 0%, transparent 70%)",
          opacity: 0.55,
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
          background: "radial-gradient(circle, #4c1d95 0%, transparent 70%)",
          opacity: 0.6,
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
          background: "radial-gradient(circle, #a78bfa 0%, transparent 70%)",
          opacity: 0.4,
          filter: "blur(4px)",
        }}
      />

      {/* Logo "S" flutuando com glow pulsante */}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            transform: `translateY(${flutuarY}px) rotate(${rotacao}deg) scale(${escalaLogo})`,
            filter: `drop-shadow(0 0 ${brilho}px rgba(139, 92, 246, 0.85)) drop-shadow(0 0 ${brilho * 2}px rgba(76, 29, 149, 0.5))`,
          }}
        >
          <Img src={staticFile("logo-s.png")} style={{ width: tamanhoLogo, height: "auto" }} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
