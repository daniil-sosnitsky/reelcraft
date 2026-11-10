#!/usr/bin/env bash
. "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/tools/env.sh"   # прослойка окружения, см. tools/env.sh
# ══════════════════════════════════════════════════════════════
# new-video.sh (reelcraft) — сантехника нового ролика одной командой.
# Запуск: scripts/new-video.sh NN [--theme light|emerald|both] [--force]
#
# Делает то, что раньше собиралось руками по engine/README.md и съедало
# стабильные 15–20 минут на ролик (замер по video-03, 2026-10-11):
#   • engine/public/videos/NN/ + audio.wav из слота очереди;
#   • src/videos/video-NN/data.ts — CAP из вычитанного captions.generated.ts,
#     CAP_GROUPS, длительность, заготовка таблицы сцен;
#   • src/videos/video-NN/scenes<Тема>.tsx — заготовка сцен;
#   • src/videos/video-NN/Video<NN><Тема>.tsx — корень композиции со всей
#     обязательной сантехникой (Audio, Bgm, Background, Captions, Character,
#     блок SFX, блок переходов);
#   • регистрацию композиции в src/Root.tsx перед якорем.
#
# Чего НЕ делает: постановку. Сцены, камеры, тайминги — из сториборда.
# Запускать ПОСЛЕ сториборда (шаг 5), перед вёрсткой (шаг 6): тогда таблица
# сцен и длительность заполняются сразу по паспорту.
# ══════════════════════════════════════════════════════════════
set -euo pipefail
cd "$(dirname "$0")/.."

NN=""; THEMES="light"; FORCE=0
while [ $# -gt 0 ]; do
  case "$1" in
    --theme) THEMES="${2:-}"; shift 2 ;;
    --force) FORCE=1; shift ;;
    -h|--help) sed -n '3,22p' "$0"; exit 0 ;;
    *) NN="$1"; shift ;;
  esac
done
[ -n "$NN" ] || { echo "✗ Укажи номер слота: scripts/new-video.sh NN [--theme light|emerald|both]"; exit 1; }
case "$THEMES" in light|emerald|both) ;; *) echo "✗ --theme: light, emerald или both"; exit 1 ;; esac

SLOT="queue/video-${NN}"
VDIR="engine/src/videos/video-${NN}"
PUB="engine/public/videos/${NN}"

[ -d "$SLOT" ] || { echo "✗ Нет слота $SLOT — сначала scripts/queue-add.sh <файл> ${NN}"; exit 1; }
[ -f "$SLOT/audio.wav" ] || { echo "✗ Нет $SLOT/audio.wav"; exit 1; }
[ -f "$SLOT/captions.generated.ts" ] || { echo "✗ Нет $SLOT/captions.generated.ts"; exit 1; }
if [ -d "$VDIR" ] && [ "$FORCE" -eq 0 ]; then
  echo "✗ Папка ролика уже есть: $VDIR (перезаписать — --force; файлы сцен при этом НЕ трогаются)"; exit 1
fi

# ── длительность: речь + хвост CTA ───────────────────────────────────────────
# Призыв в финале не озвучен, поэтому CTA живёт 3.5–4с сверх речи (CLAUDE.md,
# «Константы канала»). Берём 4с = 120 кадров; по сториборду пересчитать.
FPS=30
CTA_TAIL=120
DUR_SEC=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$SLOT/audio.wav")
SPEECH_FRAMES=$(python3 -c "import math,sys; print(math.ceil(float(sys.argv[1])*$FPS))" "$DUR_SEC")
TOTAL=$((SPEECH_FRAMES + CTA_TAIL))

# ── mean речи: нужен для формулы громкости SFX (CLAUDE.md, «Звук») ──────────
MEAN_DB=$(ffmpeg -hide_banner -i "$SLOT/audio.wav" -af volumedetect -f null - 2>&1 \
          | grep mean_volume | awk '{print $5}' || echo "-17.0")

