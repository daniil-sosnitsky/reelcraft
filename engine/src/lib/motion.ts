// Грамматика движения темы emerald-velvet: пресеты по РОЛЯМ вместо одного
// входа на всё (library/velvet-theme.md).
//
// Зачем так. В сданном video-18 на весь ролик было 3 easing и один spring на
// все входы: всё въезжало снизу с фейдом за одно и то же время. Это ровно
// тот набор признаков, по которому зритель читает кадр как
// «сгенерированное видео» — не потому, что движения мало (у нас 37,9
// события/мин, выше половины эталонов), а потому что оно ОДИНАКОВОЕ.
//
// Лечится не новыми эффектами, а разбросом: роль задаёт длительность, ось и
// кривую, и роли между собой отличаются кратно. Разброс 34/8 = 4,25× при
// норме ≥3×.
//
// Все функции — чистые от номера кадра (рендер Remotion детерминирован,
// Math.random и Date.now в проекте запрещены линтом).
import { Easing, interpolate } from 'remotion';

const CL = { extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const };

/** Кривые. Названия — по тому, что кривая делает с материалом, а не по
 * математике: outExpo «ставит» тяжёлый носитель, outBack «щёлкает» мелкий
 * акцент. linear — только для света: свет не ускоряется. */
export const EASE = {
  outExpo: Easing.bezier(0.16, 1, 0.3, 1),
  outQuint: Easing.bezier(0.22, 1, 0.36, 1),
  outCirc: Easing.bezier(0, 0.55, 0.45, 1),
  inOutCubic: Easing.bezier(0.65, 0, 0.35, 1),
  outBack: Easing.bezier(0.34, 1.56, 0.64, 1),
  linear: Easing.linear,
} as const;

export type MotionRole = 'media' | 'hero' | 'support' | 'meta' | 'accent';

/** Пресеты ролей. `frames` при 30 fps; `dy`/`dx` — смещение входа в px;
 * `from`/`to` — scale; `fade` — участвует ли opacity.
 *
 * media без fade намеренно: крупный носитель, проявляющийся из прозрачности,
 * читается как слайд презентации. Он должен ПРИЕХАТЬ, а не проступить. */
export const MOTION: Record<
  MotionRole,
  { frames: number; dx: number; dy: number; from: number; to: number; ease: (t: number) => number; fade: boolean }
> = {
  media: { frames: 34, dx: 0, dy: 0, from: 1.06, to: 1, ease: EASE.outExpo, fade: false },
  hero: { frames: 26, dx: 0, dy: 64, from: 0.94, to: 1, ease: EASE.outQuint, fade: true },
  support: { frames: 14, dx: -48, dy: 0, from: 1, to: 1, ease: EASE.outCirc, fade: true },
  meta: { frames: 8, dx: 0, dy: 0, from: 1, to: 1, ease: EASE.inOutCubic, fade: true },
  accent: { frames: 6, dx: 0, dy: 0, from: 1.12, to: 1, ease: EASE.outBack, fade: true },
};

/** Поза элемента роли на кадре `frame`, вход начинается на `at`.
 * Возвращает готовый style-кусок: transform + opacity. */
export const roleStyle = (
  role: MotionRole,
  frame: number,
  at: number,
  opts?: { frames?: number; dx?: number; dy?: number },
): { transform: string; opacity: number } => {
  const m = MOTION[role];
  const frames = opts?.frames ?? m.frames;
  const dx = opts?.dx ?? m.dx;
  const dy = opts?.dy ?? m.dy;
  const p = interpolate(frame - at, [0, frames], [0, 1], { ...CL, easing: m.ease });
  const scale = m.from + (m.to - m.from) * p;
  const x = dx * (1 - p);
  const y = dy * (1 - p);
  // opacity добирается быстрее сдвига (0,6 длительности): элемент не должен
  // быть полупрозрачным, когда он уже почти встал.
  const opacity = m.fade ? interpolate(frame - at, [0, frames * 0.6], [0, 1], CL) : 1;
  return { transform: `translate(${x}px, ${y}px) scale(${scale})`, opacity };
};

/** Кадр входа n-го элемента серии. Стаггер 2–3 кадра (60–100 мс): меньше —
 * серия читается как один объект, больше — как отдельные события и ломает
 * правило 3 («одна точка внимания»). */
export const stagger = (at: number, index: number, step = 3): number => at + index * step;

/** Микропуш на длинном холде: кадр не читается зависшим, но и не «дышит».
 * 1,2 %/с с потолком scale 1,03. */
export const hold = (frame: number, at: number, fps = 30): number =>
  1 + Math.min(0.03, Math.max(0, (frame - at) / fps) * 0.012);

/** Смаз движения на снэпе. Не больше 3 раз за ролик и только на снэпах:
 * смаз на спокойном входе читается как расфокус, а не как скорость. */
export const snapBlur = (frame: number, at: number, frames = 3, maxPx = 9): number => {
  const t = frame - at;
  if (t < 0 || t > frames) return 0;
  return interpolate(t, [0, frames], [maxPx, 0], CL);
};

/** Мигание каретки в нарисованном интерфейсе: 2 кадра вкл / 10 выкл.
 * Площадь каретки ≤1 % кадра, поэтому правило 7 (стробы) не нарушается. */
export const caret = (frame: number): number => (frame % 12 < 2 ? 1 : 0);
