// scripts/task77-fix-paul-shifts.mjs
//
// Task 77 (boss 2026-10-07): «shifts are fine, you can fix mine as well :)»
// — the same repair Task 76 gave djorudjov, applied to Paul (413553377,
// salavey13, admin of vip-bike).
//
// DATA (verified live before writing this script):
//   Paul has 23 rows, NONE open, but FIVE overnight monsters — forgotten
//   clock-outs that swallow following days and explode the pay:
//     A1 2026-08-22 06:30 → 08-23 17:00  (2070 min, 34.5 h) — Aug 23 has no
//        own row (swallowed); the 08-23 17:00 close is a real UI event.
//     A2 2026-08-25 11:33 → 08-26 11:08  (1416 min) — Aug 26 has its own row
//        starting 11:09:18 (closed stale, reopened immediately).
//     A3 2026-09-03 15:09 → 09-04 06:54  (945 min, rate 500) — Sep 4 has no
//        own row; the 06:54 close is the next-morning UI event.
//     A4 2026-09-28 08:42 → 09-29 07:51  (1389 min) — Sep 29 own row at
//        07:51:19 (13 s later).
//     A5 2026-09-29 07:51 → 10-01 09:37  (2986 min, 49.8 h!) — Oct 1 own row
//        at 09:37:20.
//   Rate eras (his OWN rows): 169 ₽/h through Sep 2; 500 ₽/h from Sep 3
//   (row 09-03 carries 500) — unlike djorudjov, Paul switched before the
//   crew's 09-11 era, so no re-rating is needed (post-era rows are already
//   500).
//
// REPAIR (UTC; crew standard day 07:00→19:00, same as the djorudjov fix):
//   1. Five monsters → real days: close at 19:00 UTC of the start day
//      ( trg_calc_shift_salary recomputes salary_amount on clock_out_time
//        update ). Overnight tails are dropped — nobody works 34 h.
//   2. Swallowed days backfilled as standard days:
//        Aug 23  07:00→17:00 @169  (honours the real 17:00 close event)
//        Sep  4  07:00→19:00 @500
//        Sep 30  07:00→19:00 @500
//   3. Forgot-to-open tail after his last real row (Oct 1) — same doctrine
//      as the djorudjov backfill «восстановлено: забыл открыть смену»:
//        Oct 2…Oct 6  07:00→19:00 @500
//      Oct 7 (today) stays for real usage. Gaps with NO lockout and NO
//      boss instruction (Aug 18, Aug 31, Sep 5–12, 14–15, 17–27) are NOT
//      invented — flagged in the audit block instead.
//
// AUDIT: crews.metadata.owner_fix_20261007_shifts_paul (owner_ prefix =
// double-invisible in member UI).
//
// Run:  node --env-file=.env.local scripts/task77-fix-paul-shifts.mjs          (dry-run)
//       node --env-file=.env.local scripts/task77-fix-paul-shifts.mjs --apply  (execute)
import { createClient } from "../node_modules/@supabase/supabase-js/dist/main/index.js";

const APPLY = process.argv.includes("--apply");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const sb = createClient(url, key);

const PAUL = "413553377";
const CREW_ID = "2d5fde70-1dd3-4f0d-8d72-66ccf6908746"; // VIP_BIKE
const AUDIT_KEY = "owner_fix_20261007_shifts_paul";
const S = "T07:00:00+00:00"; // standard start
const E = "T19:00:00+00:00"; // standard end

const log = (...a) => console.log(...a);

const { data: shifts, error } = await sb
  .from("crew_member_shifts")
  .select("*")
  .eq("member_id", PAUL)
  .eq("crew_id", CREW_ID)
  .order("clock_in_time", { ascending: true });
if (error) {
  console.error("fetch failed:", error.message);
  process.exit(1);
}
log(`paul shifts: ${shifts.length} rows, open: ${shifts.filter((s) => !s.clock_out_time).length}`);

const plan = [];
const existingDayKeys = new Set(shifts.map((s) => s.clock_in_time.slice(0, 10)));

// ── 1. monsters → real days ─────────────────────────────────────────────────
const MONSTERS = [
  { inDay: "2026-08-22", expectOutDay: "2026-08-23", rate: 169, note: "Aug 22 34.5h monster" },
  { inDay: "2026-08-25", expectOutDay: "2026-08-26", rate: 169, note: "Aug 25 23.6h monster" },
  { inDay: "2026-09-03", expectOutDay: "2026-09-04", rate: 500, note: "Sep 3 overnight monster (already 500-era)" },
  { inDay: "2026-09-28", expectOutDay: "2026-09-29", rate: 500, note: "Sep 28 23h monster" },
  { inDay: "2026-09-29", expectOutDay: "2026-10-01", rate: 500, note: "Sep 29 49.8h monster" },
];
for (const m of MONSTERS) {
  const row = shifts.find(
    (s) => s.clock_in_time.startsWith(m.inDay) && s.clock_out_time?.startsWith(m.expectOutDay),
  );
  if (!row) {
    log(`monster ${m.inDay}: not found / already fixed — skip`);
    continue;
  }
  plan.push({
    op: "UPDATE",
    id: row.id,
    reason: `${m.note} → real ${m.inDay} day (close at standard 19:00 UTC)`,
    from: { clock_out_time: row.clock_out_time, salary_amount: row.salary_amount, hourly_rate: row.hourly_rate },
    to: { clock_out_time: m.inDay + E, hourly_rate: row.hourly_rate },
  });
}

