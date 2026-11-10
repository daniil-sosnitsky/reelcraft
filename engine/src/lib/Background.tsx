// Фон — один компонент, две ветки: светлая и тёмная (Background рендерится первым,
// под сценами).
//
// light («Sticker Light»):
// --bg + радиальный светлый блик сверху + пол-сетка в перспективе внизу
// кадра, плюс UiScrim (мягкое затемнение низа/правого края, z 45 — над
// персонажем, под караоке).
//
// noir («GitHub noir») — раньше фон был
// голым backgroundColor без общего компонента): --bg сплошной + статичная
// виньетка (радиальное затемнение к краям кадра). Виньетка статична — не
// мигает (правило №7 в reelcraft/CLAUDE.md: полноэкранные стробы запрещены).
import React from 'react';
import { AbsoluteFill } from 'remotion';
import type { Theme, ThemeId } from '../themes/types';
import { BackdropDepth } from './BackdropDepth';

// Список тёмных тем. Раньше здесь стояло `theme.id === 'noir'`, и любая новая
// тёмная тема молча уезжала в светлую ветку — то есть получала белый блик
// сверху и пол-сетку, рассчитанные на светлый фон. Новая тёмная тема
// добавляется сюда одной строкой.
const DARK_THEMES: ThemeId[] = ['noir', 'emerald', 'emerald-velvet', 'velvet-noir', 'terminal'];

// Третья ветка: тема со слоистой глубиной (theme.depth) рендерит
// BackdropDepth — база, асимметричные пятна свечения, виньетка, зерно.
// Выбор идёт по НАЛИЧИЮ поля, а не по id: так ни одна существующая тема не
// меняет поведение ни на байт, а новая тёмная тема с глубиной не требует
// правки этого файла вообще.
export const Background: React.FC<{ theme: Theme }> = ({ theme }) =>
  theme.depth ? (
    <BackdropDepth theme={theme} />
  ) : DARK_THEMES.includes(theme.id) ? (
    <BackgroundNoir theme={theme} />
  ) : (
    <BackgroundLight theme={theme} />
  );

const BackgroundLight: React.FC<{ theme: Theme }> = ({ theme }) => (
  <AbsoluteFill style={{ pointerEvents: 'none' }}>
    <AbsoluteFill style={{ background: theme.colors.bg }} />

    {/* Радиальный светлый блик сверху кадра */}
    <AbsoluteFill
      style={{
        background:
          'radial-gradient(ellipse 90% 50% at 50% 8%, rgba(255,255,255,0.9), rgba(255,255,255,0) 60%)',
      }}
    />

    {/* Пол-сетка в перспективе — статичный слой внизу кадра */}
    <div
      style={{
        position: 'absolute',
        left: -200,
        right: -200,
        bottom: 0,
        height: 720,
        overflow: 'hidden',
        maskImage:
          'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 22%, rgba(0,0,0,1) 78%, rgba(0,0,0,0) 100%)',
        WebkitMaskImage:
          'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 22%, rgba(0,0,0,1) 78%, rgba(0,0,0,0) 100%)',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, perspective: 1150 }}>
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: 1400,
            transform: 'rotateX(58deg)',
            transformOrigin: '50% 100%',
            backgroundImage:
              'repeating-linear-gradient(to top, rgba(16,24,40,0.07) 0px, rgba(16,24,40,0.07) 2px, transparent 2px, transparent 74px)',
          }}
        />
      </div>
    </div>
  </AbsoluteFill>
);

const BackgroundNoir: React.FC<{ theme: Theme }> = ({ theme }) => (
  <AbsoluteFill style={{ pointerEvents: 'none' }}>
    <AbsoluteFill style={{ background: theme.colors.bg }} />

    {/* Статичная виньетка — тёмный GitHub-фон читается объёмнее, не плоско */}
    <AbsoluteFill
      style={{
        background:
          'radial-gradient(ellipse 80% 60% at 50% 42%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.55) 100%)',
      }}
    />
  </AbsoluteFill>
);

/** UiScrim — мягкое затемнение низа/правого края, нужен
 * только в light: там персонаж стоит на кадре, скрим отделяет его от
 * караоке-полосы. В noir не используется (персонажа нет). */
export const UiScrim: React.FC = () => (
  <AbsoluteFill
    style={{
      pointerEvents: 'none',
      zIndex: 45,
      background:
        'radial-gradient(ellipse 30% 42% at 103% 62%, rgba(22,24,29,0.22), rgba(22,24,29,0) 100%), linear-gradient(to top, rgba(22,24,29,0.36) 0%, rgba(22,24,29,0) 22%)',
    }}
  />
);
