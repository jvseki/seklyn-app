import React from "react";
import { Composition } from "remotion";
import { LogoHero } from "./LogoHero";

const FPS = 30;
const DURACAO_SEGUNDOS = 6;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="LogoHeroDesktop"
        component={LogoHero}
        durationInFrames={FPS * DURACAO_SEGUNDOS}
        fps={FPS}
        width={1920}
        height={1080}
      />
      <Composition
        id="LogoHeroMobile"
        component={LogoHero}
        durationInFrames={FPS * DURACAO_SEGUNDOS}
        fps={FPS}
        width={960}
        height={720}
      />
    </>
  );
};
