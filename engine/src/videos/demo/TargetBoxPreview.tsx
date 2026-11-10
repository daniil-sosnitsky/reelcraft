// TargetBoxPreview — ДОБАВЛЕНО НАМИ (2026-10-07). Пруф-композиция рамки
// выделения цели (правило 28), по образцу CtaPreview: увидеть компонент, не
// собирая ради этого ролик.
//
// Проверяет ровно то, из-за чего рамка появилась:
//   1) рамка приклеена к цели и едет вместе с наездом;
//   2) линия не толстеет при увеличении zoom (компенсация stroke/zoom);
//   3) границы идут по краю смыслового блока и НЕ задевают соседний текст —
//      главная претензия автора к тестовым роликам.
//
// Цель замерена в самом ассете (1238×545): заголовок «Очередь тем для
// роликов» занимает x 44–490, y 358–404. Сверху пусто, снизу абзац с y≈437 —
// то есть при зазоре pad=12 нижняя грань встаёт на 416 и до абзаца остаётся
// 21px. Если рамка когда-нибудь поедет, это видно здесь первым.
//
// Смотреть:  npx remotion studio → TargetBoxLight / TargetBoxSpotlight
// Снять кадр: npx remotion still TargetBoxLight out/tb-light.png --frame=95
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { Background } from '../../lib/Background';
import { PageCam, type CamKey } from '../../lib/PageCam';
import { TargetBox } from '../../lib/TargetBox';
import { lightTheme } from '../../themes/light';
import { emeraldTheme } from '../../themes/emerald';
import type { Theme } from '../../themes/types';

export const TARGET_BOX_PREVIEW_DURATION = 120;

// Геометрия карточки — та же, что у ShotCard в video-01 (паспорт 1000×474).
const SHOT_W = 1000;
const SHOT_H = 474;
const SHOT_LEFT = (1080 - SHOT_W) / 2;
const SHOT_TOP = 250;

const SRC = { path: 'videos/01/shots/01-ideas.png', w: 1238, h: 545 };

// Цель: заголовок «Очередь тем для роликов», координаты исходника.
const TARGET = { x: 44, y: 358, w: 446, h: 46 };

// Наезд: zoom 1.9 → окно 526×249 исходных px. Полуокно по X = 263, значит
// cx обязан лежать в 263…975 (правило 19), берём 280 — цель 44…490 влезает
// в видимые 17…543 целиком.
const CAM: CamKey[] = [
  { frame: 0, cx: 500, cy: 330, zoom: 1.2 },
  { frame: 60, cx: 280, cy: 381, zoom: 1.9 },
];
const FINAL_ZOOM = 1.9;
// Рамка появляется В КОНЦЕ движения, когда камера встала (правило 28).
const BOX_FROM = 60;

const Preview: React.FC<{ theme: Theme; mode: 'frame' | 'spotlight' }> = ({ theme, mode }) => (
  <AbsoluteFill>
    <Background theme={theme} />
    <div
      style={{
        position: 'absolute',
        left: SHOT_LEFT,
        top: SHOT_TOP,
        width: SHOT_W,
        height: SHOT_H,
        borderRadius: 28,
        overflow: 'hidden',
        boxShadow: '0 30px 60px rgba(16,24,40,0.22)',
      }}
    >
      <PageCam
        src={SRC.path}
        pageH={SRC.h}
        srcW={SRC.w}
        viewportW={SHOT_W}
        viewportH={SHOT_H}
        keys={CAM}
      >
        <TargetBox
          x={TARGET.x}
          y={TARGET.y}
          w={TARGET.w}
          h={TARGET.h}
          zoom={FINAL_ZOOM}
          theme={theme}
          from={BOX_FROM}
          mode={mode}
          pad={12}
        />
      </PageCam>
    </div>
  </AbsoluteFill>
);

export const TargetBoxLight: React.FC = () => <Preview theme={lightTheme} mode="frame" />;
export const TargetBoxEmerald: React.FC = () => <Preview theme={emeraldTheme} mode="frame" />;
export const TargetBoxSpotlight: React.FC = () => <Preview theme={emeraldTheme} mode="spotlight" />;
