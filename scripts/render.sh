#!/usr/bin/env bash
. "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/tools/env.sh"   # прослойка окружения, см. tools/env.sh
# ─────────────────────────────────────────────────────────────────────────────
# render.sh — ЕДИНСТВЕННАЯ точка рендера ролика.
#
# Зачем отдельный скрипт (правка 2026-10-12):
#
# 1. Черновой рендер отменён. Замер: ролик на `--scale=0.4 --jpeg-quality=60`
#    идёт столько же, сколько чистовик (video-04 — 5 мин против 4, video-05 —
#    3 против 3). Узкое место рендера не кодек и не число пикселей, а прогон
#    React в headless-браузере: он одинаков при любом масштабе. То есть
#    конвейер рендерил ролик дважды, второй раз без выигрыша. Теперь рендер
#    один, в полном качестве, и он же идёт и терчеку, и в сдачу.
#
# 2. Число воркеров считается по СВОБОДНОЙ памяти, а не задано константой.
#    Каждый headless-браузер съедает ~1,5 ГБ. Раньше стояло жёсткое 3 —
#    страховка от падений по памяти при открытом Chrome (2026-10-12). Но если
#    браузер закрыт и свободно 10 ГБ, три воркера — это вдвое медленнее, чем
#    машина может. Теперь: workers = свободно_ГБ / 1,2, но не меньше 3 (это
#    число проверено на 3,8 ГБ свободных) и не больше 6 (выше упирается в
#    2 производительных ядра i5-1235U).
#    Перебить — переменной REELCRAFT_CONCURRENCY.
#
# 3. Диапазон кадров. Перепроверять правку полным рендером — потеря 3–5 мин
#    на круг: правка живёт в одной сцене, а рендерится весь ролик. С
#    `--frames=A-B` перепроверка стоит ~1 мин, и `qa-auto.sh` по такому
#    отрезку работает как по целому ролику (кадр 0 отрезка он считает
#    обложкой — на это WARN «обложка» в отрезке можно не смотреть).
#
# Использование:
#   ./scripts/render.sh <CompositionId> [out.mp4] [--frames=A-B] [доп. флаги]
#
#   ./scripts/render.sh Video-05-Light
#       → engine/out/video-05-light.mp4, полное качество, все кадры
#
#   ./scripts/render.sh Video-05-Light out/chk.mp4 --frames=1163-1340
#       → перепроверка одной сцены
#
#   ./scripts/render.sh Video-05-Light out/nobgm.mp4 --props='{"bgm":false}'
#       → версия без музыки (претензия Content ID)
#
#   ./scripts/render.sh Video-05-Light --progress
#       → с индикатором Remotion (бандлинг, проценты кадров, энкодинг)
#
# Качество кадров и кодека задано в remotion.config.ts и флагами НЕ понижается.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

PROJ="$(cd "$(dirname "$0")/.." && pwd)"

usage () { sed -n '3,45p' "$0"; exit 1; }
[[ $# -lt 1 ]] && usage

COMP="$1"; shift

# Уровень лога Remotion. По умолчанию error: прогресс-бар молчит, в логе
# остаются только наши строки и настоящие ошибки. `--progress` возвращает
# штатный индикатор Remotion (бандлинг, проценты кадров, энкодинг) — нужен,
# когда рендер подозрительно долгий и надо видеть, на каком он шаге, а также
# когда прогон снимается в банк footage. Флаг вырезается из аргументов:
# пробросить второй `--log` в Remotion нельзя, он падает на двух значениях.
LOG="error"
ARGS=()
for a in "$@"; do
  if [[ "$a" == "--progress" ]]; then LOG="info"; else ARGS+=("$a"); fi
done
set -- ${ARGS+"${ARGS[@]}"}

# Имя по умолчанию — из id композиции: Video-05-Light → video-05-light.mp4
OUT=""
if [[ $# -gt 0 && "$1" != --* ]]; then OUT="$1"; shift; fi
[[ -z "$OUT" ]] && OUT="$PROJ/engine/out/$(echo "$COMP" | tr '[:upper:]' '[:lower:]').mp4"
# Путь резолвим ДО cd в engine — иначе относительный «out/…» превращается
# в «engine/out/…» внутри engine (накладка 2026-08-21).
[[ "$OUT" != /* ]] && OUT="$(pwd)/$OUT"
mkdir -p "$(dirname "$OUT")"

# ── Сколько воркеров тянет машина прямо сейчас ───────────────────────────────
concurrency () {
  if [[ -n "${REELCRAFT_CONCURRENCY:-}" ]]; then echo "$REELCRAFT_CONCURRENCY"; return; fi
  local free_gb w
  # Свободная физическая память: в Git Bash берём её у PowerShell (/proc/meminfo
  # на Windows показывает не то — там нет MemAvailable).
  free_gb="$(powershell -NoProfile -Command \
    '[math]::Floor((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory/1MB)' 2>/dev/null | tr -d '[:space:]')"
  [[ -z "$free_gb" ]] && { echo 3; return; }   # не смогли замерить — прежняя константа
  w=$(( free_gb * 10 / 12 ))                   # ~1,2 ГБ на headless-браузер
  (( w < 3 )) && w=3                           # 3 проверены на 3,8 ГБ свободных
  (( w > 6 )) && w=6                           # выше упираемся в 2 P-ядра
  echo "$w"
}

W="$(concurrency)"
FREE="$(powershell -NoProfile -Command \
  '"{0:N1}" -f ((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory/1MB)' 2>/dev/null | tr -d '[:space:]')"

cd "$PROJ/engine"
echo "▶ Рендер $COMP → $OUT"
echo "  воркеров: $W (свободно ${FREE:-?} ГБ). Закрытый Chrome ускоряет рендер вдвое."
[[ "$*" == *--frames=* ]] && echo "  диапазон кадров: ${*#*--frames=}"

START="$SECONDS"
npx remotion render src/index.ts "$COMP" "$OUT" --log="$LOG" --concurrency="$W" "$@"
MIN=$(( (SECONDS - START) / 60 )); SEC=$(( (SECONDS - START) % 60 ))

echo "✓ Готово за ${MIN}м ${SEC}с: $OUT"
echo "  Дальше: ./scripts/qa-auto.sh $OUT   и   ./scripts/qa-sheet.sh auto $OUT 70"
