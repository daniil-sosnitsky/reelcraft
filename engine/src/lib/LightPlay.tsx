// LightPlay — свет как отдельный слой кадра. Три режима, у каждого своя
// работа; смешивать их в одной сцене нельзя — свет перестаёт читаться
// событием и становится шумом.
//
//  cone     — конус выметает заголовок слева направо. Строго ЛИНЕЙНО: свет
//             не ускоряется и не тормозит, ускорение читается как анимация
//             объекта, а не как освещение.
//  sheen    — блик по носителю, 28–34 кадра, обязательно клипается В
//             носитель (правило 15: максимум один блик на героя сцены).
//  halation — гало вокруг акцента, ≤14 кадров, ≤40 % площади. Не строб:
//             правило 7 разрешает импульс ≤5 кадров и ≤60 % площади, здесь
//             вдвое мягче.
import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { EASE } from './motion';

const CL = { extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const };

export const LightPlay: React.FC<{
  mode: 'cone' | 'sheen' | 'halation';
  /** Прямоугольник, по которому идёт свет, в координатах кадра. */
  x: number;
  y: number;
  w: number;
  h: number;
  from: number;
  /** Длительность; по умолчанию — норма режима. */
  frames?: number;
  color?: string;
  /** Абсолютный кадр композиции, когда компонент стоит внутри <Sequence>
   * (тот же проп, что у PageCam, TargetBox и FlowNode). */
  frame?: number;
}> = ({ mode, x, y, w, h, from, frames, color = 'rgba(255,255,255,0.22)', frame: frameProp }) => {
  const ownFrame = useCurrentFrame();
  const frame = frameProp ?? ownFrame;
  const dur = frames ?? (mode === 'sheen' ? 30 : mode === 'halation' ? 14 : 70);
  const t = frame - from;
  if (t < 0 || t > dur) return null;

  if (mode === 'halation') {
    // Гало: разгорается за треть длительности и гаснет — поэтому пик стоит
    // на кадре акцента, а не в конце.
    const p = interpolate(t, [0, dur * 0.35, dur], [0, 1, 0], CL);
    return (
      <div
        style={{
          position: 'absolute',
          left: x - h * 0.7,
          top: y - h * 0.7,
          width: w + h * 1.4,
          height: h * 2.4,
          borderRadius: '50%',
          background: `radial-gradient(ellipse at center, ${color} 0%, rgba(0,0,0,0) 70%)`,
          opacity: p * 0.55,
          mixBlendMode: 'screen',
          pointerEvents: 'none',
        }}
      />
    );
  }

  // cone и sheen — полоса света, идущая по оси x. Разница в жёсткости
  // границы и в том, что sheen обязан клипаться в носитель.
  const p = interpolate(t, [0, dur], [0, 1], {
    ...CL,
    easing: mode === 'cone' ? EASE.linear : EASE.outExpo,
  });
  const bandW = mode === 'cone' ? w * 0.42 : w * 0.3;
  const left = -bandW + p * (w + bandW);

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        overflow: 'hidden', // клип в носитель — правило 15
        pointerEvents: 'none',
        // sheen клипается в носитель жёстко — он и есть блик по карточке.
        // cone освещает кадр: на выходе из габарита он обязан растворяться,
        // иначе клип даёт вертикальную кромку света.
        ...(mode === 'cone'
          ? {
              maskImage: 'linear-gradient(to right, rgba(0,0,0,0) 0%, #000 12%, #000 86%, rgba(0,0,0,0) 100%)',
              WebkitMaskImage:
                'linear-gradient(to right, rgba(0,0,0,0) 0%, #000 12%, #000 86%, rgba(0,0,0,0) 100%)',
            }
          : null),
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: mode === 'cone' ? -h * 0.2 : 0,
          left,
          width: bandW,
          height: mode === 'cone' ? h * 1.4 : h,
          background: `linear-gradient(100deg, rgba(0,0,0,0) 0%, ${color} 50%, rgba(0,0,0,0) 100%)`,
          transform: mode === 'cone' ? 'skewX(-14deg)' : 'skewX(-20deg)',
          mixBlendMode: 'screen',
          // Затухание по вертикали. Без него у полосы остаются прямые верх и
          // низ, а когда она доезжает до правого края носителя, overflow
          // режет её вертикально — и свет читается серой плашкой поверх
          // заголовка, а не освещением (пруф: probe-58, угол за словом «ТОТ»).
          maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, #000 22%, #000 78%, rgba(0,0,0,0) 100%)',
          WebkitMaskImage:
            'linear-gradient(to bottom, rgba(0,0,0,0) 0%, #000 22%, #000 78%, rgba(0,0,0,0) 100%)',
        }}
      />
    </div>
  );
};