mkdir -p "$VDIR" "$PUB"
[ -f "$PUB/audio.wav" ] || cp "$SLOT/audio.wav" "$PUB/audio.wav"

# ── data.ts ──────────────────────────────────────────────────────────────────
UP=$(echo "VIDEO${NN}" | tr '[:lower:]' '[:upper:]')
if [ -f "$VDIR/data.ts" ] && [ "$FORCE" -eq 0 ]; then
  echo "· data.ts уже есть — не трогаю"
else
  {
    echo "// video-${NN} — данные ролика. CAP перенесён из"
    echo "// queue/video-${NN}/captions.generated.ts после вычитки (шаг 3):"
    echo "// тексты правятся там, тайминги не трогаются нигде. Разметка hl"
    echo "// ставится на шаге 5 вместе со сторибордом."
    echo "import { buildCaptionGroups, type Word } from '../../lib/captionGroups';"
    echo ""
    echo "export const CAP: Word[] = ["
    awk '/^export const CAP = \[/{f=1;next} /^\];/{f=0} f' "$SLOT/captions.generated.ts"
    echo "];"
    echo ""
    echo "export const CAP_GROUPS = buildCaptionGroups(CAP);"
    echo ""
    echo "// Речь ${DUR_SEC}с = ${SPEECH_FRAMES} кадров @${FPS}fps, плюс хвост CTA ${CTA_TAIL}"
    echo "// кадров (призыв не озвучен, 3.5–4с). Пересчитать по сториборду."
    echo "export const ${UP}_DURATION = ${TOTAL};"
    echo "export const ${UP}_FPS = ${FPS};"
    echo ""
    echo "// mean речи ${MEAN_DB} dB — вход формулы громкости SFX (CLAUDE.md, «Звук»):"
    echo "// volume = 10^((mean − 11 − пик_файла)/20), пики в public/shared/sfx/CATALOG.md."
    echo "export const SPEECH_MEAN_DB = ${MEAN_DB};"
    echo ""
    echo "// Границы сцен — из таблицы сцен сториборда (8–12 сцен на 40–45с,"
    echo "// правило 23). Общие для всех веток: биты речи одни и те же."
    echo "export const SCENES: { from: number; to: number }[] = ["
    echo "  { from: 0, to: ${TOTAL} }, // TODO: разбить по битам речи из сториборда"
    echo "];"
  } > "$VDIR/data.ts"
  echo "✓ $VDIR/data.ts — $(grep -c "text:" "$VDIR/data.ts") слов караоке, ${TOTAL} кадров"
fi

# ── ветки тем ────────────────────────────────────────────────────────────────
emit_branch() {
  local key="$1"         # light | emerald
  local Suffix Theme ThemeImport CharLine PosesImport CharImport
  case "$key" in
    light)
      Suffix="Light"; Theme="lightTheme"; ThemeImport="import { lightTheme } from '../../themes/light';"
      # В светлой теме низ кадра закрывает персонаж (правило 20).
      CharImport="import { Character } from '../../lib/Character';"$'\n'
      PosesImport="import { CHAR_POSES } from './dataLight';"$'\n'
      CharLine='      <Character poses={CHAR_POSES} charZone={theme.charZone!} swapMode="dip" />'
      ;;
    emerald)
      Suffix="Emerald"; Theme="emeraldTheme"; ThemeImport="import { emeraldTheme } from '../../themes/emerald';"
      # В тёмных темах низ закрывает контент или футаж, персонажа нет.
      CharImport=""
      PosesImport=""
      CharLine='      {/* Персонажа в тёмной теме нет: низ кадра закрывает контент (правило 20). */}'
      ;;
  esac

  local scenes="$VDIR/scenes${Suffix}.tsx"
  local root="$VDIR/Video${NN}${Suffix}.tsx"

  # Позы персонажа — только светлая ветка: в тёмных его нет.
  if [ "$key" = "light" ] && { [ ! -f "$VDIR/dataLight.ts" ] || [ "$FORCE" -eq 1 ]; }; then
    cat > "$VDIR/dataLight.ts" <<POSES
