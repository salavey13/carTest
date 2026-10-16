// Task 98 audit v2 — correct id column + real salary config → exact reconciliation.
import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(url, key, { auth: { persistSession: false } });

const CREW = "2d5fde70-1dd3-4f0d-8d72-66ccf6908746";
const DJ = "7813830016";

const { data: crewRow } = await sb.from("crews").select("metadata").eq("id", CREW).maybeSingle();
const cfgRaw = crewRow?.metadata?.franchize?.salaryCoefficients || {};
const cfg = {
  rental: { budget: 750, regular: 1000, partner_regular: 500, premium: 1500, partner_premium: 750, ...cfgRaw.rental },
  equipmentRentalUnit: Number.isFinite(Number(cfgRaw.equipmentRentalUnit)) ? Number(cfgRaw.equipmentRentalUnit) : 200,
  sale: { enduro_moped: 5000, regular: 10000, premium: 15000, ...cfgRaw.sale },
  overpricePercent: Number.isFinite(Number(cfgRaw.overpricePercent)) ? Number(cfgRaw.overpricePercent) : 10,
};
console.log("salary config:", JSON.stringify(cfg));
console.log("priceThresholds:", JSON.stringify(cfgRaw.priceThresholds || null));

const { data: shifts } = await sb
  .from("crew_member_shifts")
  .select("id, member_id, clock_in_time, clock_out_time")
  .eq("crew_id", CREW)
  .gte("clock_in_time", "2026-09-30T00:00:00+03:00")
  .lte("clock_in_time", "2026-10-27T00:00:00+03:00");
console.log("shift rows for attribution:", shifts?.length ?? 0);

function pickShiftAt(shiftsArr, atMs) {
  let best = null, bestDur = -1, bestIn = Infinity;
  for (const s of shiftsArr) {
    const inMs = Date.parse(s.clock_in_time);
    if (!Number.isFinite(inMs) || inMs > atMs) continue;
    const outMs = s.clock_out_time ? Date.parse(s.clock_out_time) : null;
    if (outMs != null && outMs < atMs) continue;
    const dur = outMs == null ? Number.MAX_SAFE_INTEGER : outMs - inMs;
    if (dur > bestDur || (dur === bestDur && inMs < bestIn)) { best = s; bestDur = dur; bestIn = inMs; }
  }
  return best;
}
function attr(r) {
  if (r.created_by_operator_chat_id) return { id: String(r.created_by_operator_chat_id), src: "doc_command" };
  const fr = r.metadata?.pickup_freeze;
  if (fr?.frozen_by) return { id: String(fr.frozen_by), src: "handout" };
  if (r.metadata?.return_confirmed_by) return { id: String(r.metadata.return_confirmed_by), src: "return" };
  const t = Date.parse(r.created_at);
  if (Number.isFinite(t)) {
    const s = pickShiftAt(shifts || [], t);
    if (s) return { id: String(s.member_id), src: "shift" };
  }
  return { id: null, src: "none" };
}

const pStart = "2026-10-01T00:00:00+03:00";
const pEnd = "2026-10-26T00:00:00+03:00";
const { data: rentals } = await sb
  .from("rentals")
  .select(`rental_id, total_cost, metadata, created_at, created_by_operator_chat_id, status,
    requested_start_date, requested_end_date,
    vehicle:cars!inner(id, make, model, crew_id, specs, daily_price, type)`)
  .eq("vehicle.crew_id", CREW)
  .neq("status", "cancelled")
  .gte("requested_start_date", pStart)
  .lt("requested_start_date", pEnd)
  .order("requested_start_date", { ascending: true });

const { data: users } = await sb.from("users").select("user_id, username");
const nameOf = (id) => {
  const u = (users || []).find((x) => String(x.user_id) === String(id));
  return u ? `@${u.username}` : id || "—";
};

