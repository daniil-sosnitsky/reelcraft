#!/usr/bin/env bash
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/tools/env.sh"   # прослойка окружения, см. tools/env.sh
# ─────────────────────────────────────────────────────────────────────────────
# prep.sh — подготовка сырого ролика для Reelcraft
#
# Поток (упрощён 2026-08-03 — папок на Рабочем столе больше нет):
#   inbox/            ← CapCut экспортирует сюда напрямую
#        ↓ (этот скрипт: громкость → [паузы] → скорость → звук)
#   inbox/NAME-prep.mp4   ← вход для scripts/queue-add.sh
#   inbox/_raw/NAME.mp4   ← оригинал, уезжает сюда автоматически
#
# Промежуточного апрува нет: паузы режутся в монтажке (CapCut и т.п.), а
# результат смотрится уже готовым роликом.
#
# Что делает за один прогон:
#   1) нормализация громкости (двухпроходная, точно в LUFS);
#   2) [опционально, ВЫКЛ по умолчанию] auto-editor вырезает паузы/тишину;
#   3) ffmpeg ускоряет С СОХРАНЕНИЕМ высоты голоса (atempo, без «бурундука»);
#   4) обработка звука: шумодав + EQ голоса + финальная подгонка громкости.
#
# Паузы режутся вручную в монтажке — по умолчанию скрипт их НЕ трогает
# (см. CUT_PAUSES ниже: автоматический рез иногда съедал начала слов).
#
# Работает и с ВИДЕО (.mp4/.mov), и с ЧИСТЫМ АУДИО (.m4a/.mp3/.wav — например
# запись Диктофона). Тип определяется автоматически, у аудио своя скорость.
#
# Использование:
#   ./prep.sh                 # обработать всё необработанное из inbox/
#   ./prep.sh /путь/файл      # обработать один конкретный файл
#   ./prep.sh --voice         # забрать свежие записи Диктофона macOS
#   SPEED=1.3 ./prep.sh ...   # разово переопределить скорость
#   CUT_PAUSES=true ./prep.sh ...  # разово включить рез пауз auto-editor'ом
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── НАСТРОЙКИ (крутилки для калибровки) ───────────────────────────────────────
# Скорость речи — ОДНА крутилка на оба случая входа.
# Раньше чистое аудио ускорялось слабее (1.1), и пара «1.2 / 1.1» читалась так,
# будто картинка и звук едут врозь. На деле коэффициент всегда общий для обеих
# дорожек файла — путались только имена переменных.
SPEED="${SPEED:-1.2}"                    # 1.2 — проверенная бодрость без «бурундука»
SPEED_AUDIO="${SPEED_AUDIO:-$SPEED}"     # чистое аудио — та же скорость; развести можно переменной окружения

# Рез пауз auto-editor'ом — ПО УМОЛЧАНИЮ ВЫКЛЮЧЕН: автоматический рез
# иногда съедает лишнее, надёжнее резать вручную в монтажке.
CUT_PAUSES="${CUT_PAUSES:-false}"

# ⚠ Порог считается от ПОЛНОЙ ШКАЛЫ, поэтому громкость выравнивается ПЕРВЫМ
#   шагом — иначе на тихой записи порог съедает тихие начала и хвосты слов.
MARGIN="${MARGIN:-0.3s}"     # «подушка» вокруг речи: запас, чтобы не резать по словам (если CUT_PAUSES=true)
THRESHOLD="${THRESHOLD:-2%}" # порог тишины: больше % = агрессивнее режет тихое (если CUT_PAUSES=true)

