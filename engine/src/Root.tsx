import './fonts';
import React from 'react';
import { Composition } from 'remotion';
import { DemoLight, DemoNoir, DemoEmerald, DEMO_DURATION } from './videos/demo/Demo';
import { DemoFlow, DEMO_FLOW_DURATION, DEMO_FLOW_FPS } from './videos/demo/DemoFlow';
import { CtaLight, CtaEmerald, CTA_PREVIEW_DURATION } from './videos/demo/CtaPreview';
import {
  TargetBoxLight,
  TargetBoxEmerald,
  TargetBoxSpotlight,
  TARGET_BOX_PREVIEW_DURATION,
} from './videos/demo/TargetBoxPreview';
import { BrollLight, BrollEmerald, BROLL_PREVIEW_DURATION } from './videos/demo/BrollPreview';
import { AudioOffsetProbe, AUDIO_PROBE_DURATION } from './videos/demo/AudioOffsetProbe';

// Публичная версия: зарегистрированы только демо- и пруф-композиции.
// Сцены своих роликов живут в engine/src/videos/video-NN/ и в этот
// файл дописываются по мере сборки — как образец смотри videos/demo/.

// Ролики собираются на 30 fps. FPS_NEW=60 — только по явной просьбе:
// рендер вдвое дольше, на телефоне разницы нет. Demo-композиции живут
// на 60, их внутренние кадровые константы под это и посчитаны.
const FPS = 30;
const FPS_NEW = 60;
const WIDTH = 1080;
const HEIGHT = 1920;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* DemoLight / DemoNoir — минимальная связка всех кусков движка:
          тема, фон, караоке, персонаж, стикер, Lottie, переход.
          Читать перед вёрсткой первого ролика (engine/README.md). */}
      <Composition
        id="DemoLight"
        component={DemoLight}
        durationInFrames={DEMO_DURATION}
        fps={FPS_NEW}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="DemoNoir"
        component={DemoNoir}
        durationInFrames={DEMO_DURATION}
        fps={FPS_NEW}
        width={WIDTH}
        height={HEIGHT}
      />
      {/* DemoEmerald — ДОБАВЛЕНО НАМИ: фирменная зелёная тёмная тема канала. */}
      <Composition
        id="DemoEmerald"
        component={DemoEmerald}
        durationInFrames={DEMO_DURATION}
        fps={FPS_NEW}
        width={WIDTH}
        height={HEIGHT}
      />
      {/* DemoFlow — демо FlowNode / DottedLink / MacWindow (правило 24). */}
      <Composition
        id="DemoFlow"
        component={DemoFlow}
        durationInFrames={DEMO_FLOW_DURATION}
        fps={DEMO_FLOW_FPS}
        width={WIDTH}
        height={HEIGHT}
      />

      {/* CtaLight / CtaEmerald — ДОБАВЛЕНО НАМИ: превью финальной карточки
          канала. Прогонять после любой правки src/channel.ts. */}
      <Composition
        id="CtaLight"
        component={CtaLight}
        durationInFrames={CTA_PREVIEW_DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="CtaEmerald"
        component={CtaEmerald}
        durationInFrames={CTA_PREVIEW_DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />

      {/* AudioOffsetProbe — ДОБАВЛЕНО НАМИ: эталон для замера смещения
          аудиодорожки рендера (поправка 1 формулы sfxFrom). Перезамерять
          при смене версии Remotion, кодека, частоты или контейнера —
          см. шапку composition-файла. */}
      <Composition
        id="AudioOffsetProbe"
        component={AudioOffsetProbe}
        durationInFrames={AUDIO_PROBE_DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />

      {/* TargetBox* — ДОБАВЛЕНО НАМИ: пруф рамки выделения цели (правило 28).
          Прогонять после любой правки TargetBox или PageCam. */}
      <Composition
        id="TargetBoxLight"
        component={TargetBoxLight}
        durationInFrames={TARGET_BOX_PREVIEW_DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="TargetBoxEmerald"
        component={TargetBoxEmerald}
        durationInFrames={TARGET_BOX_PREVIEW_DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="TargetBoxSpotlight"
        component={TargetBoxSpotlight}
        durationInFrames={TARGET_BOX_PREVIEW_DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />

      {/* Broll* — ДОБАВЛЕНО НАМИ: пруф живого плана во весь кадр.
          Прогонять после любой правки Broll. */}
      <Composition
        id="BrollLight"
        component={BrollLight}
        durationInFrames={BROLL_PREVIEW_DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="BrollEmerald"
        component={BrollEmerald}
        durationInFrames={BROLL_PREVIEW_DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    </>
  );
};
