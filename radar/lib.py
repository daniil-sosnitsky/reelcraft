#!/usr/bin/env python3
"""Общее для радара: конфиг, токен, тонкий клиент Apify.

Зависимостей нет намеренно — только стандартная библиотека. Радар должен
подниматься на чистой машине сразу после restore-tools.ps1, без pip install.
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request

# Консоль Windows по умолчанию cp1251 и падает на «→» и эмодзи прямо в
# середине работы. Переключаем вывод на utf-8 здесь, чтобы каждый скрипт
# радара запускался и без tools/env.sh.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding='utf-8')
    except (AttributeError, ValueError):
        pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RADAR = os.path.join(ROOT, 'radar')
RAW = os.path.join(RADAR, 'raw')
OUT = os.path.join(RADAR, 'out')

APIFY_ACTOR = 'apify~instagram-scraper'
API = 'https://api.apify.com/v2'


def load_config():
    with open(os.path.join(RADAR, 'accounts.json'), encoding='utf-8') as f:
        return json.load(f)


def token():
    """Токен только из окружения или .env — хардкод запрещён (CLAUDE.md)."""
    tok = os.environ.get('APIFY_TOKEN')
    if not tok:
        path = os.path.join(ROOT, '.env')
        if os.path.exists(path):
            for line in open(path, encoding='utf-8'):
                line = line.strip()
                if line.startswith('APIFY_TOKEN='):
                    tok = line.split('=', 1)[1].strip()
                    break
    if not tok:
        sys.exit('Нет APIFY_TOKEN: скопируй .env.example в .env и впиши токен.')
    return tok


def _request(url, data=None, method='GET'):
    body = json.dumps(data).encode('utf-8') if data is not None else None
    req = urllib.request.Request(
        url, data=body, method=method,
        headers={'Content-Type': 'application/json'} if body else {})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            raw = r.read()
    except urllib.error.HTTPError as e:
        # Текст ошибки Apify куда полезнее голого кода: там и лимиты, и
        # «актор не найден», и «кончились кредиты».
        sys.exit(f'Apify ответил {e.code}: {e.read().decode("utf-8", "replace")[:500]}')
    return json.loads(raw) if raw else None


def run_actor(payload, tok, poll=10, timeout=900):
    """Запускает актор асинхронно и ждёт завершения.

    Синхронный режим Apify (`run-sync-get-dataset-items`) рвётся по таймауту
    на нескольких аккаунтах, поэтому запускаем run и опрашиваем статус.
    """
    run = _request(f'{API}/acts/{APIFY_ACTOR}/runs?token={tok}', payload, 'POST')['data']
    run_id, ds = run['id'], run['defaultDatasetId']
    print(f'Apify run {run_id} — жду...', flush=True)

    deadline = time.time() + timeout
    while time.time() < deadline:
        time.sleep(poll)
        st = _request(f'{API}/actor-runs/{run_id}?token={tok}')['data']['status']
        if st in ('SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT'):
            print(f'  статус: {st}', flush=True)
            if st != 'SUCCEEDED':
                sys.exit(f'Прогон завершился как {st}. Логи: https://console.apify.com/actors/runs/{run_id}')
            break
        print('  ещё работает...', flush=True)
    else:
        sys.exit(f'Прогон не уложился в {timeout} с. Логи: https://console.apify.com/actors/runs/{run_id}')

    return _request(f'{API}/datasets/{ds}/items?token={tok}&clean=true&format=json')


def views_of(post):
    """Просмотры ролика с фолбэком.

    У Reels Apify отдаёт просмотры не всегда: videoPlayCount бывает пустым,
    иногда есть только videoViewCount. Если нет ни того ни другого — метрика
    считается по лайкам, и тема помечается как грубая (см. rank.py).
    """
    for key in ('videoPlayCount', 'videoViewCount'):
        v = post.get(key)
        if isinstance(v, int) and v > 0:
            return v, key
    likes = post.get('likesCount')
    if isinstance(likes, int) and likes > 0:
        return likes, 'likesCount'
    return 0, 'none'
