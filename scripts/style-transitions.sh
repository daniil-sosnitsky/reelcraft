#!/usr/bin/env bash
. "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/tools/env.sh"   # прослойка окружения, см. tools/env.sh
# ══════════════════════════════════════════════════════════════
# style-transitions.sh (reelcraft) — разобрать ПЕРЕХОДЫ чужого ролика.
# Запуск: scripts/style-transitions.sh <имя-разбора> [--cuts N] [--pre N] [--post N]
#   --cuts N      сколько склеек разобрать (по умолчанию 12, 0 = все)
#   --pre/--post  сколько кадров брать до и после склейки (по умолчанию 3 и 3)
#
# Зачем отдельный скрипт. style-teardown.sh даёт контактный лист ПО ПЛАНАМ —
# по одному кадру из середины каждого плана. На нём видно композицию,
# типографику и палитру, но переход не виден вообще: он живёт в 3-8 кадрах
# НА СТЫКЕ, которые лист планов как раз и пропускает. Поэтому «какие у них
# переходы» по листу планов определить физически нельзя — нужна покадровая
# плёнка вокруг каждой склейки, и это она.
#
# Второй выход — профиль склейки числами (scdet.txt). Детектор даёт оценку
# различия для КАЖДОГО кадра, и по форме всплеска тип склейки читается
# однозначно, без угадывания по картинке:
#   один кадр с оценкой 40-100          -> жёсткая склейка
#   4-12 кадров подряд по 5-20          -> растворение / засветка
#   всплеск + высокие оценки до него    -> замах камерой (whip), смаз в кадре
#   всплеск при почти одинаковых кадрах -> наезд рывком (punch-in)
#
# На выходе radar/style/<имя>/:
#   transitions/NN.png   плёнка по каждой склейке (pre+post кадров в ряд)
#   transitions.png      сводный лист: все склейки, по ряду на склейку
#   scdet.txt            оценка различия по каждому кадру
#   transitions.md       профиль каждой склейки с типом, посчитанным по scdet
# ══════════════════════════════════════════════════════════════
set -euo pipefail
cd "$(dirname "$0")/.."

NAME="${1:-}"
if [ -z "$NAME" ]; then
  echo "✗ Запуск: scripts/style-transitions.sh <имя-разбора> [--cuts N] [--pre N] [--post N]"
  exit 1
fi
shift
MAXCUTS=12; PRE=3; POST=3
while [ $# -gt 0 ]; do
  case "$1" in
    --cuts) MAXCUTS="${2:-12}"; shift 2 ;;
    --pre)  PRE="${2:-3}"; shift 2 ;;
    --post) POST="${2:-3}"; shift 2 ;;
    *) echo "✗ Неизвестная опция: $1"; exit 1 ;;
  esac
done

DIR="radar/style/${NAME}"
SRC="$DIR/source.mp4"
CUTS="$DIR/cuts.txt"
[ -f "$SRC" ]  || { echo "✗ Нет $SRC — сначала scripts/style-teardown.sh"; exit 1; }
[ -f "$CUTS" ] || { echo "✗ Нет $CUTS — сначала scripts/style-teardown.sh"; exit 1; }

# Частота кадров нужна точной дробью: по ней время склейки переводится в номер
# кадра. r_frame_rate у Instagram-выгрузок бывает 30000/1001, и округление
# «примерно 30» на 40-й секунде уже уводит на кадр в сторону.
FPS_R=$(ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate -of csv=p=0 "$SRC")
FPS=$(awk -v r="$FPS_R" 'BEGIN{split(r,a,"/"); printf "%.6f", a[2]?a[1]/a[2]:a[1]}')
echo "→ $NAME: ${FPS} fps"

mkdir -p "$DIR/transitions" "$DIR/_tframes"
rm -f "$DIR/transitions/"*.png "$DIR/_tframes/"*.png 2>/dev/null || true

# ── 1. оценка различия по каждому кадру ──────────────────────────────────────
# scdet с порогом 0 ничего не вырезает, а только печатает оценку: нужна вся
# кривая, включая низкие значения внутри растворения.
# Грабля: metadata=print пишет в stderr у этой сборки — поэтому 2>&1, а не -v.
ffmpeg -nostdin -hide_banner -i "$SRC" \
  -vf "scdet=threshold=0,metadata=print:file=-" -f null - 2>&1 \
  | awk '
      /pts_time:/ { for (i = 1; i <= NF; i++) if ($i ~ /^pts_time:/) { split($i, a, ":"); t = a[2] } }
      /lavfi\.scd\.score=/ { split($0, b, "="); printf "%.4f %.2f\n", t, b[2] }
    ' > "$DIR/scdet.txt" || true
SCN=$(wc -l < "$DIR/scdet.txt")
echo "→ Оценка различия снята по $SCN кадрам"

