# Windows-адаптация reelcraft

Базовый комплект конвейера писался под macOS. Я развернул его **нативно под
Windows 11 + Git Bash**, потому что правило 27 требует живых скриншотов окон
программ — из WSL их не снять.

Весь инструментарий лежит **внутри проекта**, в `tools/`: на `C:\` нет прав
записи, а системный PATH не трогаем.

## Что установлено в tools/

| Папка | Что | Версия |
|---|---|---|
| `ffmpeg/` | ffmpeg, ffprobe, ffplay (Gyan full build) | 9.0.2 |
| `whisper/` | `whisper-cli.exe` + ggml-бэкенды CPU | whisper.cpp b5130 (v1.9.4) |
| `whisper-models/` | `ggml-large-v3-turbo.bin` | 1.5 ГБ |
| `bin/` | шимы: `head`, `caffeinate`, `python3` | наши |
| `env.sh` | сборка окружения — единственная точка правки | наш |

## Зачем нужны шимы

| Шим | Проблема |
|---|---|
| `head` | в этой сборке Git Bash (минимальный MSYS, 356 утилит) `head` отсутствует вообще, а скрипты кита его зовут |
| `python3` | в Windows-PATH `python3` — заглушка Microsoft Store: печатает «Python» и выходит. Настоящий интерпретатор зовётся `python` |
| `caffeinate` | macOS-утилита «не давать машине уснуть во время рендера». Съедает свои флаги и запускает команду как есть |

| `PYTHONIOENCODING=utf-8` | Python под Windows пишет в консоль в cp1251 и падает с `UnicodeEncodeError` на «×», «→», «✓» в выводе скриптов QA |

`env.sh` дополнительно задаёт `WHISPER_MODELS_DIR` (дефолт комплекта
`~/.cache` — не наш случай) и `RC_QA_FONT` (в комплекте зашит путь к шрифту
macOS).

## Патчи в скриптах комплекта

**Одна строка на скрипт**, сразу после shebang:

```bash
. "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/tools/env.sh"   # прослойка окружения
```

Стоит в: `prep.sh`, `scripts/clean-out.sh`, `scripts/qa-auto.sh`,
`scripts/qa-sheet.sh`, `scripts/queue-add.sh`, `scripts/save-storyboard.sh`,
`scripts/setup-assets.sh`, `scripts/sfx-catalog.sh`.

Плюс три точечные правки (шим не достаёт до абсолютных путей):

| Файл | Было | Стало |
|---|---|---|
| `scripts/queue-add.sh` | `/usr/bin/python3 scripts/transcribe.py` | `python3 scripts/transcribe.py` |
| `scripts/qa-auto.sh` | `/usr/bin/python3 - …` | `python3 - …` |
| `scripts/qa-sheet.sh` | `ImageFont.truetype('/System/Library/Fonts/…')` | `ImageFont.truetype(os.environ.get('RC_QA_FONT', …))` |

## Каталог приёмов: upstream переехал

Комплект ссылается на `../video-shotcraft/skill/references/…`, но в репозитории
video-shotcraft структуру с тех пор изменили — всё лежит в корне, без
префикса `skill/`.

Чтобы не править пути в шести файлах `library/`, репозиторий распакован
**в подпапку**: `../video-shotcraft/skill/`. Все ссылки комплекта
сходятся без единого патча.

⚠️ Поэтому обновлять каталог нужно тоже в `skill/`, а не `git pull` в корне.

## Монтажный стол (workbench): что пришлось доделать

Стол живёт в клоне — `video-shotcraft/skill/workbench/`, а клон целиком в
`.gitignore` (~200 МБ не наш код). **Значит правки ниже в репозиторий не
попадают и после каждого обновления клона накладываются заново.**

### 1. Зависимости

```bash
cd ../video-shotcraft/skill/workbench
npm install --ignore-scripts
# пакеты нашего движка, которых у стола нет (версия — как у стола, 4.0.484,
# иначе в сборку приедут два экземпляра remotion):
npm install --ignore-scripts --save-exact \
  @remotion/layout-utils@4.0.484 @remotion/paths@4.0.484 \
  @remotion/transitions@4.0.484 @remotion/lottie@4.0.484 \
  @remotion/fonts@4.0.484 lottie-web@5.13.0
