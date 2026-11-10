// Адаптация компонента из проекта video-shotcraft
// (github.com/Vincentwei1021/video-shotcraft, Apache License 2.0).
// Изменения относительно оригинала описаны в NOTICE в корне проекта.
import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

/** Bright-field cut: a warm-white bloom that flashes over the hard cut.
 * `duration` — кадры; если не задан, берётся ~0.33с (было захардкожено 10
 * кадров при 30fps) через fps композиции. */
export const FlashCut: React.FC<{ duration?: number }> = ({ duration: durationProp }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const duration = durationProp ?? Math.round((10 / 30) * fps);
  const o = interpolate(frame, [0, duration * 0.4, duration], [0, 0.85, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill
      style={{
        pointerEvents: 'none',
        opacity: o,
        background: 'radial-gradient(ellipse at 50% 45%, rgba(255,248,235,0.98), rgba(255,244,224,0.55) 55%, transparent 80%)',
      }}
    />
  );
};
