// app/franchize/lib/salary-constants.ts
// ──────────────────────────────────────────────────────────────────────────
// ONE source of truth for the salary defaults (iter32).
//
// Why a constant: the hourly-rate fallback used to be the literal 169 in
// several web files (CrewShiftsClient live timer, team-earnings shift math),
// while the DB default and the bot /shift flow use 500 — the drift made the
// live earnings counter under-report open shifts until the shift was closed
// (the DB trigger then wrote the real amount).
//
// 500 ₽/h is grounded in:
//   • supabase/migrations/20260726000001_deposit_and_shift_tracking.sql —
//     crew_member_shifts.hourly_rate numeric DEFAULT 500;
//   • the /shift hourly_rate trigger fix (commit ce6e11c) — default 500;
//   • users.metadata.hourly_rate is the per-member source of truth, the
//     trigger trg_sync_hourly_rate_on_shift_start copies it into each shift.
//
// Zero dependencies — safe from client components AND server actions.

/** Fallback hourly rate (₽/h) when neither the shift nor the member carries a rate. */
export const DEFAULT_HOURLY_RATE = 500;
