#!/usr/bin/env bash
. "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/tools/env.sh"   # прослойка окружения, см. tools/env.sh
# ─────────────────────────────────────────────────────────────────────────────
# qa-sheet.sh — КОНТАКТНЫЙ ЛИСТ для визуального контроля ролика.
#
# Зачем:
# раньше каждый проверяющий агент снимал кадры по одному — `npx remotion still`
# поднимает бандл заново, кадр стоит 30–40с, и каждый кадр уходил в контекст
# отдельной картинкой. На один ролик выходило под 20 запусков у верстальщика,
# столько же у терчека, плюс приёмка режиссёра — один и тот же кадр смотрели
# трижды. Здесь наоборот: ОДИН черновой рендер целиком → кадры режутся
# ffmpeg'ом мгновенно → склеиваются в СЕТКУ, которая читается одним взглядом.
#
# Бонус: тайлы делаются шириной 360px — это ровно «телефонный тест» правила
# темпа 13 (текст либо читается на 360px, либо он текстура). То есть сетка
# проверяет читаемость сама по себе, отдельный прогон не нужен.
#
# Рендера здесь больше НЕТ (правка 2026-10-12): режим `draft` убран, рендер
# живёт в `scripts/render.sh`. Причина — замер: черновик на scale 0.4 идёт
# столько же, сколько чистовик (узкое место — прогон React в браузере, а не
# пиксели), то есть ролик рендерился дважды без выигрыша. Контактный лист
# режется из ЧИСТОВОГО рендера, он же идёт в сдачу.
#
# Использование:
#   ./scripts/qa-sheet.sh sheet <video.mp4> "0,45,120,260" [out.png] [колонок]
#       контактный лист из перечисленных КАДРОВ (не секунд)
#
#   ./scripts/qa-sheet.sh auto <video.mp4> [шаг_в_кадрах] [out.png]
#       контактный лист по всему ролику с равным шагом (по умолчанию 60 = 2с)
#
# После сетки в ПОЛНОМ размере смотрятся только те 2–3 кадра, где видно
# неладное: `ffmpeg -ss <кадр/30> -i <video> -frames:v 1 /tmp/x.png`
#
# Грабля сборки ffmpeg на этой машине: фильтр drawtext НЕ собран (нет
# libfreetype), поэтому подписи кадров и сама сетка клеятся Python+PIL.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

PROJ="$(cd "$(dirname "$0")/.." && pwd)"
TILE_W=360

# fps раньше был захардкожен (30) — с 2026-09-04 новые ролики 60fps,
# поэтому читаем реальный fps из самого видео (как в qa-auto.sh).
fps_of () {
  local video="$1"
  local raw; raw="$(ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate -of csv=p=0 "$video" | tr -d ',[:space:]')"
  python3 -c "n,d=('$raw'.split('/')+['1'])[:2]; print(round(float(n)/float(d)))"
}

