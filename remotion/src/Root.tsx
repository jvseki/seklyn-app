import React from "react";
import { Composition } from "remotion";
import { LogoHero } from "./LogoHero";
import { DURACAO_SIMULACAO, SimulacaoLoja } from "./SimulacaoLoja";
import { ApresentacaoSeklyn, DURACAO_APRESENTACAO } from "./ApresentacaoSeklyn";
import { WALL_A, WALL_L, WallpaperIphone } from "./WallpaperIphone";
import { DURACAO_PARCERIA, ExplicacaoParceria } from "./ExplicacaoParceria";

const FPS = 30;
const DURACAO_SEGUNDOS = 6;
const DURACAO_FRAMES = FPS * DURACAO_SEGUNDOS;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="LogoHeroDesktop"
        component={LogoHero}
        durationInFrames={DURACAO_FRAMES}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ claro: false }}
      />
      <Composition
        id="LogoHeroMobile"
        component={LogoHero}
        durationInFrames={DURACAO_FRAMES}
        fps={FPS}
        width={960}
        height={720}
        defaultProps={{ claro: false }}
      />
      <Composition
        id="LogoHeroDesktopClaro"
        component={LogoHero}
        durationInFrames={DURACAO_FRAMES}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ claro: true }}
      />
      {/* Wallpaper do iPhone 16 Pro (imagem — renderizar com "remotion still"). */}
      <Composition id="WallpaperIphone" component={WallpaperIphone} durationInFrames={1} fps={FPS} width={WALL_L} height={WALL_A} />
      {/* Reel de apresentação do Seklyn pro Instagram (com trilha original). */}
      <Composition
        id="ApresentacaoSeklyn"
        component={ApresentacaoSeklyn}
        durationInFrames={DURACAO_APRESENTACAO}
        fps={FPS}
        width={1080}
        height={1920}
      />
      {/* Vídeo vertical da proposta da loja (pra mandar pro Douglas no WhatsApp). */}
      <Composition
        id="SimulacaoLoja"
        component={SimulacaoLoja}
        durationInFrames={DURACAO_SIMULACAO}
        fps={FPS}
        width={1080}
        height={1920}
      />
      {/* Explicação da parceria pro Douglas, com os números do teste real (08/11). */}
      <Composition
        id="ExplicacaoParceria"
        component={ExplicacaoParceria}
        durationInFrames={DURACAO_PARCERIA}
        fps={FPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="LogoHeroMobileClaro"
        component={LogoHero}
        durationInFrames={DURACAO_FRAMES}
        fps={FPS}
        width={960}
        height={720}
        defaultProps={{ claro: true }}
      />
    </>
  );
};
