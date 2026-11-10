// Broll — живой план во весь кадр. ДОБАВЛЕНО НАМИ (2026-11-01).
//
// Зачем понадобился. До сих пор видео в движке жило ровно в одном месте —
// внутри `PageCam`, то есть умело единственный приём: «наезд на экран».
// Самого базового киношного плана — «кадр целиком стоит 2 секунды» — у нас
// не было компонента вообще, и поэтому ролики собирались из карточек с
// типографикой. Замер 2026-11-01: детектор склеек видит в video-18 пять
// смен картинки на 16 объявленных сцен — одиннадцать монтажных стыков
// зритель просто не замечает, потому что в кадре остаётся та же карточка на
// том же месте. Полнокадровый план — первый инструмент, который даёт
// настоящую смену картинки.
//
// Чем отличается от PageCam:
//   PageCam — камера ВНУТРИ экрана (читаем цель на скриншоте, правила 19/28).
//   Broll   — кадр САМ ПО СЕБЕ (меняем картинку, держим темп, закрываем низ).
// Рамка цели (TargetBox) сюда не нужна: мы ничего не выделяем на странице.
//
// Правило 26 (носитель не касается кромок) здесь не нарушается, а осознанно
// не применяется: это и есть помеченный случай «во весь кадр».
import React from 'react';
import { AbsoluteFill, Easing, OffthreadVideo, interpolate, staticFile, useCurrentFrame } from 'remotion';
import type { Theme } from '../themes/types';

/** Как клип ложится в кадр.
 *  cover   — заполняет кадр целиком, лишнее обрезается (вертикальные съёмки);
 *  contain — влезает целиком, поля закрывает размытый двойник (ландшафтные
 *            скринкасты: иначе от записи 16:9 в вертикали остаётся марка). */
export type BrollFit = 'cover' | 'contain';

/** Где живёт план.
 *  full    — во весь кадр 1080×1920 (главный режим, ради него компонент);
 *  content — врезка в контент-зону темы, рабочая ширина 1000 (правило 16). */
export type BrollZone = 'full' | 'content';

/** Затемнение под текст.
 *  caption — только под полосой караоке (по умолчанию: караоке обязано
 *            читаться поверх любого кадра);
 *  bottom  — вся нижняя половина (когда поверх плана идёт своя типографика);
 *  full    — равномерный скрим по всему кадру (план уходит в фон);
 *  none    — без затемнения. */
export type BrollScrim = 'none' | 'caption' | 'bottom' | 'full';

const FRAME_W = 1080;
const FRAME_H = 1920;
/** Рабочая ширина врезки — та же 1000, что у всех носителей (правило 16). */
const CONTENT_W = 1000;

