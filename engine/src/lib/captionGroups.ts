// Алгоритм группировки караоке-субтитров — перенесён дословно из
// алгоритм группировки караоке (buildCaptionGroups), без привязанного к
// конкретному ролику массива CAP. Каждый ролик (src/videos/video-NN/)
// держит свой Word[] с транскриптом и импортирует buildCaptionGroups() сам.
//
// Идея группировки: слова режутся на «страницы» по 3 (MAXW) или по границе
// 20 символов (MAXCHARS), группа закрывается раньше на знаке препинания или
// паузе ≥0.3с (PAUSE) — так фраза не разваливается на середине слова.
// visStart/visEnd — с запасом (BUF) после произнесения последнего слова
// группы, чтобы плашка не гасла раньше, чем читатель успел её увидеть, но
// не позже начала следующей группы.

// hl:'alt' — второй текстовый слой (2026-11-01, library/style-reference.md):
// акцентное слово набирается засечным курсивом внутри гротескной фразы.
// У всех разобранных эталонов текстовых слоёв минимум два, у нас был один.
export type Word = { text: string; start: number; end: number; hl?: 'mark' | 'red' | 'alt' };

export type CapGroup = {
  words: Word[];
  start: number;
  end: number;
  visStart: number;
  visEnd: number;
};

const MAXW = 3;
const MAXCHARS = 20;
const PAUSE = 0.3;
const BUF = 0.35;

export function buildCaptionGroups(cap: Word[]): CapGroup[] {
  const groups: { words: Word[]; start: number; end: number }[] = [];
  let cur: Word[] = [];
  let curChars = 0;
  for (let i = 0; i < cap.length; i++) {
    const w = cap[i];
    if (cur.length && (cur.length >= MAXW || curChars + w.text.length > MAXCHARS)) {
      groups.push({ words: cur.slice(), start: cur[0].start, end: cur[cur.length - 1].end });
      cur = [];
      curChars = 0;
    }
    cur.push(w);
    curChars += w.text.length + 1;
    const nx = cap[i + 1];
    const punct = /[,.!?:]$/.test(w.text);
    const pause = nx ? nx.start - w.end : 999;
    if (!nx || punct || pause >= PAUSE) {
      groups.push({ words: cur.slice(), start: cur[0].start, end: cur[cur.length - 1].end });
      cur = [];
      curChars = 0;
    }
  }
  return groups.map((g, gi) => {
    const next = groups[gi + 1];
    const visStart = g.start;
    const visEnd = next ? Math.min(next.start, g.end + BUF) : g.end + BUF;
    return { ...g, visStart, visEnd };
  });
}
