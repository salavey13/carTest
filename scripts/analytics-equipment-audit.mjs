// Analytics equipment double-counting audit (2026-09-13 request).
// Pulls the day-page rentals for vip-bike (same union the dashboard uses),
// replicates computeAnalyticsKpis() EXACTLY, prints per-row money split and
// flags potential double-counting (bundled gear + standalone gear rows).
//
// Run: node scripts/analytics-equipment-audit.mjs [YYYY-MM-DD ...]
// Defaults to MSK yesterday + today.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

// ── env (same source the app uses) ─────────────────────────────────────────
const envText = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = Object.fromEntries(
  envText.split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#")).map((l) => {
    const i = l.indexOf("=");
    return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
  }),
);
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// ── MSK day helpers (mirror analytics-utils localDateOnly) ────────────────
const mskDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString("en-CA", { timeZone: "Europe/Moscow" }) : null;
const dayWindowUtc = (dateStr) => {
  // MSK midnight → UTC ISO
  const start = new Date(`${dateStr}T00:00:00+03:00`);
  const end = new Date(start.getTime() + 24 * 3600 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
};

// ── money math copied from rental-price-split / subrenter-economics ────────
const UNIT_PRICES = { helmets: 1000, gloves: 500, jacket: 500, pants: 500, boots: 500, net: 500, bag: 500, backpack: 500, charger: 0 };
const FALLBACK = 500;
const toNum = (v) => (typeof v === "number" ? (Number.isFinite(v) ? v : 0) : 0);
const isEquipmentOnly = (m) => m?.item_type === "equipment";
const storedEquip = (m) => {
  const raw = m?.equipment_price;
  const v = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() !== "" ? Number(raw) : NaN;
  return Number.isFinite(v) && v >= 0 ? v : null;
};
const estimateEquip = (m) => {
  const eq = m?.equipment;
  if (!eq || typeof eq !== "object") return 0;
  let total = 0;
  for (const [k, v] of Object.entries(eq)) {
    if (k.endsWith("_gift")) continue;
    if (eq[`${k}_gift`] === true) continue;
    const qty = typeof v === "number" && v > 0 ? v : v === true ? 1 : 0;
    total += (UNIT_PRICES[k] ?? FALLBACK) * qty;
  }
  return total;
};
const equipmentPart = (m, totalCost) => {
  const total = Math.max(0, toNum(totalCost));
  if (isEquipmentOnly(m)) return total > 0 ? total : 0;
  const stored = storedEquip(m);
  if (stored != null) return Math.min(Math.round(stored), total);
  return Math.min(estimateEquip(m), total);
};
const equipmentPartOf = (rows) => rows.reduce((s, r) => s + equipmentPart(r.metadata, r.total_cost), 0);

// ── args: dates to audit ───────────────────────────────────────────────────
const dates = process.argv.slice(2).length
  ? process.argv.slice(2)
  : (() => {
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Moscow" });
      const y = new Date(new Date(`${today}T12:00:00+03:00`).getTime() - 24 * 3600 * 1000)
        .toLocaleDateString("en-CA", { timeZone: "Europe/Moscow" });
      return [y, today];
    })();

// ── crew ───────────────────────────────────────────────────────────────────
const { data: crew } = await supabase.from("crews").select("id,name,slug").eq("slug", "vip-bike").single();
if (!crew) { console.error("crew vip-bike not found"); process.exit(1); }
console.log(`CREW ${crew.slug} (${crew.name}) id=${crew.id}`);

// model name: prefer embedded vehicle, fallback to cars lookup
const { data: bikes } = await supabase.from("cars").select("id,make_model,title,specs").eq("crew_id", crew.id);
const bikeName = (r) => {
  const v = r.vehicle;
  if (v) return v.make_model || v.title || v.id;
  const b = (bikes || []).find((x) => x.id === r.vehicle_id);
  return b ? (b.make_model || b.title || r.vehicle_id) : String(r.vehicle_id || "—").slice(0, 24);
};

for (const date of dates) {
  const { start, end } = dayWindowUtc(date);
  // same union as getRentalsDashboard day queries (crew scope via vehicle.crew_id);
  // vehicle embed MUST be in select for the nested filter to exist
  const sel = "rental_id,status,total_cost,vehicle_id,user_id,created_at,requested_start_date,requested_end_date,agreed_start_date,agreed_end_date,metadata,vehicle:cars!inner(id,make,model)";
  const [byReqStart, byAgreedStartLegacy, byEnd] = await Promise.all([
    supabase.from("rentals").select(sel).eq("vehicle.crew_id", crew.id).gte("requested_start_date", start).lte("requested_start_date", end),
    supabase.from("rentals").select(sel).eq("vehicle.crew_id", crew.id).gte("agreed_start_date", start).lte("agreed_start_date", end).is("requested_start_date", null),
    supabase.from("rentals").select(sel).eq("vehicle.crew_id", crew.id).or(`and(agreed_end_date.gte.${start},agreed_end_date.lte.${end}),and(requested_end_date.gte.${start},requested_end_date.lte.${end})`).neq("status", "cancelled"),
  ]);
  const map = new Map();
  for (const [label, res] of [["byReqStart", byReqStart], ["legacy", byAgreedStartLegacy], ["byEnd", byEnd]]) {
    if (res.error) console.error(`  [query ${label}] ERROR:`, res.error.message, res.error.details ?? "", res.error.hint ?? "");
    for (const r of res.data || []) map.set(r.rental_id, r);
  }
  const rows = [...map.values()];

  console.log(`\n═══ DAY ${date} (MSK) — ${rows.length} day-page rows ═══`);
  console.log("rental_id                        | created_at (MSK)     | status               | item       | source                | total | eq_price | bike_price | bike / renter");
  for (const r of rows.sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""))) {
    const m = r.metadata || {};
    const linked = Boolean(m.primary_rental_id);
    const kind = isEquipmentOnly(m) ? (linked ? "EQ-LINKED" : "EQ-STANDALONE") : "bike+gear ";
    console.log(
      `${r.rental_id.slice(0, 8)} | ${r.created_at ? r.created_at.slice(0, 16) : "null"} | ${String(r.status).padEnd(20)} | ${kind} | ${String(m.source ?? "—").padEnd(21)} | ${String(toNum(r.total_cost)).padStart(5)} | ${String(storedEquip(m) ?? "—").padStart(8)} | ${String(m.bike_price ?? "—").padStart(10)} | ${bikeName(r)} / ${m.renter_name || r.user_id}`,
    );
  }

  // ── KPI replication (computeAnalyticsKpis) ──
  const real = rows.filter((r) => String(r.status ?? "") !== "cancelled");
  const started = real.filter((r) => mskDate(r.requested_start_date || r.agreed_start_date) === date);
  const revenueRows = started.filter((r) => ["active", "completed", "confirmed", "pending_confirmation"].includes(String(r.status ?? "")));
  const revenue = revenueRows.reduce((s, r) => s + (toNum(r.total_cost) || 0), 0);
  const equipPart = revenueRows.reduce((s, r) => s + equipmentPart(r.metadata, r.total_cost), 0);
  const standaloneGear = revenueRows.filter((r) => isEquipmentOnly(r.metadata));
  const gearInBikeRows = revenueRows.filter((r) => !isEquipmentOnly(r.metadata) && equipmentPart(r.metadata, r.total_cost) > 0);
  const returns = real.filter((r) => mskDate(r.agreed_end_date || r.requested_end_date) === date);

  const linkedGearRows = standaloneGear.filter((r) => r.metadata?.primary_rental_id);
  const trueGearRows = standaloneGear.filter((r) => !r.metadata?.primary_rental_id);
  const linkedGearSum = linkedGearRows.reduce((s, r) => s + toNum(r.total_cost), 0);
  const trueGearSum = trueGearRows.reduce((s, r) => s + toNum(r.total_cost), 0);

  console.log(`\n── KPI as the page computes them ──`);
  console.log(`Аренд сегодня : ${started.length}`);
  console.log(`Выручка       : ${revenue.toLocaleString("ru-RU")} ₽`);
  console.log(`Экипировка    : ${equipPart.toLocaleString("ru-RU")} ₽  (EQ-LINKED rows: ${linkedGearRows.length} = ${linkedGearSum} ₽; true standalone: ${trueGearRows.length} = ${trueGearSum} ₽; bundled-in-bike: ${gearInBikeRows.length} rows, gear part ${gearInBikeRows.reduce((s, r) => s + equipmentPart(r.metadata, r.total_cost), 0)} ₽)`);
  console.log(`Возвратов     : ${returns.length}`);

  // ── CORRECT totals: linked gear rows are INVENTORY (money already inside
  // the primary bike rental's total) → they must add ZERO revenue ──
  const realRevenue = revenue - linkedGearSum;
  const realEquipPart = equipmentPartOf(revenueRows.filter((r) => !(isEquipmentOnly(r.metadata) && r.metadata?.primary_rental_id)));
  console.log(`\n── CORRECT totals (linked gear rows excluded from money) ──`);
  console.log(`Выручка верная  : ${realRevenue.toLocaleString("ru-RU")} ₽  (page overstates by ${linkedGearSum.toLocaleString("ru-RU")} ₽)`);
  console.log(`Экипировка верная: ${realEquipPart.toLocaleString("ru-RU")} ₽`);
  const mskNow = new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow" });
  console.log(`(audit run at ${mskNow} MSK)`);

  // ── double-count probe: same client (user_id) has BOTH a bike rental with
  // gear money AND standalone gear rows on the same day ──
  const bikeRowsByUser = new Map();
  for (const r of gearInBikeRows) {
    const k = r.user_id;
    bikeRowsByUser.set(k, (bikeRowsByUser.get(k) || 0) + equipmentPart(r.metadata, r.total_cost));
  }
  let flagged = 0;
  for (const r of standaloneGear) {
    const bundled = bikeRowsByUser.get(r.user_id) || 0;
    if (bundled > 0) {
      flagged++;
      console.log(`  ⚠ DOUBLE-COUNT CANDIDATE: standalone gear row ${r.rental_id.slice(0, 8)} (${toNum(r.total_cost)} ₽) for user ${r.user_id} whose bike rental(s) already carry ${bundled} ₽ of gear money`);
    }
  }
  if (!flagged) console.log(`  (no same-user bike+standalone gear overlap on this day)`);
}
process.exit(0);
