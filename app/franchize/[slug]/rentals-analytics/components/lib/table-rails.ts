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
 * АРЕНДЫ display order (data indexes of the 28-column sheet, task 156:
 * 0 Дата · 1 ЗП Аренда · 2 Партнеру · 3 Цена · 4 Способ оплаты · 5 Экип ·
 * 6 Залог · 7 Марка · 8 Пробег до · 9 Пробег после · 10 Время · 11 Имя ·
 * 12 Телефон · 13 Комментарий · 14 Заметки · 15 Субарендатор · 16 Фото ·
 * 17 ID(hidden) · 18 ЗП техника · 19 ЗП экип · 20 ЗП наценка · 21 Экип флаги ·
 * 22 Оператор создал · 23 Оператор выдал · 24 Оператор принял ·
 * 25 Оператор (ЗП) · 26 Атрибуция ЗП · 27 Верификация).
 *
 * Remap: 7 → position 1 (left rail), 23/24 → the tail before 27 (right rail).
 * Every filter/sum/split keeps reading the RAW row layout — this order is
 * display-only.
 */
export const RENTALS_DISPLAY_ORDER: number[] = [
  0, 7, 1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17,
  18, 19, 20, 21, 22, 25, 26, 23, 24, 27,
];

/**
 * Cumulative sticky offsets for the leading/trailing rail columns of an
 * auto-layout table.
 *
 * @param widths      rendered header-cell widths, in display order
 *                    (getBoundingClientRect — fractional)
 * @param stickyLeft  count of leading display columns pinned left
 * @param stickyRight count of trailing display columns pinned right
 * @returns left[i]  — `left` offset for display column i (i < stickyLeft):
 *                    prefix sum of the rail widths before it (left[0] = 0).
 *           right[j] — `right` offset for the column j positions from the
 *                    right edge (j < stickyRight): suffix sum of the rail
 *                    widths after it (right[0] = 0, the rightmost column).
 *
 * Clamped to widths.length — a short/legacy sheet pins whatever it has.
 *
 * Task 163 — offsets are integers and each next offset never exceeds the
 * PREVIOUS CELL'S PAINTED edge. The raw sums are fractional (87.375px-style);
 * a pinned cell paints [offset, offset + fractionalWidth], so flooring the
 * raw prefix sum alone still left up to ~1px LAYOUT gaps between consecutive
 * pinned cells (the painted edge drifted past the next floored offset) — the
 * see-through slit the boss reported. The accumulation floors RECURSIVELY
 * (acc = floor(acc + width)): each next offset ≤ floor(prevOffset + width) ≤
 * prevOffset + width → rail cells always overlap or tile, never gap (the
 * ≤0.5px error becomes an invisible overlap covered by the later cell's
 * opaque background). The right rail mirrors the same recursion from the
 * right edge.
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
    acc = Math.floor(acc + widths[i]);
  }
  const right: number[] = [];
  acc = 0;
  for (let j = 0; j < stickyRight && j < widths.length; j++) {
    // j positions from the RIGHT edge: offset = sum of the rail widths
    // AFTER it (right[0] = 0 — the rightmost column hugs the edge).
    right[j] = acc;
    acc = Math.floor(acc + widths[widths.length - 1 - j]);
  }
  return { left, right };
}
