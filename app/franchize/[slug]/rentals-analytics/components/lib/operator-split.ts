// rentals-analytics/components/lib/operator-split.ts
//
// Task 127 — per-operator commission split for the table view modal.
//
// The sheet's totals card sums «ЗП Аренда» + «ЗП Продажа» into ONE number —
// correct for a single-operator crew, useless the moment two operators close
// rentals in the same period. The CSV builder (lib/csv-builders/rentals-csv.ts)
// already attributes every ЗП row to a crew member («Оператор (ЗП)» column,
// same attribution chain as the profile salary math — Task 98), so the modal
// can group client-side with zero extra queries:
//
//   АРЕНДЫ  col 1 «ЗП Аренда»  × col 22 «Оператор (ЗП)»
//   ПРОДАЖИ col 1 «ЗП Продажа» × col 6  «Оператор (ЗП)»
//
// Every operator gets a STABLE identity — an emoji avatar + an accent color,
// derived from a djb2 hash of their label. Same operator ⇒ same icon in the
// split pills and on every marked table row, across sessions and devices
// (no randomness, no server round-trip). Pure module — unit-tested.

/** Emoji avatars for crew members (visually distinct at ~14px). */
export const OPERATOR_ICONS = [
  "🧑‍✈️",
  "🦅",
  "🐺",
  "🦊",
  "🐯",
  "🦁",
  "🐻",
  "🦉",
  "🐬",
  "🦈",
  "🐙",
  "🦖",
] as const;

/** Accent colors paired with the icons (readable on light AND dark tints). */
export const OPERATOR_COLORS = [
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#6366f1",
  "#84cc16",
  "#f43f5e",
  "#06b6d4",
  "#a855f7",
] as const;

/** djb2 — tiny, stable, distribution good enough for palette picking. */
export function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (((h << 5) + h + s.charCodeAt(i)) | 0) >>> 0;
  }
  return h >>> 0;
}

export function operatorIconOf(label: string): string {
  return OPERATOR_ICONS[hashString(label) % OPERATOR_ICONS.length];
}

export function operatorColorOf(label: string): string {
  return OPERATOR_COLORS[hashString(label) % OPERATOR_COLORS.length];
}

export interface OperatorSplitEntry {
  /** The «Оператор (ЗП)» cell value as printed in the sheet (@username / name / id). */
  label: string;
  /** Σ of the operator's ЗП rows (rentals + sales), ₽. */
  amount: number;
  /** Stable emoji avatar. */
  icon: string;
  /** Stable accent color. */
  color: string;
  /** amount / grandTotal (0 when grandTotal ≤ 0). */
  share: number;
}

/**
 * Groups ЗП rows by operator and sorts by amount desc (ties → label asc, so
 * the pill order is stable). Rows with an empty label are SKIPPED — the
 * caller surfaces them separately as «без атрибуции».
 */
export function buildOperatorSplit(
  entries: ReadonlyArray<{ label: string; amount: number }>,
  grandTotal: number,
): OperatorSplitEntry[] {
  const byLabel = new Map<string, number>();
  for (const e of entries) {
    const label = (e.label || "").trim();
    if (!label) continue;
    byLabel.set(label, (byLabel.get(label) || 0) + (Number.isFinite(e.amount) ? e.amount : 0));
  }
  return [...byLabel.entries()]
    .map(([label, amount]) => ({
      label,
      amount,
      icon: operatorIconOf(label),
      color: operatorColorOf(label),
      share: grandTotal > 0 ? amount / grandTotal : 0,
    }))
    .sort((a, b) => b.amount - a.amount || a.label.localeCompare(b.label));
}
