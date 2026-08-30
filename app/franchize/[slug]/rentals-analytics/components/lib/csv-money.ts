// app/franchize/[slug]/rentals-analytics/components/lib/csv-money.ts
//
// iter26 — money-cell parsing for the analytics table view (ExportCsvModal
// totals). Extracted from the component so it is a pure, unit-testable module.
//
// Real cell shapes in the 21-column finance sheet (lib/csv-builders/rentals-csv.ts):
//   «1600»            — ЗП Аренда / Партнеру / Цена: plain numbers
//   «15000 нал»       — Залог: amount + method suffix (нал / ТБанк / Сбербанк)
//   «2шл+перч (800~)» — Экип: unit list + charged cost in parens (~ = estimate)
//
// The previous parser only handled plain numbers, so Σ Экип + Залог summed to
// 0 for every decorated cell (pre-existing bug, fixed together with the
// iter26 Σ Партнёрам tile).

/** Parse a money-ish CSV table cell into a number (0 for non-money cells). */
export function toNumber(s: string): number {
  if (!s) return 0;
  const t = s.trim().replace(/\s+/g, "").replace(/,/g, ".").replace(/[₽$€~]/g, "");
  if (t !== "") {
    const direct = Number(t);
    if (Number.isFinite(direct)) return direct;
  }
  // Decorated cells: prefer the parenthesised amount (equipment cells always
  // carry it — «2шл+перч (800~)» → 800), otherwise a leading number followed
  // only by a method word («15000нал» → 15000, «20000ТБанк» → 20000).
  // Non-money cells («3+2» photos, «заряд↔») match neither → 0.
  const paren = t.match(/\(([-\d]+(?:\.\d+)?)\)/);
  if (paren) {
    const n = Number(paren[1]);
    return Number.isFinite(n) ? n : 0;
  }
  const lead = t.match(/^([-\d]+(?:\.\d+)?)[A-Za-zА-Яа-яЁё]*$/);
  if (lead) {
    const n = Number(lead[1]);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}
