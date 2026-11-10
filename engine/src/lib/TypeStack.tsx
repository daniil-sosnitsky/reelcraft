// TypeStack — типографика по шкале темы. Закрывает два разрыва с эталонами
// (library/style-reference.md, раздел «Типографика»):
//
//  1. Второй шрифт внутри одной фразы: гротеск + засечная дисплейная
//     гарнитура на акцентном слове. Одна замена — и строка перестаёт быть
//     субтитром, становится вёрсткой.
//  2. Заливка-маркер ПОД словом, а не перекраска буквы. У всех эталонов
//     выделение сделано прямоугольником (жёлтым, кислотным, коралловым).
//
// Правило кадра: не больше двух смысловых ступеней шкалы, отношение
// соседних ≥1,8 (у сданного video-18 было 80/64 = 1,25 — «всё одним
// уровнем», главная причина, по которой кадр читался дешёвым).
//
// Маркер раскрывается ПО ШИРИНЕ, а не фейдом: ширина — это событие, фейд —
// это появление плашки, которого зритель не замечает.
import React from 'react';
import { fitText } from '@remotion/layout-utils';
import { interpolate, useCurrentFrame } from 'remotion';
import type { Theme } from '../themes/types';
import { EASE, roleStyle, stagger, type MotionRole } from './motion';

const CL = { extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const };

export type TypeStep = 'hero' | 'title' | 'lead' | 'body' | 'mono' | 'label';

/** Семейство и вес ступени. Единственное место, где шкала связывается с
 * гарнитурами: сцены спрашивают ступень, а не шрифт. */
export const stepFont = (theme: Theme, step: TypeStep): React.CSSProperties => {
  const t = theme.type;
  const size = t?.scale[step] ?? 52;
  switch (step) {
    case 'hero':
      return { fontFamily: t?.display, fontWeight: 900, fontSize: size, lineHeight: 1.06, letterSpacing: '-0.01em' };
    case 'title':
      return { fontFamily: t?.display, fontWeight: 800, fontSize: size, lineHeight: 1.08, letterSpacing: '-0.01em' };
    case 'lead':
      return { fontFamily: theme.fontInter, fontWeight: 700, fontSize: size, lineHeight: 1.18 };
    case 'body':
      return { fontFamily: theme.fontInter, fontWeight: 500, fontSize: size, lineHeight: 1.26 };
    case 'mono':
      return { fontFamily: theme.fontMono, fontWeight: 500, fontSize: size, lineHeight: 1.6 };
    case 'label':
      return {
        fontFamily: t?.label,
        fontWeight: 600,
        fontSize: size,
        lineHeight: 1.1,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
      };
  }
};

/** Служебная метка: колонтитул, подпись колонки, статус. Шампань линией и
 * мелким капсом — заливкой второй акцент не используется никогда. */
