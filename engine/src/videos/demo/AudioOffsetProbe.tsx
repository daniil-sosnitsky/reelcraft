// AudioOffsetProbe — ДОБАВЛЕНО НАМИ. Эталон для замера поправки 1 из
// формулы sfxFrom() (src/lib/sfx.ts): смещения аудиодорожки рендера.
//
// Почему нужна отдельная композиция, а не замер на сданном ролике.
// Замер 2026-10-13 на video-05-terminal.mp4 дал верное число (+1.28 кадра),
// но принять его скрипт отказался: в готовом ролике SFX сидят на 11 dB ниже
// речи и ещё под BGM, и нормализованная кросс-корреляция опознаёт форму
// зонда с качеством 0.04–0.34 при пороге 0.3. То есть на продакшн-миксе
// замер зависит от того, попал ли зонд в паузу речи, — это не замер, а
// лотерея. Здесь дорожка пустая, зонды стоят на полной громкости, и
// корреляция выходит однозначной.
//
// Зонды СТОЯТ ГОЛЫМИ ЧИСЛАМИ и sfxFrom() здесь НЕ применяется — это
// единственное место в движке, где так правильно: мы меряем сам сдвиг
// пайплайна, а поправка исказила бы линейку. Линту это место исключено
// по имени файла.
//
// Как замерить (из корня reelcraft):
//   ./scripts/render.sh AudioOffsetProbe
//   python scripts/audio-offset.py engine/out/audiooffsetprobe.mp4 \
//     --probe impact/bass-hit-short.mp3@30 \
//     --probe ui/pop.mp3@75 \
//     --probe ui/chime-crystal.mp3@120
// Полученное среднее вписать в src/lib/sfx.ts → OUTPUT_AUDIO_OFFSET_F
// вместе с датой и составом пайплайна.
import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame } from 'remotion';

/** 6с: три зонда с запасом на хвост последнего. */
export const AUDIO_PROBE_DURATION = 180;

/** Окно каждого зонда, кадры. Обязано быть ДЛИННЕЕ самого длинного зонда:
 * скрипт сравнивает дорожку с ЦЕЛЫМ файлом-оригиналом, и обрезанный окном
 * зонд перестаёт совпадать по форме. Пруф 2026-10-14: chime-crystal (2.0с =
 * 60 кадров) в окне 30 кадров дал качество 0.00, хотя стоял ровно там, где
 * указан. Поэтому зонды подобраны короткие (≤1.11с), окно 45 кадров. */
const PROBE_WINDOW = 45;

/** Зонды: резкие сэмплы с коротким фронтом, разнесённые по дорожке.
 * Разнос (50 кадров) больше и окна зонда, и радиуса поиска скрипта
 * (30 кадров) — иначе хвост предыдущего лезет в окно поиска следующего. */
export const AUDIO_PROBES: { frame: number; src: string }[] = [
  { frame: 30, src: 'shared/sfx/impact/bass-hit-short.mp3' },  // 1.10с
  { frame: 80, src: 'shared/sfx/ui/pop.mp3' },                 // 0.48с
  { frame: 130, src: 'shared/sfx/ui/ui-click-tone.mp3' },      // 0.20с
];

/** Картинка нужна только чтобы глазом сверить кадр зонда со вспышкой:
 * если дорожка и картинка разъехались грубо (не на доли кадра), это видно
 * уже на контактном листе, и замер можно не запускать. */
const Marker: React.FC = () => {
  const frame = useCurrentFrame();
  const hit = AUDIO_PROBES.some((p) => frame >= p.frame && frame < p.frame + 2);
  return (
    <AbsoluteFill
      style={{
        background: hit ? '#ffffff' : '#101010',
        alignItems: 'center',
        justifyContent: 'center',
        color: hit ? '#101010' : '#8a8a8a',
        fontFamily: 'monospace',
        fontSize: 120,
      }}
    >
      f{frame}
    </AbsoluteFill>
  );
};

export const AudioOffsetProbe: React.FC = () => (
  <AbsoluteFill>
    <Marker />
    {AUDIO_PROBES.map((p) => (
      <Sequence key={p.src} from={p.frame} durationInFrames={PROBE_WINDOW}>
        {/* volume без ослабления: формула громкости (helpers.ts sfxGain)
            здесь не применяется — нужна максимальная узнаваемость формы. */}
        <Audio src={staticFile(p.src)} volume={1} />
      </Sequence>
    ))}
  </AbsoluteFill>
);
