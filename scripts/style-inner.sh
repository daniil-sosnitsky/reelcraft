#!/usr/bin/env bash
. "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/tools/env.sh"   # прослойка окружения, см. tools/env.sh
# ══════════════════════════════════════════════════════════════
# style-inner.sh (reelcraft) — вырезать ЭКРАН ВНУТРИ кадра и сделать его
# самостоятельным источником для разбора.
# Запуск: scripts/style-inner.sh <имя-разбора> <Ш:В:X:Y> [--gain N]
#   Ш:В:X:Y  прямоугольник экрана в пикселях исходника (как у ffmpeg crop)
#   --gain N яркость прибавкой, по умолчанию 0.06 (экран в кадре всегда темнее)
#
# Зачем. Есть целый формат роликов, где камера неподвижна, а весь монтаж идёт
# НА ЭКРАНЕ внутри кадра: стол, монитор, на мониторе крутится ролик. Если
# считать монтаж по всему кадру, детектор видит неподвижную комнату и честно
# отвечает «ноль склеек» — и это ложь о ролике. Разбирать надо содержимое
# экрана, а не кадр целиком.
#
# Ошибка, из-за которой скрипт появился (2026-11-01): разбор key-01..03 был
# сделан по внешнему кадру и дал «0 склеек, переходов нет». На самом деле
# внутри экрана полноценный рекламный ролик со своим монтажом.
#
# Что делает: режет прямоугольник, вытягивает яркость и контраст (экран снят
# камерой, он тусклый и с бликом — без вытяжки детектор склеек не срабатывает),
# приводит к CFR и кладёт результат как ОТДЕЛЬНЫЙ разбор <имя>-inner.
# Дальше по нему работают обычные scripts/style-teardown.sh и
# scripts/style-transitions.sh — своего разбора скрипт не делает.
# ══════════════════════════════════════════════════════════════
set -euo pipefail
cd "$(dirname "$0")/.."

NAME="${1:-}"
CROP="${2:-}"
if [ -z "$NAME" ] || [ -z "$CROP" ]; then
  echo "✗ Запуск: scripts/style-inner.sh <имя-разбора> <Ш:В:X:Y> [--gain N]"
  echo "  Прямоугольник снимается с полноразмерного кадра:"
  echo "  ffmpeg -ss 8 -i radar/style/<имя>/source.mp4 -frames:v 1 кадр.png"
  exit 1
fi
shift 2
GAIN=0.06
[ "${1:-}" = "--gain" ] && GAIN="${2:-0.06}"

case "$CROP" in
  [0-9]*:[0-9]*:[0-9]*:[0-9]*) ;;
  *) echo "✗ Прямоугольник пишется как Ш:В:X:Y, например 900:430:140:855"; exit 1 ;;
esac

SRC="radar/style/${NAME}/source.mp4"
[ -f "$SRC" ] || { echo "✗ Нет $SRC — сначала scripts/style-teardown.sh"; exit 1; }

OUTNAME="${NAME}-inner"
OUTDIR="radar/style/${OUTNAME}"
mkdir -p "$OUTDIR"

# Масштаб до 1280 по ширине: детектор склеек на мелком кадре даёт шум, а
# полный размер не нужен — внутри всё равно пересъёмка экрана.
# Порядок фильтров: crop → eq → scale → fps. Вытяжка ДО масштаба, иначе
# интерполяция размывает границы и всплеск на склейке становится пологим.
echo "→ Режу экран $CROP из $NAME, яркость +$GAIN"
ffmpeg -nostdin -hide_banner -loglevel error -i "$SRC" \
  -vf "crop=${CROP},eq=brightness=${GAIN}:contrast=1.30:saturation=1.08,scale=1280:-2:flags=lanczos,fps=30" \
  -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -movflags +faststart \
  -c:a copy -y "$OUTDIR/source.mp4"

W=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "$OUTDIR/source.mp4")
echo "✓ Экран вырезан: $OUTDIR/source.mp4 ($W)"
echo ""
echo "  Дальше обычным порядком:"
echo "    bash scripts/style-teardown.sh $OUTDIR/source.mp4 $OUTNAME --no-asr"
echo "    bash scripts/style-transitions.sh $OUTNAME --cuts 12"
echo "    bash scripts/style-grid.sh $OUTNAME 24 4"