# ── 2. список склеек ─────────────────────────────────────────────────────────
mapfile -t ALL < <(grep -v '^#' "$CUTS" | grep -v '^[[:space:]]*$')
TOTAL=${#ALL[@]}
[ "$TOTAL" -gt 0 ] || { echo "✗ В cuts.txt нет склеек"; exit 1; }
if [ "$MAXCUTS" -gt 0 ] && [ "$TOTAL" -gt "$MAXCUTS" ]; then
  # Склейки берутся РАВНОМЕРНО по всему ролику, а не первые N: у первых планов
  # свой монтаж (хук), по ним нельзя судить о переходах середины и финала.
  mapfile -t CUTLIST < <(printf '%s\n' "${ALL[@]}" \
    | awk -v n="$MAXCUTS" -v t="$TOTAL" '{i = int(NR * n / t); if (i != p) { print; p = i }}')
else
  CUTLIST=("${ALL[@]}")
fi
NCUT=${#CUTLIST[@]}
echo "→ Разбираю $NCUT склеек из $TOTAL"

# ── 3. плёнка вокруг каждой склейки ──────────────────────────────────────────
# Один проход по файлу на все склейки: выражение select по номерам кадров.
# Покадровый -ss на каждый кадр был бы в десятки раз дольше.
STEP=$((PRE + POST))
EXPR=""
IDX=0
: > "$DIR/transitions-map.txt"
for T in "${CUTLIST[@]}"; do
  N0=$(awk -v t="$T" -v f="$FPS" 'BEGIN{printf "%d", t * f + 0.5}')
  A=$((N0 - PRE)); [ "$A" -lt 0 ] && A=0
  B=$((A + STEP - 1))
  EXPR="${EXPR:+$EXPR+}between(n,$A,$B)"
  IDX=$((IDX + 1))
  printf '%02d  t=%s  кадр %d  (%d..%d)\n' "$IDX" "$T" "$N0" "$A" "$B" >> "$DIR/transitions-map.txt"
done

# scale до 240 по ширине: на ряду из шести кадров различимо движение и смаз, а
# полный размер превратил бы сводный лист в мегабайты, которые незачем смотреть.
ffmpeg -nostdin -hide_banner -loglevel error -i "$SRC" \
  -vf "select='${EXPR}',scale=240:-2,setpts=N/TB" -fps_mode passthrough \
  "$DIR/_tframes/%04d.png"

GOT=$(ls "$DIR/_tframes/"*.png 2>/dev/null | wc -l)
echo "→ Кадров вытащено: $GOT (ожидалось ~$((NCUT * STEP)))"

# ── 4. ряд на каждую склейку + сводный лист ──────────────────────────────────
# Грабля (2026-11-01): -pattern_type glob в этой сборке ffmpeg молча даёт
# пустой вход. Только нумерованная последовательность со -start_number.
i=1
while [ "$i" -le "$NCUT" ]; do
  START=$(( (i - 1) * STEP + 1 ))
  ffmpeg -nostdin -hide_banner -loglevel error \
    -framerate 1 -start_number "$START" -i "$DIR/_tframes/%04d.png" \
    -frames:v 1 -vf "tile=${STEP}x1:margin=2:padding=2:color=0x101010" \
    "$(printf '%s/transitions/%02d.png' "$DIR" "$i")" \
    || echo "  (ряд $i не собрался)"
  i=$((i + 1))
done

# Сводный лист клеится из готовых рядов: глобальный tile не годится, у него
# нумерация идёт подряд и ряды разъехались бы по склейкам.
ROWS=$(ls "$DIR/transitions/"*.png 2>/dev/null | wc -l)
if [ "$ROWS" -gt 0 ]; then
  ffmpeg -nostdin -hide_banner -loglevel error \
    -framerate 1 -start_number 1 -i "$DIR/transitions/%02d.png" \
    -frames:v 1 -vf "tile=1x${ROWS}:margin=4:padding=6:color=0x303030" \
    "$DIR/transitions.png" || echo "  (сводный лист не собрался)"
fi

# ── 5. профиль каждой склейки числами ────────────────────────────────────────
{
  echo "# Переходы — $NAME"
  echo ""
  echo "Тип считается по форме всплеска в scdet.txt, окно +-6 кадров от склейки."
  echo "Пик — максимальная оценка различия; «кадров >4» — ширина всплеска."
  echo ""
  echo "| № | Время, с | Пик | Кадров >4 | До склейки >4 | Тип по профилю |"
  echo "|---|---|---|---|---|---|"
  i=1
  for T in "${CUTLIST[@]}"; do
    awk -v t="$T" -v f="$FPS" -v i="$i" '
      BEGIN { win = 6 / f; peak = 0; wide = 0; pre = 0 }
      {
        if ($1 >= t - win && $1 <= t + win) {
          if ($2 > peak) peak = $2
          if ($2 > 4) wide++
          if ($1 < t - 0.5 / f && $2 > 4) pre++
        }
      }
      END {
        type = "жёсткая склейка"
        if (wide >= 4 && peak < 30)     type = "растворение / засветка"
        else if (wide >= 3 && pre >= 2) type = "замах камерой, смаз"
        else if (peak < 12)             type = "мягкая смена внутри плана"
        printf "| %02d | %.2f | %.1f | %d | %d | %s |\n", i, t, peak, wide, pre, type
      }
    ' "$DIR/scdet.txt"
    i=$((i + 1))
  done
} > "$DIR/transitions.md"

rm -rf "$DIR/_tframes"
echo ""
echo "✓ Переходы разобраны:"
echo "  $DIR/transitions.png       — сводный лист, ряд на склейку (СМОТРЕТЬ ГЛАЗАМИ)"
echo "  $DIR/transitions.md        — тип каждой склейки по профилю scdet"
echo "  $DIR/transitions-map.txt   — какой ряд какой склейке соответствует"