usage () { sed -n '3,36p' "$0"; exit 1; }
[[ $# -lt 1 ]] && usage
MODE="$1"; shift

# ── Режим draft убран: рендер переехал в scripts/render.sh ───────────────────
if [[ "$MODE" == "draft" ]]; then
  echo "Режим draft убран 2026-10-12: черновой рендер шёл столько же, сколько" >&2
  echo "чистовой, и ролик рендерился дважды. Теперь один рендер на всё:" >&2
  echo "  ./scripts/render.sh ${1:-<CompositionId>}" >&2
  echo "а контактный лист режется из него: ./scripts/qa-sheet.sh auto <out.mp4> 70" >&2
  exit 1
fi

# ── Общая часть: вынуть кадры и склеить сетку ────────────────────────────────
build_sheet () {
  local VIDEO="$1" FRAMES="$2" OUT="$3" COLS="$4"
  local FPS; FPS="$(fps_of "$VIDEO")"
  local TMP; TMP="$(mktemp -d)"

  local i=0
  IFS=',' read -ra ARR <<< "$FRAMES"
  for f in "${ARR[@]}"; do
    f="$(echo "$f" | tr -d ' ')"
    [[ -z "$f" ]] && continue
    local t; t="$(python3 -c "print($f/$FPS)")"
    ffmpeg -v error -ss "$t" -i "$VIDEO" -frames:v 1 \
      -vf "scale=${TILE_W}:-1" "$TMP/$(printf '%03d' $i)_f${f}.png" -y
    i=$((i+1))
  done
  [[ $i -eq 0 ]] && { echo "Кадры не заданы"; rm -rf "$TMP"; exit 1; }

  python3 - "$TMP" "$OUT" "$COLS" <<'PY'
import os, re, sys
from PIL import Image, ImageDraw, ImageFont

tmp, out, cols = sys.argv[1], sys.argv[2], int(sys.argv[3])
files = sorted(f for f in os.listdir(tmp) if f.endswith('.png'))
if not files:
    raise SystemExit('нет кадров')

tiles, labels = [], []
for name in files:
    tiles.append(Image.open(os.path.join(tmp, name)).convert('RGB'))
    m = re.search(r'_f(\d+)\.png$', name)
    labels.append('f' + m.group(1) if m else '')

tw, th = tiles[0].size
pad, margin = 8, 8
rows = (len(tiles) + cols - 1) // cols
W = margin * 2 + cols * tw + (cols - 1) * pad
H = margin * 2 + rows * th + (rows - 1) * pad
sheet = Image.new('RGB', (W, H), (32, 32, 32))

try:
    font = ImageFont.truetype(os.environ.get('RC_QA_FONT', '/System/Library/Fonts/Supplemental/Arial Bold.ttf'), 22)
except OSError:
    font = ImageFont.load_default()

draw = ImageDraw.Draw(sheet)
for idx, (tile, label) in enumerate(zip(tiles, labels)):
    r, c = divmod(idx, cols)
    x = margin + c * (tw + pad)
    y = margin + r * (th + pad)
    sheet.paste(tile, (x, y))
    # плашка с номером кадра — иначе на сетке не понять, что где
    draw.rectangle([x + 6, y + 6, x + 6 + 11 * len(label) + 12, y + 36], fill=(0, 0, 0))
    draw.text((x + 12, y + 10), label, fill=(255, 255, 255), font=font)

sheet.save(out)
print(f'  тайл {tw}×{th}, сетка {cols}×{rows}, кадров {len(tiles)}')
PY

  rm -rf "$TMP"
  echo "✓ Контактный лист: $OUT  (тайл ${TILE_W}px = телефонный тест правила 13)"
}

if [[ "$MODE" == "sheet" ]]; then
  [[ $# -lt 2 ]] && usage
  VIDEO="$1"; FRAMES="$2"
  # Имя по умолчанию — от входного видео: параллельные сборки роликов
  # не перетирают контактные листы друг друга.
  OUT="${3:-$PROJ/engine/out/qa-sheet-$(basename "${VIDEO%.*}").png}"
  COLS="${4:-4}"
  build_sheet "$VIDEO" "$FRAMES" "$OUT" "$COLS"
  exit 0
fi

if [[ "$MODE" == "auto" ]]; then
  [[ $# -lt 1 ]] && usage
  VIDEO="$1"
  STEP="${2:-60}"
  OUT="${3:-$PROJ/engine/out/qa-sheet-auto-$(basename "${VIDEO%.*}").png}"
  FPS="$(fps_of "$VIDEO")"
  DUR="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$VIDEO")"
  TOTAL="$(python3 -c "print(int(float($DUR)*$FPS))")"
  FRAMES="$(python3 -c "print(','.join(str(f) for f in range(0, $TOTAL, $STEP)))")"
  build_sheet "$VIDEO" "$FRAMES" "$OUT" 5
  exit 0
fi

usage
