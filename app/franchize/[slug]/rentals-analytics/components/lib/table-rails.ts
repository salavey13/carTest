// Task 137 — sticky-rail geometry for the table-view modal (ExportCsvModal).
//
// The boss's complaint: the АРЕНДЫ sheet is 25 columns wide — by the time you
// side-scroll to the right, you've forgotten what the row even was. Fix in
// three parts:
//   1. Марка (bike id) moves to display position 1 → the LEFT rail is always
//      «Дата + Марка» (when + which bike), pinned while the middle scrolls.
//   2. Оператор выдал / Оператор принял (activation / finalization) move to
//      the tail, right before Верификация → the RIGHT rail is always
//      «who activated / who finalized / is it verified», pinned next to the
//      quick-verify ✓ column.
//   3. Both rails need pixel offsets — auto table layout sizes columns by
//      CONTENT, so "the second column starts at X px" can only be MEASURED
//      from the rendered header row, never guessed from constants.

/**
 * АРЕНДЫ display order (data indexes of the 25-column sheet:
 * 0 Дата · 1 ЗП Аренда · 2 Партнеру · 3 Цена · 4 Экип · 5 Залог · 6 Марка ·
 * 7 Пробег до · 8 Пробег после · 9 Время · 10 Комментарий · 11 Заметки ·
 * 12 Субарендатор · 13 Фото · 14 ID(hidden) · 15 ЗП техника · 16 ЗП экип ·
 * 17 ЗП наценка · 18 Экип флаги · 19 Оператор создал · 20 Оператор выдал ·
 * 21 Оператор принял · 22 Оператор (ЗП) · 23 Атрибуция ЗП · 24 Верификация).
 *
 * Remap: 6 → position 1 (left rail), 20/21 → the tail before 24 (right rail).
 * Every filter/sum/split keeps reading the RAW row layout — this order is
 * display-only.
 */
export const RENTALS_DISPLAY_ORDER: number[] = [
  0, 6, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13, 14,
  15, 16, 17, 18, 19, 22, 23, 20, 21, 24,
];

/**
 * Cumulative sticky offsets for the leading/trailing rail columns of an
 * auto-layout table.
 *
 * @param widths      rendered header-cell widths, in display order
 *                    (getBoundingClientRect — fractional, no rounding drift)
 * @param stickyLeft  count of leading display columns pinned left
 * @param stickyRight count of trailing display columns pinned right
 * @returns left[i]  — `left` offset for display column i (i < stickyLeft):
 *                    prefix sum of the rail widths before it (left[0] = 0).
 *           right[j] — `right` offset for the column j positions from the
 *                    right edge (j < stickyRight): suffix sum of the rail
 *                    widths after it (right[0] = 0, the rightmost column).
 *
 * Clamped to widths.length — a short/legacy sheet pins whatever it has.
 */
export function computeRailOffsets(
  widths: number[],
  stickyLeft: number,
  stickyRight: number,
): { left: number[]; right: number[] } {
  const left: number[] = [];
  let acc = 0;
  for (let i = 0; i < stickyLeft && i < widths.length; i++) {
    left.push(acc);
    acc += widths[i];
  }
  const right: number[] = [];
  acc = 0;
  for (let j = 0; j < stickyRight && j < widths.length; j++) {
    // j positions from the RIGHT edge: offset = sum of the rail widths
    // AFTER it (right[0] = 0 — the rightmost column hugs the edge).
    right[j] = acc;
    acc += widths[widths.length - 1 - j];
  }
  return { left, right };
}
