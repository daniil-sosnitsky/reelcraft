// Опись ролика для монтажного стола (workbench каталога приёмов video-shotcraft).
//
// Что это. `../video-shotcraft/skill/workbench` — браузерный монтажный стол
// (многодорожечный таймлайн + библиотека ассетов + панель свойств + живой
// предпросмотр Remotion + экспорт MP4). Он читает из проекта ОДИН модуль —
// `src/workbench.ts` с константой WORKBENCH — и по ней разбирает сданный
// ролик на клипы: сцены, караоке, персонаж, речь, музыка, SFX. После этого
// кадр можно подвинуть, сцену растянуть, сэмпл заменить — без правки tsx.
//
// Главное правило описи (§3 references/workbench.md каталога приёмов): опись НЕ содержит
// своих таймингов. Она импортирует те же SCENES, CAP и таблицу SFX, из
// которых рендерится ролик. Вторая копия чисел разъезжается с первой через
// одну правку — и стол начнёт показывать не тот ролик, который сдан.
//
// Раскладка дорожек задана импортёром стола (projectImport.ts): сверху вниз
// transitions -> captions -> overlays -> shots -> музыка -> SFX. Фон поэтому
// НЕ может быть отдельной дорожкой (overlays идут НАД сценами) — он вшит в
// обёртку каждой сцены, под её содержимое и вне кроссфейда.
import React from 'react';
import { Background } from './Background';
import { Captions } from './Captions';
import { Character, type PoseKeyframe } from './Character';
import { Bgm } from './Bgm';
import { Scene } from './Scene';
import { sfxCueFrom, type SfxCue } from './SfxTrack';
import type { CapGroup, Word } from './captionGroups';
import type { Theme } from '../themes/types';

// ── Структуры описи. Типы стола (workbench/src/cards/manifest.ts) сюда НЕ
// импортируются: каталог приёмов — внешний клон, его путь в tsconfig движка не заведён.
// Совместимость структурная, ровно как предписывает каталог приёмов.
type Field = { type: string; key: string; label: string; default: unknown } & Record<string, unknown>;

type Unit = {
  id: string;
  label?: string;
  from: number;
  duration: number;
  component: React.ComponentType<Record<string, unknown>>;
  props?: Record<string, unknown>;
  schema?: Field[];
  durationProp?: string;
  cardId?: string;
  cardName?: string;
};

type AudioCue = { from: number; duration?: number; src: string; volume: number; label?: string };

export type WorkbenchManifest = {
  name: string;
  fps: number;
  width: number;
  height: number;
  total: number;
  background?: string;
  revision?: string;
  shots: Unit[];
  captions?: Unit[];
  overlays?: Unit[];
  sfx?: AudioCue[];
  bgm?: AudioCue[];
  order?: ('transitions' | 'captions' | 'overlays')[];
  original?: React.ComponentType<Record<string, unknown>>;
};

export type ReelManifestInput = {
  /** Имя ролика на столе: «video-05 · Sticker Light». */
  name: string;
  fps: number;
  width: number;
  height: number;
  total: number;
  theme: Theme;
  /** Границы сцен — та же таблица, что в композиции. */
  scenes: readonly { from: number; to: number }[];
  /** Компоненты сцен по порядку; длина совпадает со scenes. */
  sceneComponents: readonly React.FC<{ theme: Theme }>[];
  /** Подписи сцен для таймлайна («S4 — шаг 2, queue-add»). */
  sceneLabels?: readonly string[];
  /** Кроссфейды, заданные в композиции не по умолчанию: индекс сцены -> кадры. */
  fadeIn?: Record<number, number>;
  fadeOut?: Record<number, number>;
  /** Караоке: слова и группы из data-файла ролика. */
  words: readonly Word[];
  captionGroups: readonly CapGroup[];
  hiddenUntilFrame?: number;
  hiddenRanges?: [number, number][];
  /** Позы персонажа; нет персонажа (тёмные темы) — не передавать. */
  poses?: readonly PoseKeyframe[];
  /** Речь ролика, путь от public/: 'videos/05/audio.wav'. */
  speech: string;
  bgm?: { src: string; volume: number; fadeInSec?: number; fadeOutSec?: number };
  sfx: readonly SfxCue[];
  /** Сданная композиция целиком — стол регистрирует её как ProjOriginal
   * и сверяет с разобранной покадрово (`npm run parity`). */
  original: React.ComponentType<Record<string, unknown>>;
};

