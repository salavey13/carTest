// app/franchize/server-actions/season-stats-constants.ts
//
// Plain (non-"use server") helpers for the season-stats module.
// "use server" files may only export async functions, so shared constants
// live here.

export const SEASON_YEAR = 2026;

export const SEASON_MONTH_KEYS = [
  "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10",
];

const MONTH_LABEL_RU: Record<string, string> = {
  "01": "янв", "02": "фев", "03": "мар", "04": "апр", "05": "май", "06": "июн",
  "07": "июл", "08": "авг", "09": "сен", "10": "окт", "11": "ноя", "12": "дек",
};

export function monthLabelRu(key: string): string {
  const [y, m] = key.split("-");
  return `${MONTH_LABEL_RU[m] || m} ${y}`;
}
