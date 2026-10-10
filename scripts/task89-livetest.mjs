// Task 89 part 3: live-test the EXACT PostgREST queries the C# agent makes
// run: node --env-file=.env.local scripts/task89-livetest.mjs
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const CREW = '2d5fde70-1dd3-4f0d-8d72-66ccf6908746';

async function get(path) {
  const r = await fetch(`${URL}/rest/v1/${path}`, { headers: H });
  const body = await r.text();
  if (!r.ok) return { status: r.status, body: body.slice(0, 300) };
  return { status: r.status, json: JSON.parse(body) };
}

// 1) car by id (CheckAvailabilityAsync step 1) — falcon-lynx-purple (has agent's pending row)
console.log('T1 car-by-id:', JSON.stringify(
  await get(`cars?id=eq.falcon-lynx-purple&select=id,make,model,daily_price,quantity,owner_id,crew_id,type`)));

// 2) overlap query exactly as C# builds it — Kawasaki (currently ACTIVE rental 09.10→11.10 15:00Z)
const endIso = encodeURIComponent('2026-10-12T00:00:00Z');
const startIso = encodeURIComponent('2026-10-11T00:00:00Z');
console.log('T2 kawasaki overlap:', JSON.stringify(
  await get(`rentals?vehicle_id=eq.kawasaki-ex650k&status=not.in.(cancelled,completed)&requested_start_date=lte.${endIso}&requested_end_date=gte.${startIso}&select=rental_id,status,requested_start_date,requested_end_date`)));

// 3) ListFreeCarsAsync WITHOUT crew filter (what happened when env was missing)
const all = await get(`cars?select=id,type&crew_id=`); // empty filter → actually invalid; emulate full list
const allCars = await get(`cars?select=id,type`);
console.log('T3 ALL cars (no crew filter): count =', allCars.json?.length, 'crews-affected');

// 4) with crew filter — current behavior (no type filter → equipment leak)
const crewCars = await get(`cars?select=id,type,quantity&crew_id=eq.${CREW}`);
const byType = {};
for (const c of crewCars.json) byType[c.type] = (byType[c.type] || 0) + 1;
console.log('T4 crew cars count:', crewCars.json?.length, 'byType:', JSON.stringify(byType));

// 5) is_test_result rows in vip-bike (would agent offer test artifacts?)
const tests = await get(`cars?select=id,type&crew_id=eq.${CREW}&is_test_result=eq.true`);
console.log('T5 is_test_result rows:', tests.json?.length, JSON.stringify(tests.json?.slice(0, 5)));

// 6) hidden bikes reachable by agent?
const hidden = await get(`cars?select=id,type,specs->>hidden&crew_id=eq.${CREW}&specs->>hidden=eq.true`);
console.log('T6 hidden cars:', hidden.json?.length, JSON.stringify(hidden.json?.map(c => c.id)));

// 7) avito user rows created by agent's upsert
console.log('T7 avito users:', JSON.stringify(
  await get(`users?user_id=like.avito_*&select=user_id,language_code,created_at`)));

// 8) PostgREST datetime format sanity: does "Z"-suffix filter work on timestamptz?
console.log('T8 status not.in syntax check:', JSON.stringify(
  await get(`rentals?status=not.in.(cancelled,completed)&select=rental_id,vehicle_id,status&limit=3`)));
