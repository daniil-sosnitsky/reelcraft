# Замер целей наезда ПИПЕТКОЙ: вместо «на глаз» ищем плотный bbox чернил
# (пикселей, отличных от фона) внутри заданной грубой области.
import sys
import io
from PIL import Image

sys.stdout.reconfigure(encoding="utf-8")


def bg_of(im, box):
    """Фон = самый частый цвет в области."""
    crop = im.crop(box).convert("RGB")
    return max(crop.getcolors(crop.size[0] * crop.size[1]), key=lambda c: c[0])[1]


def ink_bbox(path, box, thr=34):
    """Тугой bbox по пикселям, отличающимся от фона больше чем на thr."""
    im = Image.open(path).convert("RGB")
    bg = bg_of(im, box)
    x0, y0, x1, y1 = box
    px = im.load()
    minx, miny, maxx, maxy = x1, y1, x0, y0
    for y in range(y0, y1):
        for x in range(x0, x1):
            r, g, b = px[x, y]
            if abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2]) > thr:
                if x < minx: minx = x
                if x > maxx: maxx = x
                if y < miny: miny = y
                if y > maxy: maxy = y
    if minx > maxx:
        return None, bg
    return (minx, miny, maxx - minx + 1, maxy - miny + 1), bg


def report(path, name, box, thr=34):
    r, bg = ink_bbox(path, box, thr)
    if r is None:
        print(f"{name:34s} ПУСТО (фон {bg})")
        return None
    x, y, w, h = r
    print(f"{name:34s} x={x:<5d} y={y:<5d} w={w:<5d} h={h:<4d}  фон={bg}")
    return r
