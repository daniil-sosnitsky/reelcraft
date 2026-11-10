// СГЕНЕРИРОВАНО: scripts/sfx-peaks.py — руками не править, перегенерировать.
// Лаг пика каждого сэмпла в кадрах при 30 fps: насколько фронт атаки
// отстоит от НАЧАЛА файла. Поправка 2 из формулы sfxFrom() (sfx.ts).
// Замерено сэмплов: 106, с лагом >=1 кадра: 59,
// нарастающих (поправка не вносится): 24.
// Порог фронта — 0.7 от максимума огибающей в первых
// 1.5с (окно 5.0 мс).

export const SFX_PEAK_LAG_F: Record<string, number> = {
  'shared/sfx/camera/camera-autofocus.mp3': 10.5, // 350 мс
  'shared/sfx/camera/camera-lens-shutter.mp3': 0.6,
  'shared/sfx/camera/camera-shutter-hard.mp3': 4.2, // 140 мс
  'shared/sfx/camera/camera-shutter-vintage.mp3': 3.45, // 115 мс
  'shared/sfx/camera/click-camera.mp3': 5.7, // 190 мс
  'shared/sfx/camera/ui-zoom-in.mp3': 3.3, // 110 мс
  'shared/sfx/camera/ui-zoom-out.mp3': 9.0, // 300 мс
  'shared/sfx/camera/zoom-air-fast.mp3': 7.95, // 265 мс
  'shared/sfx/camera/zoom-futuristic.mp3': 7.35, // 245 мс
  'shared/sfx/camera/zoom-swipe-fast.mp3': 6.45, // 215 мс
  'shared/sfx/counter/clock-knob-spin.mp3': 3.15, // 105 мс
  'shared/sfx/counter/clock-mech-retract.mp3': 0.75,
  'shared/sfx/counter/clock-tick-single.mp3': 5.55, // 185 мс
  'shared/sfx/counter/countdown-bleeps.mp3': 0.0,
  'shared/sfx/data/break-glitch-digital.mp3': 0.45,
  'shared/sfx/data/data-compute.mp3': 0, // нарастающий (фронт 17.5f) — ставить по смыслу
  'shared/sfx/data/data-load-os.mp3': 0.15,
  'shared/sfx/data/data-scan.mp3': 3.45, // 115 мс
  'shared/sfx/data/glitch-electric-small.mp3': 0.15,
  'shared/sfx/data/glitch-static-electric.mp3': 0.6,
  'shared/sfx/data/glitch-static.mp3': 11.25, // 375 мс
  'shared/sfx/data/glitch-virtual-quick.mp3': 0, // нарастающий (фронт 38.4f) — ставить по смыслу
  'shared/sfx/data/power-up-electronic.mp3': 6.45, // 215 мс
  'shared/sfx/data/power-up-static.mp3': 0, // нарастающий (фронт 18.4f) — ставить по смыслу
  'shared/sfx/data/static-electric-present.mp3': 14.25, // 475 мс
  'shared/sfx/data/sweep-digital.mp3': 10.95, // 365 мс
  'shared/sfx/data/whoosh-electric.mp3': 0, // нарастающий (фронт 16.7f) — ставить по смыслу
  'shared/sfx/impact/bass-hit-futuristic.mp3': 4.05, // 135 мс
  'shared/sfx/impact/bass-hit-short.mp3': 2.25, // 75 мс
  'shared/sfx/impact/gravel-fall-hit.mp3': 3.6, // 120 мс
  'shared/sfx/impact/hit-blow.mp3': 3.75, // 125 мс
  'shared/sfx/impact/hit-fast-exciting.mp3': 4.05, // 135 мс
  'shared/sfx/impact/hit-weak.mp3': 4.35, // 145 мс
  'shared/sfx/impact/impact-cine-big.mp3': 0, // нарастающий (фронт 39.9f) — ставить по смыслу
  'shared/sfx/impact/impact-deep-whoosh.mp3': 13.65, // 455 мс
  'shared/sfx/impact/impact-epic-trailer.mp3': 0, // нарастающий (фронт 27.9f) — ставить по смыслу
  'shared/sfx/impact/impact-movie-epic.mp3': 0, // нарастающий (фронт 42.1f) — ставить по смыслу
  'shared/sfx/impact/impact-transition.mp3': 0, // нарастающий (фронт 27.9f) — ставить по смыслу
  'shared/sfx/impact/impact-zoom-quick.mp3': 11.55, // 385 мс
  'shared/sfx/impact/metal-spring-hit.mp3': 4.5, // 150 мс
  'shared/sfx/impact/stomp-apocalyptic.mp3': 4.35, // 145 мс
  'shared/sfx/light/light-aura.mp3': 0, // нарастающий (фронт 28.9f) — ставить по смыслу
  'shared/sfx/light/light-spell.mp3': 0, // нарастающий (фронт 26.7f) — ставить по смыслу
  'shared/sfx/light/light-sweep-magic.mp3': 0, // нарастающий (фронт 44.1f) — ставить по смыслу
  'shared/sfx/light/light-transition-magic.mp3': 0, // нарастающий (фронт 38.4f) — ставить по смыслу
  'shared/sfx/light/shimmer-sparkle-sweep.mp3': 0, // нарастающий (фронт 27.3f) — ставить по смыслу
  'shared/sfx/light/sparkle-poof-hit.mp3': 0.6,
  'shared/sfx/light/sparkle-touch.mp3': 13.8, // 460 мс
  'shared/sfx/light/sparkle-wand.mp3': 4.8, // 160 мс
  'shared/sfx/light/sparkle.mp3': 0, // нарастающий (фронт 41.2f) — ставить по смыслу
  'shared/sfx/light/stardust-swish.mp3': 0, // нарастающий (фронт 23.1f) — ставить по смыслу
  'shared/sfx/riser/riser-cine.mp3': 0, // нарастающий (фронт 20.0f) — ставить по смыслу
  'shared/sfx/text/chalk-line.mp3': 0.75,
  'shared/sfx/text/keyboard.mp3': 3.6, // 120 мс
  'shared/sfx/text/marker-pen-line.mp3': 0.6,
  'shared/sfx/text/pen-click-twice.mp3': 0, // нарастающий (фронт 15.2f) — ставить по смыслу
  'shared/sfx/text/pen-write-paper.mp3': 1.8, // 60 мс
  'shared/sfx/text/pencil-write-short.mp3': 0.9,
  'shared/sfx/text/typewriter-digital.mp3': 0.0,
  'shared/sfx/text/typewriter-hit-hard.mp3': 1.05, // 35 мс
  'shared/sfx/text/typewriter-hit-single.mp3': 5.1, // 170 мс
  'shared/sfx/text/typewriter-hit-soft.mp3': 4.2, // 140 мс
  'shared/sfx/text/typewriter-return-bell.mp3': 5.1, // 170 мс
  'shared/sfx/text/write-blackboard.mp3': 14.25, // 475 мс
  'shared/sfx/text/write-fast.mp3': 0.45,
  'shared/sfx/transition/air-whoosh-powerful.mp3': 5.4, // 180 мс
  'shared/sfx/transition/air-woosh-deep.mp3': 13.65, // 455 мс
  'shared/sfx/transition/air-woosh-quick.mp3': 6.45, // 215 мс
  'shared/sfx/transition/air-zoom-vacuum.mp3': 11.25, // 375 мс
  'shared/sfx/transition/sweep-fast-small.mp3': 8.25, // 275 мс
  'shared/sfx/transition/sweep-fast.mp3': 11.85, // 395 мс
  'shared/sfx/transition/sweep-metal-quick.mp3': 0, // нарастающий (фронт 17.8f) — ставить по смыслу
  'shared/sfx/transition/sweep-scifi-fast.mp3': 8.85, // 295 мс
  'shared/sfx/transition/sweep-short.mp3': 13.35, // 445 мс
  'shared/sfx/transition/swoosh-quick.mp3': 8.25, // 275 мс
  'shared/sfx/transition/swoosh-slow.mp3': 0, // нарастающий (фронт 42.1f) — ставить по смыслу
  'shared/sfx/transition/transition-snap.mp3': 3.0, // 100 мс
  'shared/sfx/transition/transition-soft.mp3': 11.25, // 375 мс
  'shared/sfx/transition/transition-tech-slide.mp3': 2.7, // 90 мс
  'shared/sfx/transition/transition-tech.mp3': 10.2, // 340 мс
  'shared/sfx/transition/warp-slide.mp3': 12.9, // 430 мс
  'shared/sfx/transition/whoosh-big.mp3': 0, // нарастающий (фронт 21.3f) — ставить по смыслу
  'shared/sfx/transition/whoosh-fast.mp3': 0, // нарастающий (фронт 20.9f) — ставить по смыслу
  'shared/sfx/transition/whoosh-swirl.mp3': 0, // нарастающий (фронт 37.4f) — ставить по смыслу
  'shared/sfx/transition/wind-pass-vibrate.mp3': 0, // нарастающий (фронт 37.5f) — ставить по смыслу
  'shared/sfx/transition/wind-swoosh-short.mp3': 4.8, // 160 мс
  'shared/sfx/transition/wind-woosh-throw.mp3': 4.35, // 145 мс
  'shared/sfx/transition/wing-flutter.mp3': 6.45, // 215 мс
  'shared/sfx/ui/chime-crystal.mp3': 6.0, // 200 мс
  'shared/sfx/ui/hitech-touch-magnet.mp3': 0, // нарастающий (фронт 22.4f) — ставить по смыслу
  'shared/sfx/ui/pop-electric.mp3': 0.45,
  'shared/sfx/ui/pop.mp3': 0.9,
  'shared/sfx/ui/switch-click-quick.mp3': 0.0,
  'shared/sfx/ui/switch-light.mp3': 1.8, // 60 мс
  'shared/sfx/ui/switch-tap.mp3': 0.0,
  'shared/sfx/ui/ui-click-tone.mp3': 0.0,
  'shared/sfx/ui/ui-confirm-bleep.mp3': 4.8, // 160 мс
  'shared/sfx/ui/ui-confirm-tone.mp3': 0.15,
  'shared/sfx/ui/ui-message-pop.mp3': 1.65, // 55 мс
  'shared/sfx/ui/ui-notify-tech.mp3': 5.4, // 180 мс
  'shared/sfx/ui/ui-option-select.mp3': 3.45, // 115 мс
  'shared/sfx/ui/ui-popup-dry.mp3': 1.05, // 35 мс
  'shared/sfx/ui/ui-select-click.mp3': 0.0,
  'shared/sfx/ui/ui-select-modern.mp3': 0.3,
  'shared/sfx/ui/ui-success-soft.mp3': 0.3,
  'shared/sfx/ui/ui-tone-quick.mp3': 0.0,
};
