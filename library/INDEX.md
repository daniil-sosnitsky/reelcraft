# Каталог 152 приёмов video-shotcraft — входная точка

Собран 2026-08-16 из полного прочтения всех карточек (4 пакета, по категориям).
Полные описания: index-a.md (ui-entrance+rhythm), index-b.md (typography+opening),
index-c.md (transition+effects), index-d.md (camera+data+interaction+outro).
Исходники карточек: ../video-shotcraft/skill/references/shots/<категория>/ (клон репозитория, см. SETUP.md).

## Как пользоваться на сториборде (ОБЯЗАТЕЛЬНЫЙ порядок)

1. Разбей транскрипт на смысловые биты (хук / цифра / перечисление / …).
2. По КАЖДОМУ биту возьми кандидатов из маршрутизатора ниже (2–3 шт),
   сверь их полные записи в index-*.md (вертикаль, караоке, зона, грабли).
3. Для выбранных — прочитай полную карточку и её demo TSX (правило №6
   shotcraft: demo — истина по параметрам, по памяти не верстать).
4. Анти-повтор: сверься с used-log.md — хук не повторяет хуки 2 прошлых
   роликов, один приём — один раз за ролик, приём-звезда не в каждом выпуске.
5. После финала ролика — допиши использованные приёмы в used-log.md.

## Системные правила формата (сводка из пакетов)

- Крупная типографика, дублирующая речь (стомпы, split-flap, letterspace…) —
  караоке на сцене ВЫКЛЮЧАТЬ. Совместимы с караоке без вопросов:
  marker-underline-title, gradient-word-sweep (акценты поверх текста).
- Переходы (transition/) почти все перекрывают ВЕСЬ кадр → в теме с
  персонажем использовать нельзя (персонаж не должен исчезать); для
  info-zone-переходов брать эффекты/локальные приёмы. В теме без персонажа —
  переходы разрешены, бюджет 0.4–0.8с на границе фраз.
- Двухколоночные/широкоэкранные приёмы (⛔ в маршрутизаторе) — не брать без
  сильной переделки: document-typewriter-reveal, text-column-converge,
  quad-split-parallel-scenes, page-waterfall-wall и др. (см. пакеты).
- Отдельные demo лежат не в demos/, а в template/src/aifl/ — путь в записи.

## Маршрутизатор: бит речи → приёмы-кандидаты

**хук**: blur-slide, brace-expand, brand-ink-open, cel-flash-stomp, command-palette-summon, crash-zoom-punch, dataviz-landscape-open, fracture, gauge-readout-moves, icon-field-colorize, input-trigger-moves, letterspace-materialize, light-play-moves, magician-card-flourish, montage-rhythm-moves, overhead-camera-moves, radial-wave, rhythm-interrupt-moves, scramble, space-camera-moves, split-flap-title, stroke-segment-build, trailer-grammar-moves, type-assembly-moves, type-entrance-moves

**большая цифра**: chart-live-moves, cloner-depth-echo, countdown-arc-scatter, counter-confetti, deck-deal-flyin, gauge-readout-moves, list-stack-press, odometer-digit-roll, particle-celebrate-hits, research-card-stack-scroll, scroll-brake-moves, slam-entrance-moves, split-flap-title, tension-camera-moves

**перечисление**: avatar-bracket-carousel, avatar-grid-radial-build-colorize, basic-3d-scene, beat-step-list-theme-cycle, bubble-swarm-takeover, canvas-materialize-moves, card-stack, carousel-3d, cube-navigation, cursor-flyover, floating-glossy-label-pills, flying-words, impact-feedback, list-reveal, mosaic-reframe, page-waterfall-wall, panel-grid-moves, picker-carousel-feature-cycle, pill-chip-slot-cycle-handled, pill-slot-cycle, radial-ripple-phone-chips, space-camera-moves, steep-tilt-glide, terminal-3d, timeline-travel, vertical-word-roll-blur-cycle, word-relay-filmstrip ⛔, word-relay-geometry

**сравнение**: before-after-slider-scrub, chip-grid-single-select-blackout, chip-lift-to-user-pill, overhead-camera-moves, panel-grid-moves, segmented-thumb-hero, text-column-converge ⛔, transition-hidden-cut, value-stagger-gradient, word-relay-geometry

**как работает**: ai-stream-response, autolayout-gap-dial, bezier-source-converge-merge, canvas-materialize-moves, command-palette-summon, doc-park-left-pill-deal, document-typewriter-reveal ⛔, glitch-cycle, montage-rhythm-moves, product-card-progressive-assemble, scan-bracket-sweep, scanline-annotate-focus, space-camera-moves, speed-ramp-freeze, spotlight-sweep-moves, terminal-3d, theme-switch-moves, type-and-filter, wall-reveal-moves

**было→стало**: aurora-bloom-bg-flip, before-after-slider-scrub, card-flip-reveal, circle-match-iris, doc-park-left-pill-deal, hatch-depth, integration-hub-map, line-carry-transition, page-turn-transitions, panel-grid-moves, paper-plane-messenger, product-card-progressive-assemble, segmented-thumb-hero, skeleton-reveal, tension-camera-moves, theme-switch-moves, timeline-travel, transition-travel, typewriter-moves

