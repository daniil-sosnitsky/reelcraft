// Кадровые (детерминированные) аналоги GSAP-хелперов, сведённые в один модуль.
// Функции velocityAt, lagged, dampedSettle, mulberry32 и handheld — адаптация
// кода из проекта video-shotcraft (github.com/Vincentwei1021/video-shotcraft,
// Apache License 2.0), см. NOTICE; остальное написано для этого проекта. Всё — чистые функции от frame/seed, БЕЗ
// внутреннего состояния и БЕЗ побочных эффектов: рендер Remotion детермини-
// рован (любой кадр рендерится независимо от соседних), поэтому анимация не
// «крутит таймлайн» (как GSAP), а вычисляет позу прямо по номеру кадра.
//
// Хелпер камеры (refs/lib/helpers/camera.tsx, Rig на react-three-fiber) сюда
// НЕ перенесён — движок 2D (нет 3D-сцен и зависимости three), при появлении
// 3D-сцены переносить его отдельно вместе с three.

// ── Псевдослучайность (rand.ts) ────────────────────────────────────────────

/** Детерминированный PRNG — один сид всегда даёт одну и ту же последовательность. */
export const mulberry32 = (seed: number) => {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Быстрый доступ: seed → массив из n чисел [0,1) без ручного создания замыкания. */
export const seededSeries = (seed: number, n: number): number[] => {
  const rng = mulberry32(seed);
  return Array.from({ length: n }, () => rng());
};

// ── Движение (motion.ts) ───────────────────────────────────────────────────

/**
 * Скорость/направление из чистой траектории: сэмплируем posAt на frame±dt
 * (центральная разность). Используй speed, чтобы гнать интенсивность
 * растяжки/смаза/тряски/блюра; нормализуй амплитуду на размер объекта.
 * Работает с любым чистым `posAt` — без пер-кадрового состояния.
 */
export const velocityAt = (
  posAt: (f: number) => { x: number; y: number },
  frame: number,
  dt = 0.5,
): { vx: number; vy: number; speed: number; direction: number } => {
  const before = posAt(frame - dt);
  const after = posAt(frame + dt);
  const vx = (after.x - before.x) / (2 * dt);
  const vy = (after.y - before.y) / (2 * dt);
  return { vx, vy, speed: Math.hypot(vx, vy), direction: Math.atan2(vy, vx) };
};

/**
 * Follow-through без стейтфул-симуляции: «хвостовой» слой — это то же самое
 * состояние, сэмплированное на (frame − delayFrames). Иерархию волочения
 * строй так: у каждого следующего слоя задержка больше, амплитуда меньше
 * (тень 2f, «призрак» 4f, …). Состояние между кадрами не копится — каждый
 * слой остаётся чистой функцией номера кадра.
 */
export const lagged = <T,>(stateAt: (f: number) => T, frame: number, delayFrames: number): T =>
  stateAt(frame - delayFrames);

/**
 * Затухающее колебание в закрытой форме для отдачи/успокоения после удара,
 * t — кадры от импакта. Возвращает знаковый коэффициент смещения, убывающий
 * к 0; умножай на нужную пиковую амплитуду. freq в циклах/кадр (~0.1),
 * damping на кадр (~0.15).
 */
export const dampedSettle = (t: number, freq: number, damping: number): number =>
  t <= 0 ? 0 : Math.exp(-damping * t) * Math.sin(2 * Math.PI * freq * t);

// ── Дрожание камеры/объекта (shake.ts) ─────────────────────────────────────

/**
 * Детерминированный шум «ручной камеры». Слоистые синусоиды на
 * несоизмеримых частотах читаются как органичный дрейф; amp — в тех же
 * единицах, что и позиция объекта (px для 2D-слоя).
 */
export const handheld = (frame: number, amp = 0.012): [number, number, number] => [
  amp * (Math.sin(frame * 0.31) + 0.6 * Math.sin(frame * 0.83 + 1.7)),
  amp * (Math.sin(frame * 0.47 + 0.9) + 0.5 * Math.sin(frame * 1.13 + 3.1)),
  0,
];

// ── Геометрия (util.ts) ─────────────────────────────────────────────────────

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

export type Point = { x: number; y: number };

/** Точка на кубической кривой Безье в момент u∈[0,1]. */
export const cubicBezier = (p0: Point, p1: Point, p2: Point, p3: Point, u: number): Point => {
  const v = 1 - u;
  return {
    x: v * v * v * p0.x + 3 * v * v * u * p1.x + 3 * v * u * u * p2.x + u * u * u * p3.x,
    y: v * v * v * p0.y + 3 * v * v * u * p1.y + 3 * v * u * u * p2.y + u * u * u * p3.y,
  };
};

/** Приблизительная длина кубической кривой (полилиния из n сегментов). */
export const cubicBezierLength = (p0: Point, p1: Point, p2: Point, p3: Point, n = 60): number => {
  let len = 0;
  let prev = p0;
  for (let i = 1; i <= n; i++) {
    const pt = cubicBezier(p0, p1, p2, p3, i / n);
    len += Math.hypot(pt.x - prev.x, pt.y - prev.y);
    prev = pt;
  }
  return len;
};

// ── Общие clamp-настройки для interpolate() ─────────────────────────────────

export const CLAMP = { extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const };

// ── Громкость SFX (правило «пики на 10–12 dB ниже mean речи») ─────────────────

/**
 * Множитель `volume` для `<Audio>` SFX по пику файла (dB, из sfx/CATALOG.md) и
 * mean речи в ролике (dB, обычно −17 после нормализации −14 LUFS). Пик сэмпла
 * ложится на 11 dB ниже речи. Урок video-149: на глаз ставили 0.2–0.9 и
 * удары шли вровень с речью; по формуле громкие сэмплы дают 0.04–0.08,
 * тихие counter/* — 0.16–0.22.
 */
export const sfxGain = (peakDb: number, speechMeanDb = -17, headroomDb = 11): number =>
  Math.round(Math.pow(10, (speechMeanDb - headroomDb - peakDb) / 20) * 1000) / 1000;
