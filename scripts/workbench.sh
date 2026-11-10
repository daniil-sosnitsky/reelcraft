#!/usr/bin/env bash
# Монтажный стол: открыть сданный ролик для доводки без правки кода.
#
#   ./scripts/workbench.sh 05            # ветка по умолчанию (light)
#   ./scripts/workbench.sh 05 terminal   # другая ветка того же ролика
#   ./scripts/workbench.sh               # открыть то, что уже выбрано
#   ./scripts/workbench.sh --stop        # погасить dev server
#
# Что делает: переписывает engine/src/workbench.ts на опись нужного ролика
# и зовёт open.mjs кита — тот линкует engine/src и engine/public в стол,
# поднимает vite на 5198 и открывает браузер с разобранным роликом.
#
# Почему не зовём open.mjs напрямую: он написан под macOS. Опознать «свой»
# vite по командной строке (`ps`) на Windows он не умеет и поэтому НЕ гасит
# старый сервер — при смене ролика стол остался бы на предыдущем проекте
# (алиас @proj прибивается на старте vite). Гасим здесь, через WMI.
set -euo pipefail

RC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
. "$RC/tools/env.sh" # Windows-прослойка, см. tools/WINDOWS.md

WB="$RC/../video-shotcraft/skill/workbench"
PORT=5198
PIDFILE="$WB/.dev.pid"

# ── Погасить dev server стола (свой, по .dev.pid + сверке командной строки) ─
stop_server() {
  [ -f "$PIDFILE" ] || return 0
  local pid cmd
  pid="$(tr -d '[:space:]' <"$PIDFILE")"
  [ -n "$pid" ] || return 0
  cmd="$(powershell.exe -NoProfile -Command \
    "(Get-CimInstance Win32_Process -Filter \"ProcessId=$pid\").CommandLine" 2>/dev/null | tr -d '\r')"
  if printf '%s' "$cmd" | grep -q "vite"; then
    powershell.exe -NoProfile -Command "Stop-Process -Id $pid -Force" >/dev/null 2>&1 || true
    echo "[workbench] dev server остановлен (pid $pid)"
  else
    echo "[workbench] pid $pid — уже не наш vite, чищу .dev.pid"
  fi
  rm -f "$PIDFILE"
}

if [ "${1:-}" = "--stop" ]; then
  stop_server
  exit 0
fi

[ -d "$WB" ] || {
  echo "Нет монтажного стола: $WB (клон каталога приёмов не развёрнут, см. INSTALL.md)" >&2
  exit 2
}

# ── Выбор ролика: переписываем единственную строку engine/src/workbench.ts ──
ENTRY="$RC/engine/src/workbench.ts"
if [ -n "${1:-}" ]; then
  NN="$1"
  BRANCH="${2:-light}"
  DESC="$RC/engine/src/videos/video-$NN/workbench.ts"
  [ "$BRANCH" = "light" ] || DESC="$RC/engine/src/videos/video-$NN-$BRANCH/workbench.ts"
  [ -f "$DESC" ] || {
    echo "Нет описи ролика: ${DESC#"$RC/"}" >&2
    echo "Опись пишется на шаге сдачи, как устроена опись — engine/src/lib/workbench.tsx" >&2
    exit 2
  }
  REL="./videos/$(basename "$(dirname "$DESC")")/workbench"
  python - "$ENTRY" "$REL" <<'PY'
import io, re, sys
path, rel = sys.argv[1], sys.argv[2]
s = io.open(path, encoding='utf-8').read()
s = re.sub(r"export \{ WORKBENCH \} from '[^']*';", f"export {{ WORKBENCH }} from '{rel}';", s)
io.open(path, 'w', encoding='utf-8', newline='\n').write(s)
PY
  echo "[workbench] ролик: $REL"
  stop_server # алиас @proj прибивается на старте vite — без перезапуска стол откроет прежний проект
  node "$WB/scripts/open.mjs" "$RC/engine"
else
  grep -o "from '[^']*'" "$ENTRY" | tail -1 | sed "s/^/[workbench] ролик: /"
  node "$WB/scripts/open.mjs"
fi
