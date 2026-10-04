// owner_fix_20261004_hourly — set price_per_hour for the whole bike fleet.
// Owner anchors: 79BIKE Falcon GT = 3000 ₽/1h, Rerode R1+ = 3000 ₽/1h.
// Deduced rule:  price_per_hour = ceil(dailyPrice * 0.25 / 500) * 500  (25% of daily, 500-step).
// ONLY specs.price_per_hour changes; every other tier (2h/3h/6h/12h/daily/...) stays as is.
// Audit: per-car specs.owner_fix_20261004_hourly = {old, new, rule, ts} (object value ->
// invisible in contract print / card specs which render string|number only; owner_ prefix
// is stripped by public-specs sanitizer).
import { createClient } from "/home/z/cartest/node_modules/@supabase/supabase-js/dist/main/index.js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const APPLY = process.argv.includes("--apply");
const AUDIT_KEY = "owner_fix_20261004_hourly";
const TS = new Date().toISOString();
const RULE = "price_per_hour = ceil(dailyPrice*0.25/500)*500; anchors: Falcon GT & Rerode R1+ = 3000RUB/1h (owner, 2026-10-04)";

const num = (v) => (v == null ? null : typeof v === "string" ? (Number(v) || null) : (typeof v === "number" ? v : null));
const deduce = (daily) => Math.ceil((daily * 0.25) / 500) * 500;

// ── load ────────────────────────────────────────────────────────────────────
const { data: cars, error } = await sb.from("cars").select("id,make,model,specs,type,is_test_result");
if (error) throw error;
const bikes = cars.filter((c) => c.type === "bike" && !c.is_test_result);

// ── plan ────────────────────────────────────────────────────────────────────
const plan = [], skipped = [];
for (const c of bikes) {
  const name = `${c.make} ${c.model}`.trim();
  const s = c.specs || {};
  const daily = num(s.dailyPrice) ?? num(s.rent_weekday);
  const old = num(s.price_per_hour);
  if (!daily || daily <= 0) { skipped.push({ id: c.id, name, reason: "no rental daily in specs (sale-only / empty ladder)" }); continue; }
  plan.push({ id: c.id, name, daily, old, new: deduce(daily), specs: s });
}
plan.sort((a, b) => a.daily - b.daily || a.name.localeCompare(b.name));

console.log(`bikes: ${bikes.length} | to update: ${plan.length} | skipped: ${skipped.length}`);
console.log("\n— PLAN (dry" + (APPLY ? "RUN=OFF, WILL APPLY" : "-run, pass --apply to write)") + " —");
for (const p of plan) {
  const mark = p.old == null ? "null→" : `${p.old}→`;
  const changed = p.old !== p.new ? "*" : "=";
  console.log(`${changed} ${p.name.padEnd(40)} day=${String(p.daily).padStart(6)}  1h: ${String(mark + p.new).padStart(12)}  (3h=${p.specs.price_per_3h ?? "—"} 6h=${p.specs.price_per_6h ?? "—"} 12h=${p.specs.price_per_12h ?? "—"})`);
}
for (const s of skipped) console.log(`- SKIP ${s.name.padEnd(40)} ${s.reason}`);

// ── asserts ─────────────────────────────────────────────────────────────────
const gt = plan.find((p) => /Falcon GT$/.test(p.name));
const r1 = plan.find((p) => /Rerode R1\+$/.test(p.name));
if (!gt || !r1) throw new Error("anchor bikes not found");
if (gt.new !== 3000 || r1.new !== 3000) throw new Error(`anchor rule mismatch: GT=${gt.new} R1+=${r1.new}, owner said 3000/3000`);
if (plan.length !== 30) throw new Error(`expected 30 updatable bikes, got ${plan.length}`);
for (const p of plan) {
  const h3 = num(p.specs.price_per_3h), h6 = num(p.specs.price_per_6h), h12 = num(p.specs.price_per_12h);
  // Strict: new 1h < 3h <= 6h <= 12h. Daily bound is a WARNING only — pre-existing
  // quirks (Y-VOLT h12=18000 > day=12000, Wenbox h12 == day) stay as is per owner.
  if (!(p.new < (h3 ?? Infinity) && (h3 ?? 0) <= (h6 ?? Infinity) && (h6 ?? 0) <= (h12 ?? Infinity)))
    throw new Error(`hourly ladder broken for ${p.name}: ${p.new}/${h3}/${h6}/${h12}`);
  if (h12 != null && h12 > p.daily) console.log(`  ⚠ pre-existing, untouched: ${p.name} h12=${h12} > day=${p.daily}`);
  if (p.new <= 0 || p.new % 500 !== 0) throw new Error(`bad hourly ${p.new} for ${p.name}`);
}
console.log("\nasserts OK: anchors 3000/3000, 30 rows, ladder monotonic, 500-step");

if (!APPLY) { console.log("\nDRY RUN — nothing written."); process.exit(0); }

// ── apply ───────────────────────────────────────────────────────────────────
let n = 0;
for (const p of plan) {
  const specs = { ...p.specs };
  specs.price_per_hour = p.new;
  specs[AUDIT_KEY] = {
    fix: "hourly_price_fleet",
    ts: TS,
    rule: RULE,
    old_price_per_hour: p.old ?? null,
    new_price_per_hour: p.new,
    other_tiers: "untouched",
  };
  const { error: upErr } = await sb.from("cars").update({ specs }).eq("id", p.id);
  if (upErr) throw upErr;
  n++;
  console.log(`✓ ${p.name}: 1h = ${p.new} ₽`);
}
console.log(`\nupdated ${n}/${plan.length}`);

// ── verify ──────────────────────────────────────────────────────────────────
const ids = plan.map((p) => p.id);
const { data: after, error: vErr } = await sb.from("cars").select("id,make,model,specs").in("id", ids);
if (vErr) throw vErr;
let bad = 0;
for (const p of plan) {
  const row = after.find((r) => r.id === p.id);
  if (!row || num(row.specs?.price_per_hour) !== p.new || !row.specs?.[AUDIT_KEY]) { console.log(`✗ VERIFY FAIL ${p.name}`); bad++; continue; }
  // other tiers must be byte-identical to the plan snapshot
  const { price_per_hour, [AUDIT_KEY]: _a, ...restOld } = p.specs;
  const { price_per_hour: _n, [AUDIT_KEY]: _b, ...restNew } = row.specs;
  if (JSON.stringify(restOld) !== JSON.stringify(restNew)) { console.log(`✗ TIER DRIFT ${p.name}`); bad++; }
}
if (bad) throw new Error(`${bad} verification failures`);
console.log(`VERIFY OK: ${plan.length}/${plan.length} cars carry new 1h price + audit block, zero tier drift`);
