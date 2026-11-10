import re
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from make_code_html import render, esc

# Шаблоны и промежуточный HTML лежат рядом со скриптом, а не во временной
# папке сессии: та удаляется вместе с сессией и уносила бы генераторы.
GEN = os.path.join(os.path.dirname(os.path.abspath(__file__)), "templates")
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def hl_json(line):
    """Подсветка JSON: ключ, строковое значение, число."""
    out = []
    i = 0
    for m in re.finditer(r'"(?:[^"\\]|\\.)*"|\b\d+(?:\.\d+)?\b', line):
        out.append('<span class="p">%s</span>' % esc(line[i:m.start()]))
        tok = m.group(0)
        if tok.startswith('"'):
            rest = line[m.end():].lstrip()
            cls = "k" if rest.startswith(":") else "q"
        else:
            cls = "v"
        out.append('<span class="%s">%s</span>' % (cls, esc(tok)))
        i = m.end()
    out.append('<span class="p">%s</span>' % esc(line[i:]))
    return "".join(out)


def hl_sh(line):
    """Подсветка bash: комментарий целиком, иначе число/строка."""
    stripped = line.lstrip()
    if stripped.startswith("#"):
        return '<span class="c">%s</span>' % esc(line)
    out = []
    i = 0
    for m in re.finditer(r'"(?:[^"\\]|\\.)*"|\b\d+\b', line):
        out.append('<span class="p">%s</span>' % esc(line[i:m.start()]))
        tok = m.group(0)
        out.append('<span class="%s">%s</span>' % ("q" if tok.startswith('"') else "v", esc(tok)))
        i = m.end()
    out.append('<span class="p">%s</span>' % esc(line[i:]))
    return "".join(out)


render(ROOT + r"\radar\accounts.json", GEN + r"\accounts-full.html",
       "Visual Studio Code", "accounts.json &nbsp;—&nbsp; <b>reelcraft/radar</b>",
       1, 27, hl_json)

render(ROOT + r"\radar\accounts.json", GEN + r"\accounts-safe.html",
       "Visual Studio Code", "accounts.json &nbsp;—&nbsp; <b>reelcraft/radar</b>",
       8, 19, hl_json)

render(ROOT + r"\radar\run.sh", GEN + r"\runsh.html",
       "Visual Studio Code", "run.sh &nbsp;—&nbsp; <b>reelcraft/radar</b>",
       12, 24, hl_sh)
