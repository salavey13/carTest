// scripts/task76-fix-djorudjov-shifts.mjs
//
// Task 76 (boss 2026-10-07): «please fix djorudjov's shifts — he worked every
// day but sometimes forgot to open/close shifts».
//
// ROOT CAUSE CHAIN (verified in code + data):
//   1. app/api/crew/shifts/route.ts POST refuses a new shift while another is
//      open («У вас уже есть активная смена», 409) — one forgotten clock-out
//      therefore FREEZES the member out of the shift system entirely.
//   2. djorudjov forgot to close his 2026-09-22 shift → no shift could be
//      opened since (14 days of missing rows) → profile salary shows ~0
//      смены for the recent period (and the on-the-fly open-shift accrual
//      used to explode to weeks × rate).
//   3. Earlier forgotten close: the 2026-08-25 11:34 row stayed open until
//      2026-08-27 08:09 — a 2675-minute (44.6 h) monster crediting 3 days.
//   4. Rate drift (documented bug in app/franchize/lib/salary-constants.ts):
//      169 ₽/h was the legacy WEB fallback; the canonical rate is 500 ₽/h
//      (DB default, bot /shift flow, DEFAULT_HOURLY_RATE). The crew's real
//      data shows the era switch on 2026-09-11 (member 5219192922's rows).
//      djorudjov's post-09-11 rows kept the buggy 169.
//
// REPAIR (all times UTC; the member's standard day = 07:00→19:00 UTC =
// 10:00→22:00 MSK, established by his own backfilled rows):
//   A. monster row → real Aug 25 (11:34→19:00) + backfilled Aug 26 (07:00→19:00,
//      rate 169 — pre-era); the overnight Aug 26 19:00 → Aug 27 08:09 tail is
//      dropped (he was not at work overnight; Aug 27 has its own real row).
//   B. every row with clock_in ≥ 2026-09-11 and hourly_rate=169 → 500
//      (trigger trg_calc_shift_salary recomputes salary_amount on clock_out
//      update; re-rating touches clock_out_time with its current value).
//   C. the stuck-open 2026-09-22 shift → closed at 19:00 UTC.
//   D. backfill 2026-09-23 … 2026-10-06 (14 standard days), rate 500.
//      2026-10-07 (today) is left to real usage — after the fix the member
//      can clock in/out himself again.
//
// AUDIT (per the standing direct-data-correction convention): the full
// before/after report lands in crews.metadata.owner_fix_20261007_shifts
// (owner_ prefix = double-invisible in any member UI).
//
// Run:  node --env-file=.env.local scripts/task76-fix-djorudjov-shifts.mjs          (dry-run)
//       node --env-file=.env.local scripts/task76-fix-djorudjov-shifts.mjs --apply  (execute)
import { createClient } from "../node_modules/@supabase/supabase-js/dist/main/index.js";

const APPLY = process.argv.includes("--apply");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const sb = createClient(url, key);

const DJ = "7813830016";
const CREW_ID = "2d5fde70-1dd3-4f0d-8d72-66ccf6908746";
const AUDIT_KEY = "owner_fix_20261007_shifts";
const ERA_SWITCH = "2026-09-11T00:00:00+00:00"; // canonical 500 era (crew's real data)
const STANDARD_START = "T07:00:00+00:00";
const STANDARD_END = "T19:00:00+00:00";
const BACKFILL_FROM = "2026-09-23";
const BACKFILL_TO = "2026-10-06"; // inclusive; today (Oct 7) stays real

const log = (...a) => console.log(...a);

// ── fetch djorudjov's shifts ────────────────────────────────────────────────
const { data: shifts, error } = await sb
  .from("crew_member_shifts")
  .select("*")
  .eq("member_id", DJ)
  .eq("crew_id", CREW_ID)
  .order("clock_in_time", { ascending: true });
if (error) {
  console.error("fetch failed:", error.message);
  process.exit(1);
}
log(`djorudjov shifts: ${shifts.length} rows`);

const plan = [];
const existingDayKeys = new Set(shifts.map((s) => s.clock_in_time.slice(0, 10)));

