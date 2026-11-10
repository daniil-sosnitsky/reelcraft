// Адаптация компонента из проекта video-shotcraft
// (github.com/Vincentwei1021/video-shotcraft, Apache License 2.0).
// Изменения относительно оригинала описаны в NOTICE в корне проекта.
import { interpolate, useCurrentFrame, useVideoConfig, Easing } from 'remotion';

const DIGITS = '0123456789';

/** Odometer-style digit column roll for monospace numerals. */
export const DigitRoll: React.FC<{
  value: string;
  delay?: number;
  fontSize?: number;
  color?: string;
}> = ({ value, delay = 0, fontSize = 30, color = 'oklch(52% 0.115 65)' }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Каскад разрядов и длительность прокрутки заданы в кадрах при 30fps —
  // масштабируем на fps композиции, чтобы на 60fps ролике одометр не
  // крутился вдвое быстрее по реальному времени.
  const k = fps / 30;
  const stagger = 4 * k;
  const rollDur = 22 * k;
  const lineH = fontSize * 1.15;
  return (
    <span style={{ display: 'inline-flex', overflow: 'hidden', height: lineH, verticalAlign: 'bottom' }}>
      {value.split('').map((ch, i) => {
        const target = DIGITS.indexOf(ch);
        if (target < 0) {
          return (
            <span key={i} style={{ fontSize, lineHeight: `${lineH}px`, color }}>{ch}</span>
          );
        }
        const t = interpolate(frame, [delay + i * stagger, delay + i * stagger + rollDur], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.bezier(0.25, 0.8, 0.25, 1),
        });
        // roll through one full strip then land on the target digit
        const offset = (10 + target) * t * lineH;
        return (
          <span key={i} style={{ display: 'inline-block', height: lineH }}>
            <span style={{ display: 'block', transform: `translateY(${-offset}px)` }}>
              {(DIGITS + DIGITS).split('').map((d, j) => (
                <span key={j} style={{ display: 'block', fontSize, lineHeight: `${lineH}px`, color, fontVariantNumeric: 'tabular-nums' }}>
                  {d}
                </span>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
};