# Обработка звука (true/false):
DENOISE="${DENOISE:-false}"  # шумодав: на вытянутой тихой записи даёт «бочку» — по умолчанию выкл
VOICE_EQ="${VOICE_EQ:-true}" # эквалайзер: срез гула (~120 Гц) + presence (~3.5 кГц) + воздух (8 кГц)
# ⚠ Настроено по замеру спектра ПЕТЛИЧКИ 2026-10-07 (inbox/Озвучка.m4a):
#   пик энергии 300–600 Гц, завал верха (2.5–5 кГц ниже пика на 14 дБ,
#   5–9 кГц на 22 дБ), шумовой пол −70 дБ, гула в 150–300 Гц нет.
#   Поэтому: срез перенесён с 200 на 120 Гц (на 200 он вынимал тело голоса),
#   presence расширен (Q 1.5 → 1.0) и добавлена полка «воздуха» от 8 кГц —
#   это разборчивость для whisper и голос без «подушки».
#   Шумодав остаётся ВЫКЛ: с полом −70 дБ он только портит.
LOUDNORM=true    # нормализация громкости (двухпроходная, точно в цель)
LUFS=-14         # целевая громкость в LUFS (−14 = референс YouTube/Instagram)

# Рабочая папка (с 2026-08-03 — прямо inbox проекта, папок на Рабочем столе больше нет):
#   inbox/            ← CapCut экспортирует сюда; сюда же ложится результат «-prep»
#   inbox/_raw/       ← оригинал уезжает сюда сразу после обработки (чтобы не мешался)
PROJ="$(cd "$(dirname "$0")" && pwd)"
RAW_DIR="$PROJ/inbox"
OUT_DIR="$PROJ/inbox"
ORIG_DIR="$PROJ/inbox/_raw"
# ──────────────────────────────────────────────────────────────────────────────

mkdir -p "$RAW_DIR" "$OUT_DIR" "$ORIG_DIR"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

dur () { ffprobe -v error -show_entries format=duration -of csv=p=0 "$1" 2>/dev/null; }

# ── Обработка одного файла ────────────────────────────────────────────────────
has_video () {
  [[ -n "$(ffprobe -v error -select_streams v:0 -show_entries stream=codec_type -of csv=p=0 "$1" 2>/dev/null)" ]]
}

# Двухпроходная нормализация до $LUFS: 1) измерить, 2) применить точно в цель.
# $1 — вход, $2 — выход, $3 — true если есть видеодорожка (копируется как есть).
normalize () {
  local IN="$1" OUT="$2" HAS_V="$3"
  local JSON ln mi mtp mlra mth moff
  JSON="$(ffmpeg -hide_banner -nostats -i "$IN" \
          -af "loudnorm=I=${LUFS}:TP=-1.5:LRA=11:print_format=json" -f null - 2>&1 \
          | sed -n '/{/,/}/p')"
  val () { echo "$JSON" | grep "\"$1\"" | head -1 | sed -E 's/[^-0-9.]+//g'; }
  mi="$(val input_i)"; mtp="$(val input_tp)"; mlra="$(val input_lra)"
  mth="$(val input_thresh)"; moff="$(val target_offset)"
  if [[ -n "$mi" && -n "$mtp" && -n "$mlra" && -n "$mth" && -n "$moff" ]]; then
    ln="loudnorm=I=${LUFS}:TP=-1.5:LRA=11:measured_I=${mi}:measured_TP=${mtp}:measured_LRA=${mlra}:measured_thresh=${mth}:offset=${moff}:linear=true"
  else
    echo "        (не удалось измерить — однопроходная нормализация)"
    ln="loudnorm=I=${LUFS}:TP=-1.5:LRA=11"
  fi
  if [[ "$HAS_V" == true ]]; then
    ffmpeg -y -loglevel error -i "$IN" -af "$ln" \
      -map 0:v -map 0:a -c:v copy -c:a aac -b:a 192k "$OUT"
  else
    ffmpeg -y -loglevel error -i "$IN" -af "$ln" -c:a aac -b:a 192k "$OUT"
  fi
}

