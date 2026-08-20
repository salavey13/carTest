// lib/salary-period.ts
//
// Helpers for the salary pay-period cycle. The crew's payout schedule is
// the 10th and 25th of each month — salaries accrue between these dates
// and are paid out on the boundary.
//
// 2026-08-19 review: previously the profile page and salary page both
// defaulted their date pickers to "first of current month → today" (or
// "first of current month → first of next month"). That's the calendar
// month boundary, not the pay-period boundary — so on, say, August 17,
// the picker showed Aug 1 → Aug 17 (a partial pay period), and the totals
// didn't match what the owner would actually pay out on Aug 25.
//
// Now both pages default to the CURRENT pay period containing "today":
//   - If today is between the 10th and 24th (inclusive) → period is
//     [this month 10th → this month 25th]
//   - Otherwise (today is 1st-9th, or 25th-31st) → period is
//     [previous 25th → next 10th]
//
// Returns { from, to } as YYYY-MM-DD strings ready for an <input type="date">.

export const PAYOUT_SCHEDULE_DAYS = [10, 25] as const;

/**
 * Compute the current pay period (the one containing `now`) and return
 * { from, to } as YYYY-MM-DD strings (inclusive end date).
 *
 * Behavior:
 *   - If today's date (day-of-month) is 10..24 → period is [10th, 25th] this month
 *   - If today is 1..9 → period is [25th last month, 10th this month]
 *   - If today is 25..31 → period is [25th this month, 10th next month]
 *
 * @param now optional Date override (defaults to new Date())
 */
export function getCurrentPayPeriod(now: Date = new Date()): {
  from: string;
  to: string;
} {
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  const day = now.getDate();

  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (y: number, m: number, d: number) =>
    `${y}-${pad(m + 1)}-${pad(d)}`;

  if (day >= 10 && day < 25) {
    // Period: this month 10th → this month 25th
    return {
      from: fmt(year, month, 10),
      to: fmt(year, month, 25),
    };
  }

  if (day >= 25) {
    // Period: this month 25th → next month 10th
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    return {
      from: fmt(year, month, 25),
      to: fmt(nextYear, nextMonth, 10),
    };
  }

  // day < 10 — period: last month 25th → this month 10th
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  return {
    from: fmt(prevYear, prevMonth, 25),
    to: fmt(year, month, 10),
  };
}

/**
 * Compute the PREVIOUS pay period (the one immediately before the current).
 * Useful for the "Last period" quick-preset button.
 */
export function getPreviousPayPeriod(now: Date = new Date()): {
  from: string;
  to: string;
} {
  const current = getCurrentPayPeriod(now);
  // The previous period ends on the day before the current period starts.
  // Subtract 16 days from the current period start (each period is ~15 days)
  // and re-run getCurrentPayPeriod at that point in time.
  const prevMidpoint = new Date(new Date(current.from).getTime() - 8 * 24 * 60 * 60 * 1000);
  return getCurrentPayPeriod(prevMidpoint);
}

/**
 * Compute the current calendar month range (first-of-month to last-of-month).
 * Useful for the "This month" quick-preset button — the old default.
 */
export function getCurrentCalendarMonth(now: Date = new Date()): {
  from: string;
  to: string;
} {
  const year = now.getFullYear();
  const month = now.getMonth();
  const pad = (n: number) => String(n).padStart(2, "0");
  const lastDay = new Date(year, month + 1, 0).getDate();
  return {
    from: `${year}-${pad(month + 1)}-01`,
    to: `${year}-${pad(month + 1)}-${pad(lastDay)}`,
  };
}