// ── 2. swallowed days ───────────────────────────────────────────────────────
const SWALLOWED = [
  // honors the real UI close at Aug 23 17:00 carried by the A1 monster
  { day: "2026-08-23", end: "T17:00:00+00:00", rate: 169, note: "съеден «залипшей» сменой 22–23.08 (реальное закрытие было 17:00)" },
  { day: "2026-09-04", end: E, rate: 500, note: "съеден ночной сменой 03–04.09 (утреннее закрытие 06:54)" },
  { day: "2026-09-30", end: E, rate: 500, note: "съеден «залипшей» сменой 29.09–01.10 (закрыл 01.10 в 09:37)" },
];
for (const d of SWALLOWED) {
  if (existingDayKeys.has(d.day)) {
    log(`swallowed ${d.day}: row already exists — skip`);
    continue;
  }
  plan.push({
    op: "INSERT",
    reason: `swallowed day ${d.day} — standard day, rate ${d.rate}`,
    row: {
      member_id: PAUL,
      crew_id: CREW_ID,
      clock_in_time: d.day + S,
      clock_out_time: d.day + d.end,
      shift_type: "online",
      hourly_rate: d.rate,
      notes: `восстановлено: ${d.note}`,
    },
  });
}

// ── 3. forgot-to-open tail after the last real row (Oct 1) ──────────────────
const BACKFILL_FROM = "2026-10-02";
const BACKFILL_TO = "2026-10-06";
{
  const from = new Date(BACKFILL_FROM + "T00:00:00Z");
  const to = new Date(BACKFILL_TO + "T00:00:00Z");
  for (let d = new Date(from); d <= to; d.setUTCDate(d.getUTCDate() + 1)) {
    const day = d.toISOString().slice(0, 10);
    if (existingDayKeys.has(day)) continue;
    plan.push({
      op: "INSERT",
      reason: `forgot-to-open day ${day} (после последней живой смены 01.10) — standard day, canonical 500`,
      row: {
        member_id: PAUL,
        crew_id: CREW_ID,
        clock_in_time: day + S,
        clock_out_time: day + E,
        shift_type: "online",
        hourly_rate: 500,
        notes: "восстановлено: забыл открыть смену (по образцу ремонта djorudjov)",
      },
    });
  }
}

// ── report the plan ─────────────────────────────────────────────────────────
log(`\nplan: ${plan.length} operations`);
let payDelta = 0;
for (const step of plan) {
  if (step.op === "UPDATE") {
    const inT = shifts.find((s) => s.id === step.id)?.clock_in_time;
    const mins = (Date.parse(step.to.clock_out_time) - Date.parse(inT)) / 60000;
    const newPay = (mins / 60) * Number(step.to.hourly_rate);
    const oldPay = Number(step.from.salary_amount ?? 0);
    payDelta += newPay - oldPay;
    log(`  UPDATE ${step.id.slice(0, 8)} ${inT} → ${step.to.clock_out_time} | pay ${oldPay.toFixed(0)}→${newPay.toFixed(0)} | ${step.reason}`);
  } else {
    const mins = (Date.parse(step.row.clock_out_time) - Date.parse(step.row.clock_in_time)) / 60000;
    const newPay = (mins / 60) * step.row.hourly_rate;
    payDelta += newPay;
    log(`  INSERT ${step.row.clock_in_time.slice(0, 10)} ${step.row.clock_in_time.slice(11, 16)}→${step.row.clock_out_time.slice(11, 16)} @${step.row.hourly_rate} | pay +${newPay.toFixed(0)} | ${step.reason}`);
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
    const payload = { clock_out_time: step.to.clock_out_time, hourly_rate: step.to.hourly_rate };
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
    log(`  ✓ UPDATE ${step.id.slice(0, 8)} → dur ${after.duration_minutes}m, pay ${Number(after.salary_amount).toFixed(0)}₽`);
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

// ── audit block ─────────────────────────────────────────────────────────────
const { data: crewRow } = await sb.from("crews").select("metadata").eq("id", CREW_ID).single();
const meta = { ...(crewRow?.metadata ?? {}) };
meta[AUDIT_KEY] = {
  by: "task77-fix-paul-shifts.mjs",
  ts: new Date().toISOString(),
  fix: "paul shifts: 5 overnight monsters (22–23.08, 25–26.08, 03–04.09, 28–29.09, 29.09–01.10) → real days closed at 19:00 UTC; swallowed days restored (23.08 @169 with real 17:00 close, 04.09, 30.09 @500); forgot-to-open tail 02–06.10 backfilled @500 (same doctrine as the djorudjov repair). Gaps WITHOUT lockout/instruction (18.08, 31.08, 05–12.09, 14–15.09, 17–27.09) intentionally NOT invented — say the word and they get restored too. No rate drift: paul's own rows switched 169→500 on 03.09.",
  netPayDeltaRub: Number(payDelta.toFixed(0)),
  operations: results.map((r) => ({ op: r.op, id: r.id, reason: r.reason, after: r.after })),
};
const { error: auditErr } = await sb.from("crews").update({ metadata: meta }).eq("id", CREW_ID);
if (auditErr) {
  log(`⚠ audit write failed: ${auditErr.message}`);
  process.exit(1);
}
log(`\nDONE: ${results.length} operations applied. Audit → crews.metadata.${AUDIT_KEY}`);
