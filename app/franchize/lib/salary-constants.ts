// app/franchize/lib/salary-constants.ts
// ──────────────────────────────────────────────────────────────────────────
// ONE source of truth for the salary defaults (iter32; task98 2026-10-16).
//
// Why a constant: the hourly-rate fallback used to be the literal 169 in
// several web files (CrewShiftsClient live timer, team-earnings shift math),
// while the DB default and the bot /shift flow use 500 — the drift made the
// live earnings counter under-report open shifts until the shift was closed
// (the DB trigger then wrote the real amount).
//
// Task 98 (boss 2026-10-16): the default is now 100 ₽/h, not 500 — «10h shift
// equals to 1k rub — closer to reality». Historical shifts keep their stored
// rate. The DB side (column DEFAULT + sync_hourly_rate_on_shift_start()
// COALESCE fallback) is updated by the SQL only Paul applies:
//   docs/crewDocs/salary-hourly-default-100-dj-october-shifts-2026-10-16.sql
// users.metadata.hourly_rate stays the per-member source of truth — the
// trigger copies it into each shift when the member has one set.
//
// Zero dependencies — safe from client components AND server actions.

/** Fallback hourly rate (₽/h) when neither the shift nor the member carries a rate. */
export const DEFAULT_HOURLY_RATE = 100;
