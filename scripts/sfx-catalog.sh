#!/usr/bin/env bash
. "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/tools/env.sh"   # прослойка окружения, см. tools/env.sh
# Генерирует engine/public/shared/sfx/CATALOG.md — опись SFX-банка по
# подпапкам (категориям): файл · длительность (с) · пик dB (ffmpeg astats) ·
# пометки «длинный» (>1.5с), «тихий» (пик < −12dB), «СТОП-ЛИСТ» (файл из
# стоп-листа NOTES.md / reelcraft/CLAUDE.md).
#
# Запуск: ./scripts/sfx-catalog.sh   (из корня reelcraft или откуда угодно —
# путь к банку вычисляется от расположения самого скрипта).
set -euo pipefail
export LC_ALL=C

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SFX_DIR="$SCRIPT_DIR/../engine/public/shared/sfx"
OUT="$SFX_DIR/CATALOG.md"

if ! command -v ffprobe >/dev/null 2>&1 || ! command -v ffmpeg >/dev/null 2>&1; then
  echo "Нужны ffmpeg и ffprobe в PATH." >&2
  exit 1
fi

# Стоп-лист SFX (reelcraft/CLAUDE.md, раздел «Звук»): вся папка riser/, плюс
# три точечных файла — запрет по тембру (игровые/системные звуки).
is_stoplisted() {
  local rel="$1"
  case "$rel" in
    riser/*) return 0 ;;
    ui/switch-click-quick.mp3) return 0 ;;
    data/power-up-electronic.mp3) return 0 ;;
    camera/zoom-air-fast.mp3) return 0 ;;
    *) return 1 ;;
  esac
}

{
  echo "# Опись SFX-банка"
  echo
  echo "Сгенерировано автоматически: \`scripts/sfx-catalog.sh\` (не редактировать руками — перегенерировать)."
  echo
  echo "Пометки: «длинный» — дольше 1.5с (нужен явный \`durationInFrames\`); «тихий» — пик громкости ниже −12dB (см. \`NOTES.md\`); «СТОП-ЛИСТ» — запрещён к использованию (тембр игровых/системных звуков)."
  echo
} > "$OUT"

# Категории — подпапки первого уровня, кроме служебных файлов.
for dir in "$SFX_DIR"/*/; do
  [ -d "$dir" ] || continue
  category="$(basename "$dir")"
  files=()
  while IFS= read -r -d '' f; do files+=("$f"); done < <(find "$dir" -maxdepth 1 -type f \( -iname '*.mp3' -o -iname '*.wav' \) -print0 | sort -z)
  [ "${#files[@]}" -eq 0 ] && continue

  {
    echo "## $category/"
    echo
    echo "| Файл | Длит. (с) | Пик (dB) | Пометки |"
    echo "|---|---|---|---|"
  } >> "$OUT"

  for f in "${files[@]}"; do
    name="$(basename "$f")"
    rel="$category/$name"

    dur="$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$f" 2>/dev/null || echo "")"
    dur_fmt="$(printf '%.1f' "${dur:-0}" 2>/dev/null || echo "?")"

    # Пик громкости через astats (Peak level, dBFS).
    peak="$(ffmpeg -hide_banner -nostats -i "$f" -af astats=metadata=0:reset=0 -f null - 2>&1 \
      | grep -o 'Peak level dB: [-0-9.]*' | tail -1 | sed 's/Peak level dB: //')"
    [ -z "${peak:-}" ] && peak="?"

    marks=()
    if [ "$dur_fmt" != "?" ] && awk -v d="$dur_fmt" 'BEGIN{exit !(d>1.5)}'; then
      marks+=("длинный")
    fi
    if [ "$peak" != "?" ] && awk -v p="$peak" 'BEGIN{exit !(p<-12)}'; then
      marks+=("тихий")
    fi
    if is_stoplisted "$rel"; then
      marks+=("**СТОП-ЛИСТ**")
    fi

    marks_str="$(IFS=', '; echo "${marks[*]:-}")"
    echo "| $name | $dur_fmt | $peak | $marks_str |" >> "$OUT"
  done

  echo >> "$OUT"
done

echo "Опись сохранена: $OUT"
