# -*- coding: utf-8 -*-
"""Замер смещения аудиодорожки рендера — поправка 1 формулы sfxFrom().

Зачем. Вся дорожка сданного mp4 стоит с небольшим постоянным опозданием
относительно картинки. Причина не в <Audio> и не в Sequence.from, а в
кодировании: AAC-кодер подмешивает в начало «прогревочные» сэмплы (encoder
priming) — на 48 кГц обычно 1024–2112 сэмплов, то есть 0,6–1,3 кадра при
30 fps. Величина зависит от связки «версия Remotion + кодек + частота +
контейнер», поэтому её не предполагают, а замеряют один раз на пайплайн.
Отслеживается и у самих Remotion: remotion-dev/remotion#7099.

Метод (из sound-design §4.6): вытащить дорожку из готового mp4, взять
ОРИГИНАЛЫ 2–3 резких сэмплов-зондов, которые в ролике есть, и для каждого
посчитать нормализованную кросс-корреляцию в окне вокруг ожидаемого кадра.
Смещение = где зонд нашёлся минус где он должен быть. Зондов нужно
несколько: по одному можно попасть на собственный лаг пика сэмпла и
принять его за смещение пайплайна.

Запуск (из корня reelcraft):
    python scripts/audio-offset.py out/video-05.mp4 \
        --probe impact/bass-hit-short.mp3@3 \
        --probe ui/pop.mp3@1192 \
        --probe ui/chime-crystal.mp3@514

  <путь>@<кадр> — кадр, который стоит в Sequence.from у этого сэмпла в
  сцене (ДО применения поправок, то есть то число, что сейчас в коде).

Результат вписывается в engine/src/lib/sfx.ts -> OUTPUT_AUDIO_OFFSET_F
вместе с датой и составом пайплайна. Сменил кодек, частоту, контейнер или
версию Remotion — замерять заново, старое число не переносить.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np

from rc_audio import decode_mono

FPS = 30
SR = 48_000
# Окно поиска вокруг ожидаемого кадра. Смещение пайплайна — доли кадра, но
# ищем с запасом, чтобы увидеть и грубый промах (например, если сэмпл в
# коде стоит не там, где думает автор).
SEARCH_RADIUS_F = 30.0

PROJ = Path(__file__).resolve().parent.parent
SFX_DIR = PROJ / "engine" / "public" / "shared" / "sfx"


def best_lag(track: np.ndarray, probe: np.ndarray, center_s: float) -> tuple[float, float]:
    """Нормализованная кросс-корреляция зонда с окном дорожки.

    Возвращает (смещение в кадрах относительно center_s, качество совпадения
    0..1). Нормализация — по длине окна, иначе громкие места дорожки (речь,
    удар BGM) перетягивают корреляцию на себя независимо от формы зонда.
    """
    radius = int(SEARCH_RADIUS_F / FPS * SR)
    start = max(0, int(center_s * SR) - radius)
    stop = min(track.size, int(center_s * SR) + radius + probe.size)
    window = track[start:stop]
    if window.size <= probe.size:
        return 0.0, 0.0

    # Зонд центрируем и нормируем — корреляция тогда измеряет СХОДСТВО ФОРМЫ,
    # а не громкость.
    p = probe - probe.mean()
    p_norm = np.sqrt((p ** 2).sum())
    if p_norm == 0:
        return 0.0, 0.0
    p = p / p_norm

    # Корреляция через FFT: окно короткое, но зонды бывают по секунде —
    # прямой проход был бы в разы медленнее.
    n = 1
    while n < window.size + p.size:
        n *= 2
    corr = np.fft.irfft(np.fft.rfft(window, n) * np.conj(np.fft.rfft(p, n)), n)
    corr = corr[: window.size - p.size + 1]

    # Делим на локальную норму окна — это и даёт нормализованный коэффициент.
    sq = np.concatenate(([0.0], np.cumsum(window ** 2)))
    local = np.sqrt(np.maximum(sq[p.size:] - sq[: -p.size], 1e-12))
    local = local[: corr.size]
    score = corr / local

    idx = int(np.argmax(score))
    found_s = (start + idx) / SR
    return (found_s - center_s) * FPS, float(np.clip(score[idx], 0, 1))


def main() -> int:
    ap = argparse.ArgumentParser(description="Замер смещения аудиодорожки рендера")
    ap.add_argument("video", help="готовый mp4 (чистовой рендер)")
    ap.add_argument("--probe", action="append", required=True, metavar="ПУТЬ@КАДР",
                    help="сэмпл от shared/sfx/ и его кадр в сцене, можно несколько")
    args = ap.parse_args()

    video = Path(args.video)
    if not video.is_file():
        print(f"Нет файла: {video}", file=sys.stderr)
        return 1

    print(f"Дорожка: {video}")
    track = decode_mono(video, SR)
    print(f"  длительность {track.size / SR:.1f}с\n")

    results: list[tuple[str, float, float]] = []
    for spec in args.probe:
        if "@" not in spec:
            print(f"  ! пропущен «{spec}»: нужен вид ПУТЬ@КАДР", file=sys.stderr)
            continue
        rel, frame_s = spec.rsplit("@", 1)
        path = SFX_DIR / rel
        if not path.is_file():
            print(f"  ! нет сэмпла: {path}", file=sys.stderr)
            continue
        center_s = float(frame_s) / FPS
        lag_f, score = best_lag(track, decode_mono(path, SR), center_s)
        flag = "" if score >= 0.3 else "  <- совпадение слабое, зонд не годится"
        print(f"  {rel} @ f{frame_s}: смещение {lag_f:+.2f} кадра "
              f"(качество {score:.2f}){flag}")
        if score >= 0.3:
            results.append((rel, lag_f, score))

    if not results:
        print("\nНи один зонд не опознан. Берите РЕЗКИЕ сэмплы (удар, щелчок, "
              "поп), которые в ролике действительно есть, и сверяйте кадр "
              "с кодом сцены.", file=sys.stderr)
        return 1

    lags = np.array([r[1] for r in results])
    mean, spread = float(lags.mean()), float(lags.max() - lags.min())
    print(f"\nСреднее смещение: {mean:+.2f} кадра ({mean / FPS * 1000:+.0f} мс)")
    print(f"Разброс по зондам: {spread:.2f} кадра")

    if len(results) < 2:
        print("\n⚠ Зонд один. По одному зонду замер не принимают: можно "
              "принять за смещение пайплайна собственный лаг пика сэмпла. "
              "Добавьте ещё два.")
        return 0
    if spread > 1.0:
        print("\n⚠ Зонды расходятся больше чем на кадр — замер не принят. "
              "Обычно значит, что кадр одного из зондов в коде не тот, что "
              "передан, либо зонд совпал с ударом BGM. Проверьте и повторите.")
        return 0

    print("\nЗамер принят. Вписать в engine/src/lib/sfx.ts:")
    print(f"  export const OUTPUT_AUDIO_OFFSET_F = {mean:.2f};")
    print("  // замерено <дата>, пайплайн: Remotion <версия> + AAC 48кГц mp4,")
    print(f"  // зонды: {', '.join(r[0] for r in results)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
