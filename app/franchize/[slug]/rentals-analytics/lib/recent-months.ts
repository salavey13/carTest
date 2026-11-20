// recent-months.ts — task195 (boss): quick month selector data for the
// rentals/sales tableview. Pure module: the last `count` months, newest
// first, each with its exact first/last-day ISO range. The last day comes
// from day-0 of the NEXT month, so leap years and 30/31-month tails are
// correct by construction. Exported pure for unit tests (the modal is a
// TSX client component vitest can't inline-transform).

const pad = (n: number) => String(n).padStart(2, "0");

export interface RecentMonthOption {
  /** "2026-11" — stable React key + active-state match basis */
  key: string;
  /** ru-RU long month + year, capitalized («Ноябрь 2026»), « г.» stripped */
  label: string;
  /** first day of the month, ISO yyyy-mm-dd */
  fromIso: string;
  /** last day of the month, ISO yyyy-mm-dd */
  toIso: string;
}

export function buildRecentMonths(now: Date, count = 12): RecentMonthOption[] {
  const fmt = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" });
  const out: RecentMonthOption[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const fromIso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const toIso = `${last.getFullYear()}-${pad(last.getMonth() + 1)}-${pad(last.getDate())}`;
    const raw = fmt.format(d).replace(/\s*г\.?$/i, "");
    const label = raw.charAt(0).toUpperCase() + raw.slice(1);
    out.push({ key: fromIso.slice(0, 7), label, fromIso, toIso });
  }
  return out;
}
