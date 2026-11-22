// Task 81 diagnosis:
// 1) Equipment rentals (vip-bike): shapes, total_cost distribution, metadata
//    price inputs, pre/post 12.09 pattern — to pin the CSV re-price formula.
// 2) Sales of y-volt-surge-v ~69k — find the fake sale + its money trail.
// Run: node --env-file=.env.local scripts/task81-diagnose.mjs
import { createClient } from "/home/z/cartest/node_modules/@supabase/supabase-js/dist/main/index.js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const crewSlug = "vip-bike";
const { data: crew } = await sb.from("crews").select("id, slug").eq("slug", crewSlug).maybeSingle();
if (!crew) { console.log("NO CREW"); process.exit(1); }
console.log(`crew=${crew.id}`);

// ── 1. Equipment rentals ────────────────────────────────────────────────────
const { data: eqCars, error: eqErr } = await sb.from("cars")
  .select("id, make, model, type, daily_price, specs")
  .eq("crew_id", crew.id).eq("type", "equipment");
if (eqErr) { console.log("eqCars err:", eqErr.message); }
const eqIds = (eqCars || []).map((c) => c.id);
console.log(`equipment catalog items: ${eqIds.length}`);
for (const c of eqCars || []) {
  console.log(`  - ${c.make} ${c.model} daily=${c.daily_price} cat=${c.specs?.category || "?"} id=${c.id}`);
}

const fromIso = "2026-08-01T00:00:00+03:00";
const toIso = "2026-10-08T23:59:59+03:00";
const { data: rentals, error: rErr } = await sb.from("rentals")
  .select("rental_id, status, total_cost, requested_start_date, requested_end_date, agreed_start_date, agreed_end_date, metadata, created_at, vehicle_id")
  .eq("crew_id", crew.id)
  .in("vehicle_id", eqIds.length ? eqIds : ["__none__"])
  .gte("requested_start_date", fromIso)
  .lte("requested_start_date", toIso)
  .neq("status", "cancelled")
  .order("requested_start_date", { ascending: true });
if (rErr) { console.log("rentals err:", rErr.message); process.exit(1); }

const rows = rentals || [];
console.log(`\nequipment rental rows 01.08–08.10: ${rows.length}`);
const linked = rows.filter((r) => r.metadata?.primary_rental_id);
const standalone = rows.filter((r) => !r.metadata?.primary_rental_id);
const zero = rows.filter((r) => Number(r.total_cost || 0) === 0);
const nonzero = rows.filter((r) => Number(r.total_cost || 0) > 0);
const before = rows.filter((r) => new Date(r.requested_start_date) < new Date("2026-09-12T00:00:00+03:00"));
const after = rows.filter((r) => new Date(r.requested_start_date) >= new Date("2026-09-12T00:00:00+03:00"));
console.log(`linked(mirror)=${linked.length} standalone=${standalone.length} zeroCost=${zero.length} nonzeroCost=${nonzero.length} before12.09=${before.length} after=${after.length}`);
console.log(`Σ stored cost = ${rows.reduce((s, r) => s + Number(r.total_cost || 0), 0)}`);

// Cross pattern: linked/standalone × before/after × zero/nonzero
const key = (r) => `${r.metadata?.primary_rental_id ? "linked" : "standalone"}|${new Date(r.requested_start_date) < new Date("2026-09-12T00:00:00+03:00") ? "pre" : "post"}|cost${Number(r.total_cost || 0) > 0 ? ">" : "="}0`;
const buckets = {};
for (const r of rows) { const k = key(r); buckets[k] = (buckets[k] || 0) + 1; }
console.log("\nbuckets (kind|period|cost):");
for (const [k, v] of Object.entries(buckets).sort()) console.log(`  ${k}: ${v}`);

// Metadata coverage for pricing inputs
const hasDaily = rows.filter((r) => Number(r.metadata?.daily_price) > 0).length;
const hasItems = rows.filter((r) => Array.isArray(r.metadata?.equipment_items) && r.metadata.equipment_items.length > 0).length;
const hasQty = rows.filter((r) => Number(r.metadata?.quantity) > 0).length;
const hasTitle = rows.filter((r) => typeof r.metadata?.equipment_title === "string" && r.metadata.equipment_title.trim()).length;
const noEnd = rows.filter((r) => !r.requested_end_date && !r.agreed_end_date).length;
console.log(`\nmeta coverage: daily_price=${hasDaily} equipment_items=${hasItems} quantity=${hasQty} equipment_title=${hasTitle} noEnd=${noEnd}`);

