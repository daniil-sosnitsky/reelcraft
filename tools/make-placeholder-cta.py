#!/usr/bin/env python3
"""Нейтральные заглушки для CTA-карточки: avatar.png и tg-channel.jpg.

Зачем это нужно. Финальная карточка ролика по умолчанию идёт режимом
proofMode='profile' и рисует круглый аватар канала (channel.ts → ctaAvatar).
Своего аватара у человека на момент установки ещё нет, а Remotion на
отсутствующей картинке валит рендер — то есть первый же настоящий ролик
падал бы на последних секундах. Та же история, что была с позами персонажа:
заглушка нужна не для красоты, а чтобы конвейер запускался целиком.

Заглушки намеренно скучные: серый кружок с силуэтом и серая полоса «шапки».
В ролик такое не выпустишь — и не надо, их место занимает свой файл
(INSTALL.md, шаг 7). Чтобы автопроверки могли отличить заглушку от живого
файла, в метаданные обоих файлов пишется слово ЗАГЛУШКА.

Запуск:  $RC_PY tools/make-placeholder-cta.py [--force]
Нужен Pillow.
"""
from __future__ import annotations

import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw
    from PIL.PngImagePlugin import PngInfo
except ImportError:
    sys.exit("Нужен Pillow:  $RC_PY -m pip install --user Pillow")

ROOT = Path(__file__).resolve().parent.parent
CTA = ROOT / "engine" / "public" / "shared" / "cta"

MARK = "ЗАГЛУШКА reelcraft: заменить своим файлом, см. INSTALL.md шаг 7"

# Серая нейтральная пара: фон чуть светлее силуэта, чтобы в кадре было видно,
# что это именно заглушка, а не битая картинка.
BG = (214, 216, 219, 255)
FG = (150, 154, 160, 255)


def make_avatar(size: int = 512) -> Image.Image:
    """Круглый аватар с силуэтом головы и плеч, с прозрачностью по углам."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse((0, 0, size - 1, size - 1), fill=BG)

    # Голова и плечи — простейший силуэт: он читается на любом размере.
    head_r = size * 0.16
    cx, cy = size / 2, size * 0.40
    d.ellipse((cx - head_r, cy - head_r, cx + head_r, cy + head_r), fill=FG)
    body_w, body_h = size * 0.46, size * 0.30
    d.ellipse(
        (cx - body_w / 2, cy + head_r * 0.35, cx + body_w / 2, cy + head_r * 0.35 + body_h * 2),
        fill=FG,
    )

    # Обрезаем всё за пределами круга: карточка кладёт аватар как есть.
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
    img.putalpha(mask)
    return img


def make_proof(w: int = 828, h: int = 270) -> Image.Image:
    """Полоса «шапки канала» в пропорции по умолчанию (ctaProofAspect 270/828)."""
    img = Image.new("RGB", (w, h), BG[:3])
    d = ImageDraw.Draw(img)
    pad = h * 0.18
    # Кружок аватара слева и две строки-плашки справа — узнаваемый ритм шапки.
    d.ellipse((pad, pad, pad + (h - 2 * pad), h - pad), fill=FG[:3])
    x = pad + (h - 2 * pad) + pad
    d.rounded_rectangle((x, pad, x + (w - x) * 0.55, pad + h * 0.18), radius=h * 0.05, fill=FG[:3])
    d.rounded_rectangle(
        (x, pad + h * 0.30, x + (w - x) * 0.80, pad + h * 0.44), radius=h * 0.05, fill=FG[:3]
    )
    return img


def main() -> None:
    force = "--force" in sys.argv
    CTA.mkdir(parents=True, exist_ok=True)

    avatar = CTA / "avatar.png"
    proof = CTA / "tg-channel.jpg"

    for path in (avatar, proof):
        if path.exists() and not force:
            print(f"~ {path.relative_to(ROOT)} уже есть — пропускаю (--force перезапишет)")

    if not avatar.exists() or force:
        meta = PngInfo()
        meta.add_text("Comment", MARK)
        make_avatar().save(avatar, "PNG", pnginfo=meta)
        print(f"✓ {avatar.relative_to(ROOT)} — серый аватар-заглушка 512×512 с альфой")

    if not proof.exists() or force:
        make_proof().save(proof, "JPEG", quality=88, comment=MARK.encode("utf-8"))
        print(f"✓ {proof.relative_to(ROOT)} — серая «шапка»-заглушка 828×270")

    print("Оба файла — временные. Свои: INSTALL.md, шаг 7; требования — cta/README.md")


if __name__ == "__main__":
    main()
