# HTML-карточка → PNG СВОИМ headless Chrome, без общего браузера сессии.
#
# Почему не MCP-браузер: он один на машину и его может перехватить соседняя
# сессия — тогда в файл ложится чужая страница или чужой device scale factor,
# а по виду кадра это не отличить. Здесь процесс свой на каждый снимок.
#
# Высота карточки заранее неизвестна (перенос строк), поэтому снимаем окном
# с запасом, а фон страницы на время съёмки подменяем сигнальным цветом —
# по нему и обрезаем ровно окно карточки.
#
# Запуск: python scripts/screen-cards/shoot_cards.py v05-01-hook.html out.png [ширина]
import io
import os
import re
import subprocess
import sys
import tempfile

from PIL import Image

sys.stdout.reconfigure(encoding="utf-8")

CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
HERE = os.path.dirname(os.path.abspath(__file__))
GEN = os.path.join(HERE, "templates")
SENTINEL = (255, 0, 255)


def shoot(html_name, out_png, width=3600, max_height=12000):
    src = os.path.join(GEN, html_name)
    html = io.open(src, encoding="utf-8").read()
    # фон страницы (не окна карточки) — сигнальный, по нему режем
    html2, n = re.subn(r"html \{ background:#[0-9a-fA-F]{6}; \}",
                       "html { background:#FF00FF; }", html)
    if not n:
        raise SystemExit("не нашёл правило html{background} в " + html_name)
    # временный HTML — во временную папку системы, НЕ в templates/:
    # автобэкап каждые 2 часа успел закоммитить его как файл проекта
    tmp_html = os.path.join(tempfile.gettempdir(), "_shoot_tmp.html")
    io.open(tmp_html, "w", encoding="utf-8").write(html2)
    tmp_png = os.path.join(tempfile.gettempdir(), "_shoot_tmp.png")
    subprocess.run(
        [CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
         "--force-device-scale-factor=1",
         "--window-size=%d,%d" % (width, max_height),
         "--screenshot=" + tmp_png, "file:///" + src.replace("\\", "/")
         if False else "file:///" + tmp_html.replace("\\", "/")],
        capture_output=True, text=True, timeout=180,
    )
    im = Image.open(tmp_png).convert("RGB")
    px = im.load()
    W, H = im.size
    bottom = 0
    for y in range(H - 1, -1, -1):
        if px[W // 2, y] != SENTINEL and px[5, y] != SENTINEL:
            bottom = y
            break
    right = 0
    for x in range(W - 1, -1, -1):
        if px[x, 5] != SENTINEL:
            right = x
            break
    im.crop((0, 0, right + 1, bottom + 1)).save(out_png)
    os.remove(tmp_html)
    print("%s  %dx%d" % (out_png, right + 1, bottom + 1))
    return right + 1, bottom + 1


if __name__ == "__main__":
    name, out = sys.argv[1], sys.argv[2]
    w = int(sys.argv[3]) if len(sys.argv) > 3 else 3600
    shoot(name, out, w)
