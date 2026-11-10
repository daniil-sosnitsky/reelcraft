#!/usr/bin/env bash
. "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/tools/env.sh"   # прослойка окружения, см. tools/env.sh
# ══════════════════════════════════════════════════════════════
# setup-assets.sh — доложить в проект аудио-банки, которых нет в репозитории.
#
# Почему их нет: SFX — подмножество библиотеки video-shotcraft (Apache-2.0),
# её честнее брать из первоисточника; BGM — треки Mixkit, их лицензия
# разрешает использовать музыку в роликах, но не перевыкладывать сами файлы.
#
# Запуск (из корня проекта):
#   scripts/setup-assets.sh [путь-к-клону-video-shotcraft]
# По умолчанию клон ищется в ../video-shotcraft рядом с проектом.
# ══════════════════════════════════════════════════════════════
set -euo pipefail
cd "$(dirname "$0")/.."

# Рабочие папки конвейера (в git они пустые, поэтому создаём здесь)
mkdir -p inbox/_raw inbox/_done inbox/screenshots queue out renders footage/clips engine/public/videos

SHOTCRAFT="${1:-../video-shotcraft}"
SFX_SRC="$SHOTCRAFT/skill/assets/audio/sfx"
SFX_DST="engine/public/shared/sfx"
LIST="$SFX_DST/SFX-FILES.txt"

echo "── SFX ──────────────────────────────────────────────"
if [ ! -d "$SFX_SRC" ]; then
  echo "✗ Не нашёл банк SFX: $SFX_SRC"
  echo "  Склонируй каталог приёмов рядом с проектом:"
  echo "  git clone https://github.com/Vincentwei1021/video-shotcraft ../video-shotcraft"
  exit 1
fi
[ -f "$LIST" ] || { echo "✗ Нет списка $LIST"; exit 1; }

copied=0; missing=0
while IFS= read -r rel; do
  [ -z "$rel" ] && continue
  if [ -f "$SFX_SRC/$rel" ]; then
    mkdir -p "$SFX_DST/$(dirname "$rel")"
    cp -n "$SFX_SRC/$rel" "$SFX_DST/$rel" 2>/dev/null || true
    copied=$((copied+1))
  else
    echo "  ⚠ нет в источнике: $rel"
    missing=$((missing+1))
  fi
done < "$LIST"
echo "✓ SFX на месте: $copied файлов (не найдено: $missing)"
echo "  Опись и замеры пиков — $SFX_DST/CATALOG.md, грабли — NOTES.md."
echo "  Изменился состав банка → пересобрать опись: scripts/sfx-catalog.sh"

echo ""
echo "── BGM ──────────────────────────────────────────────"
BGM_DST="engine/public/shared/bgm"
have=$(find "$BGM_DST" -name '*.mp3' 2>/dev/null | wc -l | tr -d ' ')
if [ "$have" -ge 3 ]; then
  echo "✓ Треков в банке: $have"
else
  echo "В банке треков: $have — этого мало для анти-повтора (нужно 4–5)."
  echo "Скачай бесплатные треки и положи в $BGM_DST/:"
  echo "  https://mixkit.co/free-stock-music/  (Mixkit License: бесплатно,"
  echo "  в том числе коммерчески, без указания авторства)"
  echo "Названия и характеры треков, на которых собран конвейер, —"
  echo "в $BGM_DST/INDEX.md. Каждый новый трек — строкой в этот INDEX:"
  echo "имя файла, автор, характер, длительность, LUFS (ffmpeg loudnorm)."
fi

echo ""
echo "── Скрин канала для CTA ─────────────────────────────"
if grep -q "ЗАМЕНИ" engine/public/shared/cta/tg-channel.jpg 2>/dev/null || true; then :; fi
echo "engine/public/shared/cta/tg-channel.jpg — сейчас заглушка."
echo "Замени на скрин шапки своего канала (пропорции пропиши в src/channel.ts)."
