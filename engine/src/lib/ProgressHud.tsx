// Постоянный указатель места — колонтитул поверх всего ролика.
//
// Зачем: на 60-секундном ролике удержание решает структура, а не красота.
// У всех трёх длинных русскоязычных эталонов (library/style-reference.md,
// раздел «Структурные приёмы») такой указатель есть, у нас его не было —
// зритель не понимал, сколько ещё листать. Компонент — гибрид трёх эталонов:
// раздел слева (ref-01 «шаги-колонтитул» + ref-04 «// 01 — раздел»), справа
// обратный таймер (ref-05), самый дешёвый и самый сильный приём из разбора.
//
// Ставится ОДИН раз в композицию ролика, не в сцены: он сквозной и обязан
// жить на том же месте при любой смене сцены — иначе читается как плашка,
// а не как интерфейс.
import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Theme } from '../themes/types';

export type HudSection = {
  /** Абсолютный кадр ролика, с которого раздел активен. */
  from: number;
  /** Имя раздела. Короткое: 1–3 слова, иначе не влезет в полосу. */
  label: string;
};

const CL = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
/** Перекат раздела: старое уезжает вверх, новое приезжает снизу. */
const SWAP_F = 8;

const pad2 = (n: number) => (n < 10 ? `0${n}` : String(n));

export const ProgressHud: React.FC<{
  theme: Theme;
  sections: HudSection[];
  /** Кадр, на котором таймер показывает 0:00 — обычно конец речи, не конец
   * ролика: хвост CTA зритель уже не «ждёт». */
  endFrame: number;
  /** Кадр, с которого указатель убран (финальная карточка не должна
   * спорить с интерфейсом). По умолчанию = endFrame. */
  hideFrom?: number;
  /** Вход указателя: появляется не сразу, чтобы не отнимать хук. */
  showFrom?: number;
  /** Верхняя кромка полосы. Правило 26: кромки кадра не касаемся. */
  y?: number;
}> = ({ theme, sections, endFrame, hideFrom, showFrom = 14, y = 64 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const hideAt = hideFrom ?? endFrame;
  if (frame < showFrom || frame >= hideAt) return null;

  const { colors, fontInter, fontMono } = theme;

  // Вход 10 кадров и уход 8 — чтобы колонтитул не возникал щелчком.
  const appear = interpolate(frame, [showFrom, showFrom + 10], [0, 1], CL);
  const leave = interpolate(frame, [hideAt - 8, hideAt], [1, 0], CL);
  const alpha = appear * leave;

  // Активный раздел и фаза переката на его стыке.
  // Явный цикл, а не findLastIndex: tsconfig движка стоит на ES2022,
  // findLastIndex — ES2023, tsc на нём падает.
  let idx = 0;
  for (let i = 0; i < sections.length; i++) if (frame >= sections[i].from) idx = i;
  const since = frame - sections[idx].from;
  const swap = idx === 0 ? 1 : interpolate(since, [0, SWAP_F], [0, 1], CL);
  const swapEase = 1 - Math.pow(1 - swap, 3);

  // Обратный таймер: сколько секунд ролика осталось. Вверх округляем, иначе
  // зритель видит 0:00 за секунду до конца.
  const left = Math.max(0, Math.ceil((endFrame - frame) / fps));
  const timer = `${Math.floor(left / 60)}:${pad2(left % 60)}`;
  // Полоса прогресса под таймером — тот же факт, но без чтения цифр.
  const done = interpolate(frame, [0, endFrame], [0, 1], CL);

  const pill: React.CSSProperties = {
    height: 68,
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    borderRadius: 20,
    background: colors.card,
    border: `2px solid ${colors.cardBorder}`,
  };

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', zIndex: 50, opacity: alpha }}>
      {/* Раздел слева: «// 02 — Как это выглядит» */}
      <div style={{ ...pill, position: 'absolute', left: 80, top: y, maxWidth: 640, padding: '0 24px', overflow: 'hidden' }}>
        <span
          style={{
            fontFamily: fontMono,
            fontSize: 40,
            fontWeight: 500,
            color: colors.mark,
            marginRight: 16,
            whiteSpace: 'nowrap',
          }}
        >
          {`// ${pad2(idx + 1)}`}
        </span>
        {/* Перекат: номер стоит на месте, меняется только имя раздела. */}
        <span
          style={{
            fontFamily: fontInter,
            fontSize: 40,
            fontWeight: 700,
            color: colors.ink,
            whiteSpace: 'nowrap',
            opacity: swapEase,
            transform: `translateY(${(1 - swapEase) * 18}px)`,
          }}
        >
          {sections[idx].label}
        </span>
      </div>

      {/* Таймер справа: цифры + полоса прошедшего. */}
      <div style={{ ...pill, position: 'absolute', right: 80, top: y, width: 168, padding: '0 22px', flexDirection: 'column', justifyContent: 'center', alignItems: 'stretch' }}>
        <span
          style={{
            fontFamily: fontMono,
            fontSize: 40,
            fontWeight: 500,
            color: colors.ink,
            letterSpacing: 1,
            textAlign: 'center',
            lineHeight: 1,
          }}
        >
          {timer}
        </span>
        <span style={{ marginTop: 8, height: 4, borderRadius: 99, background: colors.cardBorder, overflow: 'hidden' }}>
          <span style={{ display: 'block', height: '100%', width: `${done * 100}%`, background: colors.mark }} />
        </span>
      </div>
    </AbsoluteFill>
  );
};
