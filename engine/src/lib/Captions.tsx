// Пословные караоке-субтитры — обобщены из двух ранних версий
// (светлой и тёмной): раньше
// это были два похожих файла с захардкоженной палитрой, теперь один
// компонент, стиль берётся из `theme` (src/themes/light.ts | noir.ts).
//
// light: чёрный капс (--ink) + жёлтый маркер (--mark, текст --markText) на
// светлой подложке-пилюле (usePillBackground). noir: светлые слова прямо на
// кадре (без подложки) + зелёный маркер. Паддинг у каждого слова одинаковый
// ВСЕГДА (маркер или нет, произнесено или нет) — иначе появление плашки
// двигает строку.
import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { CapGroup } from './captionGroups';
import type { Theme } from '../themes/types';

const PAD_V = 6;
const PAD_H = 16;

export const Captions: React.FC<{
  theme: Theme;
  groups: CapGroup[];
  /** Кадр (абсолютный, относительно Sequence сцены), до которого субтитры
   * скрыты — например, пока идёт стомп-типографика хука и без слов ясно,
   * что происходит. По умолчанию 0 (видны с начала). */
  hiddenUntilFrame?: number;
  /** Доп. окна полного отключения караоке (абсолютные кадры, [start, end)) —
   * например, когда крупная типографика на кадре дублирует речь (video-120,
   * S2: цифра «4» дублирует «четыре уровня»). Аддитивно к hiddenUntilFrame,
   * не меняет поведение роликов, которые этот проп не передают. */
  hiddenRanges?: [number, number][];
  /** Pop активного слова (2026-09-04): в момент произнесения слово
   * подскакивает до `wordPopScale` и за ~0.12с садится в 1. Читается как
   * «караоке живое», а не «слово перекрасилось». 1 — выключить. */
  wordPopScale?: number;
  /** Вход группы слов: fade+подъём 6px за это время (с). 0 — мгновенно,
   * как раньше. */
  groupFadeSec?: number;
}> = ({
  theme,
  groups,
  hiddenUntilFrame = 0,
  hiddenRanges = [],
  wordPopScale = 1.08,
  groupFadeSec = 0.1,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < hiddenUntilFrame) return null;
  if (hiddenRanges.some(([a, b]) => frame >= a && frame < b)) return null;
  const t = frame / fps;
  const group = groups.find((g) => t >= g.visStart && t < g.visEnd);
  if (!group) return null;

  const { colors, fontInter, safe, caption } = theme;

  // Вход группы: opacity 0→1 и подъём 6px→0 за groupFadeSec (ease-out).
  const gIn = groupFadeSec > 0 ? Math.min(1, Math.max(0, (t - group.visStart) / groupFadeSec)) : 1;
  const gEase = 1 - Math.pow(1 - gIn, 3);
  const groupStyle: React.CSSProperties = {
    opacity: gEase,
    transform: `translateY(${(1 - gEase) * 6}px)`,
  };
  // Pop слова: 1 → wordPopScale → 1 за 0.12с от момента произнесения.
  const POP_SEC = 0.12;
  const popOf = (start: number) => {
    if (wordPopScale === 1) return 1;
    const u = (t - start) / POP_SEC;
    if (u <= 0 || u >= 1) return 1;
    // колокол: sin(pi*u), пик в середине
    return 1 + (wordPopScale - 1) * Math.sin(Math.PI * u);
  };

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', zIndex: 60 }}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: safe.capTop,
          height: safe.capBottom - safe.capTop,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'nowrap',
            alignItems: 'center',
            background: caption.usePillBackground ? caption.pillBackground : 'transparent',
            backdropFilter: caption.usePillBackground ? 'blur(10px)' : undefined,
            WebkitBackdropFilter: caption.usePillBackground ? 'blur(10px)' : undefined,
            borderRadius: caption.usePillBackground ? 24 : 0,
            padding: caption.usePillBackground ? '10px 26px' : 0,
            fontFamily: fontInter,
            fontWeight: 900,
            fontSize: caption.fontSize,
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            textShadow: caption.textShadow,
            ...groupStyle,
          }}
        >
          {group.words.map((w: CapGroup['words'][number], i: number) => {
            const spoken = t >= w.start;
            const isMark = w.hl === 'mark';
            const activeMark = spoken && isMark;
            // hl:'red' — отрицания и минус-цифры. Раньше игнорировался: в
            // разметке роликов он был, а в компоненте ветки под него не было
            // (найдено терчеком на video-113). Красится САМ ТЕКСТ, без плашки:
            // красная заливка в караоке-полосе перетягивает внимание с кадра.
            const activeRed = spoken && w.hl === 'red';
            // hl:'alt' — второй текстовый слой: слово набирается засечным
            // курсивом (PT Serif, локальный, src/fonts.ts) и красится
            // акцентом темы. Заливки НЕ получает: заливка — это hl:'mark',
            // два приёма на одном слове спорят друг с другом. Шрифт стоит
            // с самого начала группы, не с момента произнесения — иначе
            // слово меняет ширину и дёргает всю строку.
            const isAlt = w.hl === 'alt';
            const color = activeMark
              ? colors.markText
              : activeRed
                ? colors.red
                : isAlt
                  ? (spoken ? colors.mark : colors.ghost)
                  : spoken
                    ? colors.ink
                    : colors.ghost;
            return (
              <span
                key={i}
                style={{
                  color,
                  fontFamily: isAlt ? '"PT Serif", Georgia, serif' : undefined,
                  fontStyle: isAlt ? 'italic' : undefined,
                  fontWeight: isAlt ? 700 : undefined,
                  background: activeMark ? colors.mark : 'transparent',
                  borderRadius: 10,
                  padding: `${PAD_V}px ${PAD_H}px`,
                  display: 'inline-block',
                  transform: `scale(${popOf(w.start)})`,
                  transformOrigin: '50% 60%',
                }}
              >
                {w.text}
              </span>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
