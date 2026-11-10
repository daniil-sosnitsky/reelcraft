#!/usr/bin/env bash
. "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/tools/env.sh"   # прослойка окружения, см. tools/env.sh
# ══════════════════════════════════════════════════════════════
# style-grid.sh (reelcraft) — равномерный контактный лист разбора.
# Запуск: scripts/style-grid.sh <имя-разбора> [кадров] [столбцов] [--from С] [--to С]
#
# Зачем, если есть sheet-shots.png. Тот лист строится ПО СКЛЕЙКАМ: кадр из
# середины каждого плана. Для ролика, смонтированного резкой, это идеальный
# разрез. Но ролик может быть собран БЕЗ склеек — на непрерывной
# трансформации (замер 2026-11-01: в разборах key-00 и key-01 детектор не
# нашёл ни одной жёсткой склейки на 25 и 22 секунды). Тогда лист планов
# вырождается в одну картинку и не показывает ничего.
#
# Поэтому второй разрез — по равномерной сетке времени. Он не знает про
# монтаж и именно поэтому работает всегда: видно, как кадр меняется сам по
# себе, где фон переворачивается, когда появляется и уходит типографика.
#
# Диапазон --from/--to нужен, чтобы разглядывать кусок подробно: тот же
# инструмент на 2 секундах даёт плёнку одной фазы анимации.
# ══════════════════════════════════════════════════════════════
set -euo pipefail
cd "$(dirname "$0")/.."

NAME="${1:-}"
if [ -z "$NAME" ]; then
  echo "✗ Запуск: scripts/style-grid.sh <имя-разбора> [кадров] [столбцов] [--from С] [--to С]"
  exit 1
fi
N="${2:-12}"
COLS="${3:-4}"
shift $(( $# > 3 ? 3 : $# ))
FROM=""; TO=""
while [ $# -gt 0 ]; do
  case "$1" in
    --from) FROM="${2:-}"; shift 2 ;;
    --to)   TO="${2:-}"; shift 2 ;;
    *) shift ;;
  esac
done

DIR="radar/style/${NAME}"
SRC="$DIR/source.mp4"
[ -f "$SRC" ] || { echo "✗ Нет $SRC — сначала scripts/style-teardown.sh"; exit 1; }

DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$SRC")
A="${FROM:-0}"
B="${TO:-$DUR}"
SPAN=$(awk -v a="$A" -v b="$B" 'BEGIN{printf "%.4f", b - a}')
awk -v s="$SPAN" 'BEGIN{exit !(s > 0)}' || { echo "✗ Пустой диапазон"; exit 1; }

ROWS=$(( (N + COLS - 1) / COLS ))
OUT="$DIR/grid.png"
[ -n "$FROM$TO" ] && OUT="$DIR/grid-${A}-${B}.png"

TMP="$DIR/_grid"
mkdir -p "$TMP"; rm -f "$TMP"/*.png 2>/dev/null || true

# fps считается так, чтобы ровно N кадров легли на диапазон: N/SPAN.
# -ss ПЕРЕД -i — быстрый поиск; точность до кадра здесь не нужна.
RATE=$(awk -v n="$N" -v s="$SPAN" 'BEGIN{printf "%.6f", n / s}')
ffmpeg -nostdin -hide_banner -loglevel error \
  -ss "$A" -i "$SRC" -t "$SPAN" \
  -vf "fps=${RATE},scale=320:-2" -frames:v "$N" "$TMP/%03d.png"

# Грабля (2026-11-01): -pattern_type glob в этой сборке ffmpeg молча даёт
# пустой вход. Только нумерованная последовательность со -start_number.
ffmpeg -nostdin -hide_banner -loglevel error \
  -framerate 1 -start_number 1 -i "$TMP/%03d.png" -frames:v 1 \
  -vf "tile=${COLS}x${ROWS}:margin=4:padding=4:color=0x303030" "$OUT"

rm -rf "$TMP"
echo "✓ $OUT — ${N} кадров, сетка ${COLS}×${ROWS}, диапазон ${A}–${B} с"
