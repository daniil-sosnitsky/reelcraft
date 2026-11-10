// Узел схемы «иконка + название + подпись» в стиле macOS — для рисованных
// макетов конвейеров/систем (правило CLAUDE.md №24: нет реального экрана —
// рисуем правдоподобный макет, а не голую карточку). Карточка тёмная/светлая
// по theme (card/cardBorder/ink/muted), скругление 18, тонкая обводка 1px,
// лёгкая тень. Иконка — либо ключ из public/shared/icons/manifest.json
// (сквиркл 72px в фирменном цвете бренда), либо `generic/<имя>` — общая
// пиктограмма Lucide из public/shared/icons/generic/ (белый штрих на тёмном
// сквиркле; для понятий без бренда: субтитры, монтаж, папка), либо свой путь
// к png/svg через staticFile (сквиркл в токенах темы).
//
// Вход: масштаб 0.92→1 с overshoot (Easing.back), 0.4с — та же кривая, что
// у Sticker.pop, но без вращения (узел схемы, не стикер).
import React from 'react';
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { fitText } from '@remotion/layout-utils';
import type { Theme } from '../themes/types';
import iconManifest from '../../public/shared/icons/manifest.json';

const CL = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const ENTER_SEC = 0.4;
const ICON_SIZE = 72;

type IconSpec = { file: string; label: string; bg: string; color: string | null; style?: 'color' | 'mono' };
const ICONS = (iconManifest as unknown as { icons: Record<string, IconSpec> }).icons;

const NEUTRAL_DARK = '#16181C';

/** Сквиркл-иконка: ключ манифеста (бренд) ИЛИ произвольный staticFile-путь
 * (png/svg/lottie-кадр уже отрендеренным превью — для случаев без бренда). */
const NodeIcon: React.FC<{ icon: string; theme: Theme }> = ({ icon, theme }) => {
  const spec = ICONS[icon];
  const pad = ICON_SIZE * 0.22;

  if (spec) {
    const bg = spec.style === 'mono' ? spec.bg : NEUTRAL_DARK;
    return (
      <div
        style={{
          width: ICON_SIZE,
          height: ICON_SIZE,
          borderRadius: ICON_SIZE * 0.32,
          background: bg,
          border: `1px solid ${theme.colors.cardBorder}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Img
          src={staticFile(`shared/icons/${spec.file}`)}
          style={{ width: ICON_SIZE - pad * 2, height: ICON_SIZE - pad * 2 }}
        />
      </div>
    );
  }

  // Общая пиктограмма Lucide (`generic/<имя>`, банк public/shared/icons/generic/,
  // штрих белый) — тёмный сквиркл в обеих темах, чтобы штрих читался.
  if (icon.startsWith('generic/')) {
    return (
      <div
        style={{
          width: ICON_SIZE,
          height: ICON_SIZE,
          borderRadius: ICON_SIZE * 0.32,
          background: NEUTRAL_DARK,
          border: `1px solid ${theme.colors.cardBorder}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Img
          src={staticFile(`shared/icons/${icon}.svg`)}
          style={{ width: ICON_SIZE - pad * 2, height: ICON_SIZE - pad * 2 }}
        />
      </div>
    );
  }

  // Не найден в манифесте — трактуем как прямой staticFile-путь (свой ассет).
  return (
    <div
      style={{
        width: ICON_SIZE,
        height: ICON_SIZE,
        borderRadius: ICON_SIZE * 0.32,
        background: theme.colors.card,
        border: `1px solid ${theme.colors.cardBorder}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      <Img src={staticFile(icon)} style={{ width: ICON_SIZE - pad * 2, height: ICON_SIZE - pad * 2, objectFit: 'contain' }} />
    </div>
  );
};

export const FlowNode: React.FC<{
  theme: Theme;
  icon: string;
  title: string;
  caption?: string;
  x: number;
  y: number;
  width?: number;
  /** Кадр входа (абсолютный либо локальный сцены — как у Sticker.from). */
  enterFrame: number;
  /** Абсолютный кадр композиции, когда узел стоит внутри <Sequence>: та
   * пересчитывает useCurrentFrame в локальный, и абсолютный `enterFrame` из
   * паспорта никогда не наступает — узел молча не рендерится всю сцену.
   * Тот же приём, что в PageCam и TargetBox. Поймано терчеком video-04
   * (2026-10-12): схема финала не появилась ни на одном кадре. */
  frame?: number;
  /** Подсветка обводки (например, активный шаг схемы). */
  accent?: string;
}> = ({ theme, icon, title, caption, x, y, width = 520, enterFrame, accent, frame: frameProp }) => {
  const ownFrame = useCurrentFrame();
  const frame = frameProp ?? ownFrame;
  const { fps } = useVideoConfig();
  if (frame < enterFrame) return null;

  const rel = frame - enterFrame;
  const enterDur = ENTER_SEC * fps;
  const p = interpolate(rel, [0, enterDur], [0, 1], { ...CL, easing: Easing.out(Easing.back(1.7)) });
  const scale = 0.92 + 0.08 * p;
  const op = interpolate(rel, [0, enterDur * 0.6], [0, 1], CL);

  const { colors, fontInter, fontMono } = theme;
  const textWidth = width - 24 - ICON_SIZE - 24 - 28;

  const { fontSize: titleFontSize } = fitText({
    text: title,
    withinWidth: textWidth,
    fontFamily: fontInter,
    fontWeight: 800,
  });

  // Правило 13: читаемый текст ≥40px — caption был мельче порога (26px).
  // 40px по умолчанию, fitText сужает, только если не влезает по ширине.
  const captionFontSize = caption
    ? Math.min(
        40,
        fitText({ text: caption, withinWidth: textWidth, fontFamily: fontMono, fontWeight: 500 }).fontSize,
      )
    : 40;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          left: x,
          top: y,
          width,
          opacity: op,
          transform: `scale(${scale})`,
          transformOrigin: '0 50%',
          display: 'flex',
          alignItems: 'center',
          gap: 24,
          padding: '22px 28px',
          borderRadius: 18,
          background: colors.card,
          border: `1px solid ${accent ?? colors.cardBorder}`,
          boxShadow: colors.cardShadow,
          boxSizing: 'border-box',
        }}
      >
        <NodeIcon icon={icon} theme={theme} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
          <div
            style={{
              fontFamily: fontInter,
              fontWeight: 800,
              fontSize: Math.min(38, titleFontSize),
              color: colors.ink,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {title}
          </div>
          {caption && (
            <div
              style={{
                fontFamily: fontMono,
                fontWeight: 500,
                fontSize: captionFontSize,
                color: colors.muted,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {caption}
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};
