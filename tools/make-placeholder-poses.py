#!/usr/bin/env python3
"""Нарисовать нейтральные заглушки персонажа светлой темы.

Зачем: светлая тема ставит в низ кадра персонажа и переключает его позы под
речь. Своего персонажа каждый рисует сам (см.
engine/public/shared/character/README.md), но без каких-либо файлов
контрольный рендер падает на отсутствующей картинке — а это первое, что
делает агент после установки. Поэтому в репозитории лежат серые силуэты:
движок с ними запускается, а в ролик такое никто не выпустит по ошибке —
слишком очевидно, что это заглушка.

Запуск (нужен Pillow):
    python tools/make-placeholder-poses.py

Перезаписывает десять файлов в engine/public/shared/character/.
Свои позы положить туда же под теми же именами — скрипт больше не запускать.
"""
import os
import sys

try:
    from PIL import Image, ImageDraw
except ImportError:
    sys.exit("Нужен Pillow:  python -m pip install --user Pillow")

W, H = 1056, 1140
GREY = (154, 160, 166, 235)   # нейтральный серый, слегка прозрачный

# Пропорции фигуры. Рост одинаков на всех позах — иначе персонаж «прыгает»
# при смене кадра, и это первое, что замечают в готовом ролике.
CX = W // 2
HEAD_R = 92
HEAD_CY = 150
BODY_TOP = HEAD_CY + HEAD_R - 10
BODY_BOTTOM = 820
BODY_HW = 128                  # полуширина корпуса
ARM_W = 44
LEG_W = 56

# Позы: углы и длины рук. Угол 0° — рука вниз, положительный — наружу/вверх.
# (левая рука: угол, длина), (правая рука: угол, длина)
POSES = {
    "pose-base":          ((10, 300), (10, 300)),
    "pose-welcome":       ((55, 310), (55, 310)),
    "pose-wave":          ((15, 300), (125, 300)),
    "pose-present-left":  ((95, 320), (10, 300)),
    "pose-present-right": ((10, 300), (95, 320)),
    "pose-think-chin":    ((12, 300), (70, 215)),
    "pose-think-cross":   ((48, 190), (48, 190)),
    "pose-shrug":         ((80, 230), (80, 230)),
    "pose-stop":          ((12, 300), (100, 260)),
    "pose-fists":         ((40, 215), (40, 215)),
}


def draw_arm(d, side, angle_deg, length):
    """Рука одной толстой линией от плеча. side: -1 левая, +1 правая."""
    import math
    sx = CX + side * (BODY_HW - 12)
    sy = BODY_TOP + 70
    rad = math.radians(angle_deg)
    # 0° — вниз, рост угла уводит руку в сторону и выше
    ex = sx + side * math.sin(rad) * length
    ey = sy + math.cos(rad) * length
    d.line([(sx, sy), (ex, ey)], fill=GREY, width=ARM_W)
    r = ARM_W // 2
    d.ellipse([ex - r, ey - r, ex + r, ey + r], fill=GREY)   # кисть


def build(name, arms):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # Голова
    d.ellipse([CX - HEAD_R, HEAD_CY - HEAD_R, CX + HEAD_R, HEAD_CY + HEAD_R], fill=GREY)
    # Корпус
    d.rounded_rectangle(
        [CX - BODY_HW, BODY_TOP, CX + BODY_HW, BODY_BOTTOM], radius=70, fill=GREY
    )
    # Ноги — всегда одинаковые: поза задаётся руками
    for side in (-1, 1):
        x = CX + side * 62
        d.rounded_rectangle(
            [x - LEG_W // 2, BODY_BOTTOM - 30, x + LEG_W // 2, H - 24],
            radius=28, fill=GREY,
        )
    # Руки
    (la, ll), (ra, rl) = arms
    draw_arm(d, -1, la, ll)
    draw_arm(d, +1, ra, rl)
    return img


def main():
    out = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "engine", "public", "shared", "character",
    )
    os.makedirs(out, exist_ok=True)
    for name, arms in POSES.items():
        p = os.path.join(out, f"{name}.png")
        build(name, arms).save(p)
        print(f"  {name}.png")
    print(f"\nГотово: {len(POSES)} заглушек в {out}")
    print("Свои позы кладутся туда же под теми же именами — см. README рядом.")


if __name__ == "__main__":
    main()
