// Общая «панель» тестовой сцены — переиспользуется DemoLight (одна панель на
// весь ролик) и DemoNoir (две панели внутри TransitionSeries). Показывает
// связку всех кусков engine на одном экране: Background, заголовок через
// fitText (гарантия «без переносов» — @remotion/layout-utils), карточка в
// токенах темы, стикер (pop+wobble), персонаж (только light), Lottie-бейдж
// (только light) и Captions поверх демо-фразы.
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { fitText } from '@remotion/layout-utils';
import { Background } from '../../lib/Background';
import { Captions } from '../../lib/Captions';
import { Character } from '../../lib/Character';
import { Sticker } from '../../lib/Sticker';
import { LottieBadge } from '../../lib/LottieBadge';
import type { CapGroup } from '../../lib/captionGroups';
import type { Theme } from '../../themes/types';

export const DemoPanel: React.FC<{
  theme: Theme;
  title: string;
  tag: string;
  stickerSrc: string;
  capGroups: CapGroup[];
  showCharacter?: boolean;
  showLottie?: boolean;
}> = ({ theme, title, tag, stickerSrc, capGroups, showCharacter = false, showLottie = false }) => {
  const { colors, fontInter, fontMono, safe } = theme;
  const cardWidth = 860;

  // fitText → гарантированный без-переносов размер шрифта под ширину карточки
  // минус паддинги (правило CLAUDE.md: заголовок не переносится за кадр).
  const { fontSize: titleFontSize } = fitText({
    text: title,
    withinWidth: cardWidth - 120,
    fontFamily: fontInter,
    fontWeight: 900,
    textTransform: 'uppercase',
  });

  return (
    <AbsoluteFill>
      <Background theme={theme} />

      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: safe.contentTop,
          transform: 'translateX(-50%)',
          width: cardWidth,
          minHeight: 420,
          background: theme.colors.card,
          border: `1px solid ${colors.cardBorder}`,
          boxShadow: colors.cardShadow,
          borderRadius: 32,
          padding: '48px 60px',
          boxSizing: 'border-box',
        }}
      >
        {/* Тег-пилюля моно-шрифтом */}
        <div
          style={{
            display: 'inline-block',
            fontFamily: fontMono,
            fontSize: 28,
            fontWeight: 500,
            color: colors.muted,
            border: `1px solid ${colors.cardBorder}`,
            borderRadius: 999,
            padding: '8px 20px',
            marginBottom: 28,
          }}
        >
          {tag}
        </div>

        {/* Заголовок — fitText гарантирует одну строку без переносов */}
        <div
          style={{
            fontFamily: fontInter,
            fontWeight: 900,
            fontSize: titleFontSize,
            lineHeight: 1.05,
            letterSpacing: -2,
            textTransform: 'uppercase',
            color: colors.ink,
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </div>

        {showLottie && (
          <LottieBadge
            src="smoke.json"
            width={90}
            height={90}
            style={{ position: 'absolute', top: 28, right: 28 }}
          />
        )}
      </div>

      {/* from=40 при 60fps (было 20 при 30fps) — тот же момент по времени. */}
      <Sticker src={stickerSrc} from={40} width={190} left={80} top={safe.contentTop + 480} rotate={-6} />

      {showCharacter && theme.charZone && (
        <Character poses={[{ frame: 0, pose: 'welcome' }]} charZone={theme.charZone} />
      )}

      <Captions theme={theme} groups={capGroups} />
    </AbsoluteFill>
  );
};
