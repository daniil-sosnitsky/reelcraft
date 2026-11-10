#!/usr/bin/env bash
. "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/tools/env.sh"   # прослойка окружения, см. tools/env.sh
# qa-auto.sh <video.mp4> [--theme light|dark] — автопроверки чернового рендера
# перед терчеком (правила 12, 20, 21, 26 CLAUDE.md). Один проход ffmpeg:
# кадры с шагом 5 (≈0.17с при 30fps), уменьшенные до ширины 180 — дальше
# считает Python+PIL. Тема (границы контент-зоны) определяется по яркости
# кадра 0, можно задать явно.
#
#   а) «пустой кадр» — весь кадр без читаемого объекта (std яркости < 10)
#      дольше 0.3с (правило 21);
#   б) «полоса пустого фона» — в контент-зоне (light 0–880, dark 0–1450)
#      однородная по вертикали полоса выше 400px держится ≥1.5с (правило 20);
#      полоса от y=0 = «пустой верх»;
#   в) «срез кромкой» — непрозрачный объект касается верхней или боковой
#      кромки ≥0.5с (правило 26; низ не проверяется — там персонаж/пол);
#   г) «обложка» — кадр 0: полоса пустого фона и срез кромкой (правило 12).
# Итог: PASS / WARN со списком находок. Python — только /usr/bin/python3 (там PIL).
set -euo pipefail

VIDEO="${1:-}"
[ -n "$VIDEO" ] && [ -f "$VIDEO" ] || { echo "Использование: scripts/qa-auto.sh <video.mp4> [--theme light|dark]"; exit 1; }
THEME=""
if [ "${2:-}" = "--theme" ]; then THEME="${3:-}"; fi
command -v ffmpeg >/dev/null || { echo "✗ Нужен ffmpeg"; exit 1; }
command -v ffprobe >/dev/null || { echo "✗ Нужен ffprobe"; exit 1; }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

FPS_RAW=$(ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate -of csv=p=0 "$VIDEO" | tr -d '[:space:],')

STEP=5
mkdir -p "$WORK/frames"
ffmpeg -hide_banner -loglevel error -i "$VIDEO" \
  -vf "select='not(mod(n\,${STEP}))',scale=180:-1" -fps_mode passthrough \
  "$WORK/frames/f_%06d.png"

python3 - "$WORK/frames" "$FPS_RAW" "$STEP" "$THEME" <<'PYEOF'
import sys, os, glob, warnings
warnings.filterwarnings("ignore")
from PIL import Image, ImageStat

frames_dir, fps_raw, step, theme = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4]
try:
    n, d = (fps_raw.split('/') + ['1'])[:2]
    fps = float(n) / float(d)
except Exception:
    fps = 30.0
if fps <= 0:
    fps = 30.0
files = sorted(glob.glob(os.path.join(frames_dir, "f_*.png")))
if not files:
    print("✗ кадры не извлеклись"); sys.exit(1)

imgs = [Image.open(f).convert("L") for f in files]
W, H = imgs[0].size
sy = H / 1920.0  # масштаб: px кадра → px исходной вертикали 1920

# ── тема по яркости кадра 0 ──
if theme not in ("light", "dark"):
    theme = "light" if ImageStat.Stat(imgs[0]).mean[0] > 128 else "dark"
ZONE_BOTTOM = 880 if theme == "light" else 1450
zone_h = int(ZONE_BOTTOM * sy)

FULL_THRESH, FULL_MIN_S = 10.0, 0.3
BAND_MIN_PX, BAND_MIN_S = 400, 1.5
ROW_STD, ROW_MEAN_TOL = 5.0, 8.0
EDGE_MIN_S = 0.5

def bg_of(img):
    # фон = самая частая яркость в контент-зоне (квантование по 4)
    hist = img.crop((0, 0, W, zone_h)).histogram()
    q = [sum(hist[i:i+4]) for i in range(0, 256, 4)]
    return q.index(max(q)) * 4 + 2

def row_stats(img):
    px = img.load()
    out = []
    for y in range(H):
        vals = [px[x, y] for x in range(W)]
        m = sum(vals) / W
        v = sum((p - m) ** 2 for p in vals) / W
        out.append((m, v ** 0.5))
    return out

def longest_uniform_band(rows, bg):
    # самая длинная полоса подряд идущих «пустых» строк в контент-зоне
    best = (0, 0, 0); cur = 0; start = 0
    for y in range(zone_h + 1):
        empty = y < zone_h and rows[y][1] < ROW_STD and abs(rows[y][0] - bg) < ROW_MEAN_TOL
        if empty:
            if cur == 0: start = y
            cur += 1
        else:
            if cur > best[0]: best = (cur, start, y - 1)
            cur = 0
    return best  # (len, y0, y1) в px кадра

