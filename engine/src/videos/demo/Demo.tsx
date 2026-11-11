// Тестовая композиция engine — 10с, без аудио. С 2026-09-04 демо переведено
// на FPS_NEW=60 (DEMO_DURATION и все внутренние кадровые константы удвоены
// относительно исходных 30fps-значений — реальная длительность и тайминги
// не изменились, см. Root.tsx).
// DemoLight: одна сцена (Scene с crossfade) — заголовок/карточка/стикер/
// персонаж/Lottie-бейдж в теме Sticker Light.
// DemoNoir: та же сцена без персонажа и Lottie, ЗАТО через TransitionSeries
// (slide) на две панели — показывает, что @remotion/transitions работает.
// Правило (см. README): полнокадровые переходы (TransitionSeries) — ТОЛЬКО
// в noir. В light персонаж стоит на кадре весь ролик, полнокадровый переход
// заставил бы его мигать/дёргаться на стыке — недопустимо по CLAUDE.md
// («элемент не появляется, если ему жить <1с», «одна точка внимания»).
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { slide } from '@remotion/transitions/slide';
import { Scene } from '../../lib/Scene';
import { lightTheme } from '../../themes/light';
import { noirTheme } from '../../themes/noir';
import { emeraldTheme } from '../../themes/emerald';
import { DemoPanel } from './DemoPanel';
import { DEMO_CAP_GROUPS, DEMO_TITLE } from './data';

export const DEMO_DURATION = 600; // 10с @60fps (было 300 @30fps)

export const DemoLight: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: lightTheme.colors.bg }}>
    <Scene durationInFrames={DEMO_DURATION} fadeInFrames={30} fadeOutFrames={30}>
      <DemoPanel
        theme={lightTheme}
        title={DEMO_TITLE}
        tag="RC · DEMO"
        stickerSrc="robot-subagents.png"
        capGroups={DEMO_CAP_GROUPS}
        showCharacter
        showLottie
      />
    </Scene>
  </AbsoluteFill>
);

// Транзишен-окно у TransitionSeries при 60fps: A=330f, transition=60f, B=330f
// → итог 330+330-60=600f (было 165/30/165=300f при 30fps, значения удвоены).
// Окно перехода (блендинг) — глобальные кадры [270, 330): смоук-стилл на
// кадре 300 (было 150) приходится ровно в его середину.
const PANEL_DURATION = 330;
const TRANSITION_DURATION = 60;

export const DemoNoir: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: noirTheme.colors.bg }}>
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={PANEL_DURATION}>
        <DemoPanel
          theme={noirTheme}
          title={DEMO_TITLE}
          tag="RC · DEMO"
          stickerSrc="robot-subagents.png"
          capGroups={DEMO_CAP_GROUPS}
        />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        timing={linearTiming({ durationInFrames: TRANSITION_DURATION })}
        presentation={slide({ direction: 'from-right' })}
      />

      <TransitionSeries.Sequence durationInFrames={PANEL_DURATION}>
        <DemoPanel
          theme={noirTheme}
          title="ДВИЖОК ГОТОВ"
          tag="RC · SLIDE 2"
          stickerSrc="notepad-checklist.png"
          capGroups={[]}
        />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  </AbsoluteFill>
);

// DemoEmerald — ДОБАВЛЕНО НАМИ, не из базового комплекта. Та же постановка, что у DemoNoir,
// но в фирменной зелёной палитре канала (themes/emerald.ts). Нужна, чтобы
// увидеть тему целиком до первого настоящего ролика: цвет фона, карточка,
// лаймовый маркер караоке и полнокадровый переход на тёмном.
export const DemoEmerald: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: emeraldTheme.colors.bg }}>
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={PANEL_DURATION}>
        <DemoPanel
          theme={emeraldTheme}
          title={DEMO_TITLE}
          tag="RC · EMERALD"
          stickerSrc="robot-subagents.png"
          capGroups={DEMO_CAP_GROUPS}
        />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        timing={linearTiming({ durationInFrames: TRANSITION_DURATION })}
        presentation={slide({ direction: 'from-right' })}
      />

      <TransitionSeries.Sequence durationInFrames={PANEL_DURATION}>
        <DemoPanel
          theme={emeraldTheme}
          title="ЦВЕТ КАНАЛА"
          tag="RC · SLIDE 2"
          stickerSrc="notepad-checklist.png"
          capGroups={[]}
        />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  </AbsoluteFill>
);
