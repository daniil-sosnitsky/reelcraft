// Окно macOS как макет — для случаев, когда реального скрина нет (правило
// CLAUDE.md №24). Заголовочная полоса с тремя кружками (красный/жёлтый/
// зелёный, 14px) и заголовком по центру (30px, muted). `variant: 'finder'`
// рисует сайдбар + сетку иконок папок/файлов (встроенный SVG, без внешних
// ассетов); `variant: 'plain'` — просто окно-рамка под свободный children.
// Вход — как у FlowNode (масштаб 0.92→1 c overshoot, 0.4с).
import React from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { fitText } from '@remotion/layout-utils';
import type { Theme } from '../themes/types';

const CL = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const ENTER_SEC = 0.4;
const TITLEBAR_H = 52;
const SIDEBAR_W = 220;

export type FinderItem = { name: string; kind: 'folder' | 'file' };

const FolderIcon: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path
      d="M3 6.5C3 5.67 3.67 5 4.5 5H9l2 2h8.5c.83 0 1.5.67 1.5 1.5v9c0 .83-.67 1.5-1.5 1.5h-15C3.67 19 3 18.33 3 17.5v-11Z"
      fill={color}
    />
  </svg>
);

const FileIcon: React.FC<{ size: number; theme: Theme }> = ({ size, theme }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path
      d="M6 2.5h8l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-17a1 1 0 0 1 1-1Z"
      fill={theme.colors.card}
      stroke={theme.colors.cardBorder}
      strokeWidth={1.2}
    />
    <path d="M14 2.5v4h4" stroke={theme.colors.cardBorder} strokeWidth={1.2} fill="none" />
  </svg>
);

// Высота одного ряда сетки finder (иконка 56 + gap 8 + строка подписи ~40px
// шрифта) и вертикальный padding тела — используются, чтобы окно finder по
// умолчанию заканчивалось сразу под последним рядом файлов, а не стояло с
// произвольным «воздухом» снизу.
const ROW_H = 118;
const GRID_PAD_V = 28;
const GRID_GAP = 24;

