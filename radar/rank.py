#!/usr/bin/env python3
"""Шаг 2 радара: посчитать коэффициент выброса и отобрать кандидатов.

  python radar/rank.py [radar/raw/posts-YYYY-MM-DD.json] [--min 3.0]

Почему не сырые просмотры. Их нельзя сравнивать между аккаунтами: 100 000 у
автора с двумя миллионами подписчиков — провал, 20 000 у автора с пятью
тысячами — попадание. Сравнима только величина «во сколько раз ролик обошёл
собственную медиану аккаунта» (docs/РАДАР-ПЛАН.md, раздел «Метрика»).

Медиана, а не среднее: один залетевший ролик утаскивает среднее вверх и
прячет остальные выбросы.

Результат: radar/out/shortlist.json + radar/out/shortlist.md (читать глазами).
"""
import json
import os
import statistics
import sys

import lib

# Меньше этого числа роликов на аккаунт — медиана недостоверна, аккаунт
# считаем, но помечаем: на трёх роликах «выброс» может быть случайностью.
MIN_POSTS_FOR_MEDIAN = 6


def latest_raw():
    files = sorted(f for f in os.listdir(lib.RAW) if f.startswith('posts-'))
    if not files:
        sys.exit('В radar/raw/ нет выгрузок — сначала python radar/fetch.py')
    return os.path.join(lib.RAW, files[-1])


def main():
    args = sys.argv[1:]
    cfg = lib.load_config()
    min_outlier = float(args[args.index('--min') + 1]) if '--min' in args else cfg['min_outlier']
    min_views = int(args[args.index('--min-views') + 1]) if '--min-views' in args else cfg.get('min_views', 0)
    max_per_account = cfg.get('max_per_account', 99)
    src = next((a for a in args if a.endswith('.json')), None) or latest_raw()

    with open(src, encoding='utf-8') as f:
        posts = json.load(f)

    # Только видео: радар ищет темы для роликов, карусели и фото не годятся.
    by_account = {}
    for p in posts:
        if p.get('type') != 'Video':
            continue
        by_account.setdefault(p.get('ownerUsername') or '?', []).append(p)

    picked, stats = [], []
    for user, items in sorted(by_account.items()):
        measured = [(p,) + lib.views_of(p) for p in items]
        values = [v for _, v, _ in measured if v > 0]
        if not values:
            stats.append((user, len(items), 0, 'нет ни просмотров, ни лайков'))
            continue
        median = statistics.median(values)
        shaky = len(values) < MIN_POSTS_FOR_MEDIAN
        stats.append((user, len(items), int(median), 'мало роликов для медианы' if shaky else ''))

        for post, value, source in measured:
            if value <= 0 or median <= 0:
                continue
            coef = value / median
            # Два порога сразу: относительный — тема обошла свою ленту,
            # абсолютный — её вообще посмотрело живое количество людей.
            if coef < min_outlier or value < min_views:
                continue
            picked.append({
                'account': user,
                'url': post.get('url'),
                'shortCode': post.get('shortCode'),
                'date': (post.get('timestamp') or '')[:10],
                'metric': value,
                'metricSource': source,
                'median': int(median),
                'outlier': round(coef, 2),
                # Метрика грубая, если считали по лайкам или медиана шаткая —
                # такие кандидаты смотреть глазами внимательнее.
                'rough': source == 'likesCount' or shaky,
                'caption': (post.get('caption') or '').strip(),
                'likes': post.get('likesCount'),
                'comments': post.get('commentsCount'),
                'duration': post.get('videoDuration'),
                'videoUrl': post.get('videoUrl'),
            })

    picked.sort(key=lambda x: -x['outlier'])

    # Потолок на донора: иначе один аккаунт с удачным месяцем забивает весь
    # шортлист, и радар перестаёт быть радаром по нише.
    seen, capped = {}, []
    for p_ in picked:
        n = seen.get(p_['account'], 0)
        if n >= max_per_account:
            continue
        seen[p_['account']] = n + 1
        capped.append(p_)
    dropped, picked = len(picked) - len(capped), capped

    os.makedirs(lib.OUT, exist_ok=True)
    with open(os.path.join(lib.OUT, 'shortlist.json'), 'w', encoding='utf-8') as f:
        json.dump(picked, f, ensure_ascii=False, indent=1)

    lines = ['# Шортлист радара', '',
             f'Источник: `{os.path.basename(src)}`. Пороги: выброс ≥ {min_outlier}×, '
             f'просмотры ≥ {min_views}, не больше {max_per_account} на аккаунт '
             f'(срезано сверх потолка: {dropped}).', '',
             '## База по аккаунтам', '',
             '| Аккаунт | Видео | Медиана | Примечание |', '|---|---|---|---|']
    lines += [f'| {u} | {n} | {m} | {note} |' for u, n, m, note in stats]
    lines += ['', f'## Кандидаты ({len(picked)})', '',
              '| × | Аккаунт | Метрика | Дата | Ссылка | Грубо |', '|---|---|---|---|---|---|']
    for p in picked:
        lines.append(f'| {p["outlier"]} | {p["account"]} | {p["metric"]} ({p["metricSource"]}) '
                     f'| {p["date"]} | {p["url"]} | {"⚠️" if p["rough"] else ""} |')
    with open(os.path.join(lib.OUT, 'shortlist.md'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines) + '\n')

    print(f'Видео всего: {sum(len(v) for v in by_account.values())}, '
          f'прошли оба порога: {len(picked)} → radar/out/shortlist.md')


if __name__ == '__main__':
    main()
