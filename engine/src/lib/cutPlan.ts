// cutPlan — машинная проверка монтажа: на каждой границе плана меняются
// минимум ДВЕ величины из трёх (тон, масштаб, тип изображения).
//
// Повод. У сданного video-18 замер дал 15 границ сцен на 66 с, а детектор
// смены картинки увидел 2–5 из них: менялась сцена, но не менялись ни тон,
// ни масштаб, ни тип изображения — всё та же карточка в середине того же
// фона. 13 стыков из 15 зритель просто не замечает.
//
// Глазами это не ловится: на контактном листе похожие кадры читаются как
// «ну, разные сцены». Поэтому проверка арифметическая и идёт по таблице
// планов до рендера.
export type Tone = 'deep' | 'mid' | 'light';
export type Scale = 'wide' | 'medium' | 'close';
export type ImageKind = 'type' | 'ui' | 'diagram' | 'media' | 'chat' | 'terminal';

export type Shot = {
  id: string;
  from: number;
  to: number;
  tone: Tone;
  scale: Scale;
  kind: ImageKind;
};

export type CutIssue = { at: number; between: string; changed: number; detail: string };

/** 0 нарушений — обязательное условие допуска ролика (как 0 ERROR линта).
 * Возвращает список границ, где изменилась 0 или 1 величина. */
export const validateCutPlan = (shots: Shot[]): CutIssue[] => {
  const issues: CutIssue[] = [];
  for (let i = 1; i < shots.length; i++) {
    const a = shots[i - 1];
    const b = shots[i];
    const changed =
      (a.tone !== b.tone ? 1 : 0) + (a.scale !== b.scale ? 1 : 0) + (a.kind !== b.kind ? 1 : 0);
    if (changed < 2) {
      issues.push({
        at: b.from,
        between: `${a.id} → ${b.id}`,
        changed,
        detail: `тон ${a.tone}→${b.tone}, масштаб ${a.scale}→${b.scale}, тип ${a.kind}→${b.kind}`,
      });
    }
  }
  return issues;
};

/** Средняя длительность плана в секундах. Ориентир короткого формата —
 * смена картинки каждые 2,0–2,5 с; у video-18 было 4,14 с. */
export const averageShot = (shots: Shot[], fps = 30): number =>
  shots.reduce((s, x) => s + (x.to - x.from), 0) / shots.length / fps;