// ── A. monster row ──────────────────────────────────────────────────────────
const monster = shifts.find(
  (s) => s.clock_in_time.startsWith("2026-08-25") && s.clock_in_time.includes("11:34"),
);
if (monster && monster.clock_out_time?.startsWith("2026-08-27")) {
  plan.push({
    op: "UPDATE",
    id: monster.id,
    reason: "monster 44.6h row (forgotten close on Aug 25) → real Aug 25 day",
    from: { clock_out_time: monster.clock_out_time, salary_amount: monster.salary_amount },
    to: { clock_out_time: "2026-08-25T19:00:00+00:00", hourly_rate: 169 },
  });
} else {
  log("A: monster row not found or already fixed — skip");
}

// A2: Aug 26 backfill (inside the swallowed window)
if (monster && !existingDayKeys.has("2026-08-26")) {
  plan.push({
    op: "INSERT",
    reason: "Aug 26 was swallowed by the monster row — standard day, pre-era rate",
    row: {
      member_id: DJ,
      crew_id: CREW_ID,
      clock_in_time: "2026-08-26" + STANDARD_START,
      clock_out_time: "2026-08-26" + STANDARD_END,
      shift_type: "online",
      hourly_rate: 169,
      notes: "восстановлено: день внутри «залипшей» смены 25–27.08 (забыл закрыть)",
    },
  });
}

// ── B. re-rate post-era rows (169 → 500) ────────────────────────────────────
// Closed rows only — the open shift is handled by step C (which closes it
// WITH the canonical rate in one update).
const misRated = shifts.filter(
  (s) => s.clock_out_time !== null && s.clock_in_time >= ERA_SWITCH && Number(s.hourly_rate) === 169,
);
for (const s of misRated) {
  plan.push({
    op: "UPDATE",
    id: s.id,
    reason: `rate drift ${s.hourly_rate}→500 (canonical DEFAULT_HOURLY_RATE; crew switched 2026-09-11)`,
    from: { hourly_rate: s.hourly_rate, salary_amount: s.salary_amount },
    to: { hourly_rate: 500, clock_out_time: s.clock_out_time }, // same value → trigger recomputes
    keepClockOut: true,
  });
}

// ── C. close the stuck-open shift ───────────────────────────────────────────
const openRow = shifts.find((s) => s.clock_out_time === null);
if (openRow) {
  const day = openRow.clock_in_time.slice(0, 10);
  const rate = openRow.clock_in_time >= ERA_SWITCH ? 500 : openRow.hourly_rate;
  plan.push({
    op: "UPDATE",
    id: openRow.id,
    reason: `open since ${openRow.clock_in_time} (forgotten close; blocks all new clock-ins) → close at standard 19:00 UTC`,
    from: { clock_out_time: null, hourly_rate: openRow.hourly_rate },
    to: { clock_out_time: day + STANDARD_END, hourly_rate: rate },
  });
} else {
  log("C: no open shift — skip");
}

