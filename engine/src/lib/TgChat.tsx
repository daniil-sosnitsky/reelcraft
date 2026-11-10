// TgChat — макет переписки «шапка + пузыри», ОБЩИЙ компонент (правило 24
// в CLAUDE.md: когда реального скрина нет и быть не может — своя приватная
// переписка автора, обрезкой не лечится — рисуем правдоподобный макет по
// токенам темы вместо голой карточки). Логотип Telegram сюда не ставим:
// бренд называется голосом и заголовком сцены, глиф добавил бы третий
// объект в кадр (правило 3).
//
// Геометрия и дефолтные тайминги — из паспорта video-18 S11
// (queue/video-18/broll-storyboard.md): окно 1000×860, шапка 130, аватар
// 72×72, пузырь клиента/ассистента, индикатор «печатает…», поле ввода.
// Следующий ролик переопределяет тексты, размер окна и тайминг через пропы,
// внутренняя раскладка (где что внутри окна) остаётся контрактом компонента.
//
// `card2` (фон пузыря клиента) в токенах темы (`src/themes/types.ts`) нет —
// берём `theme.colors.cardBorder`: он светлее `card` ровно как нужен
// «второй» фон карточки, и это тот же приём, что уже используют карточки
// ролика для второстепенного фона.
import React from 'react';
import { Easing, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { fitText } from '@remotion/layout-utils';
import type { Theme } from '../themes/types';

const CL = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const easeOutCubic = Easing.out(Easing.cubic);
// Стандартная кривая easeOutBack (overshoot 1.56) — тот же изгиб, что у
// Easing.out(Easing.back(…)) из video-NN/scenes.tsx, но без зависимости от
// Remotion-специфичной функции Easing.back при вызове из lib/.
const easeOutBack = Easing.bezier(0.34, 1.56, 0.64, 1);

export type TgChatTiming = {
  /** Окно встаёт: scale 0.965→1, opacity 0→1. */
  windowIn?: [number, number];
  /** Пузырь клиента подъезжает снизу. */
  clientIn?: [number, number];
  /** «печатает…» появляется. */
  typingIn?: [number, number];
  /** «печатает…» гаснет. */
  typingOut?: [number, number];
  /** Пузырь помощника подъезжает снизу, занимает место индикатора. */
  assistantIn?: [number, number];
};

// Индикатор «печатает…» раньше жил 46→68, то есть 22 кадра (0,73 с) — меньше
// секунды, запрещённой правилом 1 (находка терчека 2026-11-02). Разведён на
// 40→78: 38 кадров (1,27 с). Пузырь помощника сдвинут следом и встаёт на f88 —
// в сцене из 127 кадров после него остаётся 39 кадров покоя (правило 8).
const DEFAULT_TIMING: Required<TgChatTiming> = {
  windowIn: [0, 12],
  clientIn: [14, 26],
  typingIn: [40, 50],
  typingOut: [72, 78],
  assistantIn: [74, 88],
};

/** Один из трёх индикаторов «печатает…» — пульсация периодом 24 кадра,
 *  фаза дотов разнесена на 8 кадров (видно бегущую волну, не синхронный мигающий блок). */
const TypingDots: React.FC<{ theme: Theme; frame: number }> = ({ theme, frame }) => (
  <div style={{ display: 'flex', gap: 10 }}>
    {[0, 1, 2].map((i) => {
      const phase = ((frame - i * 8) % 24 + 24) % 24;
      const o = 0.35 + 0.55 * (0.5 - 0.5 * Math.cos((2 * Math.PI * phase) / 24));
      return (
        <span
          key={i}
          style={{
            width: 14,
            height: 14,
            borderRadius: 99,
            background: theme.colors.muted,
            opacity: o,
          }}
        />
      );
    })}
  </div>
);

export const TgChat: React.FC<{
  theme: Theme;
  /** Геометрия окна — абсолютные координаты кадра (правило 16). */
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  radius?: number;
  name: string;
  status?: string;
  clientText: string;
  /** Текст ассистента, `\n` — перенос строки (цифры настоящие, правило 17). */
  assistantText: string;
  /** Иконка аватара из `shared/icons/generic/`. */
  avatarIcon?: string;
  timing?: TgChatTiming;
  /** Абсолютный кадр композиции — тот же приём, что у FlowNode/DottedLink/Broll:
   *  внутри своего <Sequence> не нужен, передаётся только если сцена ведёт
   *  общий счёт кадров без переоткрытия Sequence. */
  frame?: number;
}> = ({
  theme,
  x = 40,
  y = 520,
  w = 1000,
  h = 860,
  radius = 32,
  name,
  status = 'бот · отвечает сразу',
  clientText,
  assistantText,
  avatarIcon = 'message-circle',
  timing,
  frame: frameProp,
}) => {
  const ownFrame = useCurrentFrame();
  const frame = frameProp ?? ownFrame;
  const t = { ...DEFAULT_TIMING, ...timing };

  const winP = interpolate(frame, t.windowIn, [0, 1], { ...CL, easing: easeOutCubic });
  const clientP = interpolate(frame, t.clientIn, [0, 1], { ...CL, easing: easeOutBack });
  const typingInP = interpolate(frame, t.typingIn, [0, 1], CL);
  const typingOutP = interpolate(frame, t.typingOut, [1, 0], CL);
  const typingP = Math.min(typingInP, typingOutP);
  const assistantP = interpolate(frame, t.assistantIn, [0, 1], { ...CL, easing: easeOutBack });

  // Раскладка внутри окна — контракт компонента (числа из паспорта S11),
  // не проп: следующий ролик меняет содержимое и размер окна, не схему.
  const HEADER_H = 130;
  const AVATAR = { x: 36, y: 29, size: 72 };
  const NAME_POS = { x: 132, y: 26 };
  const STATUS_POS = { x: 132, y: 86 };
  // Абсолютные координаты пузырей/поля из паспорта минус (x, y) окна — чтобы
  // при переносе окна раскладка внутри него не плыла.
  const CLIENT = { x: 70 - x, y: 700 - y, w: 720, h: 180 };
  const TYPING = { x: 70 - x, y: 905 - y, w: 240, h: 70 };
  const ASSISTANT = { x: 250 - x, y: 905 - y, w: 800, h: 250 };
  const INPUT = { x: 70 - x, y: 1200 - y, w: 940, h: 120 };

  const nameFs = Math.min(
    54,
    fitText({ text: name, withinWidth: w - NAME_POS.x - 60, fontFamily: 'Inter', fontWeight: 800 }).fontSize,
  );
  const clientFs = Math.min(
    58,
    fitText({ text: clientText, withinWidth: CLIENT.w - 72, fontFamily: 'Inter', fontWeight: 700 }).fontSize,
  );
  const assistantFs = Math.min(
    58,
    fitText({
      text: assistantText.replace(/\n/g, ' '),
      withinWidth: ASSISTANT.w - 72,
      fontFamily: 'Inter',
      fontWeight: 700,
    }).fontSize,
  );

  const bubbleStyle = (p: number, color: string): React.CSSProperties => ({
    opacity: p,
    transform: `translateY(${36 * (1 - p)}px)`,
  });

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        opacity: winP,
        transform: `scale(${0.965 + 0.035 * winP})`,
        transformOrigin: 'center top',
      }}
    >
      {/* окно */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: radius,
          background: theme.colors.card,
          border: `2px solid ${theme.colors.cardBorder}`,
          overflow: 'hidden',
        }}
      >
        {/* шапка */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '100%',
            height: HEADER_H,
            borderBottom: `1px solid ${theme.colors.cardBorder}`,
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: AVATAR.x,
              top: AVATAR.y,
              width: AVATAR.size,
              height: AVATAR.size,
              borderRadius: 999,
              background: theme.colors.mark,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Глиф общей пиктограммы (белый штрих, lint-правило 4г) положен
                маской поверх лаймового круга — так же, как BrandIcon красит
                глиф Supabase в video-18/scenes.tsx, иначе белый штрих на
                светлом mark читается вяло. */}
            <div
              style={{
                width: 38,
                height: 38,
                background: theme.colors.markText,
                mask: `url(${staticFile(`shared/icons/generic/${avatarIcon}.svg`)}) center/contain no-repeat`,
                WebkitMask: `url(${staticFile(`shared/icons/generic/${avatarIcon}.svg`)}) center/contain no-repeat`,
              }}
            />
          </div>
          <div
            style={{
              position: 'absolute',
              left: NAME_POS.x,
              top: NAME_POS.y,
              fontFamily: theme.fontInter,
              fontSize: nameFs,
              fontWeight: 800,
              color: theme.colors.ink,
              whiteSpace: 'nowrap',
            }}
          >
            {name}
          </div>
          <div
            style={{
              position: 'absolute',
              left: STATUS_POS.x,
              top: STATUS_POS.y,
              fontFamily: theme.fontInter,
              fontSize: 34,
              fontWeight: 600,
              color: theme.colors.muted,
              whiteSpace: 'nowrap',
            }}
          >
            {status}
          </div>
        </div>
      </div>

      {/* пузырь клиента */}
      <div
        style={{
          position: 'absolute',
          left: CLIENT.x,
          top: CLIENT.y,
          width: CLIENT.w,
          height: CLIENT.h,
          borderRadius: 28,
          background: theme.colors.cardBorder,
          display: 'flex',
          alignItems: 'center',
          padding: '0 36px',
          boxSizing: 'border-box',
          ...bubbleStyle(clientP, theme.colors.cardBorder),
        }}
      >
        <span style={{ fontFamily: theme.fontInter, fontSize: clientFs, fontWeight: 700, color: theme.colors.ink }}>
          {clientText}
        </span>
      </div>

      {/* индикатор «печатает…» */}
      <div
        style={{
          position: 'absolute',
          left: TYPING.x,
          top: TYPING.y,
          width: TYPING.w,
          height: TYPING.h,
          display: 'flex',
          alignItems: 'center',
          opacity: typingP,
        }}
      >
        <TypingDots theme={theme} frame={frame} />
      </div>

      {/* пузырь помощника — встаёт на место индикатора */}
      <div
        style={{
          position: 'absolute',
          left: ASSISTANT.x,
          top: ASSISTANT.y,
          width: ASSISTANT.w,
          height: ASSISTANT.h,
          borderRadius: 28,
          background: theme.colors.mark,
          display: 'flex',
          alignItems: 'center',
          padding: '0 36px',
          boxSizing: 'border-box',
          ...bubbleStyle(assistantP, theme.colors.mark),
        }}
      >
        <span
          style={{
            fontFamily: theme.fontInter,
            fontSize: assistantFs,
            fontWeight: 700,
            color: theme.colors.markText,
            whiteSpace: 'pre-line',
            lineHeight: 1.18,
          }}
        >
          {assistantText}
        </span>
      </div>

      {/* поле ввода */}
      <div
        style={{
          position: 'absolute',
          left: INPUT.x,
          top: INPUT.y,
          width: INPUT.w,
          height: INPUT.h,
          borderRadius: 24,
          border: `2px solid ${theme.colors.cardBorder}`,
          display: 'flex',
          alignItems: 'center',
          padding: '0 36px',
          boxSizing: 'border-box',
        }}
      >
        <span style={{ fontFamily: theme.fontInter, fontSize: 44, fontWeight: 600, color: theme.colors.muted }}>
          Сообщение…
        </span>
      </div>
    </div>
  );
};
