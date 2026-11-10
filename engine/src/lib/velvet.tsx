// Грамматика кадра языка emerald-velvet: фон по тону плана, рисованная
// камера, чипы, иконки, подложка, плитки и провода.
//
// Это ОБЩИЕ детали языка, годные любому ролику на теме emerald-velvet.
// Сквозные носители конкретного ролика (у video-18 — окно каталога и чат)
// живут рядом с ним, в его собственном `emerald-velvet-parts.tsx`: их данные
// принадлежат сюжету, а не языку.
//
// Почему вынесено. На video-18 всё это лежало внутри папки ролика, и второй
// ролик мог получить язык только копипастой — то есть на второй правке два
// ролика начали бы расходиться. Разделение проведено после приёмки первого
// ролика (2026-11-07), когда язык стал нормой, а не пробником.
//
// Файл назван velvet, но ЗАВИСИТ от темы emerald-velvet напрямую (константа
// T ниже): это детали одного визуального языка, а не абстрактный слой.
// Второй тёмной теме понадобится свой такой файл, а не пропсы здесь.
import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { fitText } from '@remotion/layout-utils';
import { CHAMPAGNE, GLOW, emeraldVelvetTheme } from '../themes/emerald-velvet';
import { BackdropDepth, type Glow } from './BackdropDepth';
import { Fullbleed } from './Fullbleed';
import { stepFont } from './TypeStack';
import { roleStyle, stagger, type MotionRole } from './motion';
import type { Tone } from './cutPlan';
import type { Theme } from '../themes/types';
import iconManifest from '../../public/shared/icons/manifest.json';

/** Тема языка по умолчанию. Экспортируется ради роликов, которые собраны до
 * появления чёрного варианта (video-18): они импортируют `T` напрямую. */
export const T = emeraldVelvetTheme;

/** Тема, на которой рисуется грамматика кадра.
 *
 * Понадобился после просьбы автора «хочу попробовать в чёрной теме, а не в
 * фирменной» (2026-11-08). Язык при этом не меняется — меняются только
 * токены, поэтому копировать весь файл под вторую тёмную тему было бы
 * ошибкой: две копии разъедутся на первой же правке грамматики.
 *
 * Значение по умолчанию — emerald-velvet, поэтому video-18 ничего не знает
 * о контексте и рендерится байт-в-байт как раньше. */
export const VelvetThemeContext = React.createContext<Theme>(emeraldVelvetTheme);

export const useVelvetTheme = (): Theme => React.useContext(VelvetThemeContext);

/** Второй акцент активной темы: шампань из depth.hairline. */
const useHairline = (): string => useVelvetTheme().depth?.hairline ?? CHAMPAGNE;

type IconSpec = { file: string; label: string; bg: string; color: string | null; style?: 'color' | 'mono' };
const ICONS = (iconManifest as unknown as { icons: Record<string, IconSpec> }).icons;

/** Сквиркл под пиктограмму банка generic/* обязан быть ТЁМНЫМ в любой теме:
 * Lucide приходит с прибитым stroke="#FFFFFF", на светлой плашке от иконки
 * остаётся пустой квадрат. Линт это проверяет (правило 4d). */
const SQUIRCLE_DARK = '#16181C';

/** Габариты носителя. Правило 16: размер КАЖДОГО носителя числом. */
export type Rect = { x: number; y: number; w: number; h: number };

// ─────────────────────────────────────────────────────────────────────────
// Фон по тону плана
// ─────────────────────────────────────────────────────────────────────────

/** Тон — монтажная величина: на границе плана обязаны меняться минимум две
 * величины из трёх. Один множитель плотности на план, раскладка пятен не
 * трогается. */
const DENSITY: Record<Tone, number> = { deep: 0.55, mid: 0.95, light: 1.5 };

/** Пятна свечения. Сторону источника гонит индекс плана: у соседей свет
 * приходит с разных сторон, иначе фон на склейке не меняется и склейку
 * видно только по содержимому — ровно та болезнь, из-за которой детектор
 * смены картинки нашёл в сданной версии 2 границы из 15. */
export const glowsFor = (index: number, theme: Theme = emeraldVelvetTheme): Glow[] => {
  const right = index % 2 === 0;
  // Цвета берутся из темы, а не из констант изумрудной палитры: на чёрной
  // теме зелёные пятна оставили бы кадр «фирменным зелёным», и смысл смены
  // основы пропал бы. Фолбэк — исходные изумрудные.
  const a = theme.depth?.glows?.[0]?.color ?? GLOW.emerald;
  const b = theme.depth?.glows?.[1]?.color ?? GLOW.teal;
  return [
    { color: a, radius: right ? 780 : 700, x: right ? 840 : 200, y: right ? 420 : 600, opacity: 0.46 },
    { color: b, radius: 580, x: right ? 150 : 930, y: right ? 1480 : 1220, opacity: 0.32 },
  ];
};

/** Подложка плана. Каждый план рисует свой фон, а не наследует общий слой
 * композиции — иначе тон перестаёт быть монтажной величиной. */
