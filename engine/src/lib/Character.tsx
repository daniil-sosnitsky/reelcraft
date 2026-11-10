// Персонаж. Цепочка
// поз по смысловым битам речи, кроссфейд между позами (по умолчанию 0.25с
// при 30fps = 8 кадров) ease inOut-quad, БЕЗ масштаба; дыхание всего
// персонажа весь ролик (y = -amplitude·(1-cos(2π·t/period)), детерминиро-
// ванная синусоида, не CSS keyframes).
//
// В отличие от ранней версии (где POSE_CHAIN был захардкожен внутри),
// здесь таблица смен поз передаётся пропом `poses` — каждый ролик задаёт
// свою последовательность под свою раскадровку.
//
// Рендерить компонент нужно ВНЕ Sequence-обёрток сцен (сиблингом в корневой
// композиции ролика), тогда useCurrentFrame() внутри — абсолютный кадр
// таймлайна, как и нужно для таблицы поз, привязанной к абсолютным кадрам.
// Ассеты — public/shared/character/pose-<name>.png.
import React from 'react';
import { Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import type { CharZone } from '../themes/types';

export type PoseKeyframe = { frame: number; pose: string };

const clamp = { extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const };

export const Character: React.FC<{
  poses: PoseKeyframe[];
  charZone: CharZone;
  swapFrames?: number;
  breatheAmp?: number;
  breathePeriodSec?: number;
  /** Как меняется поза (найдено терчеком video-109, 2026-08-21):
   *  • 'fade' — прежнее поведение, alpha-кроссфейд двух PNG. На контрастных
   *    парах поз (руки в разных местах) даёт «двух персонажей насквозь» —
   *    читается как баг рендера. Оставлен дефолтом, чтобы не менять уже
   *    сданные ролики 105/108.
   *  • 'dip' — подмена ЖЁСТКИМ кадром в нижней точке короткого «нырка»
   *    (присесть → подскочить): в кадре всегда РОВНО ОДНА поза, смена
   *    читается как живое движение персонажа, а не как призрак. */
  swapMode?: 'fade' | 'dip';
  /** Глубина нырка в px для swapMode='dip'. */
  dipPx?: number;
  /** Папка с позами в public/. По умолчанию — персонаж канала;
   * для отдельного бренда передать свою (напр. 'shared/character-brand'). */
  dir?: string;
}> = ({
  poses,
  charZone,
  swapFrames: swapFramesProp,
  breatheAmp = 6,
  breathePeriodSec = 2.4,
  swapMode = 'fade',
  dipPx = 26,
  dir = 'shared/character',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Дефолт — 0.25с (было захардкожено 8 кадров = 0.25с при 30fps),
  // при явном пропе используется он, независимо от fps.
  const swapFrames = swapFramesProp ?? Math.round(0.25 * fps);

  let idx = 0;
  for (let i = 0; i < poses.length; i++) {
    if (frame >= poses[i].frame) idx = i;
  }
  const cur = poses[idx];
  const prev = idx > 0 ? poses[idx - 1] : null;

  const swapT = prev
    ? interpolate(frame, [cur.frame, cur.frame + swapFrames], [0, 1], {
        ...clamp,
        easing: Easing.inOut(Easing.quad),
      })
    : 1;

  // Дыхание — детерминированная синусоида, не CSS keyframes.
  const t = frame / fps;
  const breatheY = -(breatheAmp / 2) * (1 - Math.cos((2 * Math.PI * t) / breathePeriodSec));

  // Нырок для swapMode='dip': 0 → 1 → 0 за swapFrames кадров. Подмена позы
  // приходится ровно на дно нырка (середину окна), где силуэт ниже всего и
  // глаз занят движением — щелчка смены не видно.
  const dipT = prev
    ? interpolate(frame, [cur.frame, cur.frame + swapFrames / 2, cur.frame + swapFrames], [0, 1, 0], {
        ...clamp,
        easing: Easing.inOut(Easing.quad),
      })
    : 0;
  const dipY = swapMode === 'dip' ? dipT * dipPx : 0;
  const dipScale = swapMode === 'dip' ? 1 - dipT * 0.03 : 1;
  // В режиме 'dip' кроссфейда нет: до дна показываем прежнюю позу, после — новую.
  const showPrev = swapMode === 'dip' ? frame < cur.frame + swapFrames / 2 : swapT < 1;

  const imgStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    objectPosition: '50% 100%',
  };

  return (
    <div
      style={{
        position: 'absolute',
        left: charZone.left,
        bottom: charZone.bottom,
        width: charZone.width,
        height: charZone.height,
        zIndex: charZone.z,
        transform: `translateY(${breatheY + dipY}px) scale(${dipScale})`,
        transformOrigin: '50% 100%',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          maskImage: 'linear-gradient(to bottom, #000 0%, #000 80%, rgba(0,0,0,0) 98%)',
          WebkitMaskImage: 'linear-gradient(to bottom, #000 0%, #000 80%, rgba(0,0,0,0) 98%)',
          filter: 'drop-shadow(0 30px 50px rgba(16,24,40,0.14))',
        }}
      >
        {prev && showPrev && (
          <Img
            src={staticFile(`${dir}/pose-${prev.pose}.png`)}
            style={{ ...imgStyle, opacity: swapMode === 'dip' ? 1 : 1 - swapT }}
          />
        )}
        {!(swapMode === 'dip' && prev && showPrev) && (
          <Img
            src={staticFile(`${dir}/pose-${cur.pose}.png`)}
            style={{ ...imgStyle, opacity: swapMode === 'dip' ? 1 : prev ? swapT : 1 }}
          />
        )}
      </div>
    </div>
  );
};
