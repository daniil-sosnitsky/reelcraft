// CtaPreview — ДОБАВЛЕНО НАМИ. Отдельная композиция ради одного: увидеть
// финальную CTA-карточку в обеих темах, не собирая ради этого ролик.
// Карточка — последнее, что видит зритель, и единственное место, где стоят
// личные данные канала (src/channel.ts), поэтому её проверяем отдельно
// после любой правки констант канала или CTACard.
//
// Смотреть: npx remotion studio → CtaLight / CtaEmerald.
// Снять кадр: npx remotion still CtaEmerald out/cta-emerald.png --frame=70
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { Background } from '../../lib/Background';
import { CTACard } from '../../lib/CTACard';
import { lightTheme } from '../../themes/light';
import { emeraldTheme } from '../../themes/emerald';
import type { Theme } from '../../themes/types';

/** Длительность превью: хватает на вход карточки, блик и клик курсора. */
export const CTA_PREVIEW_DURATION = 120;
/** Кадр, на котором курсор дожимает кнопку (30 fps). */
const CLICK_AT = 60;

const Preview: React.FC<{ theme: Theme }> = ({ theme }) => (
  <AbsoluteFill>
    <Background theme={theme} />
    {/* Карточка себя не центрирует (см. шапку CTACard) — задаём top числом. */}
    <div style={{ position: 'absolute', left: 0, right: 0, top: 560 }}>
      <CTACard theme={theme} clickFrame={CLICK_AT} showChip />
    </div>
  </AbsoluteFill>
);

export const CtaLight: React.FC = () => <Preview theme={lightTheme} />;
export const CtaEmerald: React.FC = () => <Preview theme={emeraldTheme} />;
