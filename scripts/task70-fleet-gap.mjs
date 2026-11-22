// task70-fleet-gap.mjs — boss question 2026-10-04:
// «comparing to desired 3mil/mes — wtf did we do wrong?»
//
// Pulls the WHOLE fleet + ALL primary rentals, computes September 2026
// actuals with the same money canon as task69 (independent impl), and
// diffs them against INSTRUKCIYA_3MLN_RUB_MES.md targets:
//   36 bikes (10 own / 26 partner), 12 000 ₽/day, 65% utilization,
//   702 rent-days/mo, ~470 deals/mo, profit ≈ 3.14M ₽/mo.
//
// Read-only. Run: cd /home/z/cartest && bun scripts/task70-fleet-gap.mjs
import { createClient } from "@supabase/supabase-js";

const sb = createClient("https://inmctohsodgdohamhzag.supabase.co", process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const MONTH = "2026-09";
const NOW = Date.now();
const assertFails = [];
const ok = (name, cond, detail = "") => { if (!cond) assertFails.push(`${name}: ${detail}`); };

// ── money canon (same as task69 independent impl) ────────────────────────────
const UNIT = { helmets: 1000, gloves: 500, jacket: 500, pants: 500, boots: 500, net: 500, bag: 500, backpack: 500, charger: 0 };
const UNIT_FALLBACK = 500;
function durUnit(base, sIso, eIso) {
  if (!(base > 0)) return 0;
  const s = Date.parse(sIso || ""), e = Date.parse(eIso || "");
  if (Number.isNaN(s) || Number.isNaN(e) || e <= s) return base;
  const hours = (e - s) / 36e5;
  if (hours < 24) return Math.round(base / 2);
  const days = Math.max(1, Math.ceil(hours / 24));
  return base + Math.round(base / 2) * (days - 1);
}
function gearEstimate(metadata, sIso, eIso) {
  const eq = metadata?.equipment;
  if (!eq || typeof eq !== "object" || Array.isArray(eq)) return 0;
  let total = 0;
  for (const [k, v] of Object.entries(eq)) {
    if (k.endsWith("_gift")) continue;
    if (eq[`${k}_gift`] === true) continue;
    const qty = typeof v === "number" && v > 0 ? v : v === true ? 1 : 0;
    total += durUnit(UNIT[k] ?? UNIT_FALLBACK, sIso, eIso) * qty;
  }
  return total;
}
function effStatus(status, endIso) {
  if ((status === "active" || status === "confirmed") && endIso) {
    const end = Date.parse(endIso);
    if (!Number.isNaN(end) && end + 24 * 36e5 < NOW) return "expired";
  }
  return status ?? "unknown";
}
function mskMonth(iso) {
  const t = Date.parse(iso || "");
  const d = new Date((Number.isNaN(t) ? NOW : t) + 3 * 36e5);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// ── load everything ──────────────────────────────────────────────────────────
const { data: cars, error: carsErr } = await sb.from("cars").select("id,make,model,daily_price,specs,type,crew_id,is_test_result");
if (carsErr) throw new Error(`cars: ${carsErr.message}`);
const { data: rentals } = await sb.from("rentals")
  .select("rental_id,vehicle_id,status,total_cost,agreed_start_date,agreed_end_date,requested_start_date,requested_end_date,created_at,metadata")
  .order("created_at", { ascending: true });

const { data: art } = await sb.schema("private").from("subrent_contract_artifacts")
  .select("crew_id,owner_percentage,created_at").order("created_at", { ascending: false });
const pctByCrew = new Map();
for (const a of art ?? []) {
  const v = Number(a.owner_percentage);
  if (Number.isFinite(v) && v >= 1 && v <= 99 && !pctByCrew.has(a.crew_id)) pctByCrew.set(a.crew_id, Math.round(v));
}

const bikeRows = (cars ?? []).filter((c) => c.type === "bike" && !c.is_test_result);
const primary = (rentals ?? []).filter((r) => {
  const m = r.metadata ?? {};
  const isMirror = m.item_type === "equipment" && (typeof m.primary_rental_id === "string" ? m.primary_rental_id.trim() !== "" : typeof m.primary_rental_id === "number");
  return !isMirror;
});

// per-bike partner chat: specs.subrenter_chat_id (task69 canon)
const partnerChatOf = (car) => (typeof car?.specs?.subrenter_chat_id === "string" && car.specs.subrenter_chat_id.trim()) || null;

// ── fleet inventory ──────────────────────────────────────────────────────────
const byBike = new Map();
for (const car of bikeRows) {
  byBike.set(car.id, { car, chat: partnerChatOf(car), rows: [] });
}
for (const r of primary) {
  const b = byBike.get(r.vehicle_id);
  if (b) b.rows.push(r);
}

// ── September math per bike ──────────────────────────────────────────────────
function rowMoney(r, chat, pct) {
  const m = r.metadata ?? {};
  const start = r.agreed_start_date || r.requested_start_date || r.created_at;
  const end = r.agreed_end_date || r.requested_end_date || null;
  const eff = effStatus(r.status, r.agreed_end_date || r.requested_end_date);
  const total = Math.max(0, Math.round(Number(r.total_cost) || 0));
  let gear = 0;
  if (m.item_type === "equipment") gear = total;
  else if (m.equipment_price != null && Number.isFinite(Number(m.equipment_price))) gear = Math.min(Math.round(Number(m.equipment_price)), total);
  else gear = Math.min(gearEstimate(m, start, end), total);
  const bike = total - gear;
  const earns = (eff === "completed" || eff === "active") && total > 0;
  const partner = earns && chat && bike > 0 ? Math.round((bike * pct) / 100) : 0;
  // rent-days: ceil of window in days (min 0.5 for half-day)
  const s = Date.parse(start || ""), e = Date.parse(end || "");
  let days = 0;
  if (!Number.isNaN(s) && !Number.isNaN(e) && e > s) days = Math.max(0.5, Math.ceil((e - s) / 864e5 * 2) / 2);
  return { total, bike, gear, partner, earns, eff, days, start, end, pctUsed: pct };
}

const sep = [];
for (const [id, b] of byBike) {
  const crewSlug = b.car.crew_id ?? null;
  const pct = pctByCrew.get(crewSlug) ?? 50;
  const rows = b.rows
    .map((r) => ({ r, m: rowMoney(r, b.chat, pct), month: mskMonth(r.agreed_start_date || r.requested_start_date || r.created_at) }))
    .filter((x) => x.month === MONTH);
  const agg = { id, label: `${b.car.make ?? ""} ${b.car.model ?? ""}`.trim() || id, chat: b.chat, pct, revenue: 0, deals: 0, bikeSum: 0, gearSum: 0, partner: 0, days: 0, cancelled: 0, cancelledSum: 0, rows: [] };
  for (const { m } of rows) {
    if (m.earns) { agg.revenue += m.total; agg.deals++; agg.bikeSum += m.bike; agg.gearSum += m.gear; agg.partner += m.partner; agg.days += m.days; }
    if (m.eff === "cancelled") { agg.cancelled++; agg.cancelledSum += m.total; }
  }
  if (rows.length) sep.push(agg);
}
sep.sort((a, b2) => b2.revenue - a.revenue);

const T = sep.reduce((a, x) => ({
  revenue: a.revenue + x.revenue, deals: a.deals + x.deals, days: a.days + x.days,
  bikeSum: a.bikeSum + x.bikeSum, gearSum: a.gearSum + x.gearSum, partner: a.partner + x.partner,
  cancelled: a.cancelled + x.cancelled, cancelledSum: a.cancelledSum + x.cancelledSum,
}), { revenue: 0, deals: 0, days: 0, bikeSum: 0, gearSum: 0, partner: 0, cancelled: 0, cancelledSum: 0 });

const activeFleet = sep.filter((x) => x.revenue > 0 || x.days > 0);
const ownFleet = bikeRows.filter((c) => !partnerChatOf(c));
const partnerFleet = bikeRows.filter((c) => partnerChatOf(c));
const avgRate = T.days ? Math.round(T.bikeSum / T.days) : 0;
const util = (T.days / (bikeRows.length * 30)) * 100;
const utilActive = activeFleet.length ? (T.days / (activeFleet.length * 30)) * 100 : 0;

// full-season view (May–Oct 2026) for context
const SEASON = ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"];
const seasonByMonth = {};
for (const mo of SEASON) seasonByMonth[mo] = { revenue: 0, deals: 0, days: 0 };
for (const r of primary) {
  const mo = mskMonth(r.agreed_start_date || r.requested_start_date || r.created_at);
  if (!seasonByMonth[mo]) continue;
  const b = byBike.get(r.vehicle_id);
  if (!b) continue;
  const pct = pctByCrew.get(b.car.crew_id ?? null) ?? 50;
  const m = rowMoney(r, b.chat, pct);
  if (m.earns) { seasonByMonth[mo].revenue += m.total; seasonByMonth[mo].deals++; seasonByMonth[mo].days += m.days; }
}

// ── sanity asserts ───────────────────────────────────────────────────────────
ok("every bike row has label", sep.every((x) => typeof x.label === "string" && x.label.length > 0), "label");
ok("rent-days ≤ 30×bikes", T.days <= bikeRows.length * 30, `${T.days} > ${bikeRows.length * 30}`);
ok("revenue = bike+gear", T.revenue === T.bikeSum + T.gearSum, `${T.revenue} vs ${T.bikeSum + T.gearSum}`);
ok("no negative totals", sep.every((x) => x.revenue >= 0), "neg");
ok("partner payout ≤ 50% of bike sum", T.partner <= Math.round(T.bikeSum * 0.5), `${T.partner} vs ${Math.round(T.bikeSum * 0.5)}`);
ok("fleet list matches bikes w/o test flag", bikeRows.length === byBike.size, `${bikeRows.length} vs ${byBike.size}`);
ok("season months present", Object.keys(seasonByMonth).length === SEASON.length, "months");

// ── report ───────────────────────────────────────────────────────────────────
const f = (n) => Math.round(n).toLocaleString("ru-RU").replace(/\u00A0/g, " ");
console.log(`\n═══ FLEET ═══`);
console.log(`bikes total: ${bikeRows.length} (own ${ownFleet.length} / partner ${partnerFleet.length}) — plan: 36 (10/26)`);
console.log(`bikes with ≥1 rental in Sep: ${activeFleet.length}`);
console.log(`partner-marked but NEVER rented in Sep: ${partnerFleet.filter((c) => !sep.find((x) => x.id === c.id && (x.revenue > 0 || x.cancelled > 0))).length}`);

console.log(`\n═══ SEPTEMBER 2026 ACTUAL vs PLAN ═══`);
console.log(`revenue:        ${f(T.revenue)} ₽  (plan revenue base ≈ 8 900 000 ₽ → ${Math.round((T.revenue / 8900000) * 100)}%)`);
console.log(`  мото:         ${f(T.bikeSum)} ₽`);
console.log(`  экип:         ${f(T.gearSum)} ₽`);
console.log(`deals:          ${T.deals}  (plan ~470 → ${Math.round((T.deals / 470) * 100)}%)`);
console.log(`rent-days:      ${f(T.days)}  (plan 702 → ${Math.round((T.days / 702) * 100)}%)`);
console.log(`utilization:    ${util.toFixed(1)}% whole fleet / ${utilActive.toFixed(1)}% among rented  (plan 65%)`);
console.log(`avg rate/day:   ${f(avgRate)} ₽  (plan 12 000)`);
console.log(`avg deal:       ${T.deals ? f(T.revenue / T.deals) : 0} ₽`);
console.log(`cancelled:      ${T.cancelled} deals / ${f(T.cancelledSum)} ₽ not earned`);
console.log(`partner payout: ${f(T.partner)} ₽ (their share of мото)`);

console.log(`\n═══ PER-BIKE SEPTEMBER (desc by revenue) ═══`);
for (const x of sep) {
  const u = (x.days / 30) * 100;
  console.log(`${x.chat ? "[P]" : "[O]"} ${x.label.padEnd(38).slice(0, 38)} rev ${f(x.revenue).padStart(9)} ₽  deals ${String(x.deals).padStart(2)}  days ${String(Math.round(x.days * 10) / 10).padStart(5)}  util ${String(Math.round(u)).padStart(3)}%  cancel ${x.cancelled}${x.cancelled ? ` (${f(x.cancelledSum)} ₽)` : ""}`);
}

console.log(`\n═══ SEASON 2026 BY MONTH (all bikes, earned) ═══`);
for (const mo of SEASON) {
  const s = seasonByMonth[mo];
  console.log(`${mo}: ${f(s.revenue).padStart(10)} ₽  deals ${String(s.deals).padStart(3)}  days ${f(s.days)}`);
}
const seasonTotal = SEASON.reduce((a, mo) => a + seasonByMonth[mo].revenue, 0);
console.log(`season total (May–Oct): ${f(seasonTotal)} ₽`);

// profit estimate: same cost model as instruction §2 (own bike), partner model §2
const opRate = 0.25;
const profitOwn = Math.max(0, T.bikeSum + T.gearSum - (activeFleet.filter((x) => !x.chat).length * 38000) - Math.round((T.bikeSum + T.gearSum) * opRate)); // 38k = ТО+хранение+страховка+мойка per own bike
const profitPartner = (T.bikeSum + T.gearSum) - T.partner - Math.round((T.bikeSum + T.gearSum) * opRate);
console.log(`\n═══ PROFIT MODEL (instruction cost shapes, rough) ═══`);
console.log(`own-bike costs (38k ₽/bike fixed) + operator 25% → rough Sep profit ≈ ${f(profitOwn + profitPartner)} ₽ vs plan 3 137 500 ₽`);

console.log(`\n${assertFails.length ? "ASSERT FAILS:\n" + assertFails.join("\n") : `asserts ok`}`);