// ── D. backfill missing standard days ───────────────────────────────────────
const missingDays = [];
{
  const from = new Date(BACKFILL_FROM + "T00:00:00Z");
  const to = new Date(BACKFILL_TO + "T00:00:00Z");
  for (let d = new Date(from); d <= to; d.setUTCDate(d.getUTCDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    if (!existingDayKeys.has(key)) missingDays.push(key);
  }
}
for (const day of missingDays) {
  plan.push({
    op: "INSERT",
    reason: "missing day (locked out by the stuck-open shift) — standard day, canonical rate",
    row: {
      member_id: DJ,
      crew_id: CREW_ID,
      clock_in_time: day + STANDARD_START,
      clock_out_time: day + STANDARD_END,
      shift_type: "online",
      hourly_rate: 500,
      notes: "восстановлено: забыл открыть смену (была незакрытая с 22.09)",
    },
  });
}

// ── report the plan ─────────────────────────────────────────────────────────
log(`\nplan: ${plan.length} operations`);
let payDelta = 0;
for (const step of plan) {
  if (step.op === "UPDATE") {
    const rate = step.to.hourly_rate;
    const out = step.to.clock_out_time;
    const inT = shifts.find((s) => s.id === step.id)?.clock_in_time;
    const mins = (Date.parse(out) - Date.parse(inT)) / 60000;
    const newPay = (mins / 60) * rate;
    const oldPay = Number(step.from.salary_amount ?? 0);
    payDelta += newPay - oldPay;
    log(`  UPDATE ${step.id.slice(0, 8)} ${inT} → ${out} | rate ${step.from.hourly_rate}→${rate} | pay ${oldPay.toFixed(0)}→${newPay.toFixed(0)} | ${step.reason}`);
  } else {
    const mins = (Date.parse(step.row.clock_out_time) - Date.parse(step.row.clock_in_time)) / 60000;
    const newPay = (mins / 60) * step.row.hourly_rate;
    payDelta += newPay;
    log(`  INSERT ${step.row.clock_in_time} → ${step.row.clock_out_time} | rate ${step.row.hourly_rate} | pay +${newPay.toFixed(0)} | ${step.reason}`);
  }
}
log(`\nnet pay delta: ${payDelta >= 0 ? "+" : ""}${payDelta.toFixed(0)} ₽`);

if (!APPLY) {
  log("\nDRY RUN — re-run with --apply to execute.");
  process.exit(0);
}

// ── execute ─────────────────────────────────────────────────────────────────
log("\nAPPLYING…");
const results = [];
for (const step of plan) {
  if (step.op === "UPDATE") {
    const payload = { hourly_rate: step.to.hourly_rate };
    if (!step.keepClockOut) payload.clock_out_time = step.to.clock_out_time;
    else payload.clock_out_time = step.to.clock_out_time; // same value fires the salary trigger
    const { error: e } = await sb.from("crew_member_shifts").update(payload).eq("id", step.id);
    if (e) {
      log(`  ✗ UPDATE ${step.id}: ${e.message}`);
      process.exit(1);
    }
    const { data: after } = await sb
      .from("crew_member_shifts")
      .select("clock_out_time, duration_minutes, hourly_rate, salary_amount")
      .eq("id", step.id)
      .single();
    results.push({ op: "update", id: step.id, reason: step.reason, after });
    log(`  ✓ UPDATE ${step.id.slice(0, 8)} → dur ${after.duration_minutes}m, rate ${after.hourly_rate}, pay ${Number(after.salary_amount).toFixed(0)}₽`);
  } else {
    const { data: inserted, error: e } = await sb
      .from("crew_member_shifts")
      .insert(step.row)
      .select("id, clock_in_time, duration_minutes, hourly_rate, salary_amount")
      .single();
    if (e) {
      log(`  ✗ INSERT ${step.row.clock_in_time}: ${e.message}`);
      process.exit(1);
    }
    results.push({ op: "insert", id: inserted.id, reason: step.reason, after: inserted });
    log(`  ✓ INSERT ${step.row.clock_in_time.slice(0, 10)} → dur ${inserted.duration_minutes}m, pay ${Number(inserted.salary_amount).toFixed(0)}₽`);
  }
}

// ── audit block on crews.metadata (owner_ prefix = invisible to member UI) ──
const { data: crewRow } = await sb.from("crews").select("metadata").eq("id", CREW_ID).single();
const meta = { ...(crewRow?.metadata ?? {}) };
meta[AUDIT_KEY] = {
  by: "task76-fix-djorudjov-shifts.mjs",
  ts: new Date().toISOString(),
  fix: "djorudjov shifts: close forgotten-open 22.09 (blocked all clock-ins), split the 25–27.08 monster into real days, backfill 23.09–06.10 (locked-out days), re-rate post-11.09 rows 169→500 (canonical DEFAULT_HOURLY_RATE; crew era switch)",
  netPayDeltaRub: Number(payDelta.toFixed(0)),
  operations: results.map((r) => ({ op: r.op, id: r.id, reason: r.reason, after: r.after })),
};
const { error: auditErr } = await sb.from("crews").update({ metadata: meta }).eq("id", CREW_ID);
if (auditErr) {
  log(`⚠ audit write failed: ${auditErr.message}`);
  process.exit(1);
}
log(`\nDONE: ${results.length} operations applied. Audit → crews.metadata.${AUDIT_KEY}`);