process_one () {
  local INPUT="$1"
  local BASENAME OUTPUT EXT SPD IS_AUDIO HAS_V
  BASENAME="$(basename "${INPUT%.*}")"

  if has_video "$INPUT"; then
    IS_AUDIO=false; HAS_V=true;  EXT=mp4; SPD="$SPEED"
  else
    IS_AUDIO=true;  HAS_V=false; EXT=m4a; SPD="$SPEED_AUDIO"
  fi
  OUTPUT="$OUT_DIR/${BASENAME}-prep.${EXT}"

  echo "▶ Исходник: $(basename "$INPUT")  ($(dur "$INPUT") сек, $([[ $IS_AUDIO == true ]] && echo аудио || echo видео))"

  # Шаг 1: СНАЧАЛА выровнять громкость. Порог реза считается от полной шкалы,
  # поэтому на тихой записи рез «по словам» — резать можно только после этого.
  # Первое выравнивание нужно только порогу реза пауз (считается от полной
  # шкалы). Рез выключен → пропускаем проход: громкость всё равно точно
  # выставит финальная подгонка ниже (правка 2026-09-04: минус один
  # перекодировщик звука на каждый ролик).
  if [[ "$CUT_PAUSES" == true ]]; then
    echo "  [1/3] Выравниваю громкость до ${LUFS} LUFS…"
    normalize "$INPUT" "$TMP/leveled.${EXT}" "$HAS_V"
  else
    echo "  [1/3] Предварительное выравнивание не нужно (рез пауз выключен) — пропускаю…"
    cp "$INPUT" "$TMP/leveled.${EXT}"
  fi

  # Шаг 2: вырезать паузы и тишину — ТОЛЬКО если явно включено (CUT_PAUSES=true).
  # По умолчанию выключено — паузы режутся вручную в монтажке.
  if [[ "$CUT_PAUSES" == true ]]; then
    echo "  [2/3] Режу паузы (порог $THRESHOLD, запас $MARGIN)…"
    auto-editor "$TMP/leveled.${EXT}" \
      --edit "audio:threshold=$THRESHOLD" \
      --margin "$MARGIN" \
      --quiet \
      -o "$TMP/nosilence.${EXT}"
    echo "        после реза пауз: $(dur "$TMP/nosilence.${EXT}") сек"
  else
    echo "  [2/3] Рез пауз выключен (CUT_PAUSES=false) — пропускаю…"
    mv "$TMP/leveled.${EXT}" "$TMP/nosilence.${EXT}"
  fi
  rm -f "$TMP/leveled.${EXT}" 2>/dev/null || true

  # Шаг 3: ускорить + мягкая чистка. Цепочка: ускорение → срез гула → [шумодав] → EQ.
  local AF="atempo=${SPD},highpass=f=90"
  [[ "$DENOISE"  == true ]] && AF="${AF},afftdn=nf=-25"
  [[ "$VOICE_EQ" == true ]] && AF="${AF},equalizer=f=120:t=q:w=1.0:g=-2.5,equalizer=f=3500:t=q:w=1.0:g=4,treble=f=8000:g=3"

  echo "  [3/3] Ускоряю ${SPD}x + обработка звука…"
  if [[ "$IS_AUDIO" == true ]]; then
    ffmpeg -y -loglevel error -i "$TMP/nosilence.${EXT}" \
      -af "$AF" -c:a aac -b:a 192k "$TMP/stageA.${EXT}"
  else
    ffmpeg -y -loglevel error -i "$TMP/nosilence.${EXT}" \
      -filter_complex "[0:v]setpts=PTS/${SPD}[v];[0:a]${AF}[a]" \
      -map "[v]" -map "[a]" \
      -c:v libx264 -crf 18 -preset medium -pix_fmt yuv420p \
      -c:a aac -b:a 192k \
      "$TMP/stageA.${EXT}"
  fi
  rm -f "$TMP/nosilence.${EXT}"

  # Финальная подгонка: рез пауз и EQ немного смещают громкость.
  if [[ "$LOUDNORM" == true ]]; then
    echo "        финальная подгонка громкости…"
    normalize "$TMP/stageA.${EXT}" "$OUTPUT" "$HAS_V"
    rm -f "$TMP/stageA.${EXT}"
  else
    mv "$TMP/stageA.${EXT}" "$OUTPUT"
  fi
  # Оригинал убираем из inbox/ — иначе queue-add.sh примет его за вход
  # вместо обработанной версии, а следующий прогон prep.sh обработает повторно.
  if ! mv -f "$INPUT" "$ORIG_DIR/"; then
    echo "✗ Не удалось перенести оригинал в $ORIG_DIR: $INPUT" >&2
    exit 1
  fi

  echo "✓ Готово: inbox/${BASENAME}-prep.${EXT}  ($(dur "$OUTPUT") сек), оригинал → inbox/_raw/"
}

