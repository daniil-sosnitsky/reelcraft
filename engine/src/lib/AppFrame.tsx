// AppFrame — НАРИСОВАННОЕ окно сервиса: браузер, мессенджер, терминал.
//
// Прямой ответ на претензию автора по video-18: «таблица Supabase выглядит
// просто таблицей, там даже не было значка supabase как при открытой
// вкладке». Настоящий, но нечитаемый скрин хуже нарисованного и
// узнаваемого — поэтому в монтаж идёт рисунок, а настоящий экран остаётся
// источником цифр (правило 17 закрыто им, правило 30 — этим компонентом).
//
// Что делает окно узнаваемым (по разбору эталонов — ровно эти детали, а не
// качество картинки): вкладка с фавиконом бренда, адресная строка, три
// точки, шапка с именем и статусом, курсор/каретка. Без них любой макет
// читается как «карточка с текстом».
//
// Геометрия задаётся числами снаружи (правило 16: размер КАЖДОГО носителя
// числом). Внутренности — children в системе координат содержимого окна.
import React from 'react';
import { Img, staticFile } from 'remotion';
import type { Theme } from '../themes/types';
import iconManifest from '../../public/shared/icons/manifest.json';
import { stepFont } from './TypeStack';
import { caret } from './motion';

type IconSpec = { file: string; label: string; bg: string; color: string | null; style?: 'color' | 'mono' };
const ICONS = (iconManifest as unknown as { icons: Record<string, IconSpec> }).icons;

const DOTS = ['#E5484D', '#E8A33D', '#34D399'];

/** Высота поля ввода в варианте chat. Одно число на плашку и на нижний
 * отступ области содержимого — две копии разъезжаются через одну правку. */
const INPUT_H = 88;

export const AppFrame: React.FC<{
  theme: Theme;
  variant: 'browser' | 'chat' | 'terminal';
  x: number;
  y: number;
  w: number;
  h: number;
  radius?: number;
  /** Ключ бренда в manifest.json — фавикон вкладки / аватар чата. */
  brand?: string;
  /** Подпись вкладки (browser), имя собеседника (chat), имя сессии (terminal). */
  title?: string;
  /** Адресная строка (browser) или статус «онлайн» (chat). */
  subtitle?: string;
  /** Кадр для мигающей каретки; не задан — каретки нет. */
  frame?: number;
  /** Поле ввода внизу окна — только для chat. */
  input?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ theme, variant, x, y, w, h, radius = 28, brand, title, subtitle, frame, input, children, style }) => {
  const c = theme.colors;
  const headH = variant === 'browser' ? 112 : 96;
  const spec = brand ? ICONS[brand] : undefined;

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        borderRadius: radius,
        background: c.card,
        border: `1px solid ${c.cardBorder}`,
        boxShadow: c.cardShadow,
        overflow: 'hidden',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {/* ── Шапка ─────────────────────────────────────────────────── */}
      <div
        style={{
          height: headH,
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          padding: '0 28px',
          // Шапка на 1 уровень светлее тела: граница окна читается без
          // линии, как у настоящих приложений.
          background: 'rgba(234,244,237,0.04)',
          borderBottom: `1px solid ${c.cardBorder}`,
          boxSizing: 'border-box',
        }}
      >
        {variant !== 'chat' ? (
          <div style={{ display: 'flex', gap: 12 }}>
            {DOTS.map((d) => (
              <div key={d} style={{ width: 16, height: 16, borderRadius: 8, background: d, opacity: 0.85 }} />
            ))}
          </div>
        ) : null}

        {variant === 'browser' ? (
          <>
            {/* Вкладка — главная деталь узнаваемости: фавикон + имя страницы */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                height: 72,
                padding: '0 24px',
                borderRadius: 14,
                background: c.bg,
                border: `1px solid ${c.cardBorder}`,
                boxSizing: 'border-box',
                // Вкладка не сжимается: в строке шапки за ширину конкурируют
                // точки, вкладка и адрес, и без этого флекс отбирал ширину у
                // вкладки, а имя страницы ломалось на две строки и вылезало
                // за её габарит (пруф: probe-198).
                flexShrink: 0,
              }}
            >
              {spec ? (
                <Img src={staticFile(`shared/icons/${spec.file}`)} style={{ width: 40, height: 40 }} />
              ) : null}
              <span style={{ ...stepFont(theme, 'body'), fontSize: 42, color: c.ink, whiteSpace: 'nowrap' }}>
                {title}
              </span>
            </div>
            {/* Ширину отдаёт адресная строка: у неё уже есть многоточие. */}
            <span
              style={{
                ...stepFont(theme, 'mono'),
                color: c.muted,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                minWidth: 0,
                flex: 1,
              }}
            >
              {subtitle}
            </span>
          </>
        ) : null}

        {variant === 'chat' ? (
          <>
            {spec ? (
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  background: spec.style === 'mono' ? spec.bg : '#16181C',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Img src={staticFile(`shared/icons/${spec.file}`)} style={{ width: 38, height: 38 }} />
              </div>
            ) : null}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ ...stepFont(theme, 'body'), fontSize: 52, fontWeight: 700, color: c.ink }}>{title}</span>
              <span style={{ ...stepFont(theme, 'body'), fontSize: 42, color: c.mark }}>{subtitle}</span>
            </div>
          </>
        ) : null}

        {variant === 'terminal' ? (
          <span style={{ ...stepFont(theme, 'label'), color: theme.depth?.hairline ?? c.muted }}>{title}</span>
        ) : null}
      </div>

      {/* ── Содержимое ─────────────────────────────────────────────────
          Поле ввода — часть окна, а не оверлей: когда оно есть, область
          содержимого обязана кончаться НАД ним, иначе последний пузырь
          уезжает под плашку ввода и читается как баг вёрстки, а не как
          «переписка продолжается» (пруф: probe-128). */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: headH,
          right: 0,
          bottom: variant === 'chat' && input !== undefined ? INPUT_H + 40 : 0,
        }}
      >
        {children}
      </div>

      {/* ── Поле ввода (chat): без него окно не читается мессенджером ── */}
      {variant === 'chat' && input !== undefined ? (
        <div
          style={{
            position: 'absolute',
            left: 28,
            right: 28,
            bottom: 24,
            height: INPUT_H,
            borderRadius: 20,
            background: c.bg,
            border: `1px solid ${c.cardBorder}`,
            display: 'flex',
            alignItems: 'center',
            padding: '0 28px',
            gap: 6,
            boxSizing: 'border-box',
          }}
        >
          <span style={{ ...stepFont(theme, 'body'), fontSize: 44, color: c.muted }}>{input}</span>
          {frame !== undefined ? (
            <span style={{ width: 3, height: 44, background: c.mark, opacity: caret(frame) }} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

/** Пузырь переписки. Исходящий — заливка акцентом, входящий — карточка.
 * Ширина задаётся числом снаружи: текст в пузыре переносится, и «примерно
 * по содержимому» здесь не работает. */
export const ChatBubble: React.FC<{
  theme: Theme;
  side: 'in' | 'out';
  x: number;
  y: number;
  w: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ theme, side, x, y, w, children, style }) => {
  const c = theme.colors;
  const out = side === 'out';
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        padding: '22px 28px',
        borderRadius: 26,
        borderBottomRightRadius: out ? 8 : 26,
        borderBottomLeftRadius: out ? 26 : 8,
        background: out ? c.mark : c.card,
        border: out ? 'none' : `1px solid ${c.cardBorder}`,
        boxShadow: c.cardShadow,
        color: out ? c.markText : c.ink,
        ...stepFont(theme, 'body'),
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {children}
    </div>
  );
};
