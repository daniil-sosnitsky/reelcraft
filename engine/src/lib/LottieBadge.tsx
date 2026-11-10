// Обёртка над @remotion/lottie — грузит JSON СТРОГО локально из public/
// (staticFile + fetch), никогда не по внешнему URL: сеть при рендере
// запрещена (то же правило, что и для шрифтов — см. src/fonts.ts).
// Lottie сам детерминирован (кадр берёт из useCurrentFrame() внутри пакета),
// так что достаточно один раз дождаться fetch через delayRender/continueRender.
import React, { useEffect, useState } from 'react';
import { continueRender, delayRender, staticFile } from 'remotion';
import { Lottie, type LottieAnimationData } from '@remotion/lottie';

export const LottieBadge: React.FC<{
  /** Путь внутри public/shared/lottie/, например "smoke.json". */
  src: string;
  width: number;
  height: number;
  style?: React.CSSProperties;
  /** Зациклить анимацию. По умолчанию true (прежнее поведение, обратная
   * совместимость со всеми существующими вызовами). Для однократного
   * перехода (напр. «лупа → крестик», video-121 S6) передавай false —
   * иначе Lottie бесконечно листает вперёд-назад между состояниями и
   * задуманный одноразовый переход не читается. ВАЖНО: чтобы анимация
   * стартовала с СВОЕГО кадра 0, а не с текущего кадра композиции, оборачивай
   * `<LottieBadge>` в собственный `<Sequence from={...}>` — Lottie берёт
   * кадр из useCurrentFrame(), который Remotion считает ЛОКАЛЬНО от
   * ближайшего Sequence. */
  loop?: boolean;
}> = ({ src, width, height, style, loop = true }) => {
  const [data, setData] = useState<LottieAnimationData | null>(null);
  const [handle] = useState(() => delayRender(`Loading lottie ${src}`));

  useEffect(() => {
    fetch(staticFile(`shared/lottie/${src}`))
      .then((res) => res.json())
      .then((json: LottieAnimationData) => {
        setData(json);
        continueRender(handle);
      })
      .catch((err) => {
        console.error('Lottie load failed', src, err);
        continueRender(handle);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!data) return null;

  return (
    <div style={{ width, height, ...style }}>
      <Lottie animationData={data} loop={loop} />
    </div>
  );
};
