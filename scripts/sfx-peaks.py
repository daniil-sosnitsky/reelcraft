# -*- coding: utf-8 -*-
"""Замер лага пика у сэмплов SFX-банка -> engine/src/lib/sfxPeaks.ts

Зачем. У многих сэмплов фронт атаки стоит не в начале файла: нарастание,
вдох перед ударом. Поставить такой файл началом на целевой кадр значит
опоздать на весь лаг. Замеры автора базового комплекта: brush-write 2 кадра, paper-slide 10,
ink-char доходил до 24 — на 30 fps это почти секунда опоздания.
Правило целиком — раздел «Звук» в CLAUDE.md (формула sfxFrom).

Таблицу читает engine/src/lib/sfx.ts -> sfxFrom(). Руками её не правят:
добавил сэмплы в банк — перезапустил скрипт.

Запуск (из корня reelcraft):
    python scripts/sfx-peaks.py

Зависимости: numpy и ffmpeg проекта (tools/ffmpeg). librosa НЕ нужна:
огибающая энергии по окнам — несколько строк numpy, а тянуть numba под
python 3.14 смысла нет.
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import numpy as np

from rc_audio import decode_mono, rms_envelope

FPS = 30                 # кадровая частота роликов (CLAUDE.md: 30 — норма)
SR = 48_000              # частота замера; дорожка роликов тоже 48 кГц
WIN_MS = 5.0             # окно огибающей энергии
# Порог «фронт атаки начался»: доля от максимума огибающей. Берём не сам
# максимум, а момент, когда энергия ВПЕРВЫЕ дошла до этой доли — у сэмплов с
# длинным сустейном (гудящий бас) максимум сидит в середине гула, а ухо
# считает ударом фронт атаки.
PEAK_THRESHOLD = 0.7
# Анализируем только НАЧАЛО файла. У нарастающих сэмплов (riser, swoosh-slow,
# light-transition-magic) глобальный максимум сидит в конце нарастания, и
# замер по всему файлу давал бы лаг в секунды: у camera-autofocus вышло 277
# кадров, то есть «поставь удар на 9 секунд раньше», чего никто не имел в
# виду. Окно 1.5с совпадает с нашей границей «длинный сэмпл» из CATALOG.md.
ANALYZE_SEC = 1.5
# Выше этого лага замер считается ненадёжным: значит сэмпл нарастающий, и
# ставить его надо по смыслу (под само нарастание), а не по фронту. Такие
# получают в таблице 0 и пометку.
SANE_LAG_F = 15.0

PROJ = Path(__file__).resolve().parent.parent
SFX_DIR = PROJ / "engine" / "public" / "shared" / "sfx"
OUT_TS = PROJ / "engine" / "src" / "lib" / "sfxPeaks.ts"


def peak_lag_frames(samples: np.ndarray) -> tuple[float, float, bool]:
    """Возвращает (лаг в кадрах, лаг в мс, надёжен ли замер).

    Лаг — первое окно огибающей, где энергия дошла до PEAK_THRESHOLD от
    максимума окна анализа: это фронт атаки, по нему и выравниваем.
    """
    if samples.size == 0:
        return 0.0, 0.0, True
    env, step = rms_envelope(samples[: int(SR * ANALYZE_SEC)], SR, WIN_MS)
    if env.size == 0:
        return 0.0, 0.0, True
    peak = float(env.max())
    if peak <= 0:
        return 0.0, 0.0, True
    idx = int(np.argmax(env >= peak * PEAK_THRESHOLD))
    sec = idx * step
    lag_f = sec * FPS
    return lag_f, sec * 1000.0, lag_f <= SANE_LAG_F


def main() -> int:
    if not SFX_DIR.is_dir():
        print(f"Нет банка SFX: {SFX_DIR}", file=sys.stderr)
        return 1

    files = sorted(
        p for p in SFX_DIR.rglob("*")
        if p.suffix.lower() in (".mp3", ".wav") and p.is_file()
    )
    if not files:
        print(f"В банке нет сэмплов: {SFX_DIR}", file=sys.stderr)
        return 1

    rows: list[tuple[str, float, float, bool]] = []
    for p in files:
        # Ключ — ровно тот путь, который уходит в staticFile() в сценах.
        key = "shared/sfx/" + p.relative_to(SFX_DIR).as_posix()
        try:
            lag_f, lag_ms, sane = peak_lag_frames(decode_mono(p, SR))
        except subprocess.CalledProcessError:
            print(f"  ! не удалось декодировать: {key}", file=sys.stderr)
            continue
        rows.append((key, lag_f, lag_ms, sane))
        if not sane:
            print(f"  ! {key}: фронт только на {lag_f:.1f} кадре — сэмпл "
                  f"нарастающий, поправка не вносится (ставить по смыслу)")
        elif lag_f >= 1.0:
            print(f"  {key}: лаг {lag_f:.2f} кадра ({lag_ms:.0f} мс)")

    # В таблицу пишем ВСЕ сэмплы, включая нулевые: отсутствие ключа и
    # замеренный ноль — разные вещи. Нет ключа значит «не замерялся», и тогда
    # sfxFrom() молча не внесёт поправку.
    lines = []
    for key, lag_f, lag_ms, sane in rows:
        if not sane:
            lines.append(f"  '{key}': 0, // нарастающий (фронт {lag_f:.1f}f) — ставить по смыслу")
        elif lag_f >= 1.0:
            lines.append(f"  '{key}': {round(lag_f, 2)}, // {lag_ms:.0f} мс")
        else:
            lines.append(f"  '{key}': {round(lag_f, 2)},")
    body = "\n".join(lines)

    significant = sum(1 for _, f, _, sane in rows if sane and f >= 1.0)
    rising = sum(1 for *_, sane in rows if not sane)

    header = (
        "// СГЕНЕРИРОВАНО: scripts/sfx-peaks.py — руками не править, перегенерировать.\n"
        f"// Лаг пика каждого сэмпла в кадрах при {FPS} fps: насколько фронт атаки\n"
        "// отстоит от НАЧАЛА файла. Поправка 2 из формулы sfxFrom() (sfx.ts).\n"
        f"// Замерено сэмплов: {len(rows)}, с лагом >=1 кадра: {significant},\n"
        f"// нарастающих (поправка не вносится): {rising}.\n"
        f"// Порог фронта — {PEAK_THRESHOLD} от максимума огибающей в первых\n"
        f"// {ANALYZE_SEC}с (окно {WIN_MS} мс).\n\n"
        "export const SFX_PEAK_LAG_F: Record<string, number> = {\n"
    )
    OUT_TS.write_text(header + body + "\n};\n", encoding="utf-8")
    print(f"\n[ok] {OUT_TS.relative_to(PROJ)}: {len(rows)} сэмплов, "
          f"{significant} с лагом >=1 кадра, {rising} нарастающих")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
