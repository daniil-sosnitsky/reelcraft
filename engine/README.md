# reelcraft-engine

Единый Remotion-проект конвейера вертикальных роликов reelcraft (1080×1920,
30fps; 60 — только по явной просьбе автора, рендер вдвое дольше). Кодовая
база собрана из двух отработанных тем — «Sticker Light» (светлая, с
персонажем) и «GitHub noir» (тёмная) — их компоненты обобщены и сведены
под один контракт темы.

## Структура

```
engine/
├── package.json / tsconfig.json / remotion.config.ts
├── src/
│   ├── index.ts              — registerRoot
│   ├── Root.tsx               — регистрация композиций (сюда добавлять новые ролики)
│   ├── fonts.ts                — локальная загрузка шрифтов (@remotion/fonts)
│   ├── global.d.ts             — типы для импорта *.woff2
│   ├── fonts/                  — Inter + JetBrains Mono, .woff2
│   ├── lib/                    — общие компоненты и алгоритмы, темонезависимые
│   │   ├── helpers.ts           — кадровые аналоги GSAP-хелперов (motion/rand/shake/util)
│   │   ├── captionGroups.ts     — алгоритм группировки караоке (buildCaptionGroups, тип Word)
│   │   ├── Captions.tsx         — пословная подсветка, стиль берёт из `theme`
│   │   ├── Character.tsx        — персонаж: позы+дыхание, таблица смен поз пропом
│   │   ├── Sticker.tsx          — стикер: pop+wobble
│   │   ├── Background.tsx       — фон: light (блик+пол-сетка+UiScrim) / noir (тёмный+виньетка)
│   │   ├── Scene.tsx            — обёртка сцены с crossfade на входе/выходе (~0.27с при любом fps)
│   │   ├── Bgm.tsx              — фоновая музыка: fade-in/out + дакинг под слова караоке (2026-09-04)
│   │   ├── CTACard.tsx          — CTA финала по константам канала
│   │   ├── PageCam.tsx          — 2.5D-камера по скрину/клипу (наезды, правило 19)
│   │   ├── FlowNode.tsx / DottedLink.tsx / MacWindow.tsx — макеты схем и окна macOS (правило 24)
│   │   ├── DigitRoll.tsx / VerticalTicker.tsx / FlashCut.tsx — одометр, 3D-стена, вспышка склейки
│   │   └── LottieBadge.tsx      — @remotion/lottie: локальная загрузка JSON из public/
│   ├── themes/
│   │   ├── types.ts             — контракт Theme (общий для light/noir)
│   │   ├── light.ts             — «Sticker Light»: палитра, info-zone 110–870, cap-band 880–1030, charZone. ЗАФИКСИРОВАНА
│   │   └── noir.ts              — «GitHub noir»: палитра, контент 300–1100, cap 1450–1620. Каркас/фолбэк: вторая тема ролика САМООПРЕДЕЛЯЕМАЯ (library/adaptive-theme.md), разовый theme.ts живёт в src/videos/video-NN/ и наследует зоны отсюда
│   └── videos/
│       └── demo/                — тестовая композиция (см. ниже)
└── public/shared/               — ассеты, общие для ВСЕХ роликов
    ├── character/                — банк поз персонажа
    ├── stickers/                  — банк стикеров
    ├── cta/tg-channel.jpg         — скрин канала для финальной CTA-сцены
    ├── sfx/                       — библиотека SFX + NOTES.md (грабли: длинные/тихие сэмплы, запрет ui-блипов)
    ├── bgm/                       — банк из 5 Mixkit-треков + INDEX.md (характеры, анти-повтор)
    ├── icons/                     — банк SVG-логотипов брендов + manifest.json; `generic/` — ~2000 общих пиктограмм Lucide (белый штрих; ключ `generic/<имя>` в FlowNode)
    └── lottie/                    — банк Lottie-анимаций + INDEX.md (что делает · источник · лицензия · где использована)
```

## Как завести новый ролик

