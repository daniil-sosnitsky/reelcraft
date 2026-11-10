// Зерно — признак «дорогого» кадра и одновременно лечение бандинга.
//
// Два разных эффекта одним слоем:
//  1. Тёмный градиент после сжатия H.264 разваливается на полосы (бандинг) —
//     шум их разбивает, кодек перестаёт «видеть» ровные ступени.
//  2. Идеально гладкая заливка читается как рендер. Зерно возвращает кадру
//     материал.
//
// Детерминированное: feTurbulence с фиксированным seed — Math.random в
// проекте ERROR линта, и правильно: кадр должен рендериться одинаково при
// любом порядке воркеров.
//
// z-index 58 — НАД контентом (иначе зерно не читается), но ПОД караоке (60):
// шум поверх субтитров съедает их контраст.
import React from 'react';
import { AbsoluteFill } from 'remotion';

export const Grain: React.FC<{
  opacity?: number;
  /** Масштаб зерна в px: 1,6 — крупинка видна на телефоне и не исчезает
   * после даунскейла ленты. baseFrequency считается от него. */
  scale?: number;
  seed?: number;
  zIndex?: number;
}> = ({ opacity = 0.055, scale = 1.6, seed = 7, zIndex = 58 }) => {
  const baseFrequency = (1 / scale).toFixed(3);
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', zIndex, opacity, mixBlendMode: 'overlay' }}>
      <svg width="100%" height="100%" style={{ display: 'block' }}>
        <filter id={`velvet-grain-${seed}`} x="0" y="0" width="100%" height="100%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency={baseFrequency}
            numOctaves={2}
            seed={seed}
            stitchTiles="stitch"
          />
          {/* Шум уводится в серый: цветное зерно красит тёмно-зелёный фон в грязь */}
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#velvet-grain-${seed})`} />
      </svg>
    </AbsoluteFill>
  );
};
