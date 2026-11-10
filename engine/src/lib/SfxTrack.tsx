// Дорожка SFX ролика — одна таблица вместо россыпи <Sequence> в композиции.
//
// Зачем так. Раньше каждый сэмпл стоял в корне композиции отдельным
// <Sequence from={sfxFrom(...)}><Audio/></Sequence>. Пока звук правился
// только в коде, это работало. Но монтажный стол (workbench) читает ролик
// по описи `src/workbench.ts`, и опись обязана брать ТУ ЖЕ таблицу, из
// которой рендерится ролик: вторая копия таймингов разъезжается с первой
// через одну правку. Поэтому SFX ролика живут таблицей в его data-файле,
// а композиция и опись читают её обе.
//
// Поправки времени (лаг пика сэмпла + смещение дорожки) вносит sfxFrom —
// см. lib/sfx.ts и CLAUDE.md «Время SFX».
import React from 'react';
import { Audio, Sequence, staticFile } from 'remotion';
import { sfxFrom } from './sfx';

export type SfxCue = {
  /** Кадр, НА КОТОРОМ ДОЛЖЕН БЫТЬ СЛЫШЕН пик. Пишется относительным
   * якорем: `SCENES[3].from + 12`. Голое число — брак (правило 17). */
  at: number;
  /** Путь от public/, как в staticFile(): 'shared/sfx/ui/pop.mp3'. */
  src: string;
  volume: number;
  /** Обрезка хвоста сэмпла. Поправками времени не двигается (lib/sfx.ts). */
  durationInFrames?: number;
  /** Ролики, сданные ДО формулы sfxFrom (2026-10-14, маркер `sfx-legacy`):
   * `at` — уже посчитанный `from`, поправки применять второй раз нельзя. */
  raw?: boolean;
  /** Подпись клипа на монтажном столе (по умолчанию — имя файла). */
  label?: string;
};

/** Кадр <Sequence> для реплики: единственное место, где считается `from`. */
export const sfxCueFrom = (cue: SfxCue): number =>
  cue.raw ? cue.at : sfxFrom(cue.at, cue.src);

export const SfxTrack: React.FC<{ cues: readonly SfxCue[] }> = ({ cues }) => (
  <>
    {cues.map((cue, i) => (
      <Sequence
        key={`${cue.src}-${i}`}
        from={sfxCueFrom(cue)}
        durationInFrames={cue.durationInFrames}
      >
        <Audio src={staticFile(cue.src)} volume={cue.volume} />
      </Sequence>
    ))}
  </>
);
