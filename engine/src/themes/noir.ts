// Тема «GitHub noir» — тёмная, без персонажа. Палитра и зоны перенесены без изменений
// (утверждённая продуктовая палитра GitHub dark, менять на глаз нельзя).
import type { Theme } from './types';

export const noirTheme: Theme = {
  id: 'noir',
  colors: {
    bg: '#0D1117',
    ink: '#E6EDF3',
    muted: '#8B949E',
    ghost: 'rgba(230,237,243,0.28)',
    card: '#161B22', // surface
    cardBorder: '#30363D', // border
    cardShadow: 'none', // плоский UI GitHub dark — карточки без объёмной тени
    mark: '#3FB950', // green
    markText: '#0D1117',
    blue: '#4493F8',
    green: '#3FB950',
    orange: '#F0883E',
    purple: '#8957E5',
    red: '#E5484D',
    flashA: '#161B22',
    flashB: '#21262D',
  },
  fontInter: 'Inter, "Inter Placeholder", sans-serif',
  fontMono: '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace',
  // Пояс главного контента / полоса караоке.
  safe: {
    contentTop: 300,
    contentBottom: 1100,
    capTop: 1450,
    capBottom: 1620,
  },
  // Персонажа в noir нет — charZone не задаётся.
  caption: {
    usePillBackground: false,
    fontSize: 60, // уменьшено с 68: safe space интерфейса Reels
    textShadow: '0 2px 16px #0D1117CC',
  },
};

/** Кнопка-акцент GitHub-стиля (использовалась в S12CTA источника). */
export const NOIR_BTN_GREEN = '#238636';
