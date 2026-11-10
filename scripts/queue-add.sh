#!/usr/bin/env bash
. "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/tools/env.sh"   # прослойка окружения, см. tools/env.sh
# ══════════════════════════════════════════════════════════════
# queue-add.sh (reelcraft) — завести слот очереди под один ролик.
# Запуск: scripts/queue-add.sh inbox/NAME-prep.mp4 [NN]
# Делает: голос −14 LUFS (wav) → whisper-cli транскрипция (ru, пословно)
#         → transcript.json + captions.generated.ts + meta.txt.
# Сториборд, вёрстка и вычитка субтитров — за агентом (см. CLAUDE.md).
# ══════════════════════════════════════════════════════════════
set -euo pipefail
cd "$(dirname "$0")/.."

# Модель: large-v3-turbo — на терминах заметно точнее small («AI-агент»
# вместо «я агент», «ТикТок», «Телеграм-канале»; 43с звука ≈ 30с обработки),
# фолбэк на small, если turbo не скачана.
# Где лежат модели whisper.cpp — задаётся при установке (INSTALL.md).
MODELS_DIR="${WHISPER_MODELS_DIR:-$HOME/.cache/whisper-models}"
if [ -z "${WHISPER_MODEL:-}" ]; then
  if [ -f "$MODELS_DIR/ggml-large-v3-turbo.bin" ]; then WHISPER_MODEL="$MODELS_DIR/ggml-large-v3-turbo.bin"
  else WHISPER_MODEL="$MODELS_DIR/ggml-small.bin"; echo "  (модели turbo нет — беру small)"; fi
fi
WHISPER_LANG="${WHISPER_LANG:-ru}"   # язык транскрипции; EN-озвучка → WHISPER_LANG=en
# Глоссарий терминов канала — подсказка whisper (initial prompt), чтобы не
# слышать «скелла для клада» вместо «скилла для Клода». Новые термины —
# дописывать в scripts/whisper-glossary.txt (одна строка, до ~200 слов).
WHISPER_GLOSSARY="${WHISPER_GLOSSARY:-scripts/whisper-glossary.txt}"
WHISPER_PROMPT=""
[ -f "$WHISPER_GLOSSARY" ] && WHISPER_PROMPT="$(tr '\n' ' ' < "$WHISPER_GLOSSARY")"
[ -f "$WHISPER_MODEL" ] || { echo "✗ Нет модели whisper: $WHISPER_MODEL"; exit 1; }
command -v whisper-cli >/dev/null || { echo "✗ Нет whisper-cli (brew install whisper-cpp)"; exit 1; }

FILE="${1:-}"
[ -n "$FILE" ] && [ -f "$FILE" ] || { echo "✗ Укажи файл: scripts/queue-add.sh inbox/NAME-prep.mp4 [NN]"; exit 1; }

# ── номер слота: аргумент → из имени файла (с защитой) → следующий свободный ──
NN="${2:-}"
if [ -z "$NN" ]; then
  FROM_NAME=$(basename "$FILE" | grep -oE '[0-9]{2,3}' | tail -1 || true)
  LAST_ARCH=$(ls past-videos/video-* 2>/dev/null | sed -E 's/.*video-([0-9]+).*/\1/' | sort -n | tail -1 || true)
  LAST_QUEUE=$(ls -d queue/video-* 2>/dev/null | sed -E 's/.*video-([0-9]+)/\1/' | sort -n | tail -1 || true)
  LAST=$(printf '%s\n%s\n0\n' "${LAST_ARCH:-0}" "${LAST_QUEUE:-0}" | sort -n | tail -1)
  if [ -n "$FROM_NAME" ] && [ "$FROM_NAME" -gt "$LAST" ] 2>/dev/null && [ "$FROM_NAME" -le $((LAST + 20)) ]; then
    NN="$FROM_NAME"
  else
    NN=$((LAST + 1))
  fi
fi
SLOT="queue/video-${NN}"
# mkdir без -p = атомарный захват слота: две параллельные сессии не могут
# завести один номер (вторая получит отказ, а не молча продолжит в чужом).
mkdir -p queue
mkdir "$SLOT" 2>/dev/null || { echo "✗ Слот уже существует (возможно, занят параллельной сессией): $SLOT — передай другой номер явно: scripts/queue-add.sh <файл> <NN>"; exit 1; }
echo "→ Слот video-${NN}: $(basename "$FILE")"