export const Label: React.FC<{
  theme: Theme;
  children: React.ReactNode;
  x: number;
  y: number;
  color?: string;
  from?: number;
  frame?: number;
  align?: 'left' | 'right';
}> = ({ theme, children, x, y, color, from = 0, frame: frameProp, align = 'left' }) => {
  const ownFrame = useCurrentFrame();
  const frame = frameProp ?? ownFrame;
  if (frame < from) return null;
  const pose = roleStyle('meta', frame, from);
  // meta-роль добирает трекинг от 0,14em к 0,02em: буквы «собираются»,
  // и метка читается событием, не просто проявляется.
  const tracking = interpolate(frame - from, [0, 8], [0.14, 0.08], CL);
  return (
    <div
      style={{
        position: 'absolute',
        ...(align === 'left' ? { left: x } : { right: x }),
        top: y,
        ...stepFont(theme, 'label'),
        letterSpacing: `${tracking}em`,
        color: color ?? theme.depth?.hairline ?? theme.colors.muted,
        opacity: pose.opacity,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </div>
  );
};

export type MarkedLine = {
  text: string;
  /** Слово/фраза внутри строки под заливку-маркер. */
  mark?: string;
  /** Слово/фраза внутри строки второй гарнитурой (дисплейный курсив). */
  alt?: string;
};

/** Блок заголовка: строки одной ступени, стаггер по роли, маркер и второй
 * шрифт внутри строки. Левый край общий — привязка к кромке, а не центр:
 * центрированная карточка посередине кадра и есть прежний дешёвый язык. */
export const TypeStack: React.FC<{
  theme: Theme;
  step: Extract<TypeStep, 'hero' | 'title' | 'lead'>;
  lines: (string | MarkedLine)[];
  x: number;
  y: number;
  /** Межстрочное в px; не задано — 1,06 от кегля. */
  leading?: number;
  from: number;
  role?: MotionRole;
  staggerStep?: number;
  /** Кадр, на котором раскрывается заливка-маркер (роль accent, 6 кадров). */
  markFrom?: number;
  frame?: number;
  color?: string;
  /** Ширина, в которую обязаны влезть все строки блока. По умолчанию —
   * от левого края до правого поля 56 px. */
  maxWidth?: number;
  /** Сколько первых строк стоят в кадре С НУЛЕВОГО КАДРА, без входа.
   * Нужно там, где блок открывает сцену: правило 12 требует, чтобы на кадре 0
   * главное слово было видно целиком, а правило 21 запрещает пустой кадр
   * длиннее 0,3 с. Весь блок с одним `from` эти два правила нарушает: до
   * входа кадр пуст. Подогнанный кегль считается по ВСЕМ строкам, поэтому
   * статичные и въезжающие строки остаются одной ступенью. */
  holdFirst?: number;
}> = ({
  theme,
  step,
  lines,
  x,
  y,
  leading,
  from,
  role = 'hero',
  staggerStep = 3,
  markFrom,
  frame: frameProp,
  color,
  maxWidth,
  holdFirst = 0,
}) => {
  const ownFrame = useCurrentFrame();
  const frame = frameProp ?? ownFrame;
  const font = stepFont(theme, step);
  const size = (font.fontSize as number) ?? 52;
  const within = maxWidth ?? 1080 - x - 56;
  // Шкала задаёт ПОТОЛОК кегля, а не факт: ширину строки в px считает
  // fitText, и самая длинная строка решает за весь блок. Иначе Playfair
  // 900/164 режется кромкой — ровно болезнь правила 13, где кегль берут
  // «красивый», а ширину носителя не меряют. Один кегль на блок, а не свой
  // на строку: разные кегли в соседних строках читаются как две ступени.
  const fitted = Math.min(
    size,
    ...lines.map((raw) =>
      fitText({
        text: typeof raw === 'string' ? raw : raw.text,
        withinWidth: within,
        fontFamily: font.fontFamily as string,
        fontWeight: font.fontWeight as number,
        letterSpacing: font.letterSpacing as string,
      }).fontSize,
    ),
  );
  // Межстрочное едет за кеглем: иначе подогнанный блок повисает с дырами.
  const lh = Math.round((leading ?? Math.round(size * 1.06)) * (fitted / size));
  const markAt = markFrom ?? from + 34;

  return (
    <>
      {lines.map((raw, i) => {
        const line: MarkedLine = typeof raw === 'string' ? { text: raw } : raw;
        const held = i < holdFirst;
        // Стаггер считается от первой ВЪЕЗЖАЮЩЕЙ строки, иначе статичные
        // строки съедали бы её очередь и вход начинался позже обещанного.
        const at = held ? 0 : stagger(from, i - holdFirst, staggerStep);
        if (frame < at) return null;
        const pose = held ? { transform: 'none', opacity: 1 } : roleStyle(role, frame, at);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y + i * lh,
              ...font,
              fontSize: fitted,
              color: color ?? theme.colors.ink,
              whiteSpace: 'nowrap',
              transform: pose.transform,
              opacity: pose.opacity,
              transformOrigin: '0 50%',
            }}
          >
            {renderLine(theme, line, frame, markAt, fitted)}
          </div>
        );
      })}
    </>
  );
};

const renderLine = (theme: Theme, line: MarkedLine, frame: number, markAt: number, size: number) => {
  const { text, mark, alt } = line;
  const target = mark ?? alt;
  if (!target || !text.includes(target)) return text;

  const [before, after] = text.split(target);
  const p = interpolate(frame - markAt, [0, 6], [0, 1], { ...CL, easing: EASE.outBack });

  if (alt) {
    return (
      <>
        {before}
        <span
          style={{
            fontFamily: theme.type?.display,
            fontStyle: 'italic',
            fontWeight: 800,
            color: theme.colors.mark,
          }}
        >
          {target}
        </span>
        {after}
      </>
    );
  }

  return (
    <>
      {before}
      <span style={{ position: 'relative', display: 'inline-block' }}>
        {/* Маркер лежит ПОД словом и раскрывается по ширине. scaleX, а не
         * width: ширину слова мы не знаем, а трансформ масштабирует сам
         * носитель и не требует замера. */}
        <span
          style={{
            position: 'absolute',
            left: -Math.round(size * 0.06),
            right: -Math.round(size * 0.06),
            top: Math.round(size * 0.1),
            bottom: Math.round(size * 0.08),
            background: theme.colors.mark,
            borderRadius: 6,
            transform: `scaleX(${p})`,
            transformOrigin: '0 50%',
          }}
        />
        <span style={{ position: 'relative', color: p > 0.5 ? theme.colors.markText : theme.colors.ink }}>
          {target}
        </span>
      </span>
      {after}
    </>
  );
};
