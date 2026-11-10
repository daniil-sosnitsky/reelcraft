// Тема «Sticker Light» — светлая, с персонажем. Палитра и зоны перенесены без
// изменений (это утверждённый продукт, не менять на глаз).
import type { Theme } from './types';

export const lightTheme: Theme = {
  id: 'light',
  colors: {
    bg: '#F4F5F7',
    ink: '#16181D',
    muted: '#8E939B',
    ghost: '#C7CBD1',
    card: '#FFFFFF',
    cardBorder: 'rgba(16,24,40,0.05)',
    cardShadow: '0 24px 60px rgba(16,24,40,0.10)',
    mark: '#FFE14D',
    markText: '#141414',
    blue: '#2E90FA',
    green: '#12B76A',
    orange: '#F79009',
    purple: '#7A5AF8',
    red: '#E5484D',
    flashA: '#F4F5F7',
    flashB: '#D3D7DD',
  },
  fontInter: 'Inter, "Inter Placeholder", sans-serif',
  fontMono: '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace',
  // info-zone / cap-band.
  safe: {
    contentTop: 110,
    contentBottom: 870,
    capTop: 880,
    capBottom: 1030,
  },
  // left/bottom-анкор, маска к низу, z 40.
  charZone: {
    left: 100,
    bottom: -20,
    width: 880,
    height: 950,
    z: 40,
  },
  caption: {
    usePillBackground: true,
    pillBackground: 'rgba(244,245,247,0.86)',
    fontSize: 56, // уменьшено с 64: караоке налезало на safe space UI Reels
    textShadow: '0 2px 18px rgba(244,245,247,0.9)',
  },
};

/** «Тёмная пилюля» .tag — фирменный акцент темы. */
export const LIGHT_TAG_BG = lightTheme.colors.ink;
export const LIGHT_TAG_TEXT = '#FFFFFF';