EDGE_JUMP = 14  # скачок яркости между соседними пикселями вдоль кромки = объект

def edge_touch(img, rows, bg):
    # Градиент фона (блик сверху, виньетка) меняется плавно — соседние пиксели
    # вдоль кромки почти равны. Объект, срезанный кромкой (карточка, текст,
    # скрин), даёт резкий скачок. Поэтому смотрим не std линии, а максимальную
    # разность соседних пикселей на ней.
    px = img.load()
    def line_jump(coords):
        vals = [px[x, y] for x, y in coords]
        return max((abs(vals[i] - vals[i - 1]) for i in range(1, len(vals))), default=0)
    top = max(line_jump([(x, y) for x in range(W)]) for y in range(0, 2)) > EDGE_JUMP
    left = max(line_jump([(x, y) for y in range(zone_h)]) for x in range(0, 2)) > EDGE_JUMP
    right = max(line_jump([(x, y) for y in range(zone_h)]) for x in range(W - 2, W)) > EDGE_JUMP
    return top, left, right

full_flags, band_flags, band_info, top_flags, side_flags = [], [], [], [], []
for img in imgs:
    bg = bg_of(img)
    rows = row_stats(img)
    full_flags.append(ImageStat.Stat(img).stddev[0] < FULL_THRESH)
    ln, y0, y1 = longest_uniform_band(rows, bg)
    band_flags.append(ln / sy >= BAND_MIN_PX)
    band_info.append((int(y0 / sy), int(y1 / sy)))
    t, l, r = edge_touch(img, rows, bg)
    top_flags.append(t)
    side_flags.append(l or r)

def runs(flags, min_s):
    out, start = [], None
    for i, fl in enumerate(flags + [False]):
        if fl and start is None:
            start = i
        elif not fl and start is not None:
            if (i - start) * step / fps >= min_s:
                out.append((start, i - 1))
            start = None
    return out

def fr(i): return i * step
def sec(i): return i * step / fps

total = 0
print(f"тема: {theme} (контент-зона 0–{ZONE_BOTTOM}), fps {fps:g}, кадров проверено {len(imgs)}")
print()
print("── а) пустые кадры (std всего кадра < %.0f, ≥ %.1fс) — правило 21 ──" % (FULL_THRESH, FULL_MIN_S))
r = runs(full_flags, FULL_MIN_S); total += len(r)
for a, b in r:
    print(f"WARN пустой кадр f{fr(a)}–f{fr(b)} (~{sec(a):.1f}s–{sec(b):.1f}s)")
if not r: print("  (не найдено)")

print()
print("── б) полоса пустого фона в контент-зоне (≥ %dpx по вертикали, ≥ %.1fс) — правило 20 ──" % (BAND_MIN_PX, BAND_MIN_S))
r = runs(band_flags, BAND_MIN_S); total += len(r)
for a, b in r:
    y0, y1 = band_info[(a + b) // 2]
    where = "пустой верх" if y0 <= 20 else "пустая полоса"
    print(f"WARN {where} y={y0}–{y1} f{fr(a)}–f{fr(b)} (~{sec(a):.1f}s–{sec(b):.1f}s)")
if not r: print("  (не найдено)")

print()
print("── в) срез кромкой (объект касается верха/боков ≥ %.1fс) — правило 26 ──" % EDGE_MIN_S)
r1 = runs(top_flags, EDGE_MIN_S); r2 = runs(side_flags, EDGE_MIN_S); total += len(r1) + len(r2)
for a, b in r1:
    print(f"WARN касание верхней кромки f{fr(a)}–f{fr(b)} (~{sec(a):.1f}s–{sec(b):.1f}s)")
for a, b in r2:
    print(f"WARN касание боковой кромки f{fr(a)}–f{fr(b)} (~{sec(a):.1f}s–{sec(b):.1f}s) — если это «во весь кадр», пометка в коде")
if not (r1 or r2): print("  (не найдено)")

print()
print("── г) обложка (кадр 0) — правило 12 ──")
cover = []
if band_flags[0]:
    y0, y1 = band_info[0]; cover.append(f"полоса пустого фона y={y0}–{y1}")
if top_flags[0]: cover.append("объект срезан верхней кромкой")
if side_flags[0]: cover.append("объект срезан боковой кромкой")
if full_flags[0]: cover.append("кадр пустой")
total += len(cover)
for c in cover: print(f"WARN обложка: {c}")
if not cover: print("  (ок)")

print()
print("── Итог ──")
print("WARN — см. находки выше" if total else "PASS")
PYEOF
