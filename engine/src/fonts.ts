// Локальные шрифты через @remotion/fonts (loadFont) — нулевая зависимость
// от сети (правило remotion-ecosystem.md п.6: @remotion/google-fonts
// ЗАПРЕЩЁН для прод-рендера, он качает файлы с fonts.gstatic.com).
// loadFont() сам вызывает delayRender()/continueRender() внутри; общий
// таймаут поднят до 120000мс в remotion.config.ts
// (Config.setDelayRenderTimeoutInMilliseconds), поэтому здесь его задавать
// негде — loadFont() не принимает свой timeoutInMilliseconds.
import { loadFont } from '@remotion/fonts';

import interRegular from './fonts/inter-v20-cyrillic_latin-regular.woff2';
import interMedium from './fonts/inter-v20-cyrillic_latin-500.woff2';
import interBold from './fonts/inter-v20-cyrillic_latin-700.woff2';
import interExtraBold from './fonts/inter-v20-cyrillic_latin-800.woff2';
import interBlack from './fonts/inter-v20-cyrillic_latin-900.woff2';
import jbMonoRegular from './fonts/jetbrains-mono-v24-cyrillic_latin-regular.woff2';
import jbMonoMedium from './fonts/jetbrains-mono-v24-cyrillic_latin-500.woff2';
import ptSerifRegular from './fonts/pt-serif-v19-cyrillic_latin-regular.woff2';
import playfair800 from './fonts/playfair-display-v40-cyrillic_latin-800.woff2';
import playfair900 from './fonts/playfair-display-v40-cyrillic_latin-900.woff2';
import oswald600 from './fonts/oswald-v57-cyrillic_latin-600.woff2';
import ptSerifBold from './fonts/pt-serif-v19-cyrillic_latin-700.woff2';

void loadFont({ family: 'Inter', url: interRegular, weight: '400' });
void loadFont({ family: 'Inter', url: interMedium, weight: '500' });
void loadFont({ family: 'Inter', url: interBold, weight: '700' });
void loadFont({ family: 'Inter', url: interExtraBold, weight: '800' });
void loadFont({ family: 'Inter', url: interBlack, weight: '900' });
void loadFont({ family: 'JetBrains Mono', url: jbMonoRegular, weight: '400' });
void loadFont({ family: 'JetBrains Mono', url: jbMonoMedium, weight: '500' });

// PT Serif (кириллица+латиница) — добавлен для video-147 («редакторская»
// тема: текст статьи на бумаге набирается засечками, как в публикации).
// Скачан локально с gwfh.mranftl.com (Open Font License), сеть при рендере
// не используется.

void loadFont({ family: 'PT Serif', url: ptSerifRegular, weight: '400' });
void loadFont({ family: 'PT Serif', url: ptSerifBold, weight: '700' });

// Playfair Display (800/900) и Oswald (600) — дисплейная пара темы
// emerald-velvet (library/velvet-theme.md). Playfair держит
// заголовки кеглем 136–164: на таком размере нужен шрифт с контрастом
// штриха, иначе кадр читается как «ещё один жирный гротеск». Oswald —
// служебный капс (колонтитулы, подписи колонок, статусы): узкий, поэтому
// метка влезает в 42px и не спорит с заголовком за внимание.
// Оба — кириллица+латиница, SIL OFL, скачаны локально через
// gwfh.mranftl.com; сеть при рендере не используется.
void loadFont({ family: 'Playfair Display', url: playfair800, weight: '800' });
void loadFont({ family: 'Playfair Display', url: playfair900, weight: '900' });
void loadFont({ family: 'Oswald', url: oswald600, weight: '600' });
