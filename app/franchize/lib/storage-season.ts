// /app/franchize/lib/storage-season.ts
// Pure helpers for the winter-storage (flowType="storage") contract.
// The boss's manual contract had an arithmetic defect — «сроком на 6.5
// месяцев» next to dates 17.10.2025 → 1.06.2026 (≈ 7.5 months inclusive).
// formatStorageMonthsLabel derives the season length FROM the dates so the
// contract can never contradict itself again (п. 2.1 «включительно»).

/** Average Gregorian month length in days (keeps season math stable). */
const AVG_MONTH_DAYS = 30.4375;
const DAY_MS = 24 * 3600 * 1000;

/**
 * Human season length between two dates, inclusive on both ends.
 * Half-month precision with Russian plural rules:
 *   2025-10-17 → 2026-06-01 = «7,5 месяца»
 *   1 month → «1 месяц», 2–4 → «месяца», 5+ → «месяцев», 2.5 → «2,5 месяца».
 * Returns "" when either date is missing/unparseable or end <= start.
 */
export function formatStorageMonthsLabel(startRaw: unknown, endRaw: unknown): string {
  const start = new Date(String(startRaw ?? ""));
  const end = new Date(String(endRaw ?? ""));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end.getTime() <= start.getTime()) {
    return "";
  }
  // +1 day: both season boundaries are included (п. 2.1 «включительно»).
  const inclusiveDays = Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1;
  const halfRounded = Math.max(0.5, Math.round((inclusiveDays / AVG_MONTH_DAYS) * 2) / 2);
  const isFractional = !Number.isInteger(halfRounded);
  const formatNum = (n: number): string => (isFractional ? n.toFixed(1).replace(".", ",") : String(n));
  const intPart = Math.floor(halfRounded);
  const plural = (() => {
    if (isFractional) return "месяца"; // 1,5 / 7,5 месяца
    const mod10 = intPart % 10;
    const mod100 = intPart % 100;
    if (mod10 === 1 && mod100 !== 11) return "месяц";
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "месяца";
    return "месяцев";
  })();
  return `${formatNum(halfRounded)} ${plural}`;
}

/**
 * The «до 3.06» rule from the boss's manual: the contract stays valid for a
 * short buffer past the season end so the pickup visit has legal coverage
 * (п. 2.2 шаблона). Returns DD.MM.YYYY or "" when the input is unusable.
 */
export function storageValidUntilISO(endRaw: unknown, bufferDays = 2): string {
  const end = new Date(String(endRaw ?? ""));
  if (Number.isNaN(end.getTime())) return "";
  return new Date(end.getTime() + bufferDays * DAY_MS).toISOString().slice(0, 10);
}
