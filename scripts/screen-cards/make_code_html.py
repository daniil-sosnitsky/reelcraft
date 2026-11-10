# Генератор HTML-карточки кода из РЕАЛЬНОГО файла.
# Зачем: прошлый скрин accounts.json был подделан (комментарии // в JSON,
# сдвинутые номера строк). Здесь контент и нумерация берутся из файла как есть.
import html
import sys
import io

sys.stdout.reconfigure(encoding="utf-8")

TPL = """<!doctype html><html><head><meta charset="utf-8"><style>
@font-face {{ font-family: 'JB'; src: local('JetBrains Mono'), local('Consolas'); }}
* {{ margin:0; padding:0; box-sizing:border-box; }}
body {{ width:1200px; background:#1b2029; font-family:'JetBrains Mono','Consolas',monospace; }}
.win {{ width:1200px; background:#1b2029; }}
.bar {{ height:58px; background:#141922; display:flex; align-items:center; padding:0 22px; gap:10px; }}
.dot {{ width:15px; height:15px; border-radius:50%; }}
.t {{ color:#8c97a8; font-size:21px; margin-left:14px; letter-spacing:.3px; }}
.tab {{ height:56px; background:#171c25; display:flex; align-items:center;
       padding:0 26px; color:#c8d2e0; font-size:21px; border-bottom:1px solid #222935; }}
.tab b {{ color:#fff; font-weight:600; }}
.code {{ padding:26px 0 30px 0; }}
.ln {{ display:flex; align-items:flex-start; line-height:42px; height:42px; }}
.n {{ width:84px; text-align:right; padding-right:26px; color:#4d586b; font-size:21px; flex:none; }}
.s {{ font-size:23px; white-space:pre; color:#d8e0ec; }}
.k {{ color:#7fb3ff; }}   /* ключ */
.v {{ color:#f0b86e; }}   /* число */
.q {{ color:#8fd98f; }}   /* строка */
.c {{ color:#5f6b7d; font-style:italic; }} /* комментарий */
.p {{ color:#aab4c4; }}
</style></head><body><div class="win">
<div class="bar"><div class="dot" style="background:#ff5f57"></div>
<div class="dot" style="background:#febc2e"></div>
<div class="dot" style="background:#28c840"></div>
<div class="t">{title}</div></div>
<div class="tab">{tab}</div>
<div class="code">{lines}</div></div></body></html>"""


def esc(s):
    return html.escape(s)


def render(path, out, title, tab, first, last, highlighter):
    raw = io.open(path, encoding="utf-8").read().split("\n")
    rows = []
    for i in range(first, last + 1):
        line = raw[i - 1].rstrip("\n")
        rows.append(
            '<div class="ln"><div class="n">%d</div><div class="s">%s</div></div>'
            % (i, highlighter(line))
        )
    io.open(out, "w", encoding="utf-8").write(
        TPL.format(title=esc(title), tab=tab, lines="\n".join(rows))
    )
    print("written", out, "lines", first, "-", last)
