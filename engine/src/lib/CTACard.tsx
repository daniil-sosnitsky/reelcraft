// Общая CTA-карточка канала (константы CLAUDE.md, раздел «Константы
// канала»): карточка 920 ширины по центру кадра, пруф канала сверху
// (по умолчанию аватар+имя, режим 'profile'), хендл
// 52px, слоган 32px — оба берутся из src/channel.ts, кнопка
// «Подписаться» 106px высотой при кегле 44, цвет #2AABEE, логотип
// shared/icons/telegram.svg. Курсор + беззвучный клик по кадру (проп
// clickFrame — локальный useCurrentFrame сцены, в которой смонтирована
// карточка); после клика кнопка красится в colors.green и меняет текст на
// «Вы подписаны». Звука нет ни на входе, ни на клике.
//
// Компонент НЕ центрирует себя сам: ставить в абсолютный контейнер с `top`
// числом, иначе флекс прижмёт карточку к верхней кромке кадра.
import React from 'react';
import { Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { fitText } from '@remotion/layout-utils';
import type { Theme } from '../themes/types';
import { CHANNEL } from '../channel';

const CL = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** Цвет кнопки подписки — из констант канала, независим от палитры темы. */
export const CTA_BTN_BLUE = CHANNEL.buttonColor;

/** Логотип Telegram на голубом диске. Иконка кита — белый диск,
 *  на светлой теме она сливается с карточкой. */
const TG_LOGO = 'shared/cta/telegram-round.svg';

export const CARD_WIDTH = 920;
const MIN_PROOF_WIDTH = 270;
const DEFAULT_PROOF_WIDTH = 420;
const PROOF_ASPECT = CHANNEL.ctaProofAspect; // высота/ширина скрина канала

// Тайминги — в кадрах при 30fps исходно; внутри компонента масштабируются
// на fps композиции (константы канала, менять только по просьбе).
const ENTER_DUR_30 = 12;
const SHAKE_AT_30 = 4;
const CHIP_AT_30 = 3;
const BLINK_AT_30 = 45;

export const CTACard: React.FC<{
  theme: Theme;
  /** staticFile-путь скрина канала. По умолчанию shared/cta/tg-channel.jpg. */
  proofSrc?: string;
  /** Ширина скрина, px. Не меньше 270 (правило канала), по умолчанию ~420. */
  proofWidth?: number;
  /** Чип-плашка над карточкой (например «бесплатный гайд · закреп»). */
  showChip?: boolean;
  chipText?: string;
  /** Локальный frame (useCurrentFrame сцены), на котором курсор кликает по
   * кнопке. Если не задан — курсора и клика нет, кнопка остаётся «Подписаться». */
  clickFrame?: number;
  /** Ширина самой карточки. Константа канала — 920, менять только по просьбе. */
  width?: number;
  /** Пруф в карточке:
   * 'profile' (по умолчанию) — круглый аватар канала + имя из шапки,
   *   рисуется нативно, поэтому чёткий на любом кегле;
   * 'image' — jpg-скрин шапки целиком (запасной, мылит на малом исходнике);
   * 'stats' — крупный логотип Telegram + строка подписчиков. */
  proofMode?: 'profile' | 'image' | 'stats';
  /** Строка под логотипом в режиме 'stats', например «1 200 подписчиков» —
   * число реальное, из шапки канала (правило 17); дефолт — из channel.ts. */
  subscribers?: string;
}> = ({
  theme,
  proofSrc = CHANNEL.ctaProof,
  proofWidth: proofWidthProp = DEFAULT_PROOF_WIDTH,
  proofMode = 'profile',
  subscribers = CHANNEL.subscribers,
  showChip = false,
  chipText = 'бесплатный гайд · закреп',
  clickFrame,
  width = CARD_WIDTH,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { colors, fontInter, fontMono } = theme;
  // Все константы длительностей ниже заданы в кадрах при 30fps — переводим
  // в реальную длительность через отношение fps/30 (иначе на 60fps ролике
  // вход/тряска/блик проигрались бы вдвое быстрее по времени).
  const k = fps / 30;
  const f30 = (n: number) => Math.round(n * k);

  const proofWidth = Math.max(MIN_PROOF_WIDTH, proofWidthProp);
  const proofHeight = proofWidth * PROOF_ASPECT;

  const handleFontSize = Math.min(
    52,
    fitText({ text: CHANNEL.handle, withinWidth: width - 56 * 2 - 64 - 18, fontFamily: 'Inter', fontWeight: 900 }).fontSize,
  );

  // Имя из шапки длиннее хендла, поэтому ужимается отдельно: в одну строку,
  // с тем же внутренним отступом карточки (56 с каждой стороны).
  const nameFontSize = Math.min(
    40,
    fitText({ text: CHANNEL.displayName, withinWidth: width - 56 * 2, fontFamily: 'Inter', fontWeight: 800 }).fontSize,
  );

  const enterDur = f30(ENTER_DUR_30);
  const shakeAt = f30(SHAKE_AT_30);
  const chipAt = f30(CHIP_AT_30);
  const blinkAt = f30(BLINK_AT_30);

  const scale = interpolate(frame, [0, enterDur], [1.12, 1], { ...CL, easing: Easing.out(Easing.cubic) });
  const cardOp = interpolate(frame, [0, f30(8)], [0, 1], CL);
  const shakeSpan = f30(3);
  const shakeX =
    frame >= shakeAt && frame < shakeAt + shakeSpan ? (frame - shakeAt === f30(1) ? 6 : -6) : 0;

  const chipOp = interpolate(frame, [chipAt, chipAt + f30(8)], [0, 1], CL);
  const blinkOp = interpolate(frame, [blinkAt, blinkAt + f30(4), blinkAt + f30(16)], [0, 0.5, 0], CL);

  const hasClick = clickFrame !== undefined;
  const cursorStart = hasClick ? clickFrame! - f30(25) : 0;
  // Цель курсора считается от НИЗА карточки — так клик попадает в кнопку
  // при любой её высоте и любом proofMode. Абсолютные координаты кадра тут
  // не работают: карточка — position: relative.
  // кнопка = padding 56 + высота 106, значит её центр на 109 от низа,
  // а курсор (40px) ставится bottom = 109 − 20 − 20 = 69. Поправка 13px
  // замерена по стиллу момента клика: кнопка в этот кадр сжата btnPress 0.96,
  // и её фактический центр уезжает вниз относительно расчётного.
  const BTN_CENTER_FROM_BOTTOM = 56 + 106 / 2;
  const cursorX = hasClick
    ? interpolate(frame, [cursorStart, clickFrame!], [width * 0.86, width / 2 - 20], CL)
    : 0;
  const cursorBottom = hasClick
    ? interpolate(frame, [cursorStart, clickFrame!], [BTN_CENTER_FROM_BOTTOM + 320, BTN_CENTER_FROM_BOTTOM - 40], CL)
    : 0;
  const cursorOp = hasClick
    ? interpolate(
        frame,
        [cursorStart, cursorStart + f30(10), clickFrame! + f30(8), clickFrame! + f30(10)],
        [0, 1, 1, 0],
        CL,
      )
    : 0;
  const clickScale = hasClick
    ? interpolate(frame, [clickFrame!, clickFrame! + f30(6), clickFrame! + f30(12)], [1, 0.85, 1], CL)
    : 1;
  const btnPress = hasClick
    ? interpolate(frame, [clickFrame!, clickFrame! + f30(6), clickFrame! + f30(12)], [1, 0.96, 1], CL)
    : 1;
  const subscribed = hasClick && frame >= clickFrame! + f30(6);

  return (
    <div style={{ position: 'relative' }}>
      {/* Одна тряска фона на входе (slam-entrance-moves). */}
      <div style={{ position: 'absolute', inset: 0, transform: `translateX(${shakeX}px)`, pointerEvents: 'none' }} />

      {showChip && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: -70,
            transform: 'translateX(-50%)',
            opacity: chipOp,
            padding: '12px 28px',
            borderRadius: 16,
            background: colors.mark,
            fontFamily: fontMono,
            fontWeight: 700,
            fontSize: 40,
            color: colors.markText,
            whiteSpace: 'nowrap',
          }}
        >
          {chipText}
        </div>
      )}

      <div
        style={{
          position: 'relative',
          left: '50%',
          transform: `translateX(-50%) scale(${scale})`,
          opacity: cardOp,
          width,
          borderRadius: 36,
          background: colors.card,
          border: `1px solid ${colors.cardBorder}`,
          padding: 56,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 32,
          boxSizing: 'border-box',
        }}
      >
        {proofMode === 'profile' ? (
          /* Аватар + имя канала — то же, что видно в шапке Telegram,
             но собранное из векторa и PNG, а не кроп скриншота. */
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>
            <Img
              src={staticFile(CHANNEL.ctaAvatar)}
              style={{ width: 200, height: 200, borderRadius: '50%', display: 'block', border: `4px solid ${colors.cardBorder}` }}
            />
            <div
              style={{
                fontFamily: fontInter,
                fontWeight: 800,
                fontSize: nameFontSize,
                color: colors.ink,
                whiteSpace: 'nowrap',
              }}
            >
              {CHANNEL.displayName}
            </div>
          </div>
        ) : proofMode === 'image' ? (
          /* Скрин канала — реальный пруф подписчиков. */
          <div style={{ width: proofWidth, height: proofHeight, borderRadius: 18, overflow: 'hidden', border: `1px solid ${colors.cardBorder}` }}>
            <Img src={staticFile(proofSrc)} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </div>
        ) : (
          /* Логотип + подписчики — пруф без мелкого текста. */
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
            <Img src={staticFile(TG_LOGO)} style={{ width: 180, height: 180, display: 'block' }} />
            {subscribers && (
              <div style={{ fontFamily: fontInter, fontWeight: 800, fontSize: 44, color: colors.ink, whiteSpace: 'nowrap' }}>
                {subscribers}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          {/* В режиме 'stats' логотип уже стоит крупно выше — второй лишний. */}
          {proofMode !== 'stats' && (
            <Img src={staticFile(TG_LOGO)} style={{ width: 64, height: 64, flexShrink: 0 }} />
          )}
          <div style={{ fontFamily: fontInter, fontWeight: 900, fontSize: handleFontSize, color: colors.ink }}>{CHANNEL.handle}</div>
        </div>

        <div style={{ fontFamily: fontInter, fontWeight: 600, fontSize: 32, color: colors.muted, textAlign: 'center' }}>
          {CHANNEL.tagline}
        </div>

        <div
          style={{
            width: '100%',
            height: 106,
            borderRadius: 18,
            background: subscribed ? colors.green : CTA_BTN_BLUE,
            color: subscribed ? colors.bg : '#fff',
            fontFamily: fontInter,
            fontWeight: 800,
            fontSize: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: `scale(${btnPress})`,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {subscribed ? 'Вы подписаны' : 'Подписаться'}
          {/* Один блик по кнопке. */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(100deg, transparent 30%, rgba(255,255,255,0.55) 50%, transparent 70%)',
              opacity: blinkOp,
              pointerEvents: 'none',
            }}
          />
        </div>
      </div>

      {/* Курсор — беззвучный клик по кнопке (только когда задан clickFrame). */}
      {hasClick && (
        <div
          style={{
            position: 'absolute',
            left: cursorX,
            bottom: cursorBottom,
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: '#fff',
            border: `3px solid ${colors.ink}`,
            opacity: cursorOp,
            transform: `scale(${clickScale})`,
            boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
          }}
        />
      )}
    </div>
  );
};