// Sources of zero rows
const zeroSources = {};
for (const r of zero) { const s = r.metadata?.source || "?"; zeroSources[s] = (zeroSources[s] || 0) + 1; }
console.log("zero-cost row sources:", JSON.stringify(zeroSources));
const nzSources = {};
for (const r of nonzero) { const s = r.metadata?.source || "?"; nzSources[s] = (nzSources[s] || 0) + 1; }
console.log("nonzero-cost row sources:", JSON.stringify(nzSources));

// Samples: pre-12.09 nonzero — stored vs daily_price×days (check convention)
console.log("\n── SAMPLES pre-12.09 nonzero (stored vs daily×days) ──");
for (const r of before.filter((x) => Number(x.total_cost || 0) > 0).slice(0, 8)) {
  const st = r.requested_start_date, en = r.requested_end_date;
  const hours = st && en ? (new Date(en) - new Date(st)) / 36e5 : null;
  const days = hours != null ? Math.max(1, Math.ceil(hours / 24)) : null;
  console.log(`  ${r.rental_id?.slice(0, 8)} ${st?.slice(0, 16)} h=${hours != null ? hours.toFixed(1) : "?"} d=${days} cost=${r.total_cost} daily=${r.metadata?.daily_price} dailyXd=${days ? (Number(r.metadata?.daily_price || 0) * days) : "?"} src=${r.metadata?.source} linked=${!!r.metadata?.primary_rental_id}`);
}
// Samples: post-12.09 zero
console.log("── SAMPLES post-12.09 zero ──");
for (const r of after.filter((x) => Number(x.total_cost || 0) === 0).slice(0, 10)) {
  const st = r.requested_start_date, en = r.requested_end_date;
  const hours = st && en ? (new Date(en) - new Date(st)) / 36e5 : null;
  console.log(`  ${r.rental_id?.slice(0, 8)} ${st?.slice(0, 16)} h=${hours != null ? hours.toFixed(1) : "?"} daily=${r.metadata?.daily_price} items=${JSON.stringify(r.metadata?.equipment_items || null)?.slice(0, 90)} qty=${r.metadata?.quantity} src=${r.metadata?.source} linked=${!!r.metadata?.primary_rental_id} title=${r.metadata?.equipment_title}`);
}
// Any post-12.09 NONZERO (would contradict)?
const postNz = after.filter((x) => Number(x.total_cost || 0) > 0);
console.log(`post-12.09 nonzero rows: ${postNz.length}`);
for (const r of postNz.slice(0, 5)) {
  console.log(`  ${r.rental_id?.slice(0, 8)} cost=${r.total_cost} src=${r.metadata?.source} linked=${!!r.metadata?.primary_rental_id}`);
}

// ── 2. Sales of y-volt-surge-v ──────────────────────────────────────────────
console.log("\n── SALES: y-volt surge ──");
const { data: yvolt, error: yErr } = await sb.from("cars")
  .select("id, make, model, crew_id, type")
  .or("slug.ilike.%y-volt-surge-v%,model.ilike.%surge%,make.ilike.%y-volt%");
if (yErr) console.log("yvolt search err:", yErr.message);
for (const c of yvolt || []) console.log(`  car id=${c.id} ${c.make} ${c.model} crew=${c.crew_id} type=${c.type}`);

// try slug column if exists
const { data: bySlug, error: sErr } = await sb.from("cars").select("id, make, model, crew_id").eq("slug", "y-volt-surge-v").maybeSingle();
if (sErr) console.log("(no slug col or err:", sErr.message, ")");
if (bySlug) console.log(`  bySlug id=${bySlug.id} ${bySlug.make} ${bySlug.model} crew=${bySlug.crew_id}`);

const candidates = (bySlug ? [bySlug] : (yvolt || []));
for (const car of candidates) {
  const { data: sales, error } = await sb.schema("private").from("sale_contract_artifacts")
    .select("id, buyer_full_name, sale_price, created_at, resolved_bike_id, telegram_chat_id, status")
    .eq("resolved_bike_id", car.id)
    .order("created_at", { ascending: false }).limit(20);
  if (error) { console.log("  sales err:", error.message); continue; }
  console.log(`  car ${car.make} ${car.model}: ${sales?.length || 0} sales (latest 20)`);
  for (const s of sales || []) console.log(`    id=${s.id} price=${s.sale_price} at=${s.created_at} buyer=${s.buyer_full_name} tg=${s.telegram_chat_id} status=${s.status}`);
}
