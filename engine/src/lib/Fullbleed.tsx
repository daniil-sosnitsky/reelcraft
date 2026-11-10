// Fullbleed — осознанное «во весь кадр» с пометкой, которую понимает линт,
// и автоскримом под полосой караоке.
//
// Правило 26 запрещает непрозрачному носителю касаться кромок кадра, и это
// правильный дефолт: случайно срезанная карточка читается как брак вёрстки.
// Но full-bleed — монтажная величина: кадр во всю ширину меняет масштаб
// плана, и без него на границе не собрать «≥2 из 3» (тон, масштаб, тип).
// Поэтому исключение существует только здесь, с явной пометкой
// FULLBLEED_INTENTIONAL в разметке.
//
// Автоскрим: любой носитель во весь кадр заходит под полосу караоке
// 1450–1620, и пословный текст на нём теряет контраст. Скрим — мягкий
// градиент ровно по полосе темы, а не затемнение всего низа.
import React from 'react';
import type { Theme } from '../themes/types';

/** Маркер для линта и для чтения кода: носитель во весь кадр здесь —
 * решение, а не промах. */
export const FULLBLEED_INTENTIONAL = 'fullbleed-intentional' as const;

export const Fullbleed: React.FC<{
  theme: Theme;
  /** Вертикальные границы носителя; по горизонтали — всегда вся ширина. */
  top: number;
  height: number;
  /** Скрим под полосой караоке. Выключать только если караоке в сцене OFF. */
  capScrim?: boolean;
  radius?: number;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ theme, top, height, capScrim = true, radius = 0, children, style }) => (
  <div
    data-fullbleed={FULLBLEED_INTENTIONAL}
    style={{
      position: 'absolute',
      left: 0,
      right: 0,
      top,
      height,
      borderRadius: radius,
      overflow: 'hidden',
      ...style,
    }}
  >
    {children}
    {capScrim ? (
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          // Координаты полосы приходят из темы, а не числом: у light полоса
          // 880–1030, у тёмных 1450–1620, и захардкоженное число сломается
          // при смене темы молча.
          top: theme.safe.capTop - top - 60,
          height: theme.safe.capBottom - theme.safe.capTop + 120,
          background: `linear-gradient(to bottom, rgba(4,16,11,0) 0%, rgba(4,16,11,0.72) 35%, rgba(4,16,11,0.72) 65%, rgba(4,16,11,0) 100%)`,
          pointerEvents: 'none',
        }}
      />
    ) : null}
  </div>
);
