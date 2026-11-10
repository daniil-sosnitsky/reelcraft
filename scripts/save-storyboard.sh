#!/usr/bin/env bash
. "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/tools/env.sh"   # прослойка окружения, см. tools/env.sh
# save-storyboard.sh NN — копирует сториборд слота очереди в папку ролика в
# engine/, чтобы раскадровка попадала в git вместе с кодом (queue/ не
# версионируется). Перезаписывает, если уже есть. Вызывается автоматически
# из scripts/lint-scenes.mjs при каждом линте — руками нужен редко.
set -euo pipefail
cd "$(dirname "$0")/.."

NN="${1:-}"
[ -n "$NN" ] || { echo "✗ Укажи номер: scripts/save-storyboard.sh NN"; exit 1; }

SRC="queue/video-${NN}/storyboard.md"
DST_DIR="engine/src/videos/video-${NN}"
DST="$DST_DIR/storyboard.md"

[ -f "$SRC" ] || { echo "✗ Нет сториборда в слоте: $SRC"; exit 1; }
[ -d "$DST_DIR" ] || { echo "✗ Нет папки ролика: $DST_DIR"; exit 1; }

cp -f "$SRC" "$DST"
echo "$DST"
