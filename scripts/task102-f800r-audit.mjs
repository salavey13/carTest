// task102: audit bmw-f800r rental from today (2026-10-17) — /doc regression
// READ-ONLY. node --env-file=.env.local scripts/task102-f800r-audit.mjs
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const fmt = (o) => JSON.stringify(o, null, 2);

// 1. find bmw-f800r bike
const { data: bikes, error: bikeErr } = await sb
  .from('cars')
  .select('id, make, model, crew_id, owner_id, type')
  .ilike('model', '%f800%');
console.log('=== CARS (f800) ===', bikeErr ? fmt(bikeErr) : '');
for (const b of bikes || []) console.log(b.id, `${b.make} ${b.model}`, 'type:', b.type, 'crew:', b.crew_id, 'owner:', b.owner_id);

const bikeIds = (bikes || []).map((b) => b.id);

// 2. rentals for these bikes in last 3 days
if (bikeIds.length) {
  const { data: rents, error: rentErr } = await sb
    .from('rentals')
    .select('*')
    .in('vehicle_id', bikeIds)
    .gte('created_at', '2026-10-15T00:00:00Z')
    .order('created_at', { ascending: false });
  console.log('\n=== RENTALS since Oct 15 (f800) ===', rentErr ? fmt(rentErr) : '');
  for (const r of rents || []) {
    console.log(fmt({
      rental_id: r.rental_id, status: r.status, crew_id: r.crew_id, user_id: r.user_id,
      vehicle_id: r.vehicle_id, total_cost: r.total_cost, created_at: r.created_at,
      agreed_start_date: r.agreed_start_date, agreed_end_date: r.agreed_end_date,
      metadata_source: r.metadata?.source, renter: r.metadata?.renter_name,
      operator: r.metadata?.created_by_operator_chat_id || r.created_by_operator_chat_id,
    }));
  }
  if (!rents?.length) console.log('!!! NO RENTALS for f800 since Oct 15');
}

// 3. recent rental_contract_artifacts (any bike) since Oct 16 — /doc generates artifact
const { data: arts, error: artErr } = await sb
  .from('rental_contract_artifacts')
  .select('*')
  .gte('created_at', '2026-10-16T00:00:00Z')
  .order('created_at', { ascending: false })
  .limit(20);
console.log('\n=== RENTAL ARTIFACTS since Oct 16 (all) ===', artErr ? fmt(artErr) : '');
for (const a of arts || []) {
  console.log(fmt({
    id: a.id, contract_key: a.contract_key, vehicle_id: a.vehicle_id, rental_id: a.rental_id,
    flow_type: a.flow_type, storage_path: a.storage_path, created_by: a.created_by_chat_id,
    created_at: a.created_at,
  }));
}

// 4. all rentals created since Oct 16 (any bike)
const { data: allRents, error: allErr } = await sb
  .from('rentals')
  .select('rental_id, status, vehicle_id, total_cost, created_at, crew_id, user_id, metadata')
  .gte('created_at', '2026-10-16T00:00:00Z')
  .order('created_at', { ascending: false })
  .limit(30);
console.log('\n=== ALL RENTALS created since Oct 16 ===', allErr ? fmt(allErr) : '');
for (const r of allRents || []) console.log(r.rental_id, r.status, r.vehicle_id?.slice(0, 10), r.total_cost, r.created_at, r.metadata?.source || '');

// 5. today's artifacts around now (both sale + rental)
const { data: saleArts } = await sb
  .from('sale_contract_artifacts')
  .select('id, contract_key, vehicle_id, flow_type, storage_path, created_at')
  .gte('created_at', '2026-10-16T00:00:00Z')
  .order('created_at', { ascending: false })
  .limit(10);
console.log('\n=== SALE ARTIFACTS since Oct 16 ===');
for (const a of saleArts || []) console.log(a.id, a.contract_key, a.vehicle_id?.slice(0, 10), a.created_at);
