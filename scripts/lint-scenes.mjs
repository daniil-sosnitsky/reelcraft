#!/usr/bin/env node
/**
 * lint-scenes.mjs — статическая проверка сцен ролика ПЕРЕД рендером.
 *
 * Зачем: часть
 * правил проекта проверяется кодом за секунды, а раньше на них тратились
 * кадры, время рендера и внимание живой модели. Глаза нужны там, где решает
 * вкус (композиция, «куда смотреть», читаемость) — остальное ловит линт.
 *
 * Запуск:  node scripts/lint-scenes.mjs 110
 *          node scripts/lint-scenes.mjs 110 --strict   (warning тоже валят прогон)
 *
 * Что проверяет:
 *  1. ERROR  Math.random() / Date.now() / new Date() — ломают детерминизм рендера.
 *  2. ERROR  импорт @remotion/google-fonts — лезет в сеть при рендере (запрещён).
 *  3. ERROR  staticFile('...') на несуществующий файл в public/ — самая частая
 *            опечатка, раньше вылезала только на рендере через 10 минут.
 *  4. ERROR  длинный SFX-сэмпл без durationInFrames (sfx/NOTES.md: тянется
 *            после конца действия).
 *  5. WARN   fontSize меньше 48 — правило темпа 13 (текст либо читается,
 *            либо это осознанная текстура: тогда пометь строку `// текстура`).
 *  6. WARN   абсолютные координаты в караоке-полосе темы.
 *  7. WARN   volume SFX выше формулы по пику из sfx/CATALOG.md (2026-09-04).
 *  8. WARN   <Character> без swapMode="dip" (2026-09-04).
 *  9. ERROR  <PageCam> в файле без ни одного <TargetBox> — наезд без
 *            выделения цели (правило 28, 2026-10-07).
 * 10. WARN   <TargetBox> с pad < 8 (линия прижата к тексту) или с целью,
 *            заданной не числом и не константой своего файла — цель «на
 *            глаз», рамка ляжет на соседний текст. Вычисление от геометрии
 *            носителя, объявленной рядом, допускается с 2026-11-02: литерал
 *            молча уезжает на соседнюю строку при правке габаритов окна.
 * 11. ERROR  <PageCam> без viewportW/viewportH — камера считает вьюпорт
 *            горизонтальным, в вертикали кадр уезжает (правило 19, 2026-10-10).
 * 12. ERROR  <TargetBox from={N}> внутри проезда камеры — рамка едет вместе
 *            с кадром (правило 28 «в конце движения», 2026-10-10);
 *     WARN   zoom рамки не совпадает с zoom камеры в этот момент.
 * 13. ERROR  сэмпл из стоп-листа sfx/NOTES.md — запрет по тембру (2026-10-10).
 * 15. ERROR  пиктограмма generic/* на светлом носителе — белый штрих не виден
 *            (2026-10-12).
 * 16. WARN   фиксированный кегль в носителе фиксированной ширины: строка не
 *            влезает, переносится и вылезает за плашку (2026-10-12).
 * 14. WARN   слова вместо чисел в паспорте сториборда («крупнее», «подольше»,
 *            «растяни») — правило 16, причина кругов правок (2026-10-11).
 * 17. ERROR  кадр SFX без sfxFrom() или с голым числом внутри него (§4.5/§4.6
 *            кита): не внесены лаг пика сэмпла и смещение дорожки, а
 *            абсолютный якорь роняет таблицу при правке сцены (2026-10-14).
 *            Ролики, сданные до формулы, помечены в шапке `sfx-legacy`.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const PROJ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const nn = process.argv[2];
const STRICT = process.argv.includes('--strict');
if (!nn) {
  console.error('Использование: node scripts/lint-scenes.mjs <NN> [--strict]');
  process.exit(2);
}

const videoDir = join(PROJ, 'engine/src/videos', `video-${nn}`);
const publicDir = join(PROJ, 'engine/public');

// Раскадровка попадает в git автоматически при каждом линте: если в слоте
// очереди есть storyboard.md — копируем в папку ролика (save-storyboard.sh).
// queue/ не версионируется, поэтому без этого шага сториборд оставался бы
// только на диске вне git.
const storyboardInSlot = join(PROJ, 'queue', `video-${nn}`, 'storyboard.md');
if (existsSync(storyboardInSlot)) {
  try {
    // Через bash, а не напрямую: на Windows Node не умеет запускать .sh как
    // исполняемый файл (spawnSync … EFTYPE), и сториборды молча не попадали
    // в git — так потерялась раскадровка тёмной ветки video-02 (2026-10-10).
    execFileSync('bash', [join(PROJ, 'scripts/save-storyboard.sh'), nn], { stdio: 'inherit' });
  } catch (e) {
    console.error('⚠ save-storyboard.sh не сработал (не критично для линта):', e.message);
  }
}

// Геометрия кадра и безопасные поля (одни для всех тем).
const WIDTH = 1080;
const SAFE_X = 40; // минимальный отступ носителя от боковой кромки

// Караоке-полоса зависит от ТЕМЫ ролика, а не от проекта: в Sticker Light
// субтитры стоят на 880–1030, в тёмных темах (noir и разовые adaptive) —
// на 1450–1620. Определяем по файлам ролика: есть VideoLight/light-сцены →
// светлая полоса, иначе тёмная. Ролик с обеими ветками проверяем по
// объединению полос — так ни одна ветка не проскочит.
const CAP_BANDS = { light: [880, 1030], dark: [1450, 1620] };
if (!existsSync(videoDir)) {
  console.error(`Нет папки ролика: ${videoDir}`);
  process.exit(2);
}

// Стоп-лист SFX (public/shared/sfx/NOTES.md, раздел «⛔ Стоп-лист») — запрет
// по ТЕМБРУ: понижать громкость и «пробовать тише» нельзя, сэмпл просто не
// берётся. Парсим из NOTES.md, а не держим копию списка в коде: список живёт
// в банке и пополняется по слуху после сдачи роликов.
// Повод для проверки (2026-10-10): riser в стоп-листе с 2026-09, но в
// сториборде video-02-emerald формула финала снова пришла как
// «riser → impact → sparkle», и выяснилось это только на вёрстке.
const STOP_SFX = (() => {
  const list = new Set();
  try {
    const notes = readFileSync(join(publicDir, 'shared/sfx/NOTES.md'), 'utf8');
    const afterHeader = notes.split(/^#+ .*Стоп-лист.*$/m)[1] ?? '';
    const section = afterHeader.split(/^#+ /m)[0];
    for (const hit of section.matchAll(/`([\w-]+\/[\w-]+\.mp3)`/g)) list.add(hit[1]);
  } catch { /* NOTES.md нет — остаётся жёсткая проверка папки riser/ ниже */ }
  return list;
})();
// Папка riser/ закрыта целиком: в ней один файл, и он в стоп-листе.
const STOP_SFX_DIRS = ['riser'];