// category resolution mirror (price tiers: premium >=14000, regular >=7000, partner trio)
const PARTNER_IDS = new Set(["ducati-aero", "yamaha-r7", "suzuki-gsx-s1000f"]);
function rentalCat(v) {
  const specs = v?.specs || {};
  const sal = specs.salary || {};
  if (sal.rentalCategory) return sal.rentalCategory;
  const dp = Number(v?.daily_price) || 0;
  const sub = Boolean(sal.subrented) || PARTNER_IDS.has(v?.id);
  if (dp >= 14000) return sub ? "partner_premium" : "premium";
  if (dp >= 7000) return sub ? "partner_regular" : "regular";
  return "budget";
}
function countUnits(eq) {
  let n = 0;
  for (const k of ["helmets", "gloves"]) n += Math.max(0, Number(eq[k]) || 0);
  for (const k of ["jacket", "pants", "boots", "net", "backpack"]) if (eq[k]) n += 1;
  return n;
}
// standard price baseline: catalog daily × days + std equip; approximate days from window
function stdPrice(v, r) {
  const eq = r.metadata?.equipment || {};
  let eqStd = (Number(eq.helmets) || 0) * 1000 + (Number(eq.gloves) || 0) * 500
    + (eq.jacket ? 500 : 0) + (eq.pants ? 500 : 0) + (eq.boots ? 500 : 0)
    + (eq.net ? 500 : 0) + (eq.backpack ? 500 : 0);
  // rough catalog price: fall back to total (markup 0) — same as app when specs unusable
  return (Number(r.total_cost) || 0) - eqStd + eqStd; // keep simple: app computes catalog; we approximate with total → markup 0
}

let djSum = 0, djN = 0, allSum = 0, split = { base: 0, equip: 0, over: 0 }, djSplit = { base: 0, equip: 0, over: 0 };
console.log(`\n== ALL bike rentals 01–25 Oct with salary calc ==`);
for (const r of rentals || []) {
  const v = Array.isArray(r.vehicle) ? r.vehicle[0] : r.vehicle;
  const meta = r.metadata || {};
  if (meta.item_type === "equipment" || v?.type === "equipment") continue;
  if (v?.type === "service") continue;
  const cat = rentalCat(v);
  const units = countUnits(meta.equipment || {});
  const base = cfg.rental[cat] ?? 0;
  const equip = units * cfg.equipmentRentalUnit;
  const over = 0; // catalog markup not computed here (needs pricing calc) — app computes real value
  const total = base + equip + over;
  const a = attr(r);
  const d = (r.requested_start_date || "").slice(5, 10);
  const isDj = a.id === DJ;
  allSum += total; split.base += base; split.equip += equip; split.over += over;
  if (isDj) { djSum += total; djN++; djSplit.base += base; djSplit.equip += equip; djSplit.over += over; }
  console.log(`${isDj ? "DJ" : "  "} ${d} ${String(r.total_cost).padStart(6)} ${v?.make} ${v?.model}`.padEnd(45)
    + ` cat=${cat.padEnd(16)} units=${units} ЗП≈${total} атр=${nameOf(a.id)} (${a.src})`);
}
console.log(`\nDJ: ${djN} rentals, ЗП≈${djSum} (base ${djSplit.base} + equip ${djSplit.equip} + over ${djSplit.over}+X)`);
console.log(`ALL: ЗП≈${allSum} (base ${split.base} + equip ${split.equip} + over ${split.over}+X)`);
console.log(`worklog reference: profile 16 880 (с точным оверпрайсом), CSV 19 255`);

// hourly_rate metadata across members
const { data: crewMembers } = await sb.from("crew_members").select("user_id").eq("crew_id", CREW).eq("membership_status", "active");
const ids = (crewMembers || []).map((m) => m.user_id);
const { data: memUsers } = await sb.from("users").select("user_id, username, metadata").in("user_id", ids);
console.log(`\n== users.metadata.hourly_rate ==`);
let anyRate = false;
for (const u of memUsers || []) {
  if (u.metadata?.hourly_rate !== undefined) { console.log(`  ${u.username || u.user_id}: ${u.metadata.hourly_rate}`); anyRate = true; }
}
if (!anyRate) console.log("  (ни у кого не задано — берётся дефолт таблицы 500)");