**появление объекта**: assemble-then-type-flyin, brace-expand, canvas-materialize-moves, card-stack, crash-zoom-punch, draw-svg-trace, graze-face-tour, hashtag-to-pill-materialize, hatch-depth, icon-performance-moves, magician-card-flourish, montage-rhythm-moves, morph-from-primitive, neon-frame-forerun, neon-frame-orbit-drop, paper-craft-moves, particle-sand-fill, radial-wave, runway-ground-skim, scanline-assemble-flyin, scramble, skeleton-reveal, slam-entrance-moves, spotlight-hero-card ⛔, text-as-mask, type-assembly-moves, type-entrance-moves, wall-reveal-moves

**связка**: avatar-bracket-carousel, beat-step-list-theme-cycle, bezier-source-converge-merge, bottom-push-stack-wipe, brand-frame-snap, bubble-swarm-takeover, chip-lift-to-user-pill, collab-cursor-moves, color-block-step-wipe, glow-flyline-moves, integration-hub-map, paper-plane-messenger, pill-chip-slot-cycle-handled, vertical-word-roll-blur-cycle

**рост-накопление**: chart-live-moves, cloner-depth-echo, crane-rise-reveal ⛔, deck-deal-flyin, icon-field-colorize, list-stack-press, page-waterfall-wall, particle-celebrate-hits, particle-sand-fill, research-card-stack-scroll, riso-print-hits

**результат-финал**: ai-stream-response, beat-cut-moves, card-flip-reveal, card-flock-tumble, cel-flash-stomp, chip-grid-single-select-blackout, chip-lift-to-user-pill, circle-match-iris, countdown-arc-scatter, counter-confetti, doc-park-left-pill-deal, edit-hook-moves, gauge-readout-moves, grain-dissolve, icon-performance-moves, impact-feedback, letterspace-materialize, light-play-moves, logo-shrink-wordmark-lockup, montage-rhythm-moves, neon-frame-orbit-drop, neon-triple-marquee, odometer-digit-roll, outline-word-fill, outro-group-photo-launch, paper-craft-moves, particle-celebrate-hits, rhythm-interrupt-moves, riso-print-hits, row-embed, runway-ground-skim, slam-entrance-moves, split-flap-title, tension-camera-moves, text-column-converge ⛔, timeline-travel, trailer-grammar-moves, ui-strip-away-outro, ui-to-brand-morph, white-flash-logo-simplify-cut, word-relay-geometry

**CTA**: card-flock-tumble, counter-confetti, edit-hook-moves, grain-dissolve, icon-performance-moves, logo-shrink-wordmark-lockup, neon-triple-marquee, outro-group-photo-launch, ui-strip-away-outro, ui-to-brand-morph, white-flash-logo-simplify-cut

**переход между мыслями**: aurora-bloom-bg-flip, basic-3d-scene, beat-cut-moves, blur-slide, bottom-push-stack-wipe, bubble-swarm-takeover, color-block-step-wipe, depth-layer-moves, fracture, fui-hud-moves, glass-pill-dictation-typing, glitch-cycle, line-carry-transition, morph-from-primitive, overhead-camera-moves, page-turn-transitions, paper-plane-messenger, paper-title-card, print-texture-transitions, scroll-brake-moves, shot-transitions, svg-shape-morph, tear-streak-transitions, title-demote-to-label, trailer-grammar-moves, transition-hidden-cut, transition-travel, type-and-filter, type-assembly-moves, typewriter-moves, wipe-transitions

**акцент**: avatar-grid-radial-build-colorize, blur-slide, brace-expand, crash-zoom-punch, dashboard-glow-highlight-pill, depth-layer-moves, draw-svg-trace, element-body-moves, fui-hud-moves, gradient-word-sweep, input-trigger-moves, light-play-moves, marker-underline-title, neon-frame-forerun, outline-word-fill, rhythm-interrupt-moves, riso-print-hits, sakuga-timing-shift, scroll-brake-moves, smear-multiples, spectrum-morph-ui, speed-ramp-freeze, spotlight-hero-card ⛔, spotlight-sweep-moves

**демонстрация интерфейса**: ai-stream-response, assemble-then-type-flyin, autolayout-gap-dial, carousel-3d, circle-match-iris, command-palette-summon, crane-rise-reveal ⛔, cube-navigation, cursor-flyover, dashboard-glow-highlight-pill, document-typewriter-reveal ⛔, floating-glossy-label-pills, graze-face-tour, list-reveal, mosaic-reframe, product-card-progressive-assemble, radial-ripple-phone-chips, row-embed, scan-bracket-sweep, scanline-annotate-focus, scanline-assemble-flyin, segmented-thumb-hero, skeleton-reveal, steep-tilt-glide, terminal-3d, type-and-filter, typewriter-moves, typing-code-block ⛔, voice-waveform-live, wall-reveal-moves, wipe-transitions, word-relay-filmstrip ⛔

(⛔ = в вертикаль не годится без сильной переделки — детали в пакете)

## Звёзды формата (топ из пакетов, для быстрых решений)

- list-reveal, doc-park-left-pill-deal, draw-svg-trace,
  beat-step-list-theme-cycle, morph-from-primitive (ui-entrance/rhythm)
- marker-underline-title, gradient-word-sweep, cel-flash-stomp,
  pill-slot-cycle (typography; стомпы — с выключенным караоке)
- fui-hud-moves·reticle-lock-on, card-flip-reveal,
  icon-performance-moves·pop-burst-confirm, line-boil, scan-bracket-sweep
  (effects, локальны к info-zone)
- type-and-filter, crash-zoom-punch, picker-carousel-feature-cycle,
  before-after-slider-scrub, counter-confetti (camera/data/interaction)