export const MacWindow: React.FC<{
  theme: Theme;
  title: string;
  x: number;
  y: number;
  width: number;
  /** Высота окна. Для variant='finder', если не задана, считается по
   * фактическому числу рядов сетки (rows*ROW_H + gaps + padding + шапка) —
   * окно заканчивается сразу под последним рядом. Для 'plain' обязательна. */
  height?: number;
  variant: 'finder' | 'plain';
  enterFrame: number;
  sidebar?: string[];
  items?: FinderItem[];
  children?: React.ReactNode;
}> = ({ theme, title, x, y, width, height: heightProp, variant, enterFrame, sidebar = [], items = [], children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < enterFrame) return null;

  const rel = frame - enterFrame;
  const enterDur = ENTER_SEC * fps;
  const p = interpolate(rel, [0, enterDur], [0, 1], { ...CL, easing: Easing.out(Easing.back(1.7)) });
  const scale = 0.92 + 0.08 * p;
  const op = interpolate(rel, [0, enterDur * 0.6], [0, 1], CL);

  // Тёмные темы (noir/adaptive) → тёмное окно с обводкой, light →
  // светлое окно (тот же принцип, что и у карточек темы: theme.colors.card).
  const isDark = theme.id !== 'light';
  const winBg = isDark ? '#1E2126' : '#FFFFFF';
  const winBorder = isDark ? '#33373E' : theme.colors.cardBorder;
  const barBg = isDark ? '#24272D' : '#F4F4F5';
  const titleColor = theme.colors.muted;
  const contentW = width - SIDEBAR_W;

  const rows = variant === 'finder' ? Math.max(1, Math.ceil(items.length / 3)) : 1;
  const finderBodyH = rows * ROW_H + (rows - 1) * GRID_GAP + GRID_PAD_V * 2;
  const height = heightProp ?? (variant === 'finder' ? TITLEBAR_H + finderBodyH : 0);

  const { fontSize: titleFontSize } = fitText({
    text: title,
    withinWidth: width - 200,
    fontFamily: theme.fontInter,
    fontWeight: 700,
  });

  // Правило темпа 11: серия появления элементов с ускорением. Интервалы
  // 0.23с→0.13с (14f→8f при 60fps), 0.5с покоя после последнего.
  const stepStart = 0.23 * fps;
  const stepEnd = 0.13 * fps;
  const n = Math.max(1, items.length - 1);
  let acc = 0;
  const itemDelays: number[] = [0];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1);
    acc += stepStart + (stepEnd - stepStart) * t;
    itemDelays.push(acc);
  }

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          left: x,
          top: y,
          width,
          height,
          opacity: op,
          transform: `scale(${scale})`,
          transformOrigin: '50% 50%',
          borderRadius: 16,
          background: winBg,
          border: `1px solid ${winBorder}`,
          boxShadow: '0 30px 60px rgba(16,24,40,0.28)',
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}
      >
        {/* Заголовочная полоса — три кружка + заголовок по центру */}
        <div
          style={{
            position: 'relative',
            height: TITLEBAR_H,
            background: barBg,
            borderBottom: `1px solid ${winBorder}`,
            display: 'flex',
            alignItems: 'center',
            padding: '0 18px',
          }}
        >
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#FF5F57' }} />
            <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#FEBC2E' }} />
            <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#28C840' }} />
          </div>
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              fontFamily: theme.fontInter,
              fontWeight: 700,
              fontSize: Math.min(30, titleFontSize),
              color: titleColor,
              whiteSpace: 'nowrap',
            }}
          >
            {title}
          </div>
        </div>

        {/* Тело окна */}
        {variant === 'plain' ? (
          <div style={{ position: 'relative', width, height: height - TITLEBAR_H }}>{children}</div>
        ) : (
          <div style={{ display: 'flex', width, height: height - TITLEBAR_H }}>
            {/* Сайдбар */}
            <div
              style={{
                width: SIDEBAR_W,
                borderRight: `1px solid ${winBorder}`,
                padding: '20px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                boxSizing: 'border-box',
              }}
            >
              {sidebar.map((s, i) => (
                <div
                  key={i}
                  style={{
                    fontFamily: theme.fontInter,
                    fontWeight: 500,
                    fontSize: 24,
                    color: titleColor,
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: i === 0 ? (isDark ? '#2C3038' : '#EFEFF1') : 'transparent',
                  }}
                >
                  {s}
                </div>
              ))}
            </div>

            {/* Сетка иконок папок/файлов */}
            <div
              style={{
                width: contentW,
                padding: 28,
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 24,
                boxSizing: 'border-box',
                alignContent: 'start',
              }}
            >
              {items.map((it, i) => {
                const delay = itemDelays[i] ?? itemDelays[itemDelays.length - 1];
                const itemOp = interpolate(rel, [delay, delay + fps * 0.15], [0, 1], CL);
                const itemScale = interpolate(rel, [delay, delay + fps * 0.15], [0.7, 1], {
                  ...CL,
                  easing: Easing.out(Easing.back(1.5)),
                });
                const { fontSize } = fitText({
                  text: it.name,
                  withinWidth: contentW / 3 - 28,
                  fontFamily: theme.fontInter,
                  fontWeight: 500,
                });
                return (
                  <div
                    key={i}
                    style={{
                      opacity: itemOp,
                      transform: `scale(${itemScale})`,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    {it.kind === 'folder' ? (
                      <FolderIcon size={56} color={theme.colors.blue} />
                    ) : (
                      <FileIcon size={56} theme={theme} />
                    )}
                    <div
                      style={{
                        width: '100%',
                        fontFamily: theme.fontInter,
                        fontWeight: 500,
                        fontSize: Math.min(40, fontSize),
                        color: theme.colors.ink,
                        textAlign: 'center',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {it.name}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
