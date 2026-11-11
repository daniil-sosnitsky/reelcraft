#!/usr/bin/env bash
. "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/tools/env.sh"   # прослойка окружения, см. tools/env.sh
# ══════════════════════════════════════════════════════════════
# style-teardown.sh (reelcraft) — разобрать ОДИН чужой ролик на стиль.
# Запуск: scripts/style-teardown.sh <ссылка|файл> <имя-разбора> [--no-asr]
#
# Зачем. «Нравится, как сделано» — не инструкция. Чтобы перенести чужую
# подачу в наш конвейер, её надо превратить в числа и кадры: где режут, как
# часто, чем заполнен кадр, сколько слов в минуту, когда случается первое
# событие. Скрипт добывает именно это и складывает в одну папку, которую
# дальше читает глазами модель (кадры) и человек (выводы).
#
# Что НЕ делает: не судит о стиле. Числа и кадры — это вход для разбора,
# а не сам разбор.
#
# На выходе radar/style/<имя>/:
#   source.mp4      исходник (скачанный или скопированный)
#   metrics.md      техника, ритм монтажа, речь, звук — числами
#   cuts.txt        таймкоды всех склеек
#   sheet-shots.png контактный лист: ПО КАДРУ ИЗ КАЖДОГО ПЛАНА
#   sheet-hook.png  первая секунда по 0.1с — где первое событие (правило 29)
#   palette.png     палитра ролика (16 цветов)
#   transcript.txt  расшифровка речи с таймингами
# ══════════════════════════════════════════════════════════════
set -euo pipefail
cd "$(dirname "$0")/.."

INPUT="${1:-}"
NAME="${2:-}"
ASR=1
[ "${3:-}" = "--no-asr" ] && ASR=0
if [ -z "$INPUT" ] || [ -z "$NAME" ]; then
  echo "✗ Запуск: scripts/style-teardown.sh <ссылка|файл> <имя-разбора> [--no-asr]"
  exit 1
fi
case "$NAME" in
  *[!a-z0-9-]*) echo "✗ Имя разбора — только строчная латиница, цифры и дефис"; exit 1 ;;
esac

DIR="radar/style/${NAME}"
mkdir -p "$DIR"
SRC="$DIR/source.mp4"

# ── 1. источник: ссылка качается yt-dlp, файл копируется ─────────────────────
if [ -f "$INPUT" ]; then
  echo "→ Беру файл: $INPUT"
  cp -f "$INPUT" "$SRC"
else
  echo "→ Качаю по ссылке (yt-dlp)…"
  # Склейка лучшего видео и аудио в mp4: дальше всё считается по одному файлу.
  "$RC_PY" -m yt_dlp -q --no-warnings \
    -f 'bv*+ba/b' --merge-output-format mp4 \
    -o "$SRC" "$INPUT" \
    || { echo "✗ Не скачалось. Приватный аккаунт или нужна авторизация — пришли файлом."; exit 1; }
fi
[ -s "$SRC" ] || { echo "✗ Пустой источник"; exit 1; }

# ── 2. техника ───────────────────────────────────────────────────────────────
read -r W H FPS_R <<EOF
$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate -of csv=p=0 "$SRC" | tr ',' ' ')
EOF
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$SRC")
BITRATE=$(ffprobe -v error -show_entries format=bit_rate -of csv=p=0 "$SRC")
FPS=$(awk -F/ -v r="$FPS_R" 'BEGIN{split(r,a,"/"); printf "%.2f", a[1]/a[2]}')
echo "→ ${W}×${H}, ${FPS} fps, ${DUR%.*}с"

# ── 3. ритм монтажа ──────────────────────────────────────────────────────────
# Порог 0.35 ловит смену плана, но не реагирует на движение внутри кадра.
echo "→ Считаю склейки…"
ffmpeg -nostdin -hide_banner -i "$SRC" \
  -vf "select='gt(scene,0.35)',metadata=print:file=-" -an -f null - 2>/dev/null \
  | grep -oE 'pts_time:[0-9.]+' | cut -d: -f2 > "$DIR/_cuts.raw" || true
CUTS=$(wc -l < "$DIR/_cuts.raw" | tr -d ' ')
# Склейки + начало ролика = число планов.
SHOTS=$((CUTS + 1))
CPM=$(awk -v c="$CUTS" -v d="$DUR" 'BEGIN{printf "%.1f", c/(d/60)}')
AVG_SHOT=$(awk -v s="$SHOTS" -v d="$DUR" 'BEGIN{printf "%.2f", d/s}')

