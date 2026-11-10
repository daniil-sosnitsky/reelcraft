# Экосистема Remotion для конвейера вертикальных роликов — ресёрч

Дата: 2026-08-16. Контекст: вертикальные говорящие ролики 1080×1920, 30fps, голос диктует тайминги, пословные караоке-субтитры, рендер локально на Mac через `@remotion/cli 4.0.484`. Уже есть: свой алгоритм караоке-групп, whisper-транскрипция через `whisper-cli` из brew, SFX через `<Audio>` в `<Sequence>`, motion-blur.

Источники — официальная документация remotion.dev и репозитории remotion-dev на GitHub (даты/версии сверены на момент ресёрча).

---

## 1. `@remotion/captions`

**Вердикт: не брать (сейчас), но держать в уме формат `Caption` как общий знаменатель.**

- `Caption` — простая структура: `{ text, startMs, endMs, timestampMs, confidence }`. Это единый формат, в который конвертируются выходы `@remotion/install-whisper-cpp`, `@remotion/whisper-web`, `@remotion/openai-whisper`, `@remotion/elevenlabs` — то есть это шина совместимости между разными транскрайберами, а не сам алгоритм субтитров.
- `createTikTokStyleCaptions({captions, combineTokensWithinMilliseconds})` группирует слова в "страницы" (`pages`) с `tokens: [{text, fromMs, toMs}]` — концептуально то же самое, что уже делает наш самописный алгоритм караоke-групп. Разница только в одном параметре группировки (`combineTokensWithinMilliseconds`), у нас, вероятно, логика тоньше под кириллицу/пунктуацию.
- Стиль (подсветка, жёлтый маркер и т.д.) пакет вообще не диктует — это чистый React/CSS сверху `pages[].tokens[]`, кастомизация 100%-ная (см. п.8 — официальный TikTok-шаблон красит активное слово через `color: active ? HIGHLIGHT_COLOR : 'white'`).
- Вывод: пакет не даёт ничего сверх уже работающего кода. Единственный сценарий, где он пригодится — если в будущем добавим альтернативный транскрайбер (ElevenLabs/OpenAI Whisper API), тогда `Caption`-тип упростит стыковку с нашей группировкой.

Документация: https://www.remotion.dev/docs/captions/api, https://www.remotion.dev/docs/captions/create-tiktok-style-captions, https://www.remotion.dev/docs/captions/caption

---

## 2. `@remotion/install-whisper-cpp`

**Вердикт: не брать сам инсталлятор, брать позже — только `toCaptions()`/postprocessing-логику как референс.**

- Три функции: `installWhisperCpp({to, version})` — ставит бинарник whisper.cpp кросс-платформенно; `downloadWhisperModel({model, folder})` — качает `.bin`-модель (`tiny…large-v3-turbo`); `transcribe({inputPath, model, tokenLevelTimestamps, language, ...})` — гоняет транскрипцию, `toCaptions({whisperCppOutput})` — конвертит в `Caption[]`.
- Ввод обязан быть 16-bit/16kHz WAV.
- Пословные тайминги: `tokenLevelTimestamps: true` включает `--dtw` (точные `t_dtw`-тайминги), но требует whisper.cpp ≥1.5.5.
- Русский язык поддерживается: параметр `language: 'Russian'` (или `'ru'`) в списке из 90+ языков — но модель должна быть **без суффикса `.en`** (мультиязычная, например `medium` вместо `medium.en`). Официальный TikTok-шаблон явно пишет: "To support non-English languages, change `WHISPER_MODEL` to a model without `.en` suffix" (README `remotion-dev/template-tiktok`).
- Наш текущий пайплайн (`whisper-cli` из brew) делает то же самое — тот же whisper.cpp под капотом, просто другой способ установки/версионирования. Замена не даёт нового функционала, только смену канала поставки бинарника (npm postinstall вместо brew) — не стоит того, чтобы трогать рабочий пайплайн.

Документация: https://www.remotion.dev/docs/install-whisper-cpp, .../transcribe, .../download-whisper-model, .../to-captions

---

## 3. `@remotion/transitions`

**Вердикт: брать позже.**