```

Стол собран на Remotion 4.0.484, движок — на 4.0.520. Наш `src/` линкуется
в стол и берёт его `node_modules`: расхождение патч-уровня, API то же.
Поднимется ли комплект на 4.0.520 — не проверял, так что версии добавочных
пакетов держать равными версии СТОЛА, а не движка.

### 2. Симлинк `workbench/demosrc`

В репозитории это относительный симлинк на `../demos` (через него библиотека
приёмов попадает в стол). Архивная распаковка превращает его в обычный файл
со строкой `../demos` внутри, и генератор индекса падает с `ENOTDIR`.
Пересоздать:

```bash
cd ../video-shotcraft/skill/workbench
rm demosrc && node -e "require('fs').symlinkSync('../demos','demosrc','junction')"
```

### 3. Правка в `workbench/scripts/gen-index.mjs`

`relative()` на Windows отдаёт путь с обратными слэшами, и он уходит прямо
в текст импорта: `from "@demos/outro\ui-strip-away-outro\…"`. esbuild читает
`\u` как escape-последовательность и валит vite на старте
(`Syntax error "i"`), причём не на сборке индекса, а позже — при сканировании
зависимостей, так что сообщение указывает совсем не туда. Тот же путь ниже
режется по `/` на категорию и слог, то есть без правки ломались ещё и
длительности карточек. Лечение — нормализация в одну строку:

```js
const rel = relative(demosDir, p).replace(/\.tsx$/, "").split(sep).join("/");
```

(плюс `sep` в импорт из `node:path`). Помечено в коде `ПРАВКА reelcraft (Windows)`.

### 4. Битый симлинк `public/cardpreviews`

Он ведёт в `gallery/media` — превью карточек, которые качаются отдельно
(`gallery/fetch-media.sh`). Пока их нет, симлинк битый, и на Windows
chokidar валит весь dev server: `EBUSY: resource busy or locked, scandir`.
Vite при этом успевает написать «ready» — и сообщение уводит в сторону.

Лечение двойное: создать пустую `skill/gallery/media/` И добавить в
`vite.config.ts` исключение из watcher (следить за превью, звуковым банком
и BGM не нужно ни при каком раскладе):

```ts
server: {
  port: 5198, strictPort: true,
  watch: { ignored: ["**/public/cardpreviews/**", "**/public/sfxlib/**", "**/public/bgmlib/**"] },
},
```

### 5. Vite слушает только `::1`

Без явного `host` vite поднимается на IPv6-петле, а `open.mjs` ждёт сервер
через `fetch('http://localhost:5198')` — Node резолвит `localhost` в
127.0.0.1 и получает отказ. Сервер при этом работает и в браузере
открывается, но лаунчер каждый раз сообщает «не поднялся за 90с» и уводит
на поиск несуществующей ошибки. Лечение — `host: "127.0.0.1"` в блоке
`server` того же `vite.config.ts`.

### 6. Две правки в `workbench/vite.config.ts`

Обе — в блоке экспорта MP4, обе помечены в коде `ПРАВКА reelcraft (Windows)`:

| Было в комплекте | Почему не работает | Стало |
|---|---|---|
| `spawn("rsync", ["-aL", …])` — синхронизация `public/` перед рендером | rsync на Windows нет, а шим-скриптом не обойтись: Node не запускает `.cmd`/`.bat` без `shell` | копирование через `fs.cp({recursive, dereference})` + `rm` — тот же смысл, что `-aL --delete` |
| `spawn(path.join(…, ".bin", "remotion"))` | `.bin/remotion` на Windows — shell-обёртка, `spawn` её не исполнит | тот же путь `+ ".cmd"` под win32 |

Без первой правки экспорт падает на синхронизации, без второй — на запуске
рендера. Предпросмотр и правка клипов работают и без них.

### 7. Чего НЕ чинили

`open.mjs` опознаёт свой dev server по `ps` и на Windows сознательно
возвращает «не мой» (в исходном коде: `return false; // 无 ps；宁可不杀`).
Поэтому старый сервер он не гасит, а алиас `@proj` прибивается на старте
vite — при смене ролика стол остался бы на предыдущем. Гасит наш лаунчер
`scripts/workbench.sh` (через WMI), сам `open.mjs` не трогаем: он
обновляется вместе с комплектом.

## Если обновляешь базовый комплект

1. Положить свежую версию базового комплекта поверх проекта.
2. Переналожить строку подключения `env.sh` в скриптах (список выше).
3. Повторить три точечные правки.
4. Повторить правки монтажного стола (раздел выше): зависимости, симлинк
   `demosrc`, папка `gallery/media`, правка `gen-index.mjs`, четыре правки
   `vite.config.ts`.
5. `tools/` не трогать — он не из комплекта.
