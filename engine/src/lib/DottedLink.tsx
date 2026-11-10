// Пунктирная связь между узлами схемы (FlowNode). Квадратичная кривая A→B;
// «рисуется» за 0.5с (drawFrame) — доля пройденного пути считается тем же
// easing, что и evolvePath (@remotion/paths), а сам пунктир — точки вдоль
// пути (getPointAtLength), видимые до пройденной длины: надёжнее, чем
// strokeDasharray-трюк на дуге произвольной кривизны, и даёт настоящий
// «пунктир», а не один растущий штрих. Подпись у середины пути повёрнута
// вдоль касательной (getTangentAtLength), опциональная стрелка на конце.
import React from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { getPointAtLength, getTangentAtLength, getLength } from '@remotion/paths';
import type { Theme } from '../themes/types';

const CL = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const DRAW_SEC = 0.5;
const DOT_GAP = 16; // px между точками пунктира
const DOT_R = 3;

type Pt = { x: number; y: number };

export const DottedLink: React.FC<{
  theme: Theme;
  from: Pt;
  to: Pt;
  /** Сдвиг контрольной точки квадратичной кривой от прямой A→B, px. */
  curve?: number;
  label?: string;
  /** Кадр, с которого линия начинает рисоваться (до него — не видна). */
  drawFrame: number;
  /** Абсолютный кадр композиции, когда линия стоит внутри <Sequence> — см.
   * тот же проп у FlowNode, PageCam и TargetBox. */
  frame?: number;
  /** Стрелка на конце (у точки `to`). */
  arrow?: boolean;
}> = ({ theme, from, to, curve = 60, label, drawFrame, arrow = true, frame: frameProp }) => {
  const ownFrame = useCurrentFrame();
  const frame = frameProp ?? ownFrame;
  const { fps } = useVideoConfig();
  if (frame < drawFrame) return null;

  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  // Перпендикуляр к A→B — сдвигаем контрольную точку, чтобы кривая не была
  // прямой линией (читается как «путь», а не как отрезок-линейка).
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const segLen = Math.hypot(dx, dy) || 1;
  const nx = -dy / segLen;
  const ny = dx / segLen;
  const cx = mx + nx * curve;
  const cy = my + ny * curve;

  const d = `M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`;
  const pathLen = getLength(d);

  const rel = frame - drawFrame;
  const drawDur = DRAW_SEC * fps;
  const progress = interpolate(rel, [0, drawDur], [0, 1], { ...CL, easing: Easing.out(Easing.cubic) });
  const revealedLen = pathLen * progress;

  const dotCount = Math.max(1, Math.floor(pathLen / DOT_GAP));
  const dots = Array.from({ length: dotCount + 1 }, (_, i) => (i / dotCount) * pathLen).filter(
    (l) => l <= revealedLen,
  );

  // С Remotion 4.0.520 getPointAtLength типизирован как Point | null (null только
  // для пустого пути) — запасная точка, чтобы типы сходились; поведение прежнее.
  const ZERO = { x: 0, y: 0 };
  const midPoint = getPointAtLength(d, pathLen * 0.5) ?? ZERO;
  const midTangent = getTangentAtLength(d, pathLen * 0.5) ?? { x: 1, y: 0 };
  // Связь ближе к вертикали (|dy|>|dx|) — подпись вдоль касательной читалась
  // бы боком, ставим её горизонтально со сдвигом вправо от середины 28px.
  // Вдоль касательной — только когда связь ближе к горизонтали.
  const isVertical = Math.abs(dy) > Math.abs(dx);
  const angleDeg = isVertical ? 0 : (Math.atan2(midTangent.y, midTangent.x) * 180) / Math.PI;
  const labelOffsetX = isVertical ? 28 : 0;
  const labelOp = interpolate(rel, [drawDur * 0.6, drawDur], [0, 1], CL);

  const endPoint = getPointAtLength(d, pathLen) ?? ZERO;
  const endTangent = getTangentAtLength(d, pathLen) ?? { x: 1, y: 0 };
  const endAngle = (Math.atan2(endTangent.y, endTangent.x) * 180) / Math.PI;
  const arrowOp = interpolate(rel, [drawDur * 0.85, drawDur], [0, 1], CL);

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
        {dots.map((l, i) => {
          const p = getPointAtLength(d, l) ?? ZERO;
          return <circle key={i} cx={p.x} cy={p.y} r={DOT_R} fill={theme.colors.muted} />;
        })}
        {arrow && (
          <polygon
            points="0,-8 18,0 0,8"
            fill={theme.colors.muted}
            opacity={arrowOp}
            transform={`translate(${endPoint.x} ${endPoint.y}) rotate(${endAngle})`}
          />
        )}
      </svg>

      {label && (
        <div
          style={{
            position: 'absolute',
            left: midPoint.x + labelOffsetX,
            top: midPoint.y,
            transform: isVertical
              ? 'translate(0, -50%)'
              : `translate(-50%, -50%) rotate(${angleDeg}deg) translateY(-24px)`,
            opacity: labelOp,
            fontFamily: theme.fontInter,
            fontWeight: 600,
            fontSize: 36,
            color: theme.colors.muted,
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </div>
      )}
    </AbsoluteFill>
  );
};