- `<TransitionSeries>` (аналог `<Series>`) + `<TransitionSeries.Transition timing={...} presentation={...}>` между `<TransitionSeries.Sequence>`. Также есть `<TransitionSeries.Overlay>` (не сокращает длительность, для лайт-лика/вспышки на стыке).
- Готовые пресентации из коробки: `fade()`, `slide()`, `wipe()`, `flip()`, `clockWipe()`, `iris()`, `pushCut()`, `none()`, плюс HTML-in-canvas набор — `zoomBlur()`, `dreamyZoom()`, `filmBurn()`, `linearBlur()`, `bookFlip()`, `zoomInOut()`, `dissolve()`, `ripple()`, `crosswarp()`, `crossZoom()`, `swap()`; `cube()` — платный (Paid badge).
- Применимость к части кадра: `<TransitionSeries>` по умолчанию работает с **абсолютно спозиционированными полноэкранными сценами** (`layout` обязан оставаться `absolute-fill`, `layout="none"` выпилен из v5). Однако секцию из документации "Enter and exit animations" можно использовать так: обернуть в `<TransitionSeries>` только один элемент (не всю сцену), тогда переход применится именно к нему — то есть частичное применение достижимо через отдельный `<TransitionSeries>` вокруг нужного слоя, но нативного "перехода только на правой половине кадра, пока остальное статично" нет — это надо собирать вручную через `interpolate`.
- Полезно на будущее для переходов между инфографик-сценами (взамен наших ручных css-переходов) — экономит велосипед, но не критично прямо сейчас.

Документация: https://www.remotion.dev/docs/transitions/transitionseries, https://www.remotion.dev/docs/transitioning, https://www.remotion.dev/docs/transitions/presentations

---

## 4. `@remotion/lottie`

**Вердикт: брать позже.**

- Стабильный пакет (с Remotion 3.2), требует peer-зависимость `lottie-web`. Компонент `<Lottie>` — пропсы `direction`, `loop`, `speed`, `renderer` (`svg`/`canvas`/`html`). `getLottieMetadata()` даёт размеры/длительность/fps анимации.
- Загрузка: из `public/` через `staticFile()` + `fetch()` + `delayRender()`/`continueRender()`, либо с удалённого URL (требует CORS). Для полностью офлайн-рендера — просто кладём `.json` в `public/`, тогда сеть не нужна вообще.
- Ограничение: зависит от `lottie-web`, лишний вес в бандле; сложные Lottie-файлы (с эффектами AE) не всегда рендерятся 1:1.
- Полезно, если решим брать готовую анимацию с LottieFiles вместо ручной SVG-анимации иконки — не горит, пока нет такой задачи.

Документация: https://www.remotion.dev/docs/lottie, .../lottie/lottie, .../lottie/getlottiemetadata

---

## 5. `@remotion/layout-utils`

**Вердикт: брать.**

- `measureText({text, fontFamily, fontWeight, fontSize, letterSpacing, ...})` → `{width, height}`. Работает **только в браузере** (не Node/Bun) — но это ровно та среда, в которой Remotion и рендерит кадры (headless Chrome), так что ограничение не мешает.
- `fillTextBox()` — находит переносы строк и overflow в текстовом блоке (буквально "не переносится ли заголовок").
- `fitText()` / `fitTextOnNLines()` — подбирают размер шрифта, чтобы текст влез в ширину/N строк. Именно `fitText()` использует официальный TikTok-шаблон для автоподгонки размера субтитров под 90% ширины кадра.
- Прямое попадание в задачу "заголовок не переносится за 1080×1920" — можно гонять `fillTextBox`/`fitText` на этапе подготовки сцены и валить рендер с понятной ошибкой, если текст не влезает, вместо визуальной проверки глазами.

Документация: https://www.remotion.dev/docs/layout-utils, .../layout-utils/measure-text

---

## 6. `@remotion/google-fonts`

**Вердикт: не брать напрямую для прод-рендера — использовать `@remotion/fonts` с локальными файлами.**

- `loadFont('normal', {weights: ['400'], subsets: ['latin']})` из `@remotion/google-fonts/<FontName>` — типобезопасная загрузка, блокирует рендер до готовности шрифта.
- Важно: шрифт **качается с CDN `fonts.gstatic.com` по сети** в момент вызова `loadFont()` (при старте Studio/рендера). Это не бандлится в проект и не работает офлайн "из коробки" — при отсутствии интернета рендер зависнет или упадёт по таймауту.
- С Remotion v5.0 `weights`/`subsets` становятся обязательными аргументами (сейчас на 4.0.484 ещё опциональны, но без них грузятся все веса/сабсеты — сотни запросов, риск таймаута).
- Для гарантированно локального рендера (наше жёсткое требование) правильный путь — `@remotion/fonts` (с v4.0.164): положить `.woff2` в `public/` и вызвать `loadFont({family, url: staticFile('Inter-Regular.woff2'), weight})` — нулевая зависимость от сети. Альтернатива — сырой `FontFace` API с `staticFile()`.
- Итог: `@remotion/google-fonts` удобен для черновой разработки с интернетом, но в проде под офлайн-рендер использовать `@remotion/fonts` + локально скачанные шрифты.