# Самый короткий и самый длинный план — показывают, есть ли «очередь»
# быстрых кадров и где ролик даёт зрителю выдохнуть.
{ echo "0.000"; cat "$DIR/_cuts.raw"; echo "$DUR"; } | awk '
  NR>1 { d=$1-prev; printf "%.2f\n", d } { prev=$1 }' | sort -n > "$DIR/_shotlens.raw"
MIN_SHOT=$(head -1 "$DIR/_shotlens.raw")
MAX_SHOT=$(tail -1 "$DIR/_shotlens.raw")

# «Шевеление» кадра: сколько кадров в минуту вообще заметно меняются.
# Низкий порог 0.08 реагирует на движение внутри плана — это и есть разница
# между живым кадром и стоящей карточкой с текстом.
CHURN=$(ffmpeg -nostdin -hide_banner -i "$SRC" \
  -vf "select='gt(scene,0.08)',metadata=print:file=-" -an -f null - 2>/dev/null \
  | grep -c 'pts_time' || true)
CHURN_PM=$(awk -v c="$CHURN" -v d="$DUR" 'BEGIN{printf "%.0f", c/(d/60)}')

{ echo "# Склейки, с"; cat "$DIR/_cuts.raw"; } > "$DIR/cuts.txt"

# ── 4. контактный лист ПО ПЛАНАМ ─────────────────────────────────────────────
# Равномерная сетка врёт: на быстром монтаже она пропускает планы, на
# медленном показывает один и тот же кадр шесть раз. Берём по кадру из
# каждого плана — через 0.25с после склейки (переход успел закончиться).
echo "→ Снимаю по кадру из каждого плана ($SHOTS)…"
rm -rf "$DIR/_shots"; mkdir -p "$DIR/_shots"
i=0
{ echo "0.000"; cat "$DIR/_cuts.raw"; } | while read -r T; do
  i=$((i+1))
  [ "$i" -gt 48 ] && break   # больше 48 планов в сетку не влезет осмысленно
  AT=$(awk -v t="$T" 'BEGIN{printf "%.3f", t+0.25}')
  ffmpeg -nostdin -y -loglevel error -ss "$AT" -i "$SRC" \
    -frames:v 1 -vf "scale=240:-2" "$(printf "%s/_shots/%03d.png" "$DIR" "$i")" 2>/dev/null || true
