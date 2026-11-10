// Обёртка сцены с кроссфейдом на входе/выходе. В ранних версиях сцены
// стыковались через <Sequence> впритык (жёсткая склейка) или
// через FlashCut на самых сильных стыках — отдельного crossfade-компонента
// не было. Здесь он собран заново: оборачивай контент сцены в <Scene>,
// указав durationInFrames родительского <Sequence>, — на входе и выходе
// сцена мягко проявляется/растворяется по opacity.
//
// Рендерить ВНУТРИ <Sequence from={...} durationInFrames={...}>: Scene
// читает useCurrentFrame() как ЛОКАЛЬНЫЙ кадр (0 = начало сцены) — это
// поведение Remotion по умолчанию внутри Sequence, ничего дополнительно
// прокидывать не нужно.
import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

const clamp = { extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const };

export const Scene: React.FC<{
  durationInFrames: number;
  /** Длительность кроссфейда на входе, кадры. 0 — сцена появляется мгновенно.
   * По умолчанию ~0.27с (8 кадров при 30fps; при другом fps — та же длительность
   * по времени, а не по кадрам — правка 2026-09-04). */
  fadeInFrames?: number;
  /** Длительность кроссфейда на выходе, кадры. 0 — сцена исчезает мгновенно. */
  fadeOutFrames?: number;
  children: React.ReactNode;
}> = ({ durationInFrames, fadeInFrames: fadeInProp, fadeOutFrames: fadeOutProp, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const defaultFade = Math.round((8 / 30) * fps);
  const fadeInFrames = fadeInProp ?? defaultFade;
  const fadeOutFrames = fadeOutProp ?? defaultFade;

  const opacityIn = fadeInFrames > 0 ? interpolate(frame, [0, fadeInFrames], [0, 1], clamp) : 1;
  const opacityOut =
    fadeOutFrames > 0
      ? interpolate(frame, [durationInFrames - fadeOutFrames, durationInFrames], [1, 0], clamp)
      : 1;

  return <AbsoluteFill style={{ opacity: Math.min(opacityIn, opacityOut) }}>{children}</AbsoluteFill>;
};
