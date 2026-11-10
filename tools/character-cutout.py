# -*- coding: utf-8 -*-
"""Магента -> альфа, нормализация роста и выравнивание по центру головы."""
import os, numpy as np
from PIL import Image

SRC, DST = 'char-raw', 'char-out'
os.makedirs(DST, exist_ok=True)

CANVAS_W, CANVAS_H = 1056, 1140
TOP_MARGIN = 130          # как у заглушки: макушка на этой высоте
FIG_H = CANVAS_H - TOP_MARGIN   # фигура уходит за нижнюю кромку (она обрезана по бедро)
BG = np.array([248.0, 4.0, 251.0], dtype=np.float32)

def cut(path):
    rgb = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    # «магентовость»: красный и синий высоко, зелёный низко
    score = (rgb[:, :, 0] + rgb[:, :, 2]) / 2.0 - rgb[:, :, 1]
    alpha = np.clip((110.0 - score) / 70.0, 0, 1)
    # снять розовую кайму: из полупрозрачных пикселей вычесть вклад фона
    a3 = alpha[:, :, None]
    clean = np.where(a3 > 0.004, (rgb - (1 - a3) * BG) / np.maximum(a3, 0.004), rgb)
    out = np.dstack([np.clip(clean, 0, 255), alpha * 255]).astype(np.uint8)
    return Image.fromarray(out, 'RGBA'), alpha

rows = []
for n in sorted(os.listdir(SRC)):
    if not n.endswith('.png'):
        continue
    img, alpha = cut(os.path.join(SRC, n))
    m = alpha > 0.5
    ys, xs = np.where(m)
    top, bot = int(ys.min()), int(ys.max())
    # центр головы — по верхней полосе в 8% роста (там только голова)
    band = m[top:top + int((bot - top) * 0.08) + 1, :]
    bxs = np.where(band.any(axis=0))[0]
    head_cx = (int(bxs.min()) + int(bxs.max())) / 2.0

    k = FIG_H / (bot - top)                      # единый рост для всех поз
    img2 = img.resize((round(img.width * k), round(img.height * k)), Image.LANCZOS)

    canvas = Image.new('RGBA', (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    off_x = round(CANVAS_W / 2 - head_cx * k)    # голова по центру холста
    off_y = round(TOP_MARGIN - top * k)          # макушка на TOP_MARGIN
    canvas.alpha_composite(img2, (off_x, off_y))
    canvas.save(os.path.join(DST, n))

    a = np.asarray(canvas)[:, :, 3]
    ys2, xs2 = np.where(a > 8)
    rows.append((n, k, int(ys2.min()), int(xs2.min()), int(xs2.max())))

print(f'{"файл":26} {"масштаб":>8} {"макушка":>8} {"лево":>6} {"право":>6}')
for n, k, t, l, r in rows:
    print(f'{n:26} {k:8.3f} {t:8d} {l:6d} {r:6d}')