done
SHEET_N=$(ls "$DIR/_shots"/*.png 2>/dev/null | wc -l | tr -d ' ')
if [ "$SHEET_N" -gt 0 ]; then
  COLS=6
  ROWS=$(( (SHEET_N + COLS - 1) / COLS ))
  # Вход нумерованной последовательностью, а не glob: сборка ffmpeg под
  # Windows собрана без поддержки glob, и -pattern_type glob там молча
  # отдаёт пустой вход (проверено 2026-11-01 — лист не собирался вообще).
  ffmpeg -nostdin -y -loglevel error -framerate 1 -start_number 1 \
    -i "$DIR/_shots/%03d.png" \
    -vf "tile=${COLS}x${ROWS}:margin=4:padding=4:color=0x202020" \
    -frames:v 1 "$DIR/sheet-shots.png" || echo "  (контактный лист по планам не собрался)"
fi

# ── 5. хук: первая секунда по 0.1с ───────────────────────────────────────────
# Правило 29 читается только здесь: видно, на каком кадре начинается первое
# событие и успевает ли оно до f8.
ffmpeg -nostdin -y -loglevel error -t 1.2 -i "$SRC" \
  -vf "fps=10,scale=240:-2,tile=6x2:margin=4:padding=4:color=0x202020" \
  -frames:v 1 "$DIR/sheet-hook.png" 2>/dev/null || true

# ── 6. палитра ───────────────────────────────────────────────────────────────
ffmpeg -nostdin -y -loglevel error -i "$SRC" \
  -vf "fps=2,scale=160:-2,palettegen=max_colors=16" "$DIR/palette.png" 2>/dev/null || true

# ── 7. звук и речь ───────────────────────────────────────────────────────────
HAS_AUDIO=$(ffprobe -v error -select_streams a -show_entries stream=codec_type -of csv=p=0 "$SRC" | head -1 || true)
LUFS="—"; WORDS="—"; WPM="—"
if [ -n "$HAS_AUDIO" ]; then
  ffmpeg -nostdin -y -loglevel error -i "$SRC" -vn -ar 48000 -ac 1 "$DIR/_audio.wav"
  LUFS=$(ffmpeg -nostdin -hide_banner -i "$DIR/_audio.wav" -af ebur128=framelog=quiet -f null - 2>&1 \
         | grep -A1 "Integrated loudness" | grep "I:" | awk '{print $2}' || echo "—")
  if [ "$ASR" -eq 1 ]; then
    MODELS_DIR="${WHISPER_MODELS_DIR:-$HOME/.cache/whisper-models}"
    MODEL="${WHISPER_MODEL:-$MODELS_DIR/ggml-large-v3-turbo.bin}"
    if [ -f "$MODEL" ] && command -v whisper-cli >/dev/null; then
      echo "→ Расшифровываю речь…"
      ffmpeg -nostdin -y -loglevel error -i "$DIR/_audio.wav" -ar 16000 -ac 1 "$DIR/_w16.wav"
      whisper-cli -m "$MODEL" -l auto -oj -of "$DIR/_w" "$DIR/_w16.wav" >/dev/null 2>&1 || true
      if [ -s "$DIR/_w.json" ]; then
        "$RC_PY" - "$DIR/_w.json" "$DIR/transcript.txt" <<'PY'
import json, sys
src, dst = sys.argv[1], sys.argv[2]
d = json.load(open(src, encoding='utf-8'))
segs = d.get('transcription', [])
with open(dst, 'w', encoding='utf-8') as f:
    for s in segs:
        t = s.get('timestamps', {}).get('from', '')
        f.write(f"[{t}] {s.get('text','').strip()}\n")
print(sum(len(s.get('text','').split()) for s in segs))
PY
        WORDS=$("$RC_PY" - "$DIR/_w.json" <<'PY'
import json, sys
d = json.load(open(sys.argv[1], encoding='utf-8'))
print(sum(len(s.get('text','').split()) for s in d.get('transcription', [])))
PY
)
        WPM=$(awk -v w="$WORDS" -v d="$DUR" 'BEGIN{printf "%.0f", w/(d/60)}')
      fi
      rm -f "$DIR/_w16.wav"
    else
      echo "  (whisper недоступен — речь не расшифрована)"
    fi
  fi
fi

# ── 8. отчёт ─────────────────────────────────────────────────────────────────
cat > "$DIR/metrics.md" <<MD
# Разбор стиля: ${NAME}

Собрано \`scripts/style-teardown.sh\` $(date '+%Y-%m-%d %H:%M'). Числа — машина,
выводы — отдельно. Источник: \`${INPUT}\`

## Техника

| | |
|---|---|
| Кадр | ${W}×${H} |
| Частота | ${FPS} fps |
| Длительность | ${DUR%.*} с |
| Битрейт | $(awk -v b="${BITRATE:-0}" 'BEGIN{printf "%.1f", b/1000000}') Мбит/с |

## Ритм монтажа

| | | наша норма |
|---|---|---|
| Планов | ${SHOTS} | 8–12 на 40–45с |
| Склеек в минуту | ${CPM} | video-17: 2.0 · video-18: 4.5 |
| Средний план | ${AVG_SHOT} с | — |
| Самый короткий план | ${MIN_SHOT} с | — |
| Самый длинный план | ${MAX_SHOT} с | — |
| Шевеление кадра (заметных смен/мин) | ${CHURN_PM} | — |

Таймкоды склеек — \`cuts.txt\`.

## Речь и звук

| | |
|---|---|
| Громкость | ${LUFS} LUFS |
| Слов | ${WORDS} |
| Темп речи | ${WPM} слов/мин |

## Что смотреть глазами

- \`sheet-shots.png\` — по кадру из каждого плана. Отвечает на вопрос «из чего
  вообще собран ролик»: живая съёмка, экран, графика, текст.
- \`sheet-hook.png\` — первая секунда по 0.1с. Видно, на каком кадре начинается
  первое событие (наше правило 29 требует до f8 = 0.27с).
- \`palette.png\` — 16 цветов ролика.
- \`transcript.txt\` — речь с таймингами: длина хука, структура.
MD

rm -f "$DIR/_audio.wav" "$DIR/_w.json" "$DIR/_cuts.raw" "$DIR/_shotlens.raw"
rm -rf "$DIR/_shots"

echo ""
echo "✓ Разбор готов: $DIR"
echo "  ${SHOTS} планов, ${CPM} склеек/мин, средний план ${AVG_SHOT}с, темп речи ${WPM} слов/мин"
echo "  Смотреть: $DIR/sheet-shots.png, $DIR/sheet-hook.png, $DIR/metrics.md"