# ── авточистка при ошибке: временные файлы всегда, а если слот не дошёл до
# meta.txt (значит обработка прервалась на середине) — весь недоделанный слот.
cleanup_on_fail() {
  local code=$?
  if [ "$code" -ne 0 ]; then
    rm -f "$SLOT/_raw-audio.wav" "$SLOT/_w16.wav" "$SLOT/_whisper.json"
    if [ ! -f "$SLOT/meta.txt" ]; then
      echo "✗ Обработка прервана (код $code) — удаляю недоделанный слот: $SLOT" >&2
      rm -rf "$SLOT"
    fi
  fi
  exit "$code"
}
trap cleanup_on_fail EXIT

# ── 1. голос: извлечь и нормализовать до −14 LUFS (wav 48k — вход Remotion) ───
TMPA="$SLOT/_raw-audio.wav"
ffmpeg -y -loglevel error -i "$FILE" -vn -acodec pcm_s16le -ar 48000 "$TMPA"
MEAS=$(ffmpeg -hide_banner -i "$TMPA" \
       -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 \
       | tr -d ' \t",' | grep -E '^(input_i|input_tp|input_lra|input_thresh|target_offset):')
v(){ echo "$MEAS" | grep "^$1:" | cut -d: -f2; }
MI="$(v input_i)"; MTP="$(v input_tp)"; MLRA="$(v input_lra)"; MTH="$(v input_thresh)"; MOFF="$(v target_offset)"
# Фолбэк на однопроходную нормализацию (как в prep.sh, функция normalize):
# если loudnorm не смог измерить все поля (тишина/битый источник и т.п.).
if [ -n "$MI" ] && [ -n "$MTP" ] && [ -n "$MLRA" ] && [ -n "$MTH" ] && [ -n "$MOFF" ]; then
  LN="loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=$MI:measured_TP=$MTP:measured_LRA=$MLRA:measured_thresh=$MTH:offset=$MOFF:linear=true"
else
  echo "  (не удалось измерить — однопроходная нормализация)"
  LN="loudnorm=I=-14:TP=-1.5:LRA=11"
fi
ffmpeg -y -loglevel error -i "$TMPA" \
  -af "$LN" \
  -acodec pcm_s16le -ar 48000 "$SLOT/audio.wav"
rm -f "$TMPA"
DUR=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$SLOT/audio.wav")
NEW_I=$(ffmpeg -hide_banner -i "$SLOT/audio.wav" -af ebur128=framelog=quiet -f null - 2>&1 \
        | grep -A1 "Integrated loudness" | grep "I:" | awk '{print $2}')
echo "→ Голос: ${NEW_I} LUFS, ${DUR}s"
echo "→ Whisper: $(basename "$WHISPER_MODEL")${WHISPER_PROMPT:+ + глоссарий}"

# ── 2. транскрипция: whisper-cli пословно (ru) ────────────────────────────────
ffmpeg -y -loglevel error -i "$SLOT/audio.wav" -ar 16000 -ac 1 "$SLOT/_w16.wav"
whisper-cli -m "$WHISPER_MODEL" -l "$WHISPER_LANG" -ml 1 -sow ${WHISPER_PROMPT:+--prompt "$WHISPER_PROMPT"} -oj -of "$SLOT/_whisper" "$SLOT/_w16.wav" >/dev/null
[ -s "$SLOT/_whisper.json" ] || { echo "✗ whisper-cli не создал JSON"; exit 1; }
python3 scripts/transcribe.py "$SLOT/_whisper.json" "$SLOT"
rm -f "$SLOT/_w16.wav" "$SLOT/_whisper.json"

# ── 3. исходник из inbox в _done ──────────────────────────────────────────────
mkdir -p inbox/_done
mv -f "$FILE" "inbox/_done/$(basename "$FILE")"

cat > "$SLOT/meta.txt" <<META
источник:     $(basename "$FILE")
длительность: ${DUR}s
громкость:    ${NEW_I} LUFS
заведён:      $(date '+%Y-%m-%d %H:%M')
META

echo ""
echo "✓ Слот готов: $SLOT"
echo "  • transcript.json — прочитать ЦЕЛИКОМ, разбить на биты, сториборд по library/INDEX.md"
echo "  • captions.generated.ts — вычитать ошибки Whisper (тайминги не трогать)"
echo "  • audio.wav — голос −14 LUFS для композиции"
