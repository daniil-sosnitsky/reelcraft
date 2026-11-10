#!/usr/bin/env python3
"""Шаг 1 радара: выгрузить посты аккаунтов-доноров через Apify.

  python radar/fetch.py [--limit N] [--days N] [--dry]

--dry печатает запрос и ничего не отправляет: Apify платный (~$2-3 за 1000
результатов), и отправка данных во внешний сервис — красная зона, поэтому
перед первым боевым прогоном полезно посмотреть, что именно уйдёт.

Результат: radar/raw/posts-YYYY-MM-DD.json (сырой ответ, не в git).
"""
import datetime as dt
import json
import os
import sys

import lib


def main():
    args = sys.argv[1:]
    cfg = lib.load_config()
    limit = cfg['limit_per_account']
    days = cfg['window_days']
    dry = '--dry' in args
    for flag, name in (('--limit', 'limit'), ('--days', 'days')):
        if flag in args:
            val = int(args[args.index(flag) + 1])
            limit, days = (val, days) if name == 'limit' else (limit, val)

    since = (dt.date.today() - dt.timedelta(days=days)).isoformat()
    urls = [f'https://www.instagram.com/{a["username"]}/' for a in cfg['accounts']]

    payload = {
        'directUrls': urls,
        'resultsType': 'posts',
        'resultsLimit': limit,
        'onlyPostsNewerThan': since,
        'addParentData': False,
    }

    print(f'Аккаунтов: {len(urls)}, окно с {since}, потолок {limit} постов на аккаунт.')
    print(f'Верхняя оценка счёта: ~{len(urls) * limit} результатов.')
    if dry:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return

    items = lib.run_actor(payload, lib.token())

    os.makedirs(lib.RAW, exist_ok=True)
    path = os.path.join(lib.RAW, f'posts-{dt.date.today().isoformat()}.json')
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(items, f, ensure_ascii=False, indent=1)

    videos = sum(1 for p in items if p.get('type') == 'Video')
    print(f'Получено {len(items)} постов (из них видео: {videos}) → {path}')


if __name__ == '__main__':
    main()