export const Stage: React.FC<{ tone: Tone; index: number; children?: React.ReactNode }> = ({
  tone,
  index,
  children,
}) => {
  const theme = useVelvetTheme();
  return (
    <AbsoluteFill>
      <BackdropDepth theme={theme} glows={glowsFor(index, theme)} density={DENSITY[tone]} />
      {children}
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// Рисованная камера
// ─────────────────────────────────────────────────────────────────────────

/** Низ носителя на крупном плане. 1430 — на 20 px выше полосы караоке
 * 1450: субтитры не имеют права ложиться на непрозрачный носитель. */
export const CAP_FREE_Y = 1430;

/** Центр камеры, подогнанный по НИЖНЕЙ кромке носителя: кромка встаёт на
 * `bottomAt`. Считать центр на глаз нельзя — при любом zoom носитель
 * заезжает пузырями под субтитры, и это видно только после рендера. */
export const camCy = (zoom: number, carrierBottom: number, bottomAt = CAP_FREE_Y): number =>
  carrierBottom - (bottomAt - 960) / zoom;

/** Крупный план рисованного интерфейса. PageCam здесь не годится: он —
 * камера ВНУТРИ скриншота, а наш носитель нарисован в координатах кадра.
 * Камера переносит точку (cx, cy) носителя в центр кадра 540×960 и
 * масштабирует, то есть кадрирует ТОТ ЖЕ объект, а не рисует новый
 * «крупный» (правило 25).
 *
 * Обёрнуто в Fullbleed: на зуме носитель заведомо выходит за кромки, и это
 * решение, а не промах (правило 26 — исключение только с пометкой). Скрим
 * под полосой караоке Fullbleed ставит сам. */
export const CloseUp: React.FC<{
  zoom: number;
  cx: number;
  cy: number;
  capScrim?: boolean;
  children?: React.ReactNode;
}> = ({ zoom, cx, cy, capScrim = true, children }) => (
  <CloseUpInner zoom={zoom} cx={cx} cy={cy} capScrim={capScrim}>
    {children}
  </CloseUpInner>
);

const CloseUpInner: React.FC<{
  zoom: number;
  cx: number;
  cy: number;
  capScrim: boolean;
  children?: React.ReactNode;
}> = ({ zoom, cx, cy, capScrim, children }) => (
  <Fullbleed theme={useVelvetTheme()} top={0} height={1920} capScrim={capScrim}>
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        // Система координат носителя, которую масштабирует камера.
        // Разрешение на вылет за кромку даёт Fullbleed выше (правило 26,
        // исключение только с пометкой).
        width: 1080, // fullbleed — во весь кадр осознанно
        height: 1920,
        transformOrigin: '0 0',
        transform: `translate(${540 - cx * zoom}px, ${960 - cy * zoom}px) scale(${zoom})`,
      }}
    >
      {children}
    </div>
  </Fullbleed>
);

// ─────────────────────────────────────────────────────────────────────────
// Мелкие носители
// ─────────────────────────────────────────────────────────────────────────

/** Чип: мелкий капс Oswald в рамке шампанью. Второй акцент темы работает
 * ТОЛЬКО линией и капсом — заливкой шампань не используется нигде, иначе
 * начинает спорить с изумрудом за роль акцента. */
export const Pill: React.FC<{
  children: React.ReactNode;
  x: number;
  y: number;
  at: number;
  frame: number;
  filled?: boolean;
}> = ({ children, x, y, at, frame, filled = false }) => {
  const T = useVelvetTheme();
  const CHAMPAGNE = useHairline();
  if (frame < at) return null;
  const p = roleStyle('meta', frame, at);
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        height: 72,
        display: 'flex',
        alignItems: 'center',
        padding: '0 26px',
        borderRadius: 16,
        border: `1px solid ${filled ? T.colors.mark : CHAMPAGNE}`,
        background: filled ? T.colors.mark : 'transparent',
        ...stepFont(T, 'label'),
        color: filled ? T.colors.markText : CHAMPAGNE,
        whiteSpace: 'nowrap',
        opacity: p.opacity,
        transform: p.transform,
        boxSizing: 'border-box',
      }}
    >
      {children}
    </div>
  );
};

