// Демо-данные для тестовой композиции — короткий караоке-фрагмент, чтобы
// показать, что Captions/buildCaptionGroups работают на реальном Word[].
// К кадру 150 (5с @30fps) группа уже отыграла и погасла — пустая
// караоке-зона на смоук-стилле ожидаема, это не баг.
import { buildCaptionGroups, type Word } from '../../lib/captionGroups';

export const DEMO_WORDS: Word[] = [
  { text: 'Движок', start: 0.2, end: 0.6 },
  { text: 'reelcraft', start: 0.65, end: 1.2, hl: 'mark' },
  { text: 'готов.', start: 1.25, end: 1.7 },
];

export const DEMO_CAP_GROUPS = buildCaptionGroups(DEMO_WORDS);

export const DEMO_TITLE = 'REELCRAFT ENGINE';