export const Broll: React.FC<{
  /** Путь от public/, например 'videos/07/clips/dzen-articles-scroll.mp4'. */
  src: string;
  theme: Theme;
  /** Длительность плана в кадрах — по ней считается наезд push. Передавать
   *  durationInFrames родительского Sequence. */
  durationInFrames: number;
  fit?: BrollFit;
  zone?: BrollZone;
  /** Обрезка клипа слева/справа в кадрах (имена пропов Remotion 4.0.520;
   *  старые startFrom/endAt объявлены deprecated). */
  trimBefore?: number;
  trimAfter?: number;
  /** Скорость клипа. Меньше 1 — замедление (длинный жест в короткий бит). */
  playbackRate?: number;
  /** Медленный наезд за весь план: scale from к to. Дефолт 1 к 1.06 —
   *  кадр перестаёт быть фотографией и выполняет правило 29 (событие не
   *  позже f8) сам собой. null — выключить, если движение есть в самом клипе. */
  push?: { from: number; to: number } | null;
  /** Снос кадра за план, px: смещение центра. Берётся вместе с push, когда
   *  интересное в клипе лежит не по центру. */
  pan?: { x?: [number, number]; y?: [number, number] };
  /** Размытый двойник в полях. По умолчанию включён при fit='contain'. */
  backdrop?: boolean;
  scrim?: BrollScrim;
  /** Цветокор под тему: клипы с телефона обычно вялые рядом с нашей графикой. */
  grade?: { saturate?: number; contrast?: number; brightness?: number };
  /** Скругление — только для zone='content'; во весь кадр скруглять нечего. */
  radius?: number;
  /** Абсолютный кадр композиции, если сцена ведёт свой счёт кадров.
   *  Та же грабля, что у FlowNode/DottedLink (used-log, video-04): внутри
   *  Sequence useCurrentFrame() отсчитывается заново. По умолчанию push
   *  считается от локального кадра сцены — это и нужно в 9 случаях из 10. */
  frame?: number;
}> = ({
  src,
  theme,
  durationInFrames,
  fit = 'cover',
  zone = 'full',
  trimBefore,
  trimAfter,
  playbackRate,
  push = { from: 1, to: 1.06 },
  pan,
  backdrop,
  scrim = 'caption',
  grade,
  radius,
  frame: frameProp,
}) => {
  const ownFrame = useCurrentFrame();
  const frame = frameProp ?? ownFrame;

  // Наезд идёт почти линейно: ускорение внутри медленного push читается как
  // рывок камеры, а не как движение. Изинг здесь намеренно пологий.
  const span: [number, number] = [0, Math.max(1, durationInFrames)];
  const clamp = { extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const };
  const ease = Easing.bezier(0.4, 0, 0.6, 1);

  const scale = push ? interpolate(frame, span, [push.from, push.to], { ...clamp, easing: ease }) : 1;
  const dx = pan?.x ? interpolate(frame, span, pan.x, { ...clamp, easing: ease }) : 0;
  const dy = pan?.y ? interpolate(frame, span, pan.y, { ...clamp, easing: ease }) : 0;

  const useBackdrop = backdrop ?? fit === 'contain';

  const filters: string[] = [];
  if (grade?.saturate !== undefined) filters.push(`saturate(${grade.saturate})`);
  if (grade?.contrast !== undefined) filters.push(`contrast(${grade.contrast})`);
  if (grade?.brightness !== undefined) filters.push(`brightness(${grade.brightness})`);
  const filter = filters.length ? filters.join(' ') : undefined;

  // Геометрия рамки плана. full — весь кадр; content — врезка по зонам темы.
  const box =
    zone === 'full'
      ? { left: 0, top: 0, width: FRAME_W, height: FRAME_H }
      : {
          left: (FRAME_W - CONTENT_W) / 2,
          top: theme.safe.contentTop,
          width: CONTENT_W,
          height: Math.max(0, theme.safe.contentBottom - theme.safe.contentTop),
        };

  const file = staticFile(src);
  // Звук клипа глушится всегда: речь ролика — отдельная дорожка −14 LUFS,
  // а своя дорожка клипа ломает замеры мастеринга.
  const videoCommon = { src: file, muted: true, trimBefore, trimAfter, playbackRate } as const;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          left: box.left,
          top: box.top,
          width: box.width,
          height: box.height,
          overflow: 'hidden',
          borderRadius: zone === 'content' ? radius ?? 28 : radius,
          backgroundColor: theme.colors.bg,
        }}
      >
        {/* Размытый двойник в полях: ландшафтный скринкаст в вертикали иначе
            оставляет две глухие полосы, и кадр читается как дырка в макете. */}
        {useBackdrop ? (
          <OffthreadVideo
            {...videoCommon}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: 'blur(42px) saturate(1.15) brightness(0.8)',
              transform: 'scale(1.18)',
            }}
          />
        ) : null}

        <OffthreadVideo
          {...videoCommon}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: fit,
            transform: `translate(${dx}px, ${dy}px) scale(${scale})`,
            transformOrigin: '50% 50%',
            filter,
          }}
        />

        <Scrim kind={scrim} theme={theme} boxTop={box.top} boxH={box.height} />
      </div>
    </AbsoluteFill>
  );
};

/** Затемнение поверх плана — чтобы караоке и типографика не тонули в кадре. */
const Scrim: React.FC<{
  kind: BrollScrim;
  theme: Theme;
  boxTop: number;
  boxH: number;
}> = ({ kind, theme, boxTop, boxH }) => {
  if (kind === 'none') return null;

  if (kind === 'full') {
    return <AbsoluteFill style={{ background: 'rgba(0,0,0,0.38)' }} />;
  }

  // Полоса караоке темы, переведённая в координаты рамки плана: во весь кадр
  // boxTop = 0, во врезке — отсчёт от её верха.
  const capTop = theme.safe.capTop - boxTop;
  const start = kind === 'caption' ? Math.max(0, capTop - 120) : Math.max(0, boxH * 0.52);
  const startPct = Math.max(0, Math.min(100, (start / Math.max(1, boxH)) * 100));
  const midPct = Math.min(100, startPct + 22);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: `linear-gradient(to bottom, rgba(0,0,0,0) ${startPct}%, rgba(0,0,0,0.55) ${midPct}%, rgba(0,0,0,0.72) 100%)`,
      }}
    />
  );
};