**Сантехника собирается одной командой** — `scripts/new-video.sh NN [--theme light|emerald|both]` (после сториборда, перед вёрсткой): папка
ролика, `data.ts` с вычитанным CAP, заготовки сцен, корень композиции со
всеми обязательными компонентами и регистрация в `Root.tsx`. Руками это
стабильно съедало 15–20 минут на ролик. Шаги ниже — что скрипт делает
внутри; читать, когда нужно понять или починить.

1. Создать `src/videos/video-NN/` (по образцу `src/videos/demo/`): свои
   `data.ts` (Word[] транскрипта → `buildCaptionGroups`), сцены-компоненты,
   главный файл композиции (`VideoNN.tsx`), который собирает сцены через
   `<Sequence>`/`<TransitionSeries>`, зовёт `<Background theme={...} />`,
   `<Captions theme={...} groups={...} />`, при необходимости `<Character>`.
2. Ассеты, специфичные для этого ролика (скриншоты, доп. стикеры, CTA-скрин
   с другим числом подписчиков и т.п.) — в `public/videos/NN/`, НЕ в
   `public/shared/`. Общие ассеты (позы, дефолтные стикеры, SFX/BGM, шрифты)
   уже лежат в `public/shared/` — просто ссылаться на них через `staticFile`.
3. Зарегистрировать композицию в `src/Root.tsx`:
   ```tsx
   <Composition id="Video-NN" component={VideoNN} durationInFrames={...} fps={FPS} width={1080} height={1920} />
   ```
   Ролики — **30 fps** (`FPS`). `FPS_NEW`=60 остаётся для явной просьбы
   автора (рендер вдвое дольше, разницы на телефоне нет).
   Обязательные компоненты в корне композиции: `<Audio>` речи, `<Bgm src
   volume durationInFrames words={CAP} />` (дакинг под слова встроен),
   `<Captions>` (pop активного слова включён по умолчанию), в light —
   `<Character swapMode="dip" …>` (кроссфейд поз даёт призрак). Громкость
   SFX — `sfxGain(пик_из_CATALOG)` из `lib/helpers.ts`, не на глаз.
4. Выбор темы — это ИМПОРТ: `import { lightTheme } from '../../themes/light'`
   или `noirTheme` из `noir.ts`. Один и тот же набор сцен/компонентов может
   рендериться в обеих темах, если весь стиль идёт через `theme`, а не
   захардкожен в компоненте.
5. Рендер: `caffeinate -ims npx remotion render src/index.ts Video-NN out/video-NN.mp4`.
   Качество кадров (JPEG 95) и кодека (CRF 16) задано в `remotion.config.ts` —
   флагами не понижать.
   Стилл для QA: `npx remotion still src/index.ts Video-NN out/video-NN-f150.png --frame=150`.
6. SFX ролика — **таблицей `SfxCue[]` в data-файле**, а не россыпью
   `<Sequence>` в корне: по ней рендерится `<SfxTrack cues={…} />`
   (`lib/SfxTrack.tsx`) и строится опись для монтажного стола. `at` — кадр
   целевого пика относительным якорем (`SCENES[n].from + k`).
7. После сдачи — опись ролика `src/videos/video-NN/workbench.ts` (образец:
   `video-05`, фабрика: `lib/workbench.tsx`). По ней монтажный стол
   разбирает ролик на клипы; своих чисел в описи нет, всё импортируется
   из data-файлов. Открыть: `./scripts/workbench.sh NN`.

## Тестовая композиция (Demo)

`src/videos/demo/` — минимальный пример связки всех кусков engine, без
реального аудио, 300 кадров (10с):

- **DemoLight** — одна сцена в `<Scene>` (crossfade вход/выход): заголовок
  через `fitText` (@remotion/layout-utils — гарантия «без переносов»),
  белая карточка в токенах темы, стикер, персонаж (поза `welcome`),
  Lottie-бейдж (`smoke.json`) в углу карточки, Captions поверх короткой
  демо-фразы.
