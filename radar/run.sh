#!/usr/bin/env bash
# Полный цикл радара с повторами. Это то, что запускает скилл reels-radar.
#
#   bash radar/run.sh [N] [--attempts K]
#     N          сколько верхних кандидатов тянуть (по умолчанию 8)
#     --attempts сколько раз повторять при неудаче (по умолчанию 5)
#
#   bash radar/run.sh --attempts 0     # ничего не тратя, показать чего не хватает
#
# Правило автора (2026-10-02): пробовать до 5 раз, и только потом звать его.
# Поэтому цикл сам переделывает выгрузку и дотягивает то, что не далось.
#
# ⚠️ Повтор здесь ПЛАТНЫЙ. Прямые ссылки на видео живут меньше часа, и чинятся
# они только новой выгрузкой Apify — это примерно $0.4 за попытку. Пять
# попыток ≈ $2 за прогон. Поэтому:
#   · кандидаты без звуковой дорожки помечаются навсегда (radar/out/
#     _noaudio.txt) и в повторах не участвуют — их новая выгрузка не починит;
#   · уже расшифрованное не перекачивается;
#   · цикл выходит сразу, как только тянуть больше нечего.
set -uo pipefail          # без -e: ненулевой код pull.sh здесь ожидаемый
cd "$(dirname "$0")/.."

TOP=8
ATTEMPTS=5
while [ $# -gt 0 ]; do
  case "$1" in
    --attempts) ATTEMPTS="$2"; shift 2 ;;
    *[!0-9]*)   echo "Непонятный аргумент: $1"; exit 1 ;;
    *)          TOP="$1"; shift ;;
  esac
done
case "$ATTEMPTS" in ''|*[!0-9]*) echo "--attempts ждёт число"; exit 1 ;; esac
# --attempts 0 — не вырожденный случай, а полезный режим: цикл не выполняется
# ни разу, и скрипт просто печатает список недотянутых кандидатов. Ни одного
# обращения к Apify, то есть бесплатно.

echo "Радар: до $TOP кандидатов, попыток не больше $ATTEMPTS."
echo "Каждая попытка — это прогон Apify, ~\$0.4."
echo

for ((n = 1; n <= ATTEMPTS; n++)); do
  echo "── Попытка $n из $ATTEMPTS ──"

  python radar/fetch.py || { echo "✗ Выгрузка не удалась — дальше смысла нет."; exit 1; }
  python radar/rank.py  || { echo "✗ Отбор не удался."; exit 1; }

  bash radar/pull.sh "$TOP"
  CODE=$?

  if [ "$CODE" -eq 0 ]; then
    echo
    echo "✓ Всё, что можно было вытянуть, вытянуто за $n попыт(ку/ки)."
    exit 0
  fi
  if [ "$CODE" -ne 10 ]; then
    echo "✗ Скачивание упало с кодом $CODE — это не протухшая ссылка, повтор не поможет."
    exit "$CODE"
  fi

  echo "  часть ссылок протухла — пробую ещё раз"
  echo
done

# Сюда попадаем, только если 5 попыток не закрыли вопрос — вот теперь зовём
# автора, а не продолжаем жечь деньги.
echo
echo "✗ $ATTEMPTS попыт(ка/ки) не хватило. Не вытянуто:"
python - <<'PY'
import json, os, sys
sys.stdout.reconfigure(encoding='utf-8')
items = json.load(open('radar/out/shortlist.json', encoding='utf-8'))
skip = set()
if os.path.exists('radar/out/_noaudio.txt'):
    skip = {l.strip() for l in open('radar/out/_noaudio.txt', encoding='utf-8') if l.strip()}
for it in items:
    name = f"{it['account']}-{it['shortCode']}"
    if os.path.exists(f'radar/out/clips/{name}.txt') or name in skip:
        continue
    print(f"  · {it['outlier']}x  {name}  {it['url']}")
PY
echo
echo "Дальше — решение автора: разбирать по тому, что есть, или пробовать позже."
exit 10
