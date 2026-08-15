import React from "react";
import { Composition } from "remotion";
import { LogoHero } from "./LogoHero";

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
