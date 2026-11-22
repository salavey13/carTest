// scripts/task77-fix-firdbradsen-shifts.mjs
//
// Task 77 (boss 2026-10-07): «and firdbradsen's member too, he worked 1
// every three days ;)» — same djorudjov-doctrine repair, but the backfill
// follows HIS schedule: one shift every three days.
//
// WHO: "firdbradsen" = member 5219192922 — Гундермурд Сигурдфлордбрадсен
// (the boss shortens the surname to its tail «…брадсен»). role=member,
// joined 2026-08-28. His own rows establish the standard day 08:00→18:00
// UTC (10:00→20:00 MSK) and the rate eras: 169 through 10.09, 500 from
// 11.09 (the crew-era switch documented in Task 76).
//
// DATA (verified live):
//   21 rows, none open, TWO monsters:
//     A1 2026-09-08 09:55 → 09-09 16:17  (1822 min, 30.4 h) — Sep 9 has no
//        own row (swallowed; he was daily that week).
//     A2 2026-09-22 08:00 → 10-01 17:30  (13531 min = 225.5 h, pay
//        112 758 ₽!!) — one forgotten close froze him out of the shift
//        system for two weeks (the API refuses a new clock-in while a
//        shift is open). The 10-01 17:30 close is a real UI event — he
//        finally closed the stale shift when he came on Oct 1.
//
// REPAIR (UTC):
//   1. A1 → real Sep 8 day (close 18:00, rate 169); overnight tail dropped.
//   2. A2 → real Sep 22 day (close 18:00, rate 500); the 225-hour tail is
//      replaced by the rhythm backfill below.
//   3. Swallowed Sep 9 → standard day 08:00→18:00 @169 (he was daily that
//      week — real rows on both sides).
//   4. Backfill 23.09–06.10 with his 1-in-3 rhythm, anchored at his last
//      real day Sep 22 → working days: Sep 25, Sep 28, Oct 1, Oct 4,
//      standard 08:00→18:00 @500. Oct 1 honours the real 17:30 close
//      carried by the monster (08:00→17:30). Sep 23/24/26/27, Oct 2/3/5/6
//      = his days off. Oct 7 (today) stays for real usage.
//   The dense daily rows 03–22.09 are the boss-entered history — kept
//   untouched (the boss's «1 every three days» shapes the BACKFILL, exactly
//   like djorudjov's «he worked every day» shaped his).
//
// AUDIT: crews.metadata.owner_fix_20261007_shifts_fird
//
// Run:  node --env-file=.env.local scripts/task77-fix-firdbradsen-shifts.mjs          (dry-run)
//       node --env-file=.env.local scripts/task77-fix-firdbradsen-shifts.mjs --apply  (execute)
import { createClient } from "../node_modules/@supabase/supabase-js/dist/main/index.js";

const APPLY = process.argv.includes("--apply");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const sb = createClient(url, key);

const FIRD = "5219192922";
const CREW_ID = "2d5fde70-1dd3-4f0d-8d72-66ccf6908746"; // VIP_BIKE
const AUDIT_KEY = "owner_fix_20261007_shifts_fird";
const S = "T08:00:00+00:00"; // his standard start (own rows)
const E = "T18:00:00+00:00"; // his standard end   (own rows)

const log = (...a) => console.log(...a);

const { data: shifts, error } = await sb
  .from("crew_member_shifts")
  .select("*")
  .eq("member_id", FIRD)
  .eq("crew_id", CREW_ID)
  .order("clock_in_time", { ascending: true });
if (error) {
  console.error("fetch failed:", error.message);
  process.exit(1);
}
log(`firdbradsen shifts: ${shifts.length} rows, open: ${shifts.filter((s) => !s.clock_out_time).length}`);

const plan = [];
const existingDayKeys = new Set(shifts.map((s) => s.clock_in_time.slice(0, 10)));

