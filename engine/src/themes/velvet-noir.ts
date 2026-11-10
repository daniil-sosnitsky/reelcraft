// Тема «Velvet Noir» — чёрный вариант языка emerald-velvet.
//
// Повод (автор, 2026-11-08): «хочу попробовать в чёрной теме, а не в
// фирменной». Меняется ОСНОВА, а не язык: шкала кеглей, роли движения,
// грамматика склейки и все компоненты остаются теми же, что в
// emerald-velvet (library/velvet-theme.md).
//
// Что именно поменялось и почему:
//  1. Фон с тёмно-изумрудного #04100B на нейтральный графит #08090B. Эталоны
//     из library/style-reference.md (ref-01, ref-05) стоят ровно на этом:
//     чистый чёрный плюс ОДИН акцент.
//  2. Свечения фона перестают быть зелёными. Если оставить зелёные пятна на
//     чёрном, кадр всё равно читается «фирменным зелёным», и смысл правки
//     теряется. Здесь они холодно-серые: источник света есть, цвета у него
//     нет.
//  3. Акцент остаётся изумрудным #34D399 — это опознавательный знак канала,
//     и автор менял его шесть дней назад осознанно. На графите он звучит
//     резче, чем на зелёном фоне: единственное цветное пятно в кадре.
//
// Полоса караоке 1450–1620 и зоны не трогаются: это safe space интерфейса
// Reels/Shorts, он от темы не зависит.
import type { Theme } from './types';

/** Второй акцент — тот же шампань, что в emerald-velvet: только линией и
 * мелким капсом, заливкой никогда. */
export const NOIR_CHAMPAGNE = '#D8C9A3';

/** Цвета пятен свечения. Нейтральные намеренно (см. пункт 2 в шапке).
 * Светлота подобрана от той же отправной точки, что в emerald-velvet:
 * ниже L 26 % пятна на съёмке сливаются с фоном и кадр читается плоским. */
export const NOIR_GLOW = {
  cool: '#3A4048',
  warm: '#44403A',
} as const;

export const velvetNoirTheme: Theme = {
  id: 'velvet-noir',
  colors: {
    bg: '#08090B',
    ink: '#F2F3F4',
    muted: '#9AA0A6',
    ghost: 'rgba(242,243,244,0.26)',
    card: '#131519',
    cardBorder: '#262A30',
    // Тень глубже, чем в изумрудной теме: на графите карточка того же тона,
    // что фон, и без выраженной тени превращается в плоскую плашку —
    // ровно та болезнь, из-за которой менялся язык.
    cardShadow:
      'inset 0 1px 0 rgba(242,243,244,.06), 0 30px 88px -26px rgba(0,0,0,.86)',
    mark: '#34D399',
    markText: '#08090B',
    blue: '#4CC9F0',
    green: '#34D399',
    orange: '#D97757',
    purple: '#8957E5',
    red: '#E5484D',
    flashA: '#131519',
    flashB: '#262A30',
  },
  fontInter: 'Inter, "Inter Placeholder", sans-serif',
  fontMono: '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace',
  safe: {
    contentTop: 300,
    contentBottom: 1100,
    capTop: 1450,
    capBottom: 1620,
  },
  caption: {
    usePillBackground: false,
    fontSize: 60, // константа канала, не трогаем
    textShadow: '0 2px 16px #000000CC',
  },
  depth: {
    glows: [
      { color: NOIR_GLOW.cool, radius: 760, x: 760, y: 420, opacity: 0.4 },
      { color: NOIR_GLOW.warm, radius: 540, x: 180, y: 1520, opacity: 0.26 },
    ],
    vignette:
      'radial-gradient(ellipse 78% 58% at 50% 46%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.7) 100%)',
    grain: { opacity: 0.06, scale: 1.6 },
    hairline: NOIR_CHAMPAGNE,
  },
  type: {
    scale: { hero: 164, title: 136, lead: 74, body: 52, mono: 44, label: 42 },
    display: '"Playfair Display", "PT Serif", Georgia, serif',
    label: 'Oswald, "Inter", sans-serif',
  },
};

export const VELVET_NOIR_BTN = velvetNoirTheme.colors.mark;