// video-${NN} — ветка Sticker Light. Смены поз персонажа, абсолютные кадры
// @30fps (Character рендерится сиблингом вне Sequence сцен, поэтому его
// useCurrentFrame() — абсолютный кадр таймлайна). Таблица — из сториборда:
// поза меняется на границе сцены, а не внутри.
import type { PoseKeyframe } from '../../lib/Character';

export const CHAR_POSES: PoseKeyframe[] = [
  { frame: 0, pose: 'think-chin' }, // TODO: расставить по границам сцен
];
POSES
    echo "✓ $VDIR/dataLight.ts"
  fi

  if [ -f "$scenes" ] && [ "$FORCE" -eq 0 ]; then
    echo "· scenes${Suffix}.tsx уже есть — не трогаю"
  else
    cat > "$scenes" <<SCENES
// video-${NN} — сцены ветки ${Suffix}. Постановка берётся из
// queue/video-${NN}/storyboard.md, НЕ из сцен прошлых роликов: оттуда можно
// брать только идиомы движка. Каждый носитель верстается по числам паспорта
// (правило 16) — слов «крупнее/подольше» в паспорте быть не должно, линт их
// теперь ловит (проверка 14).
import React from 'react';
import { AbsoluteFill } from 'remotion';
import type { Theme } from '../../themes/types';

export const Scene1: React.FC<{ theme: Theme }> = ({ theme }) => {
  // TODO: S1 (хук). Правило 12 — главный образ целиком в кадре 0;
  // правило 29 — событие не позже f8.
  return <AbsoluteFill />;
};
SCENES
    echo "✓ $scenes"
  fi

  if [ -f "$root" ] && [ "$FORCE" -eq 0 ]; then
    echo "· Video${NN}${Suffix}.tsx уже есть — не трогаю"
  else
    cat > "$root" <<ROOT
// video-${NN} — корень композиции, ветка ${Suffix}. Сантехника собрана
// scripts/new-video.sh по engine/README.md «Как завести новый ролик».
// Постановка — queue/video-${NN}/storyboard.md.
import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile } from 'remotion';
import { Background } from '../../lib/Background';
import { Captions } from '../../lib/Captions';
${CharImport}import { Bgm } from '../../lib/Bgm';
import { Scene } from '../../lib/Scene';
${ThemeImport}
import { CAP, CAP_GROUPS, SCENES, SPEECH_MEAN_DB, ${UP}_DURATION } from './data';
${PosesImport}import { Scene1 } from './scenes${Suffix}';

export { ${UP}_DURATION } from './data';

export const Video${NN}${Suffix}: React.FC<{ bgm?: boolean }> = ({ bgm = true }) => {
  const theme = ${Theme};

  return (
    <AbsoluteFill style={{ backgroundColor: theme.colors.bg }}>
      <Audio src={staticFile('videos/${NN}/audio.wav')} />
      {bgm && (
        <Bgm
          /* TODO: трек из public/shared/bgm/INDEX.md — не тот, что в прошлом
             ролике (анти-повтор, library/used-log.md). volume 0.11–0.14. */
          src="shared/bgm/TODO.mp3"
          volume={0.12}
          durationInFrames={${UP}_DURATION}
          words={CAP}
          duckDb={4}
        />
      )}
      <Background theme={theme} />

      {SCENES.map((s, i) => (
        <Sequence key={i} from={s.from} durationInFrames={s.to - s.from}>
          <Scene
            durationInFrames={s.to - s.from}
            fadeInFrames={i === 0 ? 0 : undefined}
            fadeOutFrames={i === SCENES.length - 1 ? 0 : undefined}
          >
            {/* TODO: развернуть в явные <Sequence> по сценам сториборда —
                карта выше нужна только чтобы каркас собирался до вёрстки. */}
            <Scene1 theme={theme} />
          </Scene>
        </Sequence>
      ))}

      {/* SFX. Громкость только через sfxGain(пик_из_CATALOG, SPEECH_MEAN_DB)
          из lib/helpers — на глаз нельзя, линт проверяет формулу.
          Стоп-лист сэмплов — public/shared/sfx/NOTES.md.
      <Sequence from={0} durationInFrames={15}>
        <Audio src={staticFile('shared/sfx/impact/hit-blow.mp3')} volume={sfxGain(-1.9, SPEECH_MEAN_DB)} />
      </Sequence> */}

      {/* Переходы на границах смены носителя: z-index 55 (персонаж 40,
          караоке 60), контрастные фону темы. */}

${CharLine}

      <Captions theme={theme} groups={CAP_GROUPS} />
    </AbsoluteFill>
  );
};
ROOT
    echo "✓ $root"
  fi
}