Документация: https://www.remotion.dev/docs/google-fonts/load-font, https://www.remotion.dev/docs/fonts

---

## 7. `@remotion/paths`, `@remotion/noise`, `@remotion/shapes`, `@remotion/animation-utils`

**Вердикт: брать (paths + shapes + animation-utils), брать позже (noise).**

Все четыре — лёгкие MIT-пакеты без тяжёлых зависимостей (у `@remotion/paths` вообще нет зависимостей, можно юзать даже вне Remotion).

- **`@remotion/paths`** — работа с SVG-путями: `getLength`, `cutPath`, `getPointAtLength`, `getTangentAtLength`, `reversePath`, `normalizePath`, `interpolatePath`, `evolvePath` (анимация "рисования" пути — линия/стрелка проявляется по мере прогресса), `centerPath`, `translatePath`, `warpPath`, `scalePath`, `getBoundingBox`, `resetPath`, `extendViewBox`, `getSubpaths`, `parsePath`, `serializeInstructions`. Прямое попадание для анимированных стрелок/подчёркиваний/контуров в инфографике.
- **`@remotion/shapes`** — готовые генераторы SVG-примитивов + готовые React-компоненты: `makeArrow()`/`<Arrow/>`, `makeRect()`/`<Rect/>`, `makeCallout()`/`<Callout/>` (диалоговый пузырь), `makeCircle()`, `makeHeart()`, `makePie()` (для процентных диаграмм), `makeEllipse()`, `makeTriangle()`, `makeStar()`, `makeSpark()`, `makePolygon()`. Экономит ручное написание SVG-путей для базовых фигур инфографики (стрелки, пузыри-подсказки, pie-chart).
- **`@remotion/animation-utils`** — `makeTransform()` (типобезопасная сборка CSS `transform` из функций типа `scale()`, `translateY()` — используется в официальном TikTok-шаблоне для pop-in анимации субтитров) и `interpolateStyles()` (интерполяция сразу нескольких CSS-свойств по одному прогрессу). Удобная замена ручной склейке transform-строк.
- **`@remotion/noise`** — `noise2D/3D/4D()`, Perlin-подобный шум. Полезно для органичного лёгкого дрожания/покачивания элементов вместо ручного псевдослучайного дребезга — приятный бонус, не критично.

Документация: https://www.remotion.dev/docs/paths, https://www.remotion.dev/docs/shapes, https://www.remotion.dev/docs/animation-utils, https://www.remotion.dev/docs/noise

---

## 8. Официальные шаблоны remotion.dev/templates

**Вердикт: брать позже — как референс кода, не как зависимость.**

Полный список бесплатных шаблонов: Blank, Hello World, Next.js (+ варианты Vercel/no-Tailwind/Pages dir), Recorder, Prompt-to-Motion-Graphics SaaS Starter, JavaScript, Render Server (Express), Electron, React Router 7, 3D (React Three Fiber), Stills, Audiogram, Music Visualization, Prompt to Video.

Каптион/TikTok-шаблон существует официально: **`remotion.dev/templates/tiktok`** (`npx create-video@latest --tiktok`, исходник `github.com/remotion-dev/template-tiktok`). Что там внутри и что стоит подсмотреть:

- `sub.mjs` — скрипт батч-транскрипции всех видео в `public/` через whisper.cpp, `whisper-config.mjs` — конфиг модели/языка (именно там задокументировано переключение на non-`.en` модель для не-английского языка).
- `src/CaptionedVideo/Page.tsx` — рабочий пример стилизации субтитров, стоит скопировать приёмы:
  - `fitText({fontFamily, text: page.text, withinWidth: width * 0.9, textTransform: 'uppercase'})` из `@remotion/layout-utils` — автоподбор размера шрифта под 90% ширины кадра;
  - `WebkitTextStroke: '20px black', paintOrder: 'stroke'` — толстая обводка текста без доп. слоёв;
  - `makeTransform([scale(...), translateY(...)])` из `@remotion/animation-utils` — pop-in анимация страницы субтитров через `interpolate(enterProgress, [0,1], [...])`;
  - Подсветка активного слова — `color: active ? HIGHLIGHT_COLOR : 'white'` по сравнению `t.fromMs <= timeInMs < t.toMs` — концептуально то же, что и наш алгоритм, просто эталонная реализация для сверки.

