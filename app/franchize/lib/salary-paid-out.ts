// app/franchize/lib/salary-paid-out.ts
//
// 2026-09-26 salary audit follow-up — the «двухкнижная» fix.
//
// The crew keeps TWO money books:
//   1) the FORMAL salary ledger: cash_transactions, transaction_type=
//      'expense_salary', to_user_id=member — written by the salary page
//      (recordPayout / recordPayoutForPeriod) and by the wallet-mirror
//      trigger (supabase/migrations/20260926120000_salary_wallet_mirror.sql);
//   2) the OWNER WALLET: owner_cash_entries — the de-facto cash book the
//      assistant bot and the owner write every real-world money move into
//      («занеси выплату 10 000 зарплаты админу»).
//
// Before this module the salary math («уже выплачено», balanceDue) summed
// ONLY book 1. Real payouts logged only via the wallet/bot were invisible →
// the salary page kept showing a balance for money already handed out →
// the owner could pay the same person twice.
//
// Dedup rules (why some wallet rows are NOT counted):
//   • metadata.mirrorOfTx — row written by the CODE forward-mirror
//     (salary page payout → wallet). Its formal twin is counted in book 1.
//   • metadata.mirroredToTx — row already mirrored to the formal ledger by
//     the trigger/backfill. Its formal twin is counted in book 1.
//   • source='profile' with NO metadata — legacy forward-mirror rows written
//     by the 2026-09-09 code before the metadata link existed. Their formal
//     twins always exist (the mirror runs right after the formal insert).
//   • kind='subrenter_payout' — subrenter share has its own ledger, it is
//     not crew salary.
// Everything else that names the member (person contains "(<memberId>)",
// the convention of BOTH the bot — «salavey13 (admin 413553377)» — and our
// mirror — «Name (<id>)») AND reads as salary («зарпл…» in the title or
// metadata.book='salary') counts as paid.
//
// Pure-ish module: the Supabase client is injected, so specs can mock it.

import { mskDateFromUtcIso } from "./msk-time";

type MinimalClient = {
  from: (table: string) => any;
};

export interface SumPaidOutArgs {
  crewId: string;
  memberId: string;
  /** UTC ISO window start (inclusive). */
  startUtcIso: string;
  /** UTC ISO window end (inclusive). */
  endUtcIso: string;
}

/** Escape % and _ so a member id can't widen the ILIKE pattern. */
function escapeIlike(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/** A wallet row that clearly says «зарплата»: title match or explicit book tag. */
export function isWalletSalaryTitle(title: string | null | undefined, metadata: unknown): boolean {
  if (typeof title === "string" && /зарпл/i.test(title)) return true;
  const meta = metadata as Record<string, unknown> | null;
  return typeof meta?.book === "string" && meta.book === "salary";
}

/**
 * Should this wallet row be EXCLUDED because a formal-ledger twin already
 * carries the amount? (See dedup rules in the module docs.)
 */
export function isWalletRowMirroredToFormal(row: {
  source?: string | null;
  metadata?: unknown;
}): boolean {
  const meta = (row.metadata ?? null) as Record<string, unknown> | null;
  if (meta && (typeof meta.mirrorOfTx === "string" || typeof meta.mirroredToTx === "string")) {
    return true;
  }
  // Legacy forward mirror: written by the 2026-09-09 code with source
  // 'profile' and no metadata link (the metadata column link came later).
  return row.source === "profile" && (row.metadata === null || row.metadata === undefined);
}

/**
 * Sum of everything the member was REALLY paid in the window, across both
 * books without double counting:
 *   formal expense_salary rows (includes trigger-mirrored wallet payouts)
 * + wallet salary payouts that have no formal twin.
 */
export async function sumMemberPaidOut(
  supabase: MinimalClient,
  args: SumPaidOutArgs,
): Promise<{ formalTotal: number; walletTotal: number; total: number }> {
  const { crewId, memberId, startUtcIso, endUtcIso } = args;

  // Book 1 — formal ledger, timestamp window as-is.
  const { data: formalRows, error: formalError } = await supabase
    .from("cash_transactions")
    .select("amount")
    .eq("crew_id", crewId)
    .eq("to_user_id", memberId)
    .eq("transaction_type", "expense_salary")
    .gte("transaction_date", startUtcIso)
    .lte("transaction_date", endUtcIso);
  if (formalError) throw formalError;
  const formalTotal = (formalRows || []).reduce(
    (sum: number, r: { amount?: number | null }) =>
      sum + (Number(r.amount) > 0 ? Number(r.amount) : 0),
    0,
  );

  // Book 2 — owner wallet, MSK calendar-date window (entry_date is a DATE).
  const startMskDate = mskDateFromUtcIso(startUtcIso);
  const endMskDate = mskDateFromUtcIso(endUtcIso);
  const { data: walletRows, error: walletError } = await supabase
    .from("owner_cash_entries")
    .select("amount, title, person, kind, source, metadata, entry_date")
    .eq("crew_id", crewId)
    .eq("direction", "out")
    .gt("amount", 0)
    .ilike("person", `%(${escapeIlike(memberId)})%`)
    .gte("entry_date", startMskDate)
    .lte("entry_date", endMskDate);
  if (walletError) throw walletError;

  const walletTotal = (walletRows || [])
    .filter((row: any) => row.kind !== "subrenter_payout")
    .filter((row: any) => isWalletSalaryTitle(row.title, row.metadata))
    .filter((row: any) => !isWalletRowMirroredToFormal(row))
    .reduce((sum: number, row: any) => sum + (Number(row.amount) > 0 ? Number(row.amount) : 0), 0);

  return { formalTotal, walletTotal, total: formalTotal + walletTotal };
}

/**
 * Shared shift-accrual math (one implementation for owner overview, team
 * earnings, member earnings and payout): stored salary_amount wins;
 * otherwise duration × hourly_rate. Fixes getTeamEarnings /
 * getMemberEarnings which used to ignore salary_amount entirely and
 * disagreed with the payout math for the same period.
 */
export function computeShiftAccrued(
  shifts: Array<{
    clock_in_time?: string | null;
    clock_out_time?: string | null;
    hourly_rate?: number | null;
    salary_amount?: number | null;
  }>,
  now: Date = new Date(),
): number {
  return (shifts || []).reduce((sum, s) => {
    const stored = Number(s.salary_amount || 0);
    if (stored > 0) return sum + stored;
    const start = s.clock_in_time ? new Date(s.clock_in_time) : null;
    if (!start) return sum;
    const end = s.clock_out_time ? new Date(s.clock_out_time) : now;
    const hours = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60));
    const rate = Number(s.hourly_rate || 0);
    return sum + hours * rate;
  }, 0);
}
