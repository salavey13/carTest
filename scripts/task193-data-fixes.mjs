// task193 data fixes — INSPECT phase (no writes):
//   1. cbr600rr rental ~2026-09-11 (boss: price shows 27500, actual 7500,
//      20k wrongly added as deposit)
//   2. falcon-lynx rentals on 2026-09-09 (boss: «2 incorrect falcon-lynx
//      rentals — ditch'em»)
// Prints full rows for the fix decision. Run: node scripts/task193-data-fixes.mjs
const SUPABASE_URL = "https://inmctohsodgdohamhzag.supabase.co";
const { readFileSync } = await import("node:fs");
const secrets = readFileSync("/home/z/my-project/upload/secrets_all.txt", "utf8");
const SRK = secrets.split("\n").find((l) => l.startsWith("SUPABASE_SERVICE_ROLE_KEY="))?.split("=").slice(1).join("=");
if (!SRK) { console.error("NO SERVICE KEY"); process.exit(2); }
const HDR = { apikey: SRK, Authorization: `Bearer ${SRK}`, "Accept-Type": "application/json", "Content-Type": "application/json", Accept: "application/json" };
const q = async (path) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: HDR });
  if (!res.ok) { console.error(path, res.status, (await res.text()).slice(0, 300)); return []; }
  return res.json();
};

const metaPick = (m) => m && typeof m === "object"
  ? Object.fromEntries(["deposit_amount", "deposit_method", "deposit_returned", "payment_split", "renter_name", "renter_phone", "free_rental_reason", "odometer_before", "odometer_after", "created_at_ts"].map((k) => [k, m[k]]))
  : m;

// 1) cbr600rr — everything around 10-12 sep
const cbr = await q("rentals?select=rental_id,status,total_cost,deposit_amount,deposit_returned,metadata,requested_start_date,agreed_start_date,agreed_end_date,created_at,vehicle_id,owner_id,crew_id&vehicle_id=eq.honda-cbr600rr-2003&or=(agreed_start_date.gte.2026-09-10,agreed_start_date.lte.2026-09-12,requested_start_date.gte.2026-09-10,requested_start_date.lte.2026-09-12,created_at.gte.2026-09-10T00:00:00,created_at.lte.2026-09-12T23:59:59)");
console.log("=== CBR600RR rows around 10-12 Sep:", cbr.length, "===");
for (const r of cbr) console.log(JSON.stringify({ ...r, metadata: metaPick(r.metadata) }, null, 1));

// 2) falcon-lynx — 9 sep (agreed/requested exact + a wide created_at net)
const lynx = await q("rentals?select=rental_id,status,total_cost,deposit_amount,deposit_returned,metadata,requested_start_date,agreed_start_date,agreed_end_date,created_at,vehicle_id,owner_id,crew_id&vehicle_id=eq.falcon-lynx-purple&or=(agreed_start_date.eq.2026-09-09,requested_start_date.eq.2026-09-09)");
console.log("\n=== FALCON-LYNX rows on 9 Sep:", lynx.length, "===");
for (const r of lynx) console.log(JSON.stringify({ ...r, metadata: metaPick(r.metadata) }, null, 1));
// broaden: created_at around 9 sep too (dates sometimes lag)
const lynx2 = await q("rentals?select=rental_id,status,total_cost,deposit_amount,metadata,requested_start_date,agreed_start_date,created_at,vehicle_id&vehicle_id=eq.falcon-lynx-purple&or=(created_at.gte.2026-09-08T00:00:00,created_at.lte.2026-09-11T23:59:59)");
console.log("\n=== FALCON-LYNX created 8-11 Sep:", lynx2.length, "===");
for (const r of lynx2) console.log(JSON.stringify({ ...r, metadata: metaPick(r.metadata) }, null, 1));