// ── 1+2. monsters ───────────────────────────────────────────────────────────
const MONSTERS = [
  { inDay: "2026-09-08", outDay: "2026-09-09", note: "Sep 8 30.4h overnight monster (rate 169 era)" },
  { inDay: "2026-09-22", outDay: "2026-10-01", note: "Sep 22 225.5h monster (frozen him out for 2 weeks)" },
];
for (const m of MONSTERS) {
  const row = shifts.find(
    (s) => s.clock_in_time.startsWith(m.inDay) && s.clock_out_time?.startsWith(m.outDay),
  );
  if (!row) {
    log(`monster ${m.inDay}: not found / already fixed — skip`);
    continue;
  }
  plan.push({
    op: "UPDATE",
    id: row.id,
    reason: `${m.note} → real ${m.inDay} day (close at his standard 18:00 UTC)`,
    from: { clock_out_time: row.clock_out_time, salary_amount: row.salary_amount, hourly_rate: row.hourly_rate },
    to: { clock_out_time: m.inDay + E, hourly_rate: row.hourly_rate },
  });
}

// ── 3. swallowed Sep 9 ──────────────────────────────────────────────────────
if (!existingDayKeys.has("2026-09-09")) {
  plan.push({
    op: "INSERT",
    reason: "swallowed day 2026-09-09 — standard day @169 (he was daily that week)",
    row: {
      member_id: FIRD,
      crew_id: CREW_ID,
      clock_in_time: "2026-09-09" + S,
      clock_out_time: "2026-09-09" + E,
      shift_type: "online",
      hourly_rate: 169,
      notes: "восстановлено: день внутри «залипшей» смены 08–09.09 (забыл закрыть)",
    },
  });
}

// ── 4. rhythm backfill: 1 shift every 3 days, anchored at Sep 22 ────────────
const BACKFILL_FROM = "2026-09-23";
const BACKFILL_TO = "2026-10-06";
const ANCHOR = "2026-09-22";
// Oct 1 keeps the real close event the monster carried (17:30:36).
const REAL_CLOSE_OVERRIDES = { "2026-10-01": "2026-10-01T17:30:36.495+00:00" };
{
  const anchorMs = Date.parse(ANCHOR + "T00:00:00Z");
  const from = new Date(BACKFILL_FROM + "T00:00:00Z");
  const to = new Date(BACKFILL_TO + "T00:00:00Z");
  for (let d = new Date(from); d <= to; d.setUTCDate(d.getUTCDate() + 1)) {
    const day = d.toISOString().slice(0, 10);
    const dayMs = Date.parse(day + "T00:00:00Z");
    const daysSinceAnchor = Math.round((dayMs - anchorMs) / 86400000);
    if (daysSinceAnchor % 3 !== 0) continue; // his days off
    if (existingDayKeys.has(day)) continue;
    const end = REAL_CLOSE_OVERRIDES[day] ?? day + E;
    plan.push({
      op: "INSERT",
      reason: `rhythm day ${day} (1 смена раз в 3 дня от 22.09) — standard 08:00→18:00 @500${REAL_CLOSE_OVERRIDES[day] ? ", конец = реальное закрытие 17:30" : ""}`,
      row: {
        member_id: FIRD,
        crew_id: CREW_ID,
        clock_in_time: day + S,
        clock_out_time: end,
        shift_type: "online",
        hourly_rate: 500,
        notes: "восстановлено: работал 1 смену раз в 3 дня (смену 22.09 забыл закрыть — система не пускала открыть новую)",
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
  by: "task77-fix-firdbradsen-shifts.mjs",
  ts: new Date().toISOString(),
  fix: "firdbradsen (Гундермурд Сигурдфлордбрадсен, 5219192922) shifts: monster 08–09.09 (30.4h) → real day; monster 22.09–01.10 (13531 min = 225.5h, 112 758 ₽ — забыл закрыть, система не пускала открыть новую) → real 22.09 day; swallowed 09.09 restored @169; backfill 23.09–06.10 по его графику «1 смена раз в 3 дня» от якоря 22.09 → 25.09, 28.09, 01.10 (конец = реальное закрытие 17:30), 04.10 @500 08:00–18:00. Ежедневные строки 03–22.09 (история босса) не тронуты. 07.10 оставлен живому использованию.",
  netPayDeltaRub: Number(payDelta.toFixed(0)),
  operations: results.map((r) => ({ op: r.op, id: r.id, reason: r.reason, after: r.after })),
};
const { error: auditErr } = await sb.from("crews").update({ metadata: meta }).eq("id", CREW_ID);
if (auditErr) {
  log(`⚠ audit write failed: ${auditErr.message}`);
  process.exit(1);
}
log(`\nDONE: ${results.length} operations applied. Audit → crews.metadata.${AUDIT_KEY}`);
