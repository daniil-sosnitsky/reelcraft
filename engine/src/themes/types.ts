// Общий контракт темы. Обе темы (light.ts, noir.ts) реализуют этот тип —
// компоненты src/lib/*.tsx принимают `theme: Theme` пропом и не хардкодят
// цвета/зоны сами, чтобы одна и та же сцена рендерилась в обеих палитрах.

// 'terminal' — семейство самоопределяемых тёмных тем, выведенных из
// собственных терминальных ассетов ролика (library/adaptive-theme.md).
// Разовая палитра живёт у ролика: src/videos/video-NN/theme.ts.
export type ThemeId =
  | 'light'
  | 'noir'
  | 'emerald'
  | 'emerald-velvet'
  | 'velvet-noir'
  | 'terminal';

export type ThemeColors = {
  bg: string;
  ink: string;
  muted: string;
  /** Цвет ещё не произнесённого слова в караоке ("призрак"). */
  ghost: string;
  card: string;
  cardBorder: string;
  cardShadow: string;
  /** Акцент маркера караоке (жёлтый в light, зелёный в noir). */
  mark: string;
  /** Цвет текста поверх плашки-маркера. */
  markText: string;
  blue: string;
  green: string;
  orange: string;
  purple: string;
  red: string;
  /** Пара цветов для стомп-вспышки фона (см. правило №7 в CLAUDE.md —
   * мигание ВСЕГО кадра запрещено, эти цвета — для точечных, не полноэкранных
   * акцентов). */
  flashA: string;
  flashB: string;
};

/** Пояс главного контента и полоса караоке-субтитров (px, кадр 1080×1920). */
export type SafeZones = {
  contentTop: number;
  contentBottom: number;
  capTop: number;
  capBottom: number;
};

/** Зона персонажа — только у тем с персонажем (сейчас — light). */
export type CharZone = {
  left: number;
  bottom: number;
  width: number;
  height: number;
  z: number;
};

/** Стиль пословных субтитров: light — капс на светлой пилюле-подложке,
 * noir — крупный текст прямо на кадре без подложки. */
export type CaptionStyle = {
  usePillBackground: boolean;
  pillBackground?: string;
  fontSize: number;
  textShadow: string;
};

/** Слоистая глубина кадра (тема emerald-velvet, library/velvet-theme.md).
 * Поле опциональное: темы без него рендерятся ровно как раньше.
 * Пятна свечения задаются В КООРДИНАТАХ КАДРА 1080×1920 и намеренно
 * асимметричны — центрированный градиент читается как «тёмная тема по
 * умолчанию», а не как срежиссированный свет. */
export type ThemeDepth = {
  glows: { color: string; radius: number; x: number; y: number; opacity: number }[];
  /** CSS-градиент виньетки целиком — у каждой темы своя форма. */
  vignette: string;
  /** Зерно: лечит бандинг после сжатия и снимает «цифровую» гладкость. */
  grain: { opacity: number; scale: number };
  /** Второй акцент — только линия и мелкий капс, никогда заливка. */
  hairline: string;
};

/** Шкала кеглей и дисплейная пара гарнитур. Опционально: компоненты
 * src/lib/TypeStack.tsx работают только с темами, где поле задано.
 * Отношение соседних смысловых ступеней ≥1,8 — иначе кадр читается
 * «всё одним уровнем» (диагноз video-18: 80/64 = 1,25). */
export type TypeTokens = {
  scale: { hero: number; title: number; lead: number; body: number; mono: number; label: number };
  /** Дисплейная гарнитура заголовков (засечная, контраст штриха). */
  display: string;
  /** Служебный капс: колонтитул, подписи колонок, статусы. */
  label: string;
};

export type Theme = {
  id: ThemeId;
  colors: ThemeColors;
  fontInter: string;
  fontMono: string;
  safe: SafeZones;
  charZone?: CharZone;
  caption: CaptionStyle;
  depth?: ThemeDepth;
  type?: TypeTokens;
};