/** Пиктограмма банка generic/* в тёмном сквиркле. */
export const GenericIcon: React.FC<{ name: string; size?: number; box?: number }> = ({
  name,
  size = 48,
  box = 96,
}) => (
  <div
    style={{
      width: box,
      height: box,
      borderRadius: Math.round(box * 0.3),
      background: SQUIRCLE_DARK,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}
  >
    <Img src={staticFile(`shared/icons/generic/${name}.svg`)} style={{ width: size, height: size }} />
  </div>
);

/** Логотип бренда из банка. Сквиркл красится в bg манифеста только у
 * style:"mono" — у цветного глифа своя подложка не нужна и она его глушит. */
export const BrandIcon: React.FC<{ brand: string; size?: number; box?: number }> = ({
  brand,
  size = 54,
  box = 104,
}) => {
  const spec = ICONS[brand];
  if (!spec) return null;
  return (
    <div
      style={{
        width: box,
        height: box,
        borderRadius: Math.round(box * 0.3),
        background: spec.style === 'mono' ? spec.bg : SQUIRCLE_DARK,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <Img src={staticFile(`shared/icons/${spec.file}`)} style={{ width: size, height: size }} />
    </div>
  );
};

/** Подложка схемы: третий слой кадра между фоном и плитками. Входит ролью
 * media (без fade) с кадра 0 плана — у плана не бывает пустого первого
 * кадра, а зритель получает носитель, на который садятся плитки. */
export const Panel: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  at?: number;
  frame: number;
  children?: React.ReactNode;
}> = ({ x, y, w, h, at = 0, frame, children }) => {
  const T = useVelvetTheme();
  const p = roleStyle('media', frame, at);
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        borderRadius: 34,
        // 0,055, а не 0,03: на контактном листе подложка при 3 % не читалась
        // вовсе, то есть третьего слоя в кадре не было — а он и есть разница
        // между «срежиссированной сценой» и «плашками на фоне».
        background: 'rgba(234,244,237,0.055)',
        border: `1px solid ${T.colors.cardBorder}`,
        boxSizing: 'border-box',
        transform: p.transform,
        opacity: p.opacity,
      }}
    >
      {children}
    </div>
  );
};

/** Плитка схемы: пиктограмма или бренд, заголовок, подпись. */
export const Tile: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  sub?: string;
  icon?: string;
  brand?: string;
  at: number;
  frame: number;
  role?: MotionRole;
  accent?: boolean;
}> = ({ x, y, w, h, title, sub, icon, brand, at, frame, role = 'support', accent = false }) => {
  const T = useVelvetTheme();
  if (frame < at) return null;
  const p = roleStyle(role, frame, at);
  const iconBox = brand ? 104 : icon ? 96 : 0;
  // Ширина, остающаяся тексту: габарит минус padding 32×2, минус иконка,
  // минус зазор. Считать её ОБЯЗАТЕЛЬНО, а не надеяться на nowrap: под
  // WARN на кегль почти всегда лежит переполнение, и правило 13 требует
  // сначала посчитать строку в px, а потом трогать кегль. Своими руками я
  // уже получил два таких заголовка — «Диалог передаётся целиком» в w=920
  // требует ~950 px.
  const inner = w - 64 - iconBox - (iconBox ? 28 : 0);
  const lead = stepFont(T, 'lead');
  const titleSize = Math.min(
    lead.fontSize as number,
    fitText({
      text: title,
      withinWidth: inner,
      fontFamily: lead.fontFamily as string,
      fontWeight: lead.fontWeight as number,
    }).fontSize,
  );
  const label = stepFont(T, 'label');
  const subSize = sub
    ? Math.min(
        40,
        fitText({
          text: sub,
          withinWidth: inner,
          fontFamily: label.fontFamily as string,
          fontWeight: label.fontWeight as number,
          letterSpacing: label.letterSpacing as string,
        }).fontSize,
      )
    : 0;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        borderRadius: 26,
        background: T.colors.card,
        border: `1px solid ${accent ? T.colors.mark : T.colors.cardBorder}`,
        boxShadow: T.colors.cardShadow,
        display: 'flex',
        alignItems: 'center',
        gap: iconBox ? 28 : 0,
        padding: '0 32px',
        boxSizing: 'border-box',
        transform: p.transform,
        opacity: p.opacity,
      }}
    >
      {brand ? <BrandIcon brand={brand} /> : icon ? <GenericIcon name={icon} /> : null}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
        <span style={{ ...lead, fontSize: titleSize, color: T.colors.ink, whiteSpace: 'nowrap' }}>{title}</span>
        {sub ? (
          // Потолок 40, а не 42: 74/42 = 1,76 — ступень не добирает до 1,8,
          // а линт ругается только ниже 40.
          <span style={{ ...label, fontSize: subSize, color: CHAMPAGNE, whiteSpace: 'nowrap' }}>{sub}</span>
        ) : null}
      </div>
    </div>
  );
};

/** Провод между плитками: пунктир шампанью, прорисовывается по ДЛИНЕ.
 * Длина — это событие; фейд линии зритель не замечает. */
export const Wire: React.FC<{
  x: number;
  y: number;
  len: number;
  at: number;
  frame: number;
  vertical?: boolean;
  frames?: number;
}> = ({ x, y, len, at, frame, vertical = false, frames = 10 }) => {
  const CHAMPAGNE = useHairline();
  if (frame < at) return null;
  const p = Math.min(1, (frame - at) / frames);
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: vertical ? 3 : len,
        height: vertical ? len : 3,
        background: `repeating-linear-gradient(${vertical ? 180 : 90}deg, ${CHAMPAGNE} 0 10px, rgba(0,0,0,0) 10px 22px)`,
        opacity: 0.55,
        transform: vertical ? `scaleY(${p})` : `scaleX(${p})`,
        transformOrigin: vertical ? '50% 0' : '0 50%',
      }}
    />
  );
};

