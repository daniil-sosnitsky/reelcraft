// BackdropDepth — слоистый фон темы emerald-velvet: база → асимметричные
// пятна свечения → виньетка → зерно.
//
// Почему не «градиент пожирнее». В разборах моушн-дизайна полноэкранный
// тёмный градиент прямо назван признаком дешёвого кадра, и у нас было ровно
// оно: плоский #061710 + статичная виньетка по центру. Свет должен иметь
// ИСТОЧНИК и быть асимметричным — тогда кадр читается как срежиссированный,
// а не как «тёмная тема по умолчанию».
//
// Тон кадра (глубокий / средний / светлый) — монтажная величина: на границе
// плана меняются минимум две величины из трёх (тон, масштаб, тип
// изображения). Поэтому пятна задаются поблочно пропом `glows`, а
// `density` одним числом гонит весь тон блока, не трогая раскладку.
import React from 'react';
import { AbsoluteFill } from 'remotion';
import type { Theme } from '../themes/types';
import { Grain } from './Grain';

export type Glow = { color: string; radius: number; x: number; y: number; opacity: number };

export const BackdropDepth: React.FC<{
  theme: Theme;
  /** Свои пятна блока. Не заданы — берутся из theme.depth. */
  glows?: Glow[];
  /** Множитель плотности свечения: 0,4 — «глубокий» тон, 1 — базовый,
   * 1,8 — «светлый». Один число на блок вместо правки каждого пятна. */
  density?: number;
  /** Зерно отдельным слоем поверх контента — выключается, только если блок
   * сам рисует Grain с другим z-index. */
  grain?: boolean;
}> = ({ theme, glows, density = 1, grain = true }) => {
  const depth = theme.depth;
  const spots = glows ?? depth?.glows ?? [];

  return (
    <>
      <AbsoluteFill style={{ pointerEvents: 'none' }}>
        <AbsoluteFill style={{ background: theme.colors.bg }} />

        {spots.map((g, i) => (
          <AbsoluteFill
            key={i}
            style={{
              // Пятно описано центром и радиусом в координатах кадра
              // 1080×1920 — так его можно поставить «за кромку» (центр вне
              // кадра), и свет будет приходить снаружи, как от окна.
              background: `radial-gradient(circle ${g.radius}px at ${g.x}px ${g.y}px, ${g.color} 0%, rgba(0,0,0,0) 72%)`,
              opacity: Math.min(1, g.opacity * density),
              mixBlendMode: 'screen',
            }}
          />
        ))}

        {depth?.vignette ? <AbsoluteFill style={{ background: depth.vignette }} /> : null}
      </AbsoluteFill>

      {grain && depth?.grain ? (
        <Grain opacity={depth.grain.opacity} scale={depth.grain.scale} />
      ) : null}
    </>
  );
};