// Длинные сэмплы банка (public/shared/sfx/NOTES.md) — им обязателен durationInFrames
const LONG_SFX = [
  'keyboard.mp3',
  'write-blackboard.mp3',
  'camera-autofocus.mp3',
  'light-spell.mp3',
  'impact-cine-big.mp3',
  'wing-flutter.mp3',
];

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : /\.(tsx|ts)$/.test(p) ? [p] : [];
  });

// Определяем тему ролика по составу файлов: есть светлая ветка → её полоса,
// есть только adaptive/noir → тёмная, есть обе → объединение (строже).
const allFiles = walk(videoDir);

// Тема определяется ПОФАЙЛОВО, а не по ролику целиком (правка 2026-10-12).
// Раньше ролик с двумя ветками получал объединённую полосу 880–1620, и любая
// честная координата тёмной ветки (её контент живёт до 1400) ловилась как
// заход на караоке. Теперь каждая ветка проверяется своей полосой.
// `terminal` — семейство разовых тёмных тем из library/adaptive-theme.md;
// без него ветка Video05Terminal молча считалась светлой.
const DARK_FILE = /VideoAdaptive|VideoNoir|scenes-adaptive|adaptive|noir|emerald|terminal/i;
const themeOfFile = (f) => (DARK_FILE.test(f) ? 'dark' : 'light');
const THEME_NAME = allFiles.some((f) => themeOfFile(f) === 'dark')
  ? allFiles.some((f) => themeOfFile(f) === 'light')
    ? 'light+dark (пофайлово)'
    : 'dark'
  : 'light';

// Пики SFX из public/shared/sfx/CATALOG.md (генерирует scripts/sfx-catalog.sh):
// строка таблицы «| файл.mp3 | длит | пик | пометки |» внутри раздела «## папка/».
const SFX_PEAKS = {};
try {
  const cat = readFileSync(join(publicDir, 'shared/sfx/CATALOG.md'), 'utf8');
  let dir = '';
  for (const ln of cat.split('\n')) {
    const h = ln.match(/^## (\S+)\/\s*$/);
    if (h) { dir = h[1]; continue; }
    const row = ln.match(/^\| (\S+\.mp3) \| [\d.]+ \| (-?[\d.]+) \|/);
    if (row && dir) SFX_PEAKS[`${dir}/${row[1]}`] = Number(row[2]);
  }
} catch { /* каталога нет — проверка громкости пропускается */ }
// Речь после −14 LUFS обычно даёт mean −17 dB; пик SFX ставим на 11 dB ниже.
const SPEECH_MEAN_DB = -17;
const sfxMaxVolume = (peakDb) => Math.pow(10, (SPEECH_MEAN_DB - 11 - peakDb) / 20);

const problems = [];
const add = (level, file, line, msg) =>
  problems.push({ level, file: file.replace(PROJ + '/', ''), line, msg });

// ── Карта камер ролика: имя массива CamKey[] → его ключи, разложенные по файлам
// Раньше массивы камер искались только в ТОМ ЖЕ файле, где стоит <TargetBox>.
// Но камеры давно живут в `data*.ts`, а сцены — в `scenes*.tsx`, поэтому обе
// проверки правила 28 (рамка на стоящей камере и совпадение zoom) молча
// ничего не проверяли: камера не находилась, и код выходил до проверки.
// Цена молчания — рамка video-05 S3 с zoom 1,6 при камере 1,1, то есть линия
// 4,1 px вместо 6: поймал терчек глазами 2026-10-12, хотя это арифметика.
// Карта строится ПО ФАЙЛАМ, а не одним словарём: в ролике с двумя ветками
// `data.ts` и `dataTerminal.ts` держат РАЗНЫЕ CAM_S3, и общий словарь дал бы
// ложные находки. Чей именно CAM_S3 нужен сцене, говорит её импорт.
const parseCamArrays = (src) => {
  const out = {};
  const code = src.split('\n').map((l) => l.split('//')[0]).join('\n');
  for (const decl of code.matchAll(/const\s+(\w+)\s*:\s*CamKey\[\]\s*=\s*\[([\s\S]*?)\];/g)) {
    const keys = [...decl[2].matchAll(/\{([^}]*)\}/g)]
      .map((k) => {
        const num = (p) => {
          const h = k[1].match(new RegExp(`\\b${p}:\\s*(-?[\\d.]+)`));
          return h ? Number(h[1]) : null;
        };
        return { frame: num('frame'), cx: num('cx'), cy: num('cy'), zoom: num('zoom') };
      })
      .filter((k) => k.frame !== null);
    if (keys.length) out[decl[1]] = keys;
  }
  return out;
};
const modName = (f) => f.split(/[\\/]/).pop().replace(/\.(ts|tsx)$/, '');
const camByFile = {};
for (const f of allFiles) {
  const found = parseCamArrays(readFileSync(f, 'utf8'));
  if (Object.keys(found).length) camByFile[modName(f)] = found;
}
// Камеры, видимые файлу сцен: объявленные в нём самом + импортированные
// из соседних модулей ролика (`from './dataTerminal'`).
const camsVisibleTo = (f, src) => {
  const merged = { ...(camByFile[modName(f)] || {}) };
  for (const imp of src.matchAll(/from\s+'\.\/(\w+)'/g))
    if (camByFile[imp[1]]) Object.assign(merged, camByFile[imp[1]]);
  return merged;
};

