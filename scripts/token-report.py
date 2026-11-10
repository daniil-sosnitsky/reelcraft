#!/usr/bin/env python
"""Расход токенов по сессиям проекта — чтобы норма «столько-то на ролик» была проверяемой.

Зачем: лимиты сжигает не рендер и не размер файлов, а число ЗАПРОСОВ,
помноженное на размер контекста в каждом. Этого не видно ниоткуда, кроме
логов сессий, поэтому замер вынесен в скрипт.

    python scripts/token-report.py            # сегодня
    python scripts/token-report.py --days 7   # неделя
    python scripts/token-report.py --session bc631688   # разбор одной сессии
"""
import json, os, glob, argparse, collections, datetime as dt

# Папка логов сессий: имя собирается из пути проекта — замени на своё,
# подсмотрев фактическое имя в %USERPROFILE%\.claude\projects\
LOGS = os.path.expandvars(r"%USERPROFILE%\.claude\projects\<имя-папки-проекта>")


def scan(path):
    """Суммы по одному файлу лога: запросы, входные токены, выход, модель, вызовы инструментов."""
    cr = cc = out = n = 0
    model = "?"
    tools = collections.Counter()
    peak = 0
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            try:
                r = json.loads(line)
            except Exception:
                continue
            if r.get("type") != "assistant":
                continue
            m = r.get("message") or {}
            u = m.get("usage") or {}
            ctx = u.get("cache_read_input_tokens", 0) + u.get("input_tokens", 0) + u.get("cache_creation_input_tokens", 0)
            peak = max(peak, ctx)
            cr += u.get("cache_read_input_tokens", 0) + u.get("input_tokens", 0)
            cc += u.get("cache_creation_input_tokens", 0)
            out += u.get("output_tokens", 0)
            n += 1
            if m.get("model"):
                model = m["model"]
            c = m.get("content")
            if isinstance(c, list):
                for b in c:
                    if isinstance(b, dict) and b.get("type") == "tool_use":
                        nm = b["name"]
                        if nm in ("Agent", "Task"):
                            nm = "Agent:" + str((b.get("input") or {}).get("subagent_type", "?"))
                        tools[nm] += 1
    return dict(req=n, inp=cr + cc, out=out, model=model, tools=tools, peak=peak)


def agent_type(jsonl):
    """Тип субагента лежит в соседнем .meta.json; без него строка нечитаема."""
    try:
        m = json.load(open(jsonl[:-6] + ".meta.json", encoding="utf-8"))
        return m.get("agentType") or m.get("subagent_type") or "?"
    except Exception:
        return "?"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=1)
    ap.add_argument("--session", default=None)
    a = ap.parse_args()
    cutoff = dt.datetime.now() - dt.timedelta(days=a.days)

    sessions = []
    for p in glob.glob(os.path.join(LOGS, "*.jsonl")):
        sid = os.path.basename(p)[:-6]
        if a.session and not sid.startswith(a.session):
            continue
        if not a.session and dt.datetime.fromtimestamp(os.path.getmtime(p)) < cutoff:
            continue
        sessions.append((sid, p))

    grand = collections.Counter()
    by_role = collections.Counter()
    for sid, p in sorted(sessions):
        s = scan(p)
        if not s["req"]:
            continue
        print("== сессия %s  %s" % (sid[:8], s["model"]))
        print("   режиссёр: %4d запросов, вход %11d ток (ср. %6d, пик %6d), выход %7d"
              % (s["req"], s["inp"], s["inp"] // max(s["req"], 1), s["peak"], s["out"]))
        grand["req"] += s["req"]; grand["inp"] += s["inp"]; grand["out"] += s["out"]
        by_role["режиссёр"] += s["inp"]
        subs = sorted(glob.glob(os.path.join(LOGS, sid, "subagents", "agent-*.jsonl")),
                      key=os.path.getsize, reverse=True)
        for f in subs:
            t = scan(f)
            if not t["req"]:
                continue
            at = agent_type(f)
            print("   %-16s %4d запросов, вход %11d ток (ср. %6d, пик %6d), инструментов %3d"
                  % (at[:16], t["req"], t["inp"], t["inp"] // max(t["req"], 1), t["peak"], sum(t["tools"].values())))
            grand["req"] += t["req"]; grand["inp"] += t["inp"]; grand["out"] += t["out"]
            by_role[at] += t["inp"]
    print()
    print("ИТОГО за %d дн.: запросов %d, вход %.1f млн ток, выход %.2f млн"
          % (a.days, grand["req"], grand["inp"] / 1e6, grand["out"] / 1e6))
    for k, v in by_role.most_common():
        print("   %-18s %6.1f млн  %4.0f%%" % (k, v / 1e6, 100 * v / max(grand["inp"], 1)))


if __name__ == "__main__":
    main()