Вывод: устанавливать весь шаблон незачем (своя транскрипция и группировка уже есть), но 3-4 конкретных CSS/анимационных приёма из `Page.tsx` стоит утащить руками в свои сцены.

Ссылки: https://www.remotion.dev/templates/tiktok, https://github.com/remotion-dev/template-tiktok

---

## 9. Комьюнити-библиотеки анимаций

**Вердикт: брать позже, и то не как npm-зависимость, а как источник паттернов для ручного копирования кода.**

Проверил активность (звёзды/дата последнего пуша на 2026-08-16):

| Репозиторий | Звёзды | Последний пуш | Заметки |
|---|---|---|---|
| **remocn/remocn** | 1232 | 2026-08-13 (вчера) | Самый живой. "shadcn для Remotion" — CLI ставит не npm-пакет, а копирует код компонента/сцены к тебе в проект (registry-подход). Готовые сцены и переходы, которые сразу выглядят прилично. |
| **stefanwittwer/remotion-animated** | 221 | 2025-02-22 (>1.5 года назад) | Простой декларативный API анимации объектов (`<Animated animations={[Fade(), Move()]}>`). Стабильный, но давно не обновлялся — сверить совместимость с Remotion 4.0.484 перед использованием. |
| **reactvideoeditor/remotion-templates** | 208 | 2026-04-21 | 81 бесплатный готовый шаблон-компонент, самодостаточные React-компоненты на хуках Remotion. |
| **seblavoie/remotion-kit** | 16 | 2026-02-03 | Мало адопшена, пропускаю. |

Топ выбор — **remocn**: он и самый живой, и подход "copy-paste, не зависимость" ложится на уже принятый в системе принцип (см. `feedback_blocks_bank_from_reviews` в памяти — чужой приём → блок с паспортом в банк, без автоматики/лишних зависимостей). Ставить как npm-пакет ни один из них смысла нет — рискуем версийным конфликтом с Remotion 4.0.484 и мёртвым мейнтейнсом (как у `remotion-animated`).

Источники: https://github.com/remocn/remocn, https://github.com/stefanwittwer/remotion-animated, https://github.com/reactvideoeditor/remotion-templates, https://www.remotion.dev/docs/resources

---

## 10. Лицензия для соло-автора

**Вердикт: подтверждено — полностью бесплатно, никаких условий не нарушаем.**

- Free License действует для: физлица (личное **или коммерческое** использование), организации/команды до 3 человек, НКО, или на этапе оценки продукта.
- Company License (платный, от $25/seat/мес или $0.01/рендер с минимумом $100/мес) нужен только организациям **от 4 человек**, работающим над одним Remotion-проектом.
- Соло-автор (один человек) — безусловно подпадает под Free License, включая монетизацию контента на YouTube/Reels/TikTok — это разрешённое коммерческое использование.
- Телеметрия для Free License **добровольная**: без `licenseKey` в конфиге рендера ничего не отправляется на сервер; можно передать `"free-license"` в `licenseKey`, чтобы убрать предупреждение в консоли — но это не обязательно.
- Порог в 4 человека считается по факту совместной работы над одним Remotion-проектом (если когда-нибудь появится соавтор/подрядчик на этом же кодбейсе — тогда пересчитывать).

Документация: https://www.remotion.dev/docs/license/pricing, https://www.remotion.dev/docs/license/faq

---

## Топ-3 что внедрить в первую очередь

1. **`@remotion/layout-utils` (`fitText`/`fillTextBox`)** — закрывает ровно ту задачу, которая сейчас решается на глаз: автопроверка "заголовок не переносится за границы 1080×1920". Работает уже в текущей версии 4.0.484, без побочных эффектов, интегрируется за один вечер.
2. **`@remotion/paths` + `@remotion/shapes` + `@remotion/animation-utils`** — три лёгких пакета без тяжёлых зависимостей, прямое попадание в инфографику: готовые стрелки/callout-пузыри/pie-chart вместо ручных SVG-путей, `evolvePath()` для анимации "рисования" линии, `makeTransform`/`interpolateStyles` вместо ручной склейки transform-строк.
3. **Перейти с `@remotion/google-fonts` (если используется) на `@remotion/fonts` с локальными `.woff2` в `public/`** — единственный пункт, который не "плюс к возможностям", а закрытие риска: сейчас требование "рендер полностью локально" может незаметно нарушаться, если где-то есть `loadFont()` из google-fonts, который на самом деле тянет файлы с `fonts.gstatic.com` по сети при каждом холодном старте.
