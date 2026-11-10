// Фоновая музыка с огибающей и дакингом под речь (2026-09-04).
// Раньше каждый ролик писал свой <Bgm> руками: volume константой, fade-in/out
// по кадрам, без реакции на речь. Здесь всё в одном месте:
//  • fade-in 1с / fade-out 1.7с (константы канала, CLAUDE.md «Звук»);
//  • дакинг: пока звучит слово караоке, музыка на `duckDb` тише (по умолчанию
//    −4 dB), в паузах возвращается; переходы сглажены за `duckSmoothSec`.
//    Всё детерминировано — считается от таймингов слов (Word[]/CapGroup[]),
//    а не от анализа звука, поэтому рендер воркерами даёт одно и то же.
// Рендерить сиблингом сцен в корне композиции, как <Audio> речи.
import React from 'react';
import { Audio, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Word } from './captionGroups';

export const Bgm: React.FC<{
  /** staticFile-путь трека, например 'shared/bgm/mixkit-close-up-1167.mp3'. */
  src: string;
  /** Базовый множитель громкости (0.11–0.14 по константам канала). */
  volume: number;
  /** Длительность композиции в кадрах — для fade-out. */
  durationInFrames: number;
  fadeInSec?: number;
  fadeOutSec?: number;
  /** Слова караоке для дакинга. Не передан — дакинга нет (прежнее поведение). */
  words?: Word[];
  /** На сколько dB тише под словом. 0 — выключить. */
  duckDb?: number;
  /** Сглаживание дакинга, с (окно до и после слова). */
  duckSmoothSec?: number;
}> = ({
  src,
  volume,
  durationInFrames,
  fadeInSec = 1,
  fadeOutSec = 1.7,
  words,
  duckDb = 4,
  duckSmoothSec = 0.25,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const inOp = Math.min(1, frame / (fadeInSec * fps));
  const outOp = Math.min(1, (durationInFrames - frame) / (fadeOutSec * fps));
  const env = Math.max(0, Math.min(inOp, outOp));

  // Дакинг: расстояние до ближайшего слова → 0 внутри слова, 1 вне окна.
  let duck = 1;
  if (words && words.length && duckDb > 0) {
    let dist = Infinity;
    for (const w of words) {
      if (t >= w.start - duckSmoothSec && t <= w.end + duckSmoothSec) {
        const d = t < w.start ? w.start - t : t > w.end ? t - w.end : 0;
        if (d < dist) dist = d;
        if (dist === 0) break;
      }
    }
    if (dist !== Infinity) {
      const k = Math.min(1, dist / duckSmoothSec); // 0 внутри слова → 1 на краю окна
      const ease = k * k * (3 - 2 * k);
      const minGain = Math.pow(10, -duckDb / 20);
      duck = minGain + (1 - minGain) * ease;
    }
  }

  return <Audio src={staticFile(src)} volume={Math.max(0, volume * env * duck)} />;
};
