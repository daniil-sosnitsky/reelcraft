// Тема «Emerald» — тёмная, без персонажа. ДОБАВЛЕНА НАМИ, не из кита.
//
// Палитра взята из бренда канала (свой файл бренда):
// база — тёмно-зелёный/изумрудный, акцент — лаймовый, акцент-элемент —
// коралловый спарк Claude. Та же палитра, что у обложек Telegram и Дзена,
// поэтому ролик, пост и статья читаются как один канал.
//
// Каркас зон скопирован у noir (CLAUDE.md: у тёмных тем полоса караоке
// 1450–1620) — его трогать нельзя, это safe space интерфейса Reels/Shorts.
import type { Theme } from './types';

export const emeraldTheme: Theme = {
  id: 'emerald',
  colors: {
    // Фон не чёрный, а глубокий изумрудный: на чёрном ролик выглядит как
    // «тёмная тема по умолчанию», а нам нужен узнаваемый цвет канала.
    bg: '#061710',
    ink: '#E8F5EE',
    muted: '#7FA393',
    ghost: 'rgba(232,245,238,0.28)',
    card: '#0C241A',
    cardBorder: '#1B4133',
    cardShadow: 'none', // плоский тёмный UI — карточки без объёмной тени
    mark: '#B6F24D',    // лайм: маркер караоке и главный акцент
    markText: '#061710',
    blue: '#4CC9F0',
    green: '#2FD98A',
    orange: '#D97757', // коралловый спарк Claude — акцент-элемент бренда
    purple: '#8957E5',
    red: '#E5484D',
    flashA: '#0C241A',
    flashB: '#153A2B',
  },
  fontInter: 'Inter, "Inter Placeholder", sans-serif',
  fontMono: '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace',
  // Зоны один в один с noir — безопасная область вертикального видео.
  safe: {
    contentTop: 300,
    contentBottom: 1100,
    capTop: 1450,
    capBottom: 1620,
  },
  // Персонажа в тёмной теме нет — charZone не задаётся.
  caption: {
    usePillBackground: false,
    fontSize: 60, // кегль тёмных тем, мельче нельзя (CLAUDE.md, «Караоке»)
    textShadow: '0 2px 16px #061710CC',
  },
};

/** Кнопка-акцент темы: лайм на тёмном, текст — цветом фона. */
export const EMERALD_BTN = emeraldTheme.colors.mark;
