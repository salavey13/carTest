// Task 87 step 1: find Honda CBR 600 RR rental + Aprilia Shiver car (vip-bike)
const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const h = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

async function q(table, params) {
  const u = new URL(`${BASE}/rest/v1/${table}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const r = await fetch(u, { headers: h });
  const t = await r.text();
  if (!r.ok) { console.error(`${table} ERR ${r.status}:`, t.slice(0, 300)); return []; }
  return JSON.parse(t);
}

// 1) cars like cbr / aprilia in vip-bike
const crew = await q("crews", { slug: "eq.vip-bike", select: "id,slug,name" });
const crewId = crew[0]?.id;
console.log("crew:", crewId);
const cars = await q("cars", {
  crew_id: `eq.${crewId}`,
  select: "id,make,model,year,status,daily_price,odometer",
});
const interesting = (cars ?? []).filter((c) => {
  const s = `${c.make ?? ""} ${c.model ?? ""}`.toLowerCase();
  return s.includes("cbr") || s.includes("aprilia") || s.includes("shiver");
});
console.log("interesting cars:", JSON.stringify(interesting, null, 1));

// 2) recent rentals for those car ids
const ids = interesting.map((c) => c.id);
if (ids.length) {
  const rentals = await q("rentals", {
    vehicle_id: `in.(${ids.join(",")})`,
    order: "created_at.desc",
    limit: 20,
    select: "*",
  });
  console.log(`rentals: ${rentals.length}`);
  for (const r of rentals) {
    console.log(JSON.stringify({
      id: r.id, vehicle_id: r.vehicle_id, status: r.status,
      user_id: r.user_id, start: r.start_date ?? r.start_time ?? r.started_at, end: r.end_date ?? r.end_time ?? r.ended_at,
      odo_start: r.odometer_start ?? r.start_odometer, odo_end: r.odometer_end ?? r.end_odometer,
      total_cost: r.total_cost, created_at: r.created_at,
    }));
  }
}
