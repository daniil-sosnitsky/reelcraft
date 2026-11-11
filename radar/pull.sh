#!/usr/bin/env bash
# Шаг 3 радара: скачать отобранные ролики и расшифровать их локально.
#
#   bash radar/pull.sh [N]      # N — сколько верхних кандидатов брать (по умолчанию 8)
#
# ВАЖНО: запускать сразу после fetch.py. Прямые ссылки на видео в выгрузке
# Apify подписаны и живут недолго; на протухших CDN отдаёт 403.
#
# Транскрипция идёт тем же whisper.cpp, что и наш собственный голос, только
# без пословных таймингов и без нормализации громкости: нам нужен смысл и
# хук первых секунд, а не караоке. Язык определяется автоматически: доноры
# и русские, и англоязычные.
#
# Бесплатно: ffmpeg и whisper уже стоят под основной конвейер, наружу уходит
# только скачивание видео по прямой ссылке из выгрузки.
#
# Результат: radar/out/clips/<account>-<shortCode>.{mp4,txt}
. "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/tools/env.sh"   # прослойка окружения, см. tools/env.sh
set -euo pipefail
cd "$(dirname "$0")/.."

TOP="${1:-8}"
SHORTLIST="radar/out/shortlist.json"
CLIPS="radar/out/clips"
MODELS_DIR="${WHISPER_MODELS_DIR:-$HOME/.cache/whisper-models}"
WHISPER_MODEL="${WHISPER_MODEL:-$MODELS_DIR/ggml-large-v3-turbo.bin}"

# CDN Instagram отвечает 403 на дефолтный User-Agent ffmpeg (Lavf/*).
# Заголовки браузера — всё, что нужно: ссылки из выгрузки Apify уже
# подписаны, никакой авторизации тут нет.
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
REFERER=$'Referer: https://www.instagram.com/\r\n'

[ -s "$SHORTLIST" ] || { echo "✗ Нет $SHORTLIST — сначала $RC_PY radar/rank.py"; exit 1; }
[ -f "$WHISPER_MODEL" ] || { echo "✗ Нет модели whisper: $WHISPER_MODEL"; exit 1; }
mkdir -p "$CLIPS"

# Список «имя<TAB>ссылка» первых TOP кандидатов — разбирает python, потому
# что JSON в bash не парсится честно.
"$RC_PY" - "$SHORTLIST" "$TOP" <<'PY' > "$CLIPS/_targets.tsv"
import json, sys
# newline='' обязателен: на Windows python переводит перевод строки в пару
# CR+LF, и в хвосте ссылки остаётся CR. CDN такую ссылку не отдаёт, а в логе
# она выглядит точно так же, как исправная.
sys.stdout.reconfigure(encoding='utf-8', newline='')
items = json.load(open(sys.argv[1], encoding='utf-8'))[: int(sys.argv[2])]
for it in items:
    if it.get('videoUrl'):
        print(f"{it['account']}-{it['shortCode']}\t{it['videoUrl']}")
PY

COUNT=0
FAILED=0
PENDING=0

# Безнадёжные кандидаты: у них в принципе нет звука (DASH-дорожка), новая
# выгрузка это не починит. Запоминаем, чтобы повторные попытки на них не
# тратили деньги — каждая попытка стоит прогона Apify.
NOAUDIO="$(dirname "$CLIPS")/_noaudio.txt"   # рядом с clips, а не внутри: иначе он попадает в *.txt
touch "$NOAUDIO"

# Список читаем с дескриптора 3, а ffmpeg зовём с -nostdin: иначе ffmpeg
# вычитывает stdin цикла, и кандидаты кончаются после первой итерации.
while IFS=$'\t' read -r NAME URL <&3; do
  URL=$(printf %s "$URL" | tr -d "[:cntrl:]")   # страховка: невидимый CR ломает ссылку молча
  [ -n "$NAME" ] || continue
  MP4="$CLIPS/$NAME.mp4"
  TXT="$CLIPS/$NAME.txt"
  if [ -s "$TXT" ]; then echo "· $NAME — уже расшифрован, пропускаю"; continue; fi
  if grep -qxF "$NAME" "$NOAUDIO"; then echo "· $NAME — без звука, повторять нечего"; continue; fi

  echo "↓ $NAME"
  # Один сбойный кандидат не должен валить весь прогон — идём дальше.
  if ! ffmpeg -nostdin -y -loglevel error -user_agent "$UA" -headers "$REFERER" \
       -i "$URL" -c copy "$MP4" 2>/dev/null; then
    echo "  ✗ не скачалось: ссылка протухла, нужна новая выгрузка"
    FAILED=$((FAILED + 1)); PENDING=$((PENDING + 1)); continue
  fi

  # Часть ссылок Apify отдаёт DASH-дорожку — только видео, без звука.
  # Расшифровывать там нечего, а ffmpeg падает невнятным «Invalid argument».
  if ! ffprobe -v error -select_streams a -show_entries stream=index -of csv=p=0 "$MP4" | grep -q .; then
    echo "  ✗ нет звуковой дорожки — это DASH-ссылка, больше не пробуем"
    echo "$NAME" >> "$NOAUDIO"
    rm -f "$MP4"; FAILED=$((FAILED + 1)); continue
  fi

  ffmpeg -nostdin -y -loglevel error -i "$MP4" -vn -ar 16000 -ac 1 "$CLIPS/_w16.wav"
  # -l auto обязателен: whisper.cpp по умолчанию стоит на английском и
  # русскую речь не расшифровывает, а ПЕРЕВОДИТ — текст выглядит нормальным,
  # но это уже не то, что автор сказал, и разбор хука по нему врёт.
  whisper-cli -m "$WHISPER_MODEL" -l auto -oj -of "$CLIPS/_w" "$CLIPS/_w16.wav" >/dev/null 2>&1
  "$RC_PY" - "$CLIPS/_w.json" > "$TXT" <<'PY'
import json, sys
sys.stdout.reconfigure(encoding='utf-8')
data = json.load(open(sys.argv[1], encoding='utf-8'))
print(' '.join(s.get('text', '').strip() for s in data.get('transcription', [])).strip())
PY
  rm -f "$CLIPS/_w16.wav" "$CLIPS/_w.json"
  COUNT=$((COUNT + 1))
  echo "  ✓ $("$RC_PY" -c "import sys;print(len(open(sys.argv[1],encoding='utf-8').read().split()))" "$TXT") слов"
done 3< "$CLIPS/_targets.tsv"

rm -f "$CLIPS/_targets.tsv"
echo "Готово: расшифровано $COUNT, сбоев $FAILED (из них поправимых $PENDING) → $CLIPS/"

# Отдельный код возврата, а не просто 1: run.sh по нему понимает, что повтор
# имеет смысл. Обычная ошибка (нет модели, нет шортлиста) — это exit 1, и
# повторять её бессмысленно.
if [ "$PENDING" -gt 0 ]; then exit 10; fi
echo "Дальше — разбор тем: скилл reels-radar, шаг 4."
