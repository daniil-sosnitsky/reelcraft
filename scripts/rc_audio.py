# -*- coding: utf-8 -*-
"""Общая звуковая обвязка скриптов reelcraft: резолв ffmpeg и декод в numpy.

Отдельный модуль, потому что одно и то же нужно обоим звуковым скриптам:
sfx-peaks.py (лаг пика сэмплов) и audio-offset.py (смещение дорожки
сданного файла). Третьим сюда встанет beat-grid.py, если решим монтировать
ролики под биты музыки (пока задел, см. sfx.ts).

Грабля, из-за которой модуль и появился: `which ffmpeg` в Git Bash отдаёт
путь БЕЗ расширения (`tools/ffmpeg/ffmpeg`), Git Bash сам дописывает `.exe`,
а Python зовёт CreateProcess буквально и падает с WinError 5 «отказано в
доступе». Поэтому путь к ffmpeg резолвим сами и всегда с расширением.
"""
from __future__ import annotations

import shutil
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

import numpy as np

# Вывод всегда в UTF-8. Без этого на Windows консоль берёт cp1251, и любой
# print с «⚠» или кириллицей роняет скрипт UnicodeEncodeError уже ПОСЛЕ
# того, как замер посчитан (пруф 2026-10-13: audio-offset.py упал на
# предупреждении, выдав замер и ненулевой код выхода).
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8")
    except (AttributeError, ValueError):
        pass

PROJ = Path(__file__).resolve().parent.parent
# Свой ffmpeg проекта (tools/WINDOWS.md) — приоритетнее системного: именно
# на нём замерены все константы звука.
_BUNDLED = PROJ / "tools" / "ffmpeg"


def resolve_ffmpeg(name: str = "ffmpeg") -> str:
    """Путь к ffmpeg/ffprobe, пригодный для subprocess. name без расширения."""
    for cand in (_BUNDLED / f"{name}.exe", _BUNDLED / name):
        if cand.is_file():
            return str(cand)
    found = shutil.which(name) or shutil.which(f"{name}.exe")
    if found and Path(found).is_file():
        return found
    # Последняя попытка: Git Bash мог отдать путь без расширения.
    if found:
        exe = Path(f"{found}.exe")
        if exe.is_file():
            return str(exe)
    print(f"Не найден {name}. Ожидался в tools/ffmpeg/ или в PATH.", file=sys.stderr)
    raise SystemExit(1)


FFMPEG = resolve_ffmpeg("ffmpeg")


def decode_mono(path: Path, sr: int = 48_000) -> np.ndarray:
    """Файл -> моно float64 в диапазоне [-1, 1] на частоте sr.

    Через временный wav, а не через pipe: поведение одинаковое на Windows и
    Linux, и не нужно разбирать сырой поток. Временный файл — в системном
    temp, не в проекте (параллельные сессии не должны драться за имя).
    """
    with tempfile.TemporaryDirectory(prefix="rc-audio-") as tmpdir:
        tmp = Path(tmpdir) / "decoded.wav"
        subprocess.run(
            [FFMPEG, "-hide_banner", "-loglevel", "error", "-y",
             "-i", str(path), "-ac", "1", "-ar", str(sr),
             "-acodec", "pcm_s16le", str(tmp)],
            check=True,
        )
        with wave.open(str(tmp), "rb") as w:
            raw = w.readframes(w.getnframes())
    return np.frombuffer(raw, dtype=np.int16).astype(np.float64) / 32768.0


def rms_envelope(samples: np.ndarray, sr: int, win_ms: float) -> tuple[np.ndarray, float]:
    """Огибающая энергии по неперекрывающимся окнам. -> (значения, шаг в сек)."""
    win = max(1, int(sr * win_ms / 1000))
    n = samples.size // win
    if n == 0:
        return np.zeros(0), win / sr
    env = np.sqrt((samples[: n * win].reshape(n, win) ** 2).mean(axis=1))
    return env, win / sr
