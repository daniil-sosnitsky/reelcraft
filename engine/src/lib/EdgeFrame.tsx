// EdgeFrame — привязка кадра к кромкам: тонкий хайрлайн шампанью по двум
// сторонам плюс угловая метка капсом.
//
// Зачем. В разборе дешёвого кадра композиция «центрированная карточка на
// плоском фоне» стоит отдельным пунктом: у кадра нет краёв, он не
// сверстан — он просто содержит объект посередине. Две линии по кромкам и
// метка в углу дают кадру рамку отсчёта, а заодно закрывают однородную
// полосу низа (правило 20) без лишнего носителя.
//
// Линия 2 px и ≤8 % насыщенности: это второй акцент, он не имеет права
// спорить с содержанием. Заливкой шампань не используется нигде.
import React from 'react';
import { AbsoluteFill } from 'remotion';
import type { Theme } from '../themes/types';
import { Label } from './TypeStack';

export const EdgeFrame: React.FC<{
  theme: Theme;
  /** Какие кромки обводим. По умолчанию левая и нижняя. */
  sides?: ('left' | 'right' | 'top' | 'bottom')[];
  /** Отступ линии от кромки кадра, px. */
  inset?: number;
  /** Метка в углу — хендл канала, номер акта, имя раздела. */
  label?: string;
  /** Где метка: по той же стороне, что и вертикальная линия. */
  labelSide?: 'left' | 'right';
  labelY?: number;
  from?: number;
  frame?: number;
  color?: string;
  opacity?: number;
}> = ({
  theme,
  sides = ['left', 'bottom'],
  inset = 56,
  label,
  labelSide = 'left',
  labelY = 1792,
  from = 0,
  frame,
  color,
  opacity = 0.42,
}) => {
  const line = color ?? theme.depth?.hairline ?? theme.colors.muted;
  const v = (side: 'left' | 'right') => (
    <div
      key={side}
      style={{
        position: 'absolute',
        [side]: inset,
        top: 300,
        bottom: 60,
        width: 2,
        background: line,
        opacity,
      }}
    />
  );
  const h = (side: 'top' | 'bottom') => (
    <div
      key={side}
      style={{
        position: 'absolute',
        [side]: side === 'bottom' ? 56 : inset,
        left: inset,
        right: inset,
        height: 2,
        background: line,
        opacity,
      }}
    />
  );

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {sides.map((s) => (s === 'left' || s === 'right' ? v(s) : h(s)))}
      {label ? (
        <Label
          theme={theme}
          x={labelSide === 'left' ? inset + 24 : inset + 24}
          y={labelY}
          align={labelSide}
          from={from}
          frame={frame}
          color={line}
        >
          {label}
        </Label>
      ) : null}
    </AbsoluteFill>
  );
};
