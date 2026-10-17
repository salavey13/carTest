// task102: deep dig f800r — all artifacts ever, storage files, events, states
// READ-ONLY. node --env-file=.env.local scripts/task102-f800r-audit3.mjs
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const priv = sb.schema('private');
const fmt = (o) => JSON.stringify(o, null, 2);

// 1. ALL rental artifacts for f800r (any date)
const { data: arts } = await priv
  .from('rental_contract_artifacts')
  .select('id, contract_key, requested_bike_id, resolved_bike_id, rental_id, rent_start_date, total_sum, storage_path, created_at')
  .or('requested_bike_id.ilike.%f800%,resolved_bike_id.ilike.%f800%')
  .order('created_at', { ascending: false })
  .limit(20);
console.log('=== ALL private.rental_contract_artifacts for f800 ===');
for (const a of arts || []) console.log(fmt(a));
if (!arts?.length) console.log('!!! NONE EVER');

// 2. storage bucket rental-contracts — list vip-bike/ files with f800
const { data: files, error: lsErr } = await sb.storage.from('rental-contracts').list('vip-bike', { limit: 200, search: 'f800' });
console.log('\n=== storage rental-contracts/vip-bike (f800) ===', lsErr ? fmt(lsErr) : '');
for (const f of (files || []).filter((f) => f.name.toLowerCase().includes('f800'))) console.log(f.name, f.created_at, f.metadata?.size);
// also list latest 15 files overall
const { data: allFiles } = await sb.storage.from('rental-contracts').list('vip-bike', { limit: 300, sortBy: { column: 'created_at', order: 'desc' } });
console.log('\n=== storage latest 15 ===');
for (const f of (allFiles || []).slice(0, 15)) console.log(f.name, f.created_at || '', f.metadata?.size || '');

// 3. rentals for f800r EVER (vehicle_id = bmw-f800r)
const { data: rents } = await sb
  .from('rentals')
  .select('rental_id, status, total_cost, created_at, agreed_start_date, agreed_end_date, metadata')
  .eq('vehicle_id', 'bmw-f800r')
  .order('created_at', { ascending: false })
  .limit(10);
console.log('\n=== rentals for bmw-f800r EVER ===');
for (const r of rents || []) console.log(fmt({ id: r.rental_id, status: r.status, cost: r.total_cost, created: r.created_at, src: r.metadata?.source, renter: r.metadata?.renter_name }));
if (!rents?.length) console.log('!!! NONE EVER for bmw-f800r');

// 4. equip-jack rental detail (suspicious 0₽ doc_command at 09:16:44)
const { data: jack } = await sb
  .from('rentals')
  .select('*')
  .eq('rental_id', '530ce9b6-7f43-4142-8f05-37d7097e1b9e')
  .maybeSingle();
console.log('\n=== equip-jack rental detail ===');
console.log(fmt(jack ? {
  rental_id: jack.rental_id, vehicle_id: jack.vehicle_id, status: jack.status, crew_id: jack.crew_id,
  total: jack.total_cost, created: jack.created_at, metadata: jack.metadata, payment_split: jack.payment_split,
  start: jack.agreed_start_date, end: jack.agreed_end_date, deposit: jack.deposit_amount, method: jack.deposit_method,
} : 'NOT FOUND'));

// 5. events since Oct 16 (doc flow writes events?)
const { data: evs, error: evErr } = await sb
  .from('events')
  .select('id, type, status, rental_id, created_at')
  .gte('created_at', '2026-10-16T00:00:00Z')
  .order('created_at', { ascending: false })
  .limit(25);
console.log('\n=== events since Oct 16 ===', evErr ? fmt(evErr) : '');
for (const e of evs || []) console.log(e.created_at, e.type, e.status, e.rental_id?.slice(0, 8));

// 6. user_states for operator 7813830016 (stale doc flow?)
const { data: st } = await priv.from('user_secrets').select('telegram_chat_id').limit(0);
const { data: states } = await sb.from('user_states').select('user_id, state, context, expires_at, updated_at').order('updated_at', { ascending: false }).limit(10);
console.log('\n=== public.user_states latest ===');
for (const s of states || []) console.log(fmt(s));
