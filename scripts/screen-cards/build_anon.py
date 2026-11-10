# Обезличенные пересборки 03-shortlist и 05-ideas.
# Хендлы доноров заменяются на «Аккаунт N» (порядок — как в реальной базе
# shortlist.md), ссылки на посты убираются: shortCode опознаёт аккаунт.
# ВСЕ ЧИСЛА берутся из настоящих файлов и не трогаются.
import io
import os
import re
import sys

sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.dirname(os.path.abspath(__file__))

# порядок = порядок строк «База по аккаунтам» в radar/out/shortlist.md
ORDER = ["chase.h.ai", "gregisenberg", "nick_saraev", "sebintel", "vladimir_sukhov_"]
ANON = {u: f"Аккаунт {i}" for i, u in enumerate(ORDER, 1)}

src = io.open(os.path.join(ROOT, "radar", "out", "shortlist.md"), encoding="utf-8").read()

# --- разбор настоящего shortlist.md ---
base = []
for line in src.splitlines():
    m = re.match(r"\|\s*([\w.\_]+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|", line)
    if m and m.group(1) in ANON:
        base.append((ANON[m.group(1)], m.group(2), m.group(3)))

cand = []
for line in src.splitlines():
    m = re.match(r"\|\s*([\d.]+)\s*\|\s*([\w.\_]+)\s*\|\s*(\d+)\s*\([^)]*\)\s*\|\s*([\d-]+)\s*\|", line)
    if m and m.group(2) in ANON:
        cand.append((m.group(1), ANON[m.group(2)], m.group(3), m.group(4)))

assert len(base) == 5 and len(cand) == 13, (len(base), len(cand))


def sp(n):
    """Разряды неразрывным пробелом — как рендерит Obsidian."""
    return f"{int(n):,}".replace(",", "\u00a0")


CSS = """
*{margin:0;padding:0;box-sizing:border-box}
body{width:1200px;background:#fff;font-family:'Inter','Segoe UI',Arial,sans-serif;color:#1d1f21}
.bar{height:60px;background:#f1f1f3;display:flex;align-items:center;padding:0 22px;gap:10px;
     border-bottom:1px solid #e2e2e6}
.dot{width:15px;height:15px;border-radius:50%}
.t{color:#5a5f66;font-size:22px;margin-left:14px}
.tab{height:58px;display:flex;align-items:center;padding:0 40px;color:#6b7076;font-size:24px;
     border-bottom:1px solid #ececf0}
.tab b{color:#1d1f21;font-weight:700}
.doc{padding:52px 40px 60px 40px}
h1{font-size:54px;line-height:1.15;font-weight:800;letter-spacing:-.5px;margin:0 0 30px 0}
h2{font-size:40px;font-weight:800;margin:46px 0 22px 0}
h3{font-size:36px;font-weight:800;line-height:1.3;margin:44px 0 18px 0}
p{font-size:30px;line-height:1.5;margin:0 0 14px 0;color:#2b2f33}
code.i{font-family:'JetBrains Mono','Consolas',monospace;font-size:26px;background:#f2f2f4;
       padding:3px 10px;border-radius:6px}
table{border-collapse:collapse;margin:8px 0 10px 0}
th,td{border:1px solid #e3e3e7;padding:13px 20px;font-size:30px;text-align:left;white-space:nowrap}
th{color:#5f646a;font-weight:600;background:#fafafb}
pre{background:#f6f6f8;border-radius:10px;padding:26px 28px;margin:6px 0 10px 0;
    font-family:'JetBrains Mono','Consolas',monospace;font-size:25px;line-height:1.62;color:#24282c}
"""


def win(title, tab, body):
    return f"""<!doctype html><html><head><meta charset="utf-8"><style>{CSS}</style></head><body>
<div class="bar"><div class="dot" style="background:#ff5f57"></div>
<div class="dot" style="background:#febc2e"></div><div class="dot" style="background:#28c840"></div>
<div class="t">{title}</div></div>
<div class="tab">Obsidian &nbsp;—&nbsp; <b>{tab}</b></div>
<div class="doc">{body}</div></body></html>"""


# ---------- shortlist ----------
rows_b = "".join(
    f"<tr><td>{a}</td><td>{v}</td><td>{sp(m)}</td></tr>" for a, v, m in base
)
rows_c = "".join(
    f"<tr><td>{x}</td><td>{a}</td><td>{sp(v)}</td><td>{d}</td></tr>" for x, a, v, d in cand
)
body = f"""
<h1>Шортлист радара</h1>
<p>Источник: <code class="i">posts-2026-10-02.json</code></p>
<p>Пороги: выброс ≥ <code class="i">3.0×</code>, просмотры ≥ <code class="i">5000</code>,<br>
не больше 5 на аккаунт.</p>
<h2>База по аккаунтам</h2>
<table><tr><th>Аккаунт</th><th>Видео</th><th>Медиана</th></tr>{rows_b}</table>
<h2>Кандидаты (13)</h2>
<table><tr><th>×</th><th>Аккаунт</th><th>Просмотры</th><th>Дата</th></tr>{rows_c}</table>
"""
io.open(os.path.join(OUT, "shortlist-anon.html"), "w", encoding="utf-8").write(
    win("Obsidian", "shortlist.md", body)
)

# ---------- ideas ----------
body2 = """
<h1>Очередь тем для роликов</h1>
<p>Темы приходят от радара конкурентов.<br>Новые прогоны дописываются сверху.</p>
<h2>Прогон 2026-10-02</h2>
<p>Окно 60 дней, 124 видео,<br>13 прошли пороги, 11 расшифровано.</p>
<h3>1. Личная AI-система<br>в Obsidian 🔥🔥</h3>
<pre>Метрика:   146 785 при медиане 25 228
           → 5,8×   (Аккаунт 1)
Хук:       «Вот моя личная AI-ОС»</pre>
<h3>2. Свой радар конкурентов<br>на бесплатном парсере 🔥</h3>
<pre>Метрика:   60 041 при медиане 497
           → 120,8×  (Аккаунт 5)
Хук:       «Этот бесплатный инструмент
           парсит что угодно»
Наш угол:  не пересказ про библиотеку,
           а СВОЙ результат: я собрал
           радар, который сам смотрит,
           что залетело у конкурентов</pre>
<h3>3. Я раздал работу субагентам,<br>и расход упал</h3>
<pre>Метрика:   60 908 при медиане 19 640
           → 3,1×   (Аккаунт 2)
Хук:       «Эта фича разбивает
           твоего агента на 20»</pre>
<h3>4. Четыре плагина, которые<br>у меня реально стоят</h3>
"""
io.open(os.path.join(OUT, "ideas-anon.html"), "w", encoding="utf-8").write(
    win("Obsidian", "ideas.md", body2)
)

print("база:", base)
print("кандидатов:", len(cand), "первый:", cand[0], "последний:", cand[-1])
print("html готовы")
