// task109: audit honda-cbr600rr-2003 /doc regression (doc arrived in TG, rental missing in analytics)
// READ-ONLY. node --env-file=.env.local scripts/task109-honda-doc-audit.mjs
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);
const fmt = (o) => JSON.stringify(o, null, 2);
const SINCE = '2026-10-17T00:00:00Z';

// 1. find honda cbr bikes
const { data: bikes, error: bikeErr } = await sb
  .from('cars')
  .select('id, make, model, crew_id, owner_id, type, status')
  .or('model.ilike.%cbr%,model.ilike.%600%,make.ilike.honda');
console.log('=== CARS (honda/cbr/600) ===', bikeErr ? fmt(bikeErr) : '');
for (const b of bikes || []) console.log(b.id, `${b.make} ${b.model}`, 'type:', b.type, 'status:', b.status, 'crew:', b.crew_id, 'owner:', b.owner_id);
const bikeIds = (bikes || []).map((b) => b.id);

// 2. rentals for these bikes
if (bikeIds.length) {
  const { data: rents, error: rentErr } = await sb
    .from('rentals')
    .select('*')
    .in('vehicle_id', bikeIds)
    .gte('created_at', SINCE)
    .order('created_at', { ascending: false });
  console.log('\n=== RENTALS since Oct 17 (honda) ===', rentErr ? fmt(rentErr) : '');
  for (const r of rents || []) {
    console.log(fmt({
      rental_id: r.rental_id, status: r.status, created_at: r.created_at,
      agreed_start_date: r.agreed_start_date, agreed_end_date: r.agreed_end_date,
      total_cost: r.total_cost, source: r.metadata?.source,
      renter: r.metadata?.renter_name, operator: r.metadata?.created_by_operator_chat_id || r.created_by_operator_chat_id,
    }));
  }
  if (!rents?.length) console.log('!!! NO RENTALS for honda bikes since Oct 17');
}

// 3. rental_contract_artifacts since Oct 17 (all) — the smoking gun: rental_id null?
const { data: arts, error: artErr } = await sb
  .from('rental_contract_artifacts')
  .select('*')
  .gte('created_at', SINCE)
  .order('created_at', { ascending: false })
  .limit(20);
console.log('\n=== RENTAL ARTIFACTS since Oct 17 (all bikes) ===', artErr ? fmt(artErr) : '');
for (const a of arts || []) {
  console.log(fmt({
    id: a.id, contract_key: a.contract_key, created_at: a.created_at,
    requested_bike_id: a.requested_bike_id, resolved_bike_id: a.resolved_bike_id,
    rental_id: a.rental_id, storage_path: a.storage_path,
    renter_full_name: a.renter_full_name, rent_start_date: a.rent_start_date,
    operator: a.created_by_operator_chat_id, crew: a.crew_slug,
  }));
}
if (!arts?.length) console.log('!!! NO rental_contract_artifacts since Oct 17 — flow died BEFORE artifacts');

// 4. user_rental_secrets since Oct 17 (private schema)
const { data: secrets, error: secErr } = await sb
  .schema('private')
  .from('user_rental_secrets')
  .select('id, crew_slug, source_doc_key, source_rental_id, renter_full_name, created_at')
  .gte('created_at', SINCE)
  .order('created_at', { ascending: false })
  .limit(20);
console.log('\n=== USER_RENTAL_SECRETS since Oct 17 ===', secErr ? fmt(secErr) : '');
for (const s of secrets || []) console.log(s.id, s.crew_slug, 'doc:', s.source_doc_key, 'rental:', s.source_rental_id, 'renter:', s.renter_full_name, s.created_at);
if (!secrets?.length) console.log('!!! NO user_rental_secrets since Oct 17 — flow died BEFORE secrets');

// 5. deposit_entries since Oct 17
const { data: deps, error: depErr } = await sb
  .from('deposit_entries')
  .select('id, rental_id, method, amount, created_at')
  .gte('created_at', SINCE)
  .order('created_at', { ascending: false })
  .limit(20);
console.log('\n=== DEPOSIT_ENTRIES since Oct 17 ===', depErr ? fmt(depErr) : '');
for (const d of deps || []) console.log(d.id, 'rental:', d.rental_id, d.method, d.amount, d.created_at);

// 6. storage listing — recent docx in rental-contracts (top-level folders)
for (const folder of ['vip-bike', 'sly13']) {
  const { data: files, error: lsErr } = await sb.storage.from('rental-contracts').list(folder, {
    limit: 30, sortBy: { column: 'created_at', order: 'desc' },
  });
  console.log(`\n=== STORAGE rental-contracts/${folder} (latest 30) ===`, lsErr ? lsErr.message : '');
  for (const f of files || []) {
    if (!f.name.endsWith('.docx')) continue;
    console.log(f.name, 'created:', f.created_at, 'updated:', f.updated_at, 'bytes:', f.metadata?.size);
  }
}

// 7. rental_verifications since Oct 17 — did the flow reach verification?
const { data: ver, error: verErr } = await sb
  .from('rental_verifications')
  .select('id, rental_id, status, crew_slug, requested_at, snapshot')
  .gte('requested_at', SINCE)
  .order('requested_at', { ascending: false })
  .limit(10);
console.log('\n=== RENTAL_VERIFICATIONS since Oct 17 ===', verErr ? fmt(verErr) : '');
for (const v of ver || []) console.log(v.id, 'rental:', v.rental_id, v.status, v.crew_slug, v.requested_at, 'bike:', v.snapshot?.bikeName || v.snapshot?.bike_name || '?');

// 8. ALL rentals since Oct 17 (any bike) — context
const { data: allRents, error: allErr } = await sb
  .from('rentals')
  .select('rental_id, status, vehicle_id, total_cost, created_at, crew_id, user_id, metadata')
  .gte('created_at', SINCE)
  .order('created_at', { ascending: false })
  .limit(30);
console.log('\n=== ALL RENTALS since Oct 17 ===', allErr ? fmt(allErr) : '');
for (const r of allRents || []) console.log(r.rental_id, r.status, r.vehicle_id?.slice(0, 8), r.total_cost, r.created_at, r.metadata?.source || '');
