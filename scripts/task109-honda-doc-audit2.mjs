// task109 part 2: full rows for honda rental + the two "the-meta" ghost rows
// READ-ONLY. node --env-file=.env.local scripts/task109-honda-doc-audit2.mjs
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);
const fmt = (o) => JSON.stringify(o, null, 2);

// 1. full honda rental row + the two ghost rows
const ids = ['b24dd324-b3e8-4bd5-8397-f5e6a9bb2b2f', 'df6e0946-f05b-4633-99de-004f9a39b8b8', '91df1f18-8760-4bc7-895c-69b994b21f1e'];
const { data: rows, error } = await sb.from('rentals').select('*').in('rental_id', ids);
console.log('=== FULL RENTAL ROWS ===', error ? fmt(error) : '');
for (const r of rows || []) console.log(fmt(r));

// 2. what is "the-meta..." — full vehicle_id of ghosts + any car matching
const ghosts = (rows || []).filter((r) => !ids.includes(r.rental_id) || r.vehicle_id?.startsWith('the-meta'));
for (const g of ghosts) console.log('GHOST vehicle_id full:', JSON.stringify(g.vehicle_id));
const ghostVids = [...new Set((rows || []).map((r) => r.vehicle_id).filter((v) => v && v.startsWith('the-meta')))];
if (ghostVids.length) {
  const { data: cars, error: carErr } = await sb.from('cars').select('id, make, model, type, crew_id').in('id', ghostVids);
  console.log('=== CARS matching ghost vehicle_id ===', carErr ? fmt(carErr) : '');
  for (const c of cars || []) console.log(fmt(c));
  if (!cars?.length) console.log('!!! NO car with id in', ghostVids, '— vehicle_id points to NOTHING');
}

// 3. artifacts in PRIVATE schema for honda + ghosts
const { data: arts, error: artErr } = await sb
  .schema('private')
  .from('rental_contract_artifacts')
  .select('*')
  .gte('created_at', '2026-10-17T00:00:00Z')
  .order('created_at', { ascending: false })
  .limit(10);
console.log('\n=== PRIVATE rental_contract_artifacts since Oct 17 ===', artErr ? fmt(artErr) : '');
for (const a of arts || []) {
  console.log(fmt({
    id: a.id, contract_key: a.contract_key, created_at: a.created_at,
    requested_bike_id: a.requested_bike_id, resolved_bike_id: a.resolved_bike_id,
    rental_id: a.rental_id, storage_path: a.storage_path,
    renter: a.renter_full_name, start: a.rent_start_date,
  }));
}

// 4. ALL ghost-like rentals (vehicle_id not matching any car id) — is this pattern wider?
const { data: recent, error: recErr } = await sb
  .from('rentals')
  .select('rental_id, vehicle_id, status, total_cost, created_at, metadata')
  .gte('created_at', '2026-10-10T00:00:00Z')
  .order('created_at', { ascending: false })
  .limit(60);
console.log('\n=== ALL rentals since Oct 10: vehicle_id vs cars ===', recErr ? fmt(recErr) : '');
const vids = [...new Set((recent || []).map((r) => r.vehicle_id).filter(Boolean))];
const { data: allCars } = await sb.from('cars').select('id').in('id', vids);
const known = new Set((allCars || []).map((c) => c.id));
for (const r of recent || []) {
  const ghost = r.vehicle_id && !known.has(r.vehicle_id);
  console.log(`${ghost ? '👻 GHOST' : '  ok   '} ${r.rental_id} ${r.status} v=${r.vehicle_id} cost=${r.total_cost} ${r.created_at} src=${r.metadata?.source || ''}`);
}

// 5. deposit_entries for honda (columns: check what exists — try common names)
const { data: deps, error: depErr } = await sb
  .from('deposit_entries')
  .select('*')
  .gte('created_at', '2026-10-17T00:00:00Z')
  .order('created_at', { ascending: false })
  .limit(10);
console.log('\n=== DEPOSIT_ENTRIES since Oct 17 ===', depErr ? fmt(depErr) : '');
for (const d of deps || []) console.log(fmt({ id: d.id, rental_id: d.rental_id, amount: d.amount, kind: d.kind || d.type, created_at: d.created_at, meta: d.metadata }));