case "$THEMES" in
  light)   emit_branch light ;;
  emerald) emit_branch emerald ;;
  both)    emit_branch light; emit_branch emerald ;;
esac

# ── регистрация в Root.tsx ───────────────────────────────────────────────────
# Root.tsx перечитывается прямо здесь и правится по якорю: параллельные
# сессии делят этот файл (CLAUDE.md, «Параллельная сборка»).
python3 - "$NN" "$THEMES" "$UP" <<'PY'
import io, sys, re
nn, themes, up = sys.argv[1], sys.argv[2], sys.argv[3]
p = 'engine/src/Root.tsx'
s = io.open(p, encoding='utf-8').read()

branches = {'light': ['Light'], 'emerald': ['Emerald'], 'both': ['Emerald', 'Light']}[themes]
if f'id="Video-{nn}-' in s or f'id="Video-{nn}"' in s:
    print(f'· Video-{nn} уже зарегистрирован в Root.tsx — не трогаю')
    raise SystemExit(0)

imports = ''.join(
    f"import {{ Video{nn}{b} }} from './videos/video-{nn}/Video{nn}{b}';\n" for b in branches
)
imports += f"import {{ {up}_DURATION }} from './videos/video-{nn}/data';\n"

# Импорты встают после последнего существующего import — так блок не
# разъезжается при параллельной правке соседней сессией.
last = max(m.end() for m in re.finditer(r'^import .*?;\n', s, re.M))
s = s[:last] + imports + s[last:]

comps = f"\n      {{/* video-{nn} — паспорт queue/video-{nn}/storyboard.md. */}}\n"
for b in branches:
    comps += (
        f'      <Composition\n'
        f'        id="Video-{nn}-{b}"\n'
        f'        component={{Video{nn}{b}}}\n'
        f'        durationInFrames={{{up}_DURATION}}\n'
        f'        fps={{FPS}}\n'
        f'        width={{WIDTH}}\n'
        f'        height={{HEIGHT}}\n'
        f'        defaultProps={{{{ bgm: true }}}}\n'
        f'      />\n'
    )

anchor = '      {/* Новый ролик регистрируется здесь'
assert anchor in s, 'якорь регистрации в Root.tsx не найден — файл изменился, править руками'
s = s.replace(anchor, comps + anchor, 1)
io.open(p, 'w', encoding='utf-8').write(s)
print(f'✓ Root.tsx: ' + ', '.join(f'Video-{nn}-{b}' for b in branches))
PY

echo ""
echo "✓ Каркас video-${NN} готов (${THEMES}). Дальше:"
echo "  1. Таблицу SCENES в data.ts — по битам сториборда (8–12 сцен, правило 23)"
echo "  2. Трек BGM вместо TODO.mp3 (анти-повтор по library/used-log.md)"
echo "  3. Вёрстка сцен по паспорту → node scripts/lint-scenes.mjs ${NN} && npx tsc --noEmit"