const fileLabel = (src: string) => src.split('/').pop()!.replace(/\.[^.]+$/, '');

/** Собирает опись ролика из тех же данных, из которых он рендерится. */
export const buildReelManifest = (input: ReelManifestInput): WorkbenchManifest => {
  const { theme, scenes, sceneComponents, total } = input;

  if (scenes.length !== sceneComponents.length)
    throw new Error(
      `workbench: сцен ${scenes.length}, компонентов ${sceneComponents.length} — опись собрана не из той композиции`,
    );

  // Сцена на столе: фон (вне кроссфейда) + содержимое в <Scene>. durationProp
  // отдаёт столу длину клипа, поэтому растянутая сцена гасит выход в новом
  // конце, а не замирает на старом.
  const shot = (i: number): Unit => {
    const Body = sceneComponents[i];
    const Shot: React.FC<{ durationInFrames?: number }> = ({
      durationInFrames = scenes[i].to - scenes[i].from,
    }) => (
      <>
        <Background theme={theme} />
        <Scene
          durationInFrames={durationInFrames}
          fadeInFrames={input.fadeIn?.[i]}
          fadeOutFrames={input.fadeOut?.[i]}
        >
          <Body theme={theme} />
        </Scene>
      </>
    );
    Shot.displayName = `Shot${i + 1}`;
    return {
      id: `s${i + 1}`,
      label: input.sceneLabels?.[i] ?? `S${i + 1}`,
      from: scenes[i].from,
      duration: scenes[i].to - scenes[i].from,
      component: Shot as React.ComponentType<Record<string, unknown>>,
      durationProp: 'durationInFrames',
    };
  };

  const CaptionsUnit: React.FC = () => (
    <Captions
      theme={theme}
      groups={input.captionGroups as CapGroup[]}
      hiddenUntilFrame={input.hiddenUntilFrame}
      hiddenRanges={input.hiddenRanges}
    />
  );
  CaptionsUnit.displayName = 'Captions';

  const overlays: Unit[] = [];
  if (input.poses) {
    const poses = input.poses as PoseKeyframe[];
    const CharacterUnit: React.FC = () => (
      <Character poses={poses} charZone={theme.charZone!} swapMode="dip" />
    );
    CharacterUnit.displayName = 'Character';
    overlays.push({
      id: 'character',
      label: 'Персонаж',
      from: 0,
      duration: total,
      component: CharacterUnit as React.ComponentType<Record<string, unknown>>,
    });
  }
  if (input.bgm) {
    const bgm = input.bgm;
    // BGM — компонент, а не аудиоклип стола: в нём встроен дакинг под слова
    // караоке и фейды. Аудиодорожкой он бы приехал без дакинга.
    const BgmUnit: React.FC = () => (
      <Bgm
        src={bgm.src}
        volume={bgm.volume}
        fadeInSec={bgm.fadeInSec}
        fadeOutSec={bgm.fadeOutSec}
        durationInFrames={total}
        words={input.words as Word[]}
      />
    );
    BgmUnit.displayName = 'Bgm';
    overlays.push({
      id: 'bgm',
      label: `BGM · ${fileLabel(bgm.src)}`,
      from: 0,
      duration: total,
      component: BgmUnit as React.ComponentType<Record<string, unknown>>,
    });
  }

  return {
    name: input.name,
    fps: input.fps,
    width: input.width,
    height: input.height,
    total,
    background: theme.colors.bg,
    shots: scenes.map((_, i) => shot(i)),
    captions: [
      {
        id: 'captions',
        label: 'Караоке',
        from: 0,
        duration: total,
        component: CaptionsUnit as React.ComponentType<Record<string, unknown>>,
      },
    ],
    overlays,
    // Речь отдельным аудиоклипом — её на столе двигают и подрезают чаще
    // всего; «музыка» у стола — первая аудиодорожка сверху.
    bgm: [{ from: 0, duration: total, src: input.speech, volume: 1, label: 'Речь' }],
    sfx: input.sfx.map((cue) => ({
      from: sfxCueFrom(cue),
      duration: cue.durationInFrames,
      src: cue.src,
      volume: cue.volume,
      label: cue.label ?? fileLabel(cue.src),
    })),
    order: ['transitions', 'captions', 'overlays'],
    original: input.original,
  };
};
