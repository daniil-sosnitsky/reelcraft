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
#
# ⚠️ Про SFX и историю первоисточника (проверено 2026-11-11).
# Upstream 29.10.2026 коммитом 1266a3ec УБРАЛ общий банк эффектов и перешёл на
# подбор под конкретный ролик с Freesound (references/sfx-sourcing.md). В его
# текущем main папки assets/audio/sfx больше НЕТ — она жива только в истории.
# Поэтому скрипт умеет три пути, по убыванию удобства:
#   1) банк уже лежит в клоне (старый снимок) — просто копируем;
#   2) клон — полноценный git-репозиторий: достаём банк из истории, из
#      коммита 5a2e98da (последний, где он на месте);
#   3) ни то ни другое — печатаем, что делать руками, и не делаем вид,
#      что звук установлен.
# ══════════════════════════════════════════════════════════════
set -euo pipefail
cd "$(dirname "$0")/.."

# Рабочие папки конвейера (в git они пустые, поэтому создаём здесь)
mkdir -p inbox/_raw inbox/_done inbox/screenshots queue out renders footage/clips engine/public/videos

SHOTCRAFT="${1:-../video-shotcraft}"
SFX_DST="engine/public/shared/sfx"
LIST="$SFX_DST/SFX-FILES.txt"

# Последний коммит upstream, в котором общий банк SFX ещё на месте.
# Следующий за ним (1266a3ec, 29.10.2026) его удаляет.
SFX_COMMIT="5a2e98daade313c4f376120f38427eb19a108e8c"
SFX_PATH_IN_REPO="assets/audio/sfx"

echo "── SFX ──────────────────────────────────────────────"

if [ ! -f "$LIST" ]; then
  echo "✗ Нет описи $LIST — без неё непонятно, какие файлы класть."
  echo "  Опись ведётся в репозитории; если файл потерялся — верни его из git."
  exit 1
fi
TOTAL=$(grep -c . "$LIST")

# ── Путь 1: банк лежит в клоне как файлы ────────────────────────────────────
SFX_SRC=""
for c in "$SHOTCRAFT/skill/$SFX_PATH_IN_REPO" "$SHOTCRAFT/$SFX_PATH_IN_REPO"; do
  [ -d "$c" ] && { SFX_SRC="$c"; break; }
done

copied=0; missing=0; restored=0

if [ -n "$SFX_SRC" ]; then
  echo "Источник: $SFX_SRC"
  while IFS= read -r rel; do
    rel="${rel%$'\r'}" # опись могла приехать в CRLF: хвостовой \r ломает путь молча
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
  echo "✓ SFX на месте: $copied из $TOTAL (не найдено: $missing)"
else
  # ── Путь 2: достаём банк из истории клона ─────────────────────────────────
  SC_GIT=""
  for c in "$SHOTCRAFT/skill" "$SHOTCRAFT"; do
    if [ -d "$c" ] && git -C "$c" rev-parse --git-dir >/dev/null 2>&1; then SC_GIT="$c"; break; fi
  done

  if [ -n "$SC_GIT" ]; then
    echo "Папки $SFX_PATH_IN_REPO в клоне нет — upstream убрал общий банк 29.10.2026."
    echo "Достаю из истории клона, коммит ${SFX_COMMIT:0:8}…"

    # Клон мог быть сделан с --depth 1: тогда старого коммита в нём физически нет.
    if ! git -C "$SC_GIT" cat-file -e "$SFX_COMMIT^{commit}" 2>/dev/null; then
      echo "  Коммита нет в локальной истории — дотягиваю (это ~50 МБ)…"
      git -C "$SC_GIT" fetch --unshallow origin 2>/dev/null \
        || git -C "$SC_GIT" fetch origin "$SFX_COMMIT" 2>/dev/null \
        || true
    fi

    if git -C "$SC_GIT" cat-file -e "$SFX_COMMIT^{commit}" 2>/dev/null; then
      # git show по одному файлу: рабочее дерево и индекс клона не трогаем —
      # checkout из старого коммита оставил бы человеку грязный репозиторий.
      while IFS= read -r rel; do
        rel="${rel%$'\r'}" # см. выше: CRLF в описи
        [ -z "$rel" ] && continue
        if [ -f "$SFX_DST/$rel" ]; then copied=$((copied+1)); continue; fi
        mkdir -p "$SFX_DST/$(dirname "$rel")"
        if git -C "$SC_GIT" show "$SFX_COMMIT:$SFX_PATH_IN_REPO/$rel" > "$SFX_DST/$rel" 2>/dev/null; then
          restored=$((restored+1)); copied=$((copied+1))
        else
          rm -f "$SFX_DST/$rel"
          echo "  ⚠ нет в истории: $rel"
          missing=$((missing+1))
        fi
      done < "$LIST"
      echo "✓ SFX на месте: $copied из $TOTAL (восстановлено из истории: $restored, не найдено: $missing)"
      echo "  ⚠ Происхождение части этих файлов upstream сам не смог подтвердить"
      echo "    (его assets/audio/ATTRIBUTION.md: «商用前须确认» — проверить до"
      echo "    коммерческого использования). Для монетизируемых роликов сверься"
      echo "    с ATTRIBUTION или подбери замену через Freesound (см. ниже)."
    else
      missing=$TOTAL
      echo "✗ Старый коммит дотянуть не удалось (нет сети или клон без истории)."
    fi
  else
    missing=$TOTAL
    echo "✗ Не нашёл ни банк SFX, ни git-клон каталога приёмов."
    echo "  Искал: $SHOTCRAFT/skill/$SFX_PATH_IN_REPO и $SHOTCRAFT/$SFX_PATH_IN_REPO"
  fi

  if [ "$missing" -gt 0 ] && [ "$restored" -eq 0 ]; then
    echo ""
    echo "  Два способа получить звук:"
    echo "  1. Склонировать каталог приёмов С ИСТОРИЕЙ рядом с проектом и"
    echo "     повторить этот скрипт (в подпапку skill/ — так сходятся пути"
    echo "     library/index-*.md, см. INSTALL.md, шаг 3):"
    echo "       git clone https://github.com/Vincentwei1021/video-shotcraft $SHOTCRAFT/skill"
    echo "     ⚠️ Без --depth: банк живёт в истории, у поверхностного клона его нет."
    echo "  2. Подобрать свои эффекты с Freesound — путь, на который перешёл сам"
    echo "     upstream: $SHOTCRAFT/skill/references/sfx-sourcing.md и"
    echo "     $SHOTCRAFT/skill/assets/scripts/sfx-source.py (по умолчанию CC0)."
    echo "     Имена тогда разойдутся с описью — обнови её: scripts/sfx-catalog.sh"
  fi
fi

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
echo "── Картинки CTA-карточки ─────────────────────────────"
CTA="engine/public/shared/cta"
for pair in "avatar.png:круглый аватар канала" "tg-channel.jpg:скрин шапки канала"; do
  f="${pair%%:*}"; what="${pair#*:}"
  if [ ! -f "$CTA/$f" ]; then
    echo "✗ $CTA/$f — нет ($what). Сгенерировать нейтральную заглушку:"
    echo "    \$RC_PY tools/make-placeholder-cta.py"
  elif grep -q "ЗАГЛУШКА" "$CTA/$f" 2>/dev/null; then
    echo "~ $CTA/$f — пока заглушка, замени своим ($what)"
  else
    echo "✓ $CTA/$f — свой файл на месте"
  fi
done
echo "Пропорции скрина после замены пропиши в engine/src/channel.ts (ctaProofAspect)."
