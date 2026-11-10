// Адаптация компонента из проекта video-shotcraft
// (github.com/Vincentwei1021/video-shotcraft, Apache License 2.0).
// Изменения относительно оригинала описаны в NOTICE в корне проекта.
//
// Общая версия: базовый PageCam плюс расширения под вертикаль —
//  1. Вьюпорт и «ширина страницы» были прибиты гвоздями к 1920×1080
//     (горизонтальный movie-фрейм шаблона-донора) — здесь вынесены в пропы
//     viewportW/viewportH/srcW с дефолтами 1920/1080/1920, поэтому старые
//     вызовы (если появятся) продолжат работать as is, а сцена может передать
//     реальный размер своего контейнера (например, вертикальной info-zone) и
//     реальную ширину клипа, чтобы cx/cy/zoom камеры считались в системе
//     координат САМОГО источника, а не постороннего 1920-px листа.
//  2. `Img` был единственным типом текстуры (скриншот страницы). Добавлен
//     `mediaType: 'video'` — рендерит `OffthreadVideo` вместо `Img` (камера
//     водится по видеоклипу, а не по статике).
import React from 'react';
import { AbsoluteFill, Img, OffthreadVideo, interpolate, staticFile, useCurrentFrame, Easing } from 'remotion';

export type CamKey = {
  frame: number;
  cx: number;
  cy: number;
  zoom: number;
  rotX?: number; // deg, tilt about the horizontal axis (positive = top leans away, like looking at a table)
  rotY?: number; // deg, tilt about the vertical axis (positive = right edge recedes, i.e. seen from the LEFT)
  rotZ?: number; // deg, in-plane roll
  persp?: number; // px, perspective strength (default 1400; smaller = stronger)
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * 2.5D camera over a full-page screenshot (or a video clip, mediaType='video').
 * (cx, cy) is the source-space CSS point centered in the viewportW×viewportH
 * viewport; zoom is scale (1 = 1 CSS px -> 1 output px). Textures are 2x,
 * rendered at CSS size via width=srcW.
 *
 * Optional 3D: keys may carry rotX/rotZ/persp to tilt the page like a plane
 * seen from an oblique camera. When NO key declares any 3D field, the markup
 * degrades to the original flat pan/zoom and renders pixel-identical.
 *
 * Optional DOF: a screen-space gradient-blur band approximating a focal plane
 * near `focusY` (blurring the far/top part of a tilted page).
 */
export const PageCam: React.FC<{
  src: string; // staticFile path под media (картинка или видео)
  pageH: number; // CSS высота источника (для картинки — высота страницы, для видео — высота клипа)
  keys: CamKey[];
  children?: React.ReactNode; // оверлеи в координатах источника (page-space CSS px)
  blur?: number;
  saturate?: number;
  ease?: (t: number) => number;
  dof?: { focusY: number; strength: number };
  /** Тип текстуры под камерой. По умолчанию 'img' (скриншот-страница),
   * 'video' — OffthreadVideo (клип из public/videos/NN/clips/), звук глушится. */
  mediaType?: 'img' | 'video';
  /** Реальный размер вьюпорта, в котором рисуется камера (по умолчанию —
   * горизонтальный 1920×1080 шаблона-донора; для вертикального контейнера
   * info-zone передавать фактические px контейнера). */
  viewportW?: number;
  viewportH?: number;
  /** CSS-ширина источника (страницы/клипа) — раньше была прибита к 1920. */
  srcW?: number;
  /** Фон вьюпорта там, где источник его не закрывает. Дефолт — кремовый
   *  шаблона-донора; в тёмных темах ОБЯЗАТЕЛЬНО передавать `theme.colors.bg`,
   *  иначе по краям кадра открывается светлое поле (2026-10-12). */
  bg?: string;
  // Optional absolute-frame override: when PageCam is rendered inside a
  // <Sequence> (which rebases useCurrentFrame), the parent can pass the
  // restored absolute comp frame so CAM_KEYS keep their absolute frame refs.
  frame?: number;
}> = ({
  src,
  pageH,
  keys,
  children,
  blur = 0,
  saturate = 1,
  ease = Easing.bezier(0.33, 0, 0.15, 1),
  dof,
  mediaType = 'img',
  viewportW = 1920,
  viewportH = 1080,
  srcW = 1920,
  bg = '#faf7f2',
  frame: frameProp,
}) => {
  const vcx = viewportW / 2;
  const vcy = viewportH / 2;
  const ownFrame = useCurrentFrame();
  const frame = frameProp ?? ownFrame;
  // find segment
  let a = keys[0], b = keys[keys.length - 1];
  for (let i = 0; i < keys.length - 1; i++) {
    if (frame >= keys[i].frame && frame <= keys[i + 1].frame) { a = keys[i]; b = keys[i + 1]; break; }
  }
  const t = a.frame === b.frame ? 1 : interpolate(frame, [a.frame, b.frame], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease,
  });
  const cx = lerp(a.cx, b.cx, t);
  const cy = lerp(a.cy, b.cy, t);
  const zoom = lerp(a.zoom, b.zoom, t);

  const filters: string[] = [];
  if (blur > 0) filters.push(`blur(${blur}px)`);
  if (saturate !== 1) filters.push(`saturate(${saturate})`);

  // Does any key request 3D? If not, keep the original flat markup exactly.
  const has3D = keys.some((k) => k.rotX !== undefined || k.rotY !== undefined || k.rotZ !== undefined || k.persp !== undefined);

  if (!has3D) {
    return (
      <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: bg }}>
        <div
          style={{
            position: 'absolute', width: srcW, height: pageH,
            transform: `translate(${vcx - cx * zoom}px, ${vcy - cy * zoom}px) scale(${zoom})`,
            transformOrigin: '0 0',
            filter: filters.length ? filters.join(' ') : undefined,
          }}
        >
          {mediaType === 'video' ? (
            <OffthreadVideo
              src={staticFile(src)}
              muted
              style={{ position: 'absolute', width: srcW, height: pageH, objectFit: 'cover' }}
            />
          ) : (
            <Img src={staticFile(src)} style={{ position: 'absolute', width: srcW, height: pageH }} />
          )}
          {children}
        </div>
      </AbsoluteFill>
    );
  }

  // 3D mode: pivot rotation/scale about the focal page-point (cx, cy) so it
  // stays centered in the viewport. With rotX=rotZ=0 this reduces to the flat
  // transform (proven identical: (960,540) + zoom*(p - (cx,cy))).
  const rotX = lerp(a.rotX ?? 0, b.rotX ?? 0, t);
  const rotY = lerp(a.rotY ?? 0, b.rotY ?? 0, t);
  const rotZ = lerp(a.rotZ ?? 0, b.rotZ ?? 0, t);
  const persp = lerp(a.persp ?? 1400, b.persp ?? 1400, t);

  return (
    <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: bg }}>
      <div
        style={{
          position: 'absolute', inset: 0,
          perspective: `${persp * zoom}px`,
          perspectiveOrigin: `${vcx}px ${vcy}px`,
        }}
      >
        {/* LAYOUT-SCALE zoom: instead of scale(zoom) in the transform chain (which
            makes Chromium rasterize the 3D-composited layer at srcW-wide LAYOUT
            size and then GPU-upscale by zoom — everything inside gets downsampled
            before magnification, hence blurry text), we apply the magnification as
            the CSS `zoom` property. `zoom` enlarges the layout box itself, so the
            page + card textures rasterize at the ENLARGED device size and sample
            down from their hi-res sources → sharp glyph edges under perspective.

            Coordinate math: `zoom` scales this element's local coordinate space by
            `zoom`, so a page point (cx,cy) renders at (cx*zoom, cy*zoom) device px
            from the box origin, and a `translate(Tx px)` renders as Tx*zoom device
            px. To land the focal point (cx,cy) at viewport centre (vcx,vcy):
              cx*zoom + Tx*zoom = vcx  ⟹  Tx = vcx/zoom - cx  (likewise Ty).
            Rotations pivot about transform-origin (cx,cy) = the focal point, so
            they leave its screen position unchanged. With rot=0 this reduces to
            translate(vcx/zoom - cx, vcy/zoom - cy) under zoom — identical framing
            to the old scale-based transform, just rasterized at layout scale. */}
        <div
          style={{
            position: 'absolute', width: srcW, height: pageH,
            zoom,
            transform: `translate(${vcx / zoom - cx}px, ${vcy / zoom - cy}px) rotateY(${rotY}deg) rotateX(${rotX}deg) rotateZ(${rotZ}deg)`,
            transformOrigin: `${cx}px ${cy}px`,
            transformStyle: 'preserve-3d',
            filter: filters.length ? filters.join(' ') : undefined,
          }}
        >
          {mediaType === 'video' ? (
            <OffthreadVideo
              src={staticFile(src)}
              muted
              style={{ position: 'absolute', width: srcW, height: pageH, objectFit: 'cover' }}
            />
          ) : (
            <Img src={staticFile(src)} style={{ position: 'absolute', width: srcW, height: pageH }} />
          )}
          {children}
        </div>
      </div>

      {/* Depth-of-field approximation: a top-band gradient blur (far part of a
          tilted page reads soft). Screen-space, over the page. */}
      {dof ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            height: Math.max(0, dof.focusY),
            backdropFilter: `blur(${dof.strength}px)`,
            WebkitBackdropFilter: `blur(${dof.strength}px)`,
            maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 45%, rgba(0,0,0,0) 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 45%, rgba(0,0,0,0) 100%)',
            pointerEvents: 'none',
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};