for (const file of allFiles) {
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');

  // Ролики, сданные ДО появления формулы sfxFrom (2026-10-14), помечены в
  // шапке маркером `sfx-legacy`. Переписать их механически нельзя: в коде
  // стоит уже посчитанный `from`, а sfxFrom ждёт ЦЕЛЕВОЙ кадр пика — это
  // разные числа, и замысел восстановим только по сториборду. Маркер =
  // сознательное «ролик сдан, не трогаем», а не забытая правка.
  const sfxLegacy = /sfx-legacy/.test(text);

  lines.forEach((raw, i) => {
    const ln = i + 1;
    const isComment = /^\s*(\/\/|\*|\/\*)/.test(raw);
    const code = raw.split('//')[0];

    // 1. детерминизм
    if (!isComment && /\bMath\.random\s*\(/.test(code))
      add('ERROR', file, ln, 'Math.random() — детерминизм рендера; взять mulberry32 из lib/helpers.ts');
    if (!isComment && /\bDate\.now\s*\(|new Date\s*\(/.test(code))
      add('ERROR', file, ln, 'Date.now()/new Date() — детерминизм рендера');

    // 2. сетевые шрифты
    if (/@remotion\/google-fonts/.test(code))
      add('ERROR', file, ln, '@remotion/google-fonts запрещён — лезет в сеть при рендере');

    // 3. существование ассетов
    const m = [...code.matchAll(/staticFile\(\s*['"`]([^'"`]+)['"`]\s*\)/g)];
    for (const hit of m) {
      // Путь, собранный из переменной (`shared/icons/${icon}.svg`), статикой
      // не проверить — такие места смотрит терчек на контактном листе.
      if (hit[1].includes('${')) continue;
      const assetPath = join(publicDir, hit[1]);
      if (!existsSync(assetPath))
        add('ERROR', file, ln, `staticFile('${hit[1]}') — файла нет в public/`);
    }

    // 3б. <Bgm src="..."> — путь тоже от public/, но staticFile зовётся
    // внутри компонента, и обычная проверка его не видела: опечатка или
    // незаменённая заготовка доживали до рендера (2026-10-11).
    const bgmSrc = code.match(/\bsrc=["']((?:shared|videos)\/[^"']+)["']/);
    if (bgmSrc && !bgmSrc[1].includes('${') && !existsSync(join(publicDir, bgmSrc[1])))
      add('ERROR', file, ln, `src="${bgmSrc[1]}" — файла нет в public/`);

    // 4. длинные SFX без durationInFrames
    for (const long of LONG_SFX) {
      if (code.includes(long) && !/durationInFrames/.test(raw))
        add('ERROR', file, ln, `${long} — длинный сэмпл, обязателен durationInFrames (sfx/NOTES.md)`);
    }

    // 4a-stop. сэмпл из стоп-листа — ERROR, замена громкостью невозможна.
    for (const hit of code.matchAll(/shared\/sfx\/([\w-]+\/[\w-]+\.mp3)/g)) {
      const rel = hit[1];
      const dir = rel.split('/')[0];
      if (STOP_SFX.has(rel) || STOP_SFX_DIRS.includes(dir))
        add(
          'ERROR',
          file,
          ln,
          `${rel} — файл в стоп-листе SFX (sfx/NOTES.md): запрет по ТЕМБРУ, не по громкости. ` +
            'Тише ставить нельзя — либо сэмпл другой категории, либо момент остаётся без звука ' +
            '(«лечение всегда убрать, а не заменить громче»)',
        );
    }

    // 4b. громкость SFX выше формулы (урок video-149: на глаз ставили 0.2–0.9
    // при пике файла −0.3…−2 dB, и удары шли вровень с речью). Ловим только
    // числовой volume в той же строке, что и путь сэмпла; допуск ×1.5.
    // volume встречается в двух записях: JSX `volume={0.05}` у <Audio> и
    // табличная `volume: 0.05` у SfxCue (lib/SfxTrack.tsx) — ловим обе.
    const sfxHit = code.match(/shared\/sfx\/([\w-]+\/[\w-]+\.mp3)['"`][^\n]*volume[:=]\s*\{?\s*([\d.]+)/);
    if (sfxHit && SFX_PEAKS[sfxHit[1]] !== undefined) {
      const vol = Number(sfxHit[2]);
      const max = sfxMaxVolume(SFX_PEAKS[sfxHit[1]]);
      if (vol > max * 1.5)
        add(
          'WARN',
          file,
          ln,
          `volume ${vol} для ${sfxHit[1]} (пик ${SFX_PEAKS[sfxHit[1]]} dB) — по формуле ≤ ${max.toFixed(3)} (sfxGain в lib/helpers.ts, CLAUDE.md «Звук»)`,
        );
    }

    // 4e. Кадр SFX: §4.5 (относительный якорь) + §4.6 (две поправки).
    // Голое число — брак по двум причинам сразу. Сдвинул сцену — вся таблица
    // SFX ниже поехала (три круга правок на video-02-emerald). И в нём не
    // учтены лаг пика сэмпла с смещение дорожки: суммарно до 0,3с, что ухо
    // читает как рассинхрон, а контактный лист не видит вообще.
    if (!sfxLegacy && /<Sequence\b/.test(code)) {
      // Путь сэмпла обычно на следующей строке, внутри <Audio>.
      const block = lines.slice(i, i + 4).join('\n');
      const fromAttr = code.match(/from=\{([^}]*)\}/);
      if (/shared\/sfx\//.test(block) && fromAttr) {
        const expr = fromAttr[1].trim();
        if (!/sfxFrom\s*\(/.test(expr)) {
          add(
            'ERROR',
            file,
            ln,
            `from={${expr}} у SFX без sfxFrom() — не внесены лаг пика сэмпла и ` +
              'смещение дорожки (lib/sfx.ts, CLAUDE.md «Звук»). Правильно: ' +
              "from={sfxFrom(SCENES[n].from + k, 'shared/sfx/…')}, где первый " +
              'аргумент — кадр ЦЕЛЕВОГО пика звука',
          );
        } else if (/sfxFrom\s*\(\s*\d/.test(expr)) {
          add(
            'ERROR',
            file,
            ln,
            `from={${expr}} — голый кадр внутри sfxFrom(). Якорь обязан быть ` +
              'относительным (SCENES[n].from + k): иначе правка длительности ' +
              'одной сцены роняет всю таблицу SFX ниже',
          );
        }
      }
    }

    // 4f. Кадр SFX в таблице SfxCue (lib/SfxTrack.tsx) — то же правило 17,
    // но для табличной записи. С выносом SFX из композиции в данные строк
    // `<Sequence from={sfxFrom(...)}>` в ролике больше нет, и проверка 4e
    // их не увидит. Якорь обязан быть относительным (SCENES[n].from + k):
    // голое число роняет всю таблицу ниже при правке длительности сцены.
    // raw: true — сданный ролик с маркером sfx-legacy, там `at` это уже
    // посчитанный from, и поправки к нему применять второй раз нельзя.
    // Окно = ОДНА запись таблицы. Запись обычно однострочная; если путь
    // сэмпла уехал на следующие строки (длинная запись), берём 4 строки, но
    // тогда и raw ищем в том же окне. Шире брать нельзя: `raw: true`
    // соседней записи погасит проверку, и голый кадр пройдёт молча.
    if (!isComment && /\bat:\s*[\d.]/.test(code)) {
      const entry = /shared\/sfx\//.test(code) ? code : lines.slice(i, i + 4).join('\n');
      const rawFlag = /\braw:\s*true/.test(entry);
      const isSfxEntry = /shared\/sfx\//.test(entry);
      if (isSfxEntry && !rawFlag && !sfxLegacy) {
        const atExpr = code.match(/\bat:\s*([^,]+)/)?.[1]?.trim();
        add(
          'ERROR',
          file,
          ln,
          `at: ${atExpr} в таблице SFX — голый кадр. Якорь обязан быть ` +
            'относительным (SCENES[n].from + k) и означать кадр ЦЕЛЕВОГО пика: ' +
            'поправки на лаг сэмпла и смещение дорожки вносит sfxFrom (lib/sfx.ts)',
        );
      }
    }

    // 4c. персонаж без swapMode="dip": кроссфейд поз даёт «двух персонажей насквозь».
    if (/<Character\b/.test(code) && !/swapMode/.test(lines.slice(i, i + 12).join('\n')))
      add('WARN', file, ln, '<Character> без swapMode="dip" — кроссфейд поз читается как призрак (CLAUDE.md «Константы»)');

    // 4d. пиктограмма generic/* на светлом носителе (2026-10-12).
    // Банк `shared/icons/generic/` — Lucide с прибитым stroke="#FFFFFF".
    // На светлой карточке такая иконка невидима: в кадре остаётся пустой
    // белый квадрат (брак S6 video-04, поймал автор на готовом ролике).
    // Сквиркл под generic/* обязан быть тёмным в ОБЕИХ темах — как NodeIcon
    // в lib/FlowNode.tsx (SQUIRCLE_DARK / NEUTRAL_DARK).
    if (/icons\/generic\/[\w-]+\.svg/.test(code)) {
      // Берём БЛИЖАЙШИЙ background выше по коду — это фон собственного
      // носителя иконки; фон родительской карточки ловить нельзя (иконка
      // лежит на своём тёмном сквиркле внутри светлой карточки — это норма).
      const back = lines.slice(Math.max(0, i - 14), i + 1);
      let nearestBg = null;
      for (let k = back.length - 1; k >= 0 && nearestBg === null; k--) {
        const hit = back[k].match(/background:\s*([^,\n]+)/);
        if (hit) nearestBg = hit[1].trim();
      }
      const lightBg =
        nearestBg &&
        /^(theme\.colors\.(?:card|bg|surface|paper)|['"`]#(?:[Ff]{3}|[Ff]{6}|[Ff][A-Fa-f0-9]{5})['"`])/.test(nearestBg)
          ? nearestBg
          : null;
      if (lightBg)
        add(
          'ERROR',
          file,
          ln,
          `пиктограмма generic/* на светлом носителе (${lightBg}) — белый штрих не виден, в кадре пустой квадрат; сквиркл должен быть тёмным (SQUIRCLE_DARK, см. lib/FlowNode.tsx)`,
        );
    }

    // 4e. фиксированный кегль в носителе фиксированной ширины (2026-10-12).
    // Длинная строка не влезает, flex переносит её и выносит за плашку —
    // так пропал текст чипа в S6 video-04 и уехал влево хук video-05.
    // Оценка ширины: кириллица Inter 700–800 ≈ 0.5em на символ.
    const boxW = code.match(/\bwidth:\s*(\d{2,4})\s*,/);
    if (boxW) {
      const w = Number(boxW[1]);
      // Обрезаем окно на следующем носителе со своей шириной — иначе кегль
      // соседнего блока примеряется к чужой плашке (ложные срабатывания).
      const win = lines.slice(i + 1, i + 14);
      const nextBox = win.findIndex((l) => /\bwidth:\s*(?:\d|'|"|`)/.test(l));
      const ahead = [lines[i], ...(nextBox === -1 ? win : win.slice(0, nextBox))].join('\n');
      if (!/fitText|measureText|whiteSpace/.test(ahead)) {
        const fsHit = ahead.match(/fontSize:\s*(\d+)/);
        const txtHit = ahead.match(/>\s*\n\s*([^<>{}\n]{4,})\n\s*<\//);
        // Ругаемся только на носитель фиксированной высоты в одну строку:
        // без height (или при height ≥ 1.8 кегля) перенос строки — штатная
        // вёрстка в две строки, а не вынос текста за плашку.
        const hHit = ahead.match(/height:\s*(\d{2,4})\s*,/);
        const oneLiner = hHit && fsHit && Number(hHit[1]) < Number(fsHit[1]) * 1.8;
        if (fsHit && txtHit && oneLiner) {
          const need = txtHit[1].trim().length * Number(fsHit[1]) * 0.5;
          if (need > w)
            add(
              'WARN',
              file,
              ln,
              `строка «${txtHit[1].trim()}» кеглем ${fsHit[1]} требует ≈${Math.round(need)} px, носитель ${w} px — перенос и вынос текста за плашку; считать ширину measureText или кегль fitText (правило 16)`,
            );
        }
      }
    }

    // 5. мелкий кегль
    const fs = [...code.matchAll(/fontSize:\s*(\d+)/g)];
    for (const hit of fs) {
      const size = Number(hit[1]);
      // Порог 40, а не 58: константы канала штатно используют мелкий кегль в
      // CTA-карточке (слоган 32, кнопка 44) — ругаться на них значит шуметь.
      // Ниже 40 — почти всегда либо забытая правка, либо текстура без пометки.
      if (size < 40 && !/текстура|фактура|слоган/i.test(raw))
        add('WARN', file, ln, `fontSize: ${size} — ниже порога читаемости (правило 13). Если это осознанная текстура, пометь строку словом «текстура»`);
    }

    // 6. караоке-полоса — ПО ФАКТИЧЕСКОЙ ТЕМЕ РОЛИКА.
    // Раньше здесь была прибита одна светлая полоса 880–1030, и ролики в
    // тёмной теме (караоке на 1450–1620) проходили линт с наложением
    // субтитров на контент — брак, который линт обязан ловить.
    const [capTop, capBottom] = CAP_BANDS[themeOfFile(file)];
    const coords = [...code.matchAll(/\b(top|bottom):\s*(\d+)/g)];
    for (const hit of coords) {
      const v = Number(hit[2]);
      if (hit[1] === 'top' && v >= capTop && v <= capBottom)
        add(
          'WARN',
          file,
          ln,
          `top: ${v} — попадает в караоке-полосу ${capTop}–${capBottom} (тема файла: ${themeOfFile(file)}), она неприкосновенна`,
        );
    }

    // 6б. mixBlendMode multiply/darken в ТЁМНОЙ теме — мёртвый элемент.
    // Повод (2026-10-12): подсветку слова лаймом перенесли из светлой ветки
    // video-04 в тёмную вместе с режимом наложения. multiply перемножает
    // цвета, и на фоне #12161A любой акцент уходит в ноль — прямоугольник
    // рендерился, проходил линт и qa-auto, но в кадре его не было вообще.
    // Поймать это можно только глазами на конкретном кадре, то есть ценой
    // круга правок, хотя проверка арифметическая: тёмный фон + multiply =
    // ничего. darken ведёт себя так же.
    if (!isComment && themeOfFile(file) === 'dark') {
      const blend = code.match(/mixBlendMode:\s*'(multiply|darken)'/);
      if (blend)
        add(
          'WARN',
          file,
          ln,
          `mixBlendMode: '${blend[1]}' в тёмной теме — на тёмном фоне этот режим гасит акцент в ноль, ` +
            'элемент отрендерится и будет не виден (пруф: подсветка S11 video-04-terminal). ' +
            "Для свечения на тёмном — 'screen' или обычная заливка пониженной прозрачности",
        );
    }

    // 7. выход за края кадра (текст уезжает за рамку). Правило 16 требует
    // «максимально крупно», но в границах кадра: носитель шире 1080 или
    // с отрицательным left срезается по краю и читается как брак вёрстки.
    // Ложное срабатывание, которое чинится здесь:
    // у PageCam и родственных приёмов width — это ВНУТРЕННЯЯ система координат
    // страницы (1920), ужатая `transform: scale(zoom)` внутри контейнера с
    // overflow: hidden. На экран такой элемент никогда не выходит целиком.
    // Раньше линт ругался на каждый такой ролик (video-128 — 10 ERROR,
    // video-132 — 4), и красное приучались игнорировать — то есть правило
    // переставало работать ровно там, где его ввели. Признак ужатия ищем в
    // окрестности строки: scale() в том же стилевом объекте.
    // Линт идёт построчно, а transform обычно стоит на СОСЕДНЕЙ строке того же
    // стилевого объекта — поэтому смотрим окно строк вокруг находки.
    // Ужатие бывает двух видов: transform: scale(...) и CSS-свойство zoom
    // (3D-ветка PageCam растрирует страницу через него) — признаём оба.
    const nearScaled = /transform:[^;\n]*\bscale\(|(^|[\s{,])zoom\s*[,:]/.test(
      lines.slice(Math.max(0, i - 10), i + 11).join('\n'),
    );

    // Опись ролика для монтажного стола (videos/video-NN/workbench.ts) —
    // не вёрстка: width/height там это размер КОМПОЗИЦИИ, геометрию кадра
    // правилом 16 здесь мерить нечем.
    const isManifest = /workbench\.ts$/.test(file);
    const widths = isManifest ? [] : [...code.matchAll(/\bwidth:\s*(\d+)\b/g)];
    for (const hit of widths) {
      const w = Number(hit[1]);
      if (w > WIDTH && nearScaled)
        add(
          'WARN',
          file,
          ln,
          `width: ${w} — шире кадра, но рядом transform: scale() — считаю внутренней системой координат (PageCam и т.п.). Если scale не ужимает элемент, это настоящий срез`,
        );
      else if (w > WIDTH)
        add('ERROR', file, ln, `width: ${w} — шире кадра ${WIDTH}px, края срежутся (правило 16: крупно, но В КАДРЕ)`);
      else if (w > WIDTH - 2 * SAFE_X && !/во весь кадр|fullbleed|фон/i.test(raw))
        add(
          'WARN',
          file,
          ln,
          `width: ${w} — шире безопасной ширины ${WIDTH - 2 * SAFE_X}px (поля ${SAFE_X}px). Осознанный вылет под срез — пометь строку «во весь кадр»`,
        );
    }
    const lefts = isManifest ? [] : [...code.matchAll(/\bleft:\s*(-\d+)/g)];
    for (const hit of lefts) {
      add('ERROR', file, ln, `left: ${hit[1]} — отрицательный отступ, элемент уезжает за левый край кадра`);
    }
  });

  // 9. Правило 28: наезд обязан заканчиваться выделением цели.
  // Проверка файловая, а не построчная: <PageCam> и <TargetBox> стоят в
  // разных местах сцены (рамка — ребёнком камеры, но часто через несколько
  // строк вложенности), поэтому ищем по всему файлу сразу.
  // Escape hatch — тот же приём, что у «текстуры» в правиле 13: осознанный
  // наезд без рамки (общий план, проезд по странице без одной цели) помечается
  // комментарием «без рамки» в том же файле.
  const codeOnly = lines.map((l) => l.split('//')[0]).join('\n');
  const pageCamUse = /<PageCam\b/.test(codeOnly);
  const targetBoxUse = /<TargetBox\b/.test(codeOnly);
  const frameOptOut = /без рамки/i.test(text);
  if (pageCamUse && !targetBoxUse && !frameOptOut) {
    const camLine = lines.findIndex((l) => /<PageCam\b/.test(l)) + 1;
    add(
      'ERROR',
      file,
      camLine,
      '<PageCam> без <TargetBox> — наезд без выделения цели (правило 28). ' +
        'Зритель видит ту же страницу крупнее и не понимает, на что смотреть. ' +
        'Осознанный проезд без одной цели — пометь файл комментарием «без рамки»',
    );
  }

  // 10. Правило 28: цель рамки задаётся ЧИСЛАМИ, замеренными в ассете, и
  // зазор pad ≥ 8 — иначе линия ложится на соседний текст (главная претензия
  // автора к тестовым роликам: рамка залезала на чужие слова).
  lines.forEach((raw, i) => {
    if (!/<TargetBox\b/.test(raw.split('//')[0])) return;
    const ln = i + 1;
    // Пропы часто разложены по строкам — смотрим окно до закрывающего тега.
    const tag = lines.slice(i, i + 14).join('\n').split('/>')[0];
    const padHit = tag.match(/\bpad=\{\s*(\d+(?:\.\d+)?)\s*\}/);
    if (padHit && Number(padHit[1]) < 8)
      add('WARN', file, ln, `<TargetBox pad={${padHit[1]}}> — зазор меньше 8 page-px: линия прижмётся к буквам и прочтётся как подчёркивание чужой строки (правило 28)`);
    for (const p of ['x', 'y', 'w', 'h', 'zoom']) {
      const hit = tag.match(new RegExp(`\\b${p}=\\{([^}]*)\\}`));
      // Проп не найден вовсе — цель не задана.
      if (!hit) {
        add('WARN', file, ln, `<TargetBox>: проп ${p} не задан — цель замеряется в ассете пипеткой, иначе рамка ляжет мимо (правило 28)`);
        continue;
      }
      const expr = hit[1].trim();
      if (/^-?\d/.test(expr)) continue; // литерал — как и раньше
      // Вычисление от геометрии носителя, объявленной В ЭТОМ ЖЕ файле,
      // надёжнее литерала: литеральная цель молча уезжает на соседнюю
      // строку, как только правятся габариты окна (пруф: пробник
      // emerald-velvet, рамка резала чужую цифру). Поэтому принимаем
      // идентификатор, который разрешается в константу или функцию модуля,
      // и по-прежнему ругаемся на всё остальное — «примерно рядом» и
      // пропы, пришедшие извне файла.
      const root = expr.match(/^[A-Za-z_$][\w$]*/)?.[0];
      const declared =
        root && new RegExp(`^\\s*(?:export\\s+)?(?:const|let|function)\\s+${root}\\b`, 'm').test(codeOnly);
      if (!declared)
        add(
          'WARN',
          file,
          ln,
          `<TargetBox>: проп ${p}={${expr}} — не число и не константа этого файла. ` +
            `Цель замеряется в ассете пипеткой либо считается от геометрии носителя, объявленной рядом (правило 28)`,
        );
    }
  });

  // 11. Правило 19: в вертикали вьюпорт камеры задаётся ЯВНО.
  // По умолчанию PageCam центрирует кадр как 1920×1080 (шаблон-донор). В
  // вертикальном контейнере это уводит картинку вправо и вверх, а по краям
  // открывается светлое поле. Ни контактный лист, ни qa-auto этого не видят —
  // кадр «просто немного не тот», поэтому ошибка доживала до финального
  // просмотра. Проверка дешёвая: оба пропа должны стоять у тега.
  lines.forEach((raw, i) => {
    if (!/<PageCam\b/.test(raw.split('//')[0])) return;
    const tag = lines.slice(i, i + 20).join('\n');
    const missing = ['viewportW', 'viewportH'].filter((p) => !new RegExp(`\\b${p}=`).test(tag));
    if (missing.length)
      add(
        'ERROR',
        file,
        i + 1,
        `<PageCam> без ${missing.join(' и ')} — камера считает вьюпорт горизонтальным 1920×1080, ` +
          'в вертикали картинка уедет вправо и вверх, по краям откроется поле (правило 19). ' +
          'Передавать фактические px контейнера, для полного кадра — viewportW={1080} viewportH={1920}',
      );
  });

  // 12. Правило 28 + правило 3: рамка показывается, когда камера УЖЕ ВСТАЛА.
  // Урок video-02 (терчек, 4 блокера): ключи камеры стояли без холдов, рамки
  // появлялись внутри проезда и ехали вместе с кадром — два движения спорили
  // за внимание. Проверяется арифметикой: из ключей CamKey собираются
  // интервалы покоя (соседние ключи с одинаковыми cx/cy/zoom + хвост после
  // последнего ключа, где камера стоит по clamp), и `from` рамки обязан
  // попасть в один из них. Рамка привязывается к ближайшему `keys={ИМЯ}`
  // выше по файлу — так камера и её рамки связываются даже через обёртки
  // вроде ShotCard/Hold.
  // Камеры берём из карты ролика (свои + импортированные): CamKey[] давно
  // живут в data*.ts, а не в файле сцен — см. camsVisibleTo выше.
  const camArrays = camsVisibleTo(file, text);
  const restIntervals = (keys) => {
    const rest = [];
    for (let i = 0; i < keys.length - 1; i++) {
      const [a, b] = [keys[i], keys[i + 1]];
      if (a.cx === b.cx && a.cy === b.cy && a.zoom === b.zoom) rest.push([a.frame, b.frame, a.zoom]);
    }
    const last = keys[keys.length - 1];
    rest.push([last.frame, Infinity, last.zoom]); // после последнего ключа камера стоит
    return rest;
  };

  lines.forEach((raw, i) => {
    if (!/<TargetBox\b/.test(raw.split('//')[0])) return;
    const ln = i + 1;
    const tag = lines.slice(i, i + 14).join('\n').split('/>')[0];
    const fromHit = tag.match(/\bfrom=\{\s*(\d+)\s*\}/);
    const from = fromHit ? Number(fromHit[1]) : 0;
    // ближайшее объявление камеры выше по файлу
    let camName = null;
    for (let j = i; j >= 0 && j > i - 60; j--) {
      const use = lines[j].split('//')[0].match(/\bkeys=\{\s*(\w+)\s*\}/);
      if (use && camArrays[use[1]]) { camName = use[1]; break; }
    }
    if (!camName) return;
    const rest = restIntervals(camArrays[camName]);
    const hit = rest.find(([a, b]) => from >= a && from <= b);
    if (!hit) {
      const next = rest.find(([a]) => a > from);
      add(
        'ERROR',
        file,
        ln,
        `<TargetBox from={${from}}> — на этом кадре камера ${camName} ещё едет: рамка поедет вместе с ` +
          'кадром и будет спорить с наездом за внимание (правило 28 «в конце движения», правило 3). ' +
          (next ? `Ближайший покой камеры начинается на кадре ${next[0]}` : 'Добавь холд в конце наезда'),
      );
      return;
    }
    const zoomHit = tag.match(/\bzoom=\{\s*([\d.]+)\s*\}/);
    if (zoomHit && hit[2] !== null && Number(zoomHit[1]) !== hit[2])
      add(
        'WARN',
        file,
        ln,
        `<TargetBox zoom={${zoomHit[1]}}> не совпадает с zoom камеры ${camName} в этот момент (${hit[2]}) — ` +
          'линия и скругление делятся на zoom внутри компонента, при расхождении рамка «толстеет» или истончается',
      );
  });
}

// ── 14. WARN  слова вместо чисел в паспорте (правило 16, 2026-10-11) ─────────
// Повод: три круга правок video-02 (2026-10-10) и ещё три у video-03 выросли
// из формулировок «крупнее», «подольше», «растяни». Верстальщик кадра не
// видит и додумывать их не имеет права — правило 16 требует числа. Но
// машинно паспорт не проверял никто, и слова доживали до вёрстки, где
// стоили целого круга правок.
// Шум режем тремя фильтрами: строки с цифрами пропускаем (параметр задан
// рядом), содержимое «ёлочек» вырезаем (это цитата речи, а не указание),
// блоки кода пропускаем целиком.
{
  const sbPath = existsSync(storyboardInSlot)
    ? storyboardInSlot
    : join(videoDir, 'storyboard.md');
  if (existsSync(sbPath)) {
    // \b в JS считает словом только ASCII — для кириллицы границы задаём
    // лукэраундами по самому алфавиту, иначе проверка не срабатывает вовсе.
    const VAGUE =
      /(?<![А-Яа-яЁё])(крупнее|мельче|пошире|поуже|подлиннее|покороче|подольше|побыстрее|помедленнее|пораньше|попозже|плавнее|резче|повыше|пониже|подальше|поближе|растяни[а-яё]*|растянуть|увеличь[а-яё]*|увеличить|уменьши[а-яё]*|уменьшить|подвинь[а-яё]*|сдвинь[а-яё]*|ускорь[а-яё]*|замедли[а-яё]*|слегка|немного)(?![А-Яа-яЁё])/giu;
    const sbLines = readFileSync(sbPath, 'utf8').split('\n');
    const sbName = 'storyboard.md';
    let inFence = false;
    sbLines.forEach((raw, i) => {
      if (/^\s*```/.test(raw)) { inFence = !inFence; return; }
      if (inFence) return;
      // Цифра в строке = параметр уже задан числом, слово рядом — пояснение.
      if (/\d/.test(raw)) return;
      const line = raw.replace(/«[^»]*»/g, '').replace(/"[^"]*"/g, '');
      const hits = [...new Set((line.match(VAGUE) ?? []).map((w) => w.toLowerCase()))];
      if (!hits.length) return;
      add(
        'WARN',
        sbName,
        i + 1,
        `В паспорте слово вместо числа: ${hits.map((w) => `«${w}»`).join(', ')} — ` +
          'верстальщик кадра не видит и додумать не имеет права (правило 16). ' +
          'Длительность фазы — в кадрах, масштаб — как from → to, смещение — в px.',
      );
    });
  }
}

const errors = problems.filter((p) => p.level === 'ERROR');
const warns = problems.filter((p) => p.level === 'WARN');

for (const p of [...errors, ...warns]) {
  const tag = p.level === 'ERROR' ? '✗ ERROR' : '⚠ WARN ';
  console.log(`${tag}  ${p.file}:${p.line}\n         ${p.msg}`);
}

console.log(
  `\nИтог: ${errors.length} ошибок, ${warns.length} предупреждений (ролик video-${nn}).`,
);
if (errors.length || (STRICT && warns.length)) process.exit(1);
console.log('Линт пройден.');