- **DemoNoir** — та же панель БЕЗ персонажа и БЕЗ Lottie, но через
  `TransitionSeries` (`@remotion/transitions`, presentation `slide`) — две
  панели, переход между ними в глобальных кадрах 135–165 (кадр 150 — точно
  середина перехода, удобная точка для смоук-стилла).

## Правила

- **Полнокадровые переходы (`TransitionSeries`) — ТОЛЬКО в темах без
  персонажа (адаптивная/noir).**
  В теме light персонаж стоит на кадре весь ролик; полнокадровый переход
  заставил бы его мигать/дёргаться на стыке сцен — запрещено правилами
  темпа (`CLAUDE.md`: «одна точка внимания», «элемент не
  появляется, если ему жить <1с»). В light переходы затрагивают только
  info-zone (контентный блок), персонаж и фон остаются на месте — крутить
  через `<Scene>` (crossfade) или ручной `interpolate` внутри зоны контента,
  не через `TransitionSeries` на весь кадр.
- **Детерминизм.** Никакого `Date.now()`, `Math.random()`, реальных таймеров.
  Случайность — только через `mulberry32`/`seededSeries` из `src/lib/helpers.ts`
  (один сид всегда даёт одну и ту же последовательность — иначе параллельные
  воркеры рендера дадут разные кадры).
- **Темы — это импорт, не runtime-переключатель.** Композиция ролика жёстко
  импортирует `lightTheme` либо `noirTheme`; если нужны обе версии ролика —
  делать два id композиции (как `DemoLight`/`DemoNoir`), а не пропс с
  условной логикой внутри одного дерева компонентов.
- **Шрифты — строго локально.** `src/fonts.ts` грузит `.woff2` из
  `src/fonts/` через `@remotion/fonts` (`loadFont`), который сам вызывает
  `delayRender`/`continueRender`. Общий таймаут поднят до 120000мс через
  `Config.setDelayRenderTimeoutInMilliseconds(120000)` в `remotion.config.ts`
  (сам `loadFont()` параметра `timeoutInMilliseconds` не принимает).
  **`@remotion/google-fonts` ЗАПРЕЩЁН** — он качает файлы с
  `fonts.gstatic.com` по сети в момент рендера, что ломает требование
  «рендер полностью офлайн» (см. `library/remotion-ecosystem.md`, п.6).
- **Lottie — строго локально.** JSON-файлы лежат в `public/shared/lottie/`,
  грузятся через `staticFile()` + `fetch()` (см. `src/lib/LottieBadge.tsx`),
  НИКОГДА не по внешнему URL. Каждое добавление — новая строка в
  `public/shared/lottie/INDEX.md` (что делает · источник · лицензия · в
  каких роликах использована — для анти-повтора и контроля лицензий).
- **Иконки брендов.** `public/shared/icons/manifest.json` — источник правды
  по ключам/алиасам/цветам/`style` (`mono` — красить squircle в `bg` из
  манифеста; `color` — SVG уже цветной, squircle нейтральный тёмный).
  Докачка новых иконок: `node scripts/fetch-icons.mjs
  <бренды>` из корня проекта reelcraft (портирован, сам дописывает манифест).
- **Заголовки — через `fitText`/`fillTextBox`** (`@remotion/layout-utils`),
  не на глаз: гарантия «не переносится за 1080×1920» без визуальной проверки
  каждого кадра.
- **Зоны кадра фиксированы темой**, не подбираются на глаз по сцене:
  `theme.safe.contentTop/contentBottom` — пояс контента, `capTop/capBottom` —
  полоса караоке. `theme.charZone` — только у тем с персонажем (сейчас only
  light).
- **CTA финала** — по константам канала (`CLAUDE.md` + `src/channel.ts`):
  хендл · Telegram, скрин `public/shared/cta/tg-channel.jpg`, кнопка,
  курсор-клик; тайминги ×2, если призыв не озвучен голосом.
