// BrollPreview — ДОБАВЛЕНО НАМИ (2026-11-01). Пруф компонента живого плана,
// по образцу TargetBoxPreview: увидеть кадр, не собирая ради этого ролик.
//
// Проверяет ровно то, из-за чего Broll появился:
//   1) план во весь кадр реально закрывает вертикаль (правила 20 и 26) —
//      никакой однородной полосы сверху и снизу;
//   2) медленный push даёт движение с первого кадра (правило 29), и при этом
//      не читается как рывок камеры;
//   3) ландшафтный клип в вертикали не оставляет глухих полей: fit='contain'
//      подкладывает размытый двойник;
//   4) скрим стоит ровно под полосой караоке темы — белая строка-макет внизу
//      обязана читаться поверх любого кадра.
//
// Смотреть:  npx remotion studio  →  BrollLight / BrollEmerald
// Снять кадр: npx remotion still BrollLight out/broll-light.png --frame=45
import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { Background } from '../../lib/Background';
import { Broll } from '../../lib/Broll';
import { lightTheme } from '../../themes/light';
import { emeraldTheme } from '../../themes/emerald';
import type { Theme } from '../../themes/types';

/** Три плана по 60 кадров (2с) — столько живёт нормальная перебивка. */
const SHOT = 60;
export const BROLL_PREVIEW_DURATION = SHOT * 3;

// Клипы берутся из уже сданных роликов: отдельных ассетов под пруф не заводим.
// Оба лежат в public/videos/, то есть вне git (как и ассеты TargetBoxPreview).
const VERTICAL = 'videos/07/clips/dzen-articles-scroll.mp4'; // 1080×2400, съёмка телефоном
const LANDSCAPE = 'videos/12/clips/heygen-official-demo.mp4'; // 1280×720, классические 16:9

/** Строка-макет на месте караоке: проверяем, что скрим её вытягивает. */
const CaptionProbe: React.FC<{ theme: Theme }> = ({ theme }) => (
  <div
    style={{
      position: 'absolute',
      left: 0,
      right: 0,
      top: theme.safe.capTop,
      height: theme.safe.capBottom - theme.safe.capTop,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#FFFFFF',
      fontFamily: theme.fontInter,
      fontWeight: 800,
      fontSize: theme.caption.fontSize,
      letterSpacing: '-0.01em',
      textShadow: '0 2px 18px rgba(0,0,0,0.55)',
      zIndex: 60,
    }}
  >
    ПРОВЕРКА КАРАОКЕ
  </div>
);

const Preview: React.FC<{ theme: Theme }> = ({ theme }) => (
  <AbsoluteFill>
    <Background theme={theme} />

    {/* План 1 — вертикальная съёмка во весь кадр с медленным наездом. */}
    <Sequence from={0} durationInFrames={SHOT}>
      <Broll src={VERTICAL} theme={theme} durationInFrames={SHOT} />
    </Sequence>

    {/* План 2 — ландшафтный клип: поля закрывает размытый двойник. */}
    <Sequence from={SHOT} durationInFrames={SHOT}>
      <Broll
        src={LANDSCAPE}
        theme={theme}
        durationInFrames={SHOT}
        fit="contain"
        push={{ from: 1.04, to: 1 }}
      />
    </Sequence>

    {/* План 3 — врезка в контент-зону: план как носитель внутри макета. */}
    <Sequence from={SHOT * 2} durationInFrames={SHOT}>
      <Broll
        src={VERTICAL}
        theme={theme}
        durationInFrames={SHOT}
        zone="content"
        scrim="none"
        grade={{ saturate: 1.1, contrast: 1.05 }}
      />
    </Sequence>

    <CaptionProbe theme={theme} />
  </AbsoluteFill>
);

export const BrollLight: React.FC = () => <Preview theme={lightTheme} />;
export const BrollEmerald: React.FC = () => <Preview theme={emeraldTheme} />;
