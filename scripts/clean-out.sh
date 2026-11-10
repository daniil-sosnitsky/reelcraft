#!/usr/bin/env bash
. "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/tools/env.sh"   # прослойка окружения, см. tools/env.sh
# clean-out.sh [NN] — уборка черновых рендеров.
#
# Без аргумента: показывает, что лежит в out/ и engine/out/ (размер, дата),
# ничего не удаляет.
# С NN: удаляет файлы, в имени которых встречается "-NN" или "qa-NN"
# (например out/qa-150.mp4, engine/out/video-150-draft.mp4), печатает
# освобождённый объём.
set -euo pipefail
cd "$(dirname "$0")/.."

DIRS=(out engine/out)

human() {
  # $1 — байты → человекочитаемо (macOS BSD numfmt отсутствует, считаем сами)
  local b="$1"
  awk -v b="$b" 'BEGIN{
    split("B KB MB GB TB", u, " ");
    i=1;
    while (b >= 1024 && i < 5) { b /= 1024; i++ }
    printf "%.1f%s", b, u[i]
  }'
}

if [ -z "${1:-}" ]; then
  echo "Черновые рендеры (ничего не удалено — передай NN, чтобы очистить):"
  echo
  found=0
  for d in "${DIRS[@]}"; do
    [ -d "$d" ] || continue
    while IFS= read -r -d '' f; do
      found=1
      size=$(stat -f%z "$f" 2>/dev/null || stat -c%s "$f" 2>/dev/null)
      mtime=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M" "$f" 2>/dev/null || stat -c "%y" "$f" 2>/dev/null | cut -d. -f1)
      printf "  %-50s %8s   %s\n" "$f" "$(human "$size")" "$mtime"
    done < <(find "$d" -maxdepth 1 -type f -print0 | sort -z)
  done
  [ "$found" -eq 0 ] && echo "  (пусто)"
  exit 0
fi

NN="$1"
total=0
count=0
for d in "${DIRS[@]}"; do
  [ -d "$d" ] || continue
  while IFS= read -r -d '' f; do
    base="$(basename "$f")"
    if [[ "$base" == *"-${NN}"* ]] || [[ "$base" == *"qa-${NN}"* ]]; then
      size=$(stat -f%z "$f" 2>/dev/null || stat -c%s "$f" 2>/dev/null)
      total=$((total + size))
      count=$((count + 1))
      rm -f "$f"
      echo "  удалён: $f"
    fi
  done < <(find "$d" -maxdepth 1 -type f -print0)
done

if [ "$count" -eq 0 ]; then
  echo "Ничего не найдено для video-${NN} в out/ и engine/out/."
else
  echo "Удалено файлов: $count, освобождено: $(human "$total")"
fi
