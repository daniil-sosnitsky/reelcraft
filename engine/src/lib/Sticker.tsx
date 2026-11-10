// Стикер: pop на входе + лёгкий wobble
// логики. pop = back.out(1.6) 0.5с (15f), wobble ±2.2° cycle 1.6с (48f) на
// всё время жизни, drop-shadow 0 16px 32px rgba(16,24,40,0.18). `from` —
// локальный кадр (относительно начала Sequence сцены-владельца). Ассеты —
// public/shared/stickers/<src>.
import React from 'react';
import { Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';

const clamp = { extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const };
const POP_DUR_SEC = 0.5; // было захардкожено 15 кадров = 0.5с при 30fps
const WOBBLE_CYCLE = 1.6;
const WOBBLE_AMP = 2.2;

export const Sticker: React.FC<{
  src: string;
  from: number;
  width: number;
  left?: number;
  top?: number;
  right?: number;
  bottom?: number;
  rotate?: number;
}> = ({ src, from, width, left, top, right, bottom, rotate = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < from) return null;

  const rel = frame - from;
  const popDur = POP_DUR_SEC * fps;
  const pop = interpolate(rel, [0, popDur], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.6)) });
  const t = rel / fps;
  const wobble = WOBBLE_AMP * Math.sin((2 * Math.PI * t) / WOBBLE_CYCLE);

  return (
    <Img
      src={staticFile(`shared/stickers/${src}`)}
      style={{
        position: 'absolute',
        left,
        top,
        right,
        bottom,
        width,
        height: 'auto',
        transform: `scale(${pop}) rotate(${rotate + wobble}deg)`,
        transformOrigin: '50% 50%',
        filter: 'drop-shadow(0 16px 32px rgba(16,24,40,0.18))',
        pointerEvents: 'none',
      }}
    />
  );
};