# ── Режим --voice: забрать свежие записи Диктофона macOS прямо в inbox/ ──────
VOICEMEMOS="$HOME/Library/Group Containers/group.com.apple.VoiceMemos.shared/Recordings"

if [[ "${1:-}" == "--voice" ]]; then
  [[ -d "$VOICEMEMOS" ]] || { echo "Папка Диктофона не найдена: $VOICEMEMOS"; exit 1; }
  echo "Свежие записи Диктофона:"
  shopt -s nullglob
  MEMOS=("$VOICEMEMOS"/*.m4a)
  shopt -u nullglob
  [[ ${#MEMOS[@]} -eq 0 ]] && { echo "Записей нет."; exit 0; }
  # самые новые сверху, забираем всё что моложе суток.
  # ⚠ cp -n возвращает 1, если файл уже есть, — под set -e это роняло скрипт
  # на повторном запуске; поэтому копирование обёрнуто в if.
  while IFS= read -r m; do
    if cp -n "$m" "$RAW_DIR/" 2>/dev/null; then
      echo "  → скопировано: $(basename "$m")"
    else
      echo "  · уже было: $(basename "$m")"
    fi
  done < <(find "$VOICEMEMOS" -name "*.m4a" -mtime -1 -print)
  echo "Лежит в: $RAW_DIR — запусти ./prep.sh чтобы обработать."
  exit 0
fi

# ── Режим: один файл (аргумент) или всё необработанное из inbox/ ──────────────
if [[ $# -ge 1 ]]; then
  [[ -f "$1" ]] || { echo "Ошибка: файл не найден: $1"; exit 1; }
  process_one "$1"
else
  shopt -s nullglob nocaseglob
  CANDIDATES=("$RAW_DIR"/*.mp4 "$RAW_DIR"/*.mov "$RAW_DIR"/*.m4v "$RAW_DIR"/*.mkv "$RAW_DIR"/*.avi \
              "$RAW_DIR"/*.m4a "$RAW_DIR"/*.mp3 "$RAW_DIR"/*.wav)
  shopt -u nullglob nocaseglob

  # Отсеять артефакты пайплайна: уже обработанное («-prep») и audio.mp3 композиции.
  # ⚠ Развёртывание пустого массива пишем как ${arr[@]+"${arr[@]}"} — иначе
  # системный bash 3.2 под `set -u` падает с «unbound variable».
  FILES=()
  for f in ${CANDIDATES[@]+"${CANDIDATES[@]}"}; do
    base="$(basename "$f")"
    [[ "$base" == *-prep.* ]] && continue
    [[ "$base" == audio.mp3 || "$base" == audio.mp4 ]] && continue
    FILES+=("$f")
  done

  if [[ ${#FILES[@]} -eq 0 ]]; then
    echo "В inbox/ нет необработанных медиафайлов."
    echo "Папка: $RAW_DIR  (CapCut экспортирует сюда)"
    exit 0
  fi
  echo "Найдено файлов: ${#FILES[@]}"
  for f in ${FILES[@]+"${FILES[@]}"}; do process_one "$f"; done
fi

echo "Смотри результат в:  $OUT_DIR"
