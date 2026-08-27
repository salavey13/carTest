// iter15b: kawasaki forensics round 2 — correct tables + private schema headers
import { createClient } from '@supabase/supabase-js';

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });
const priv = { headers: { 'Accept-Profile': 'private', 'Content-Profile': 'private' } };

const RENTAL_ID = 'e4791134-de27-4ca0-a782-9408137599dc';

// 1. rentals row with REAL columns
const { data: rent, error: rErr } = await sb.from('rentals').select('*').eq('rental_id', RENTAL_ID).single();
if (rErr) { console.error('rental err:', rErr.message); process.exit(1); }
console.log('=== rental row (real cols) ===');
console.log(JSON.stringify({ rental_id: rent.rental_id, vehicle_id: rent.vehicle_id, user_id: rent.user_id, crew_id: rent.crew_id, status: rent.status, agreed_start_date: rent.agreed_start_date, agreed_end_date: rent.agreed_end_date, requested_start_date: rent.requested_start_date, requested_end_date: rent.requested_end_date, price_total: rent.price_total, deposit_total: rent.deposit_total, created_at: rent.created_at }, null, 1));
console.log('ALL rental columns:', Object.keys(rent).join(', '));
const md = rent.metadata || {};
console.log('deposit keys in metadata:', Object.keys(md).filter(k => k.includes('deposit')));

// 2. private.rental_contract_artifacts for this rental (by rental_id AND by doc scope)
const { data: byRent, error: a1 } = await sb.from('rental_contract_artifacts').select('*').eq('rental_id', RENTAL_ID).maybeSingle();
console.log('\n=== private.rental_contract_artifacts by rental_id ===', a1 ? a1.message : (byRent ? 'FOUND' : 'none'));
if (byRent) {
  const am = byRent.metadata || byRent.payload || {};
  console.log('artifact cols:', Object.keys(byRent).join(', '));
  console.log('doc_url:', byRent.doc_url, '| storage_path:', byRent.storage_path, '| created:', byRent.created_at);
  console.log('deposit_amount:', am.deposit_amount, '| deposit_method:', am.deposit_method, '| deposit_returned:', am.deposit_returned);
  console.log('renter_name:', am.renter_name, '| renter_phone:', am.renter_phone);
  console.log('total_amount:', am.total_amount, '| equipment:', JSON.stringify(am.equipment));
  console.log('full metadata (5k):', JSON.stringify(am).slice(0, 5000));
}

// 3. also search artifacts by order scope string
const { data: anyArts, error: a2 } = await sb.from('rental_contract_artifacts').select('artifact_id,rental_id,kind,created_at,metadata->order_id,metadata->renter_name,metadata->renter_phone,metadata->deposit_amount').order('created_at', { ascending: false }).limit(8);
console.log('\n=== latest rental artifacts (any) ===', a2 ? a2.message : '');
for (const a of anyArts || []) console.log(JSON.stringify(a).slice(0, 400));

// 4. cars row for kawasaki — odometer in specs
const { data: car, error: cErr } = await sb.from('cars').select('id,make,model,type,specs').or(`id.eq.kawasaki-ex650k,specs->>slug.eq.kawasaki-ex650k`).maybeSingle();
console.log('\n=== car kawasaki-ex650k ===', cErr ? cErr.message : (car ? 'FOUND' : 'not found by slug'));
if (car) {
  const sp = car.specs || {};
  console.log('car.id:', car.id, '| make:', car.make, '| model:', car.model);
  console.log('odometer keys:', JSON.stringify({ last_known_odometer: sp.last_known_odometer, odometer: sp.odometer, odometer_km: sp.odometer_km, mileage: sp.mileage }));
  console.log('deposit in specs:', JSON.stringify({ deposit: sp.deposit, deposit_amount: sp.deposit_amount, deposit_rub: sp.deposit_rub }));
  console.log('specs keys:', Object.keys(sp).join(', '));
}

// 5. deposit_entries columns
const { data: de, error: deErr } = await sb.from('deposit_entries').select('*').eq('rental_id', RENTAL_ID).limit(5);
console.log('\n=== deposit_entries ===', deErr ? deErr.message : JSON.stringify(de).slice(0, 800));

// 6. sale artifacts — falcon-gt-2026 phone question
const { data: sales, error: sErr } = await sb.from('sale_contract_artifacts').select('*').order('created_at', { ascending: false }).limit(3);
console.log('\n=== latest sale_contract_artifacts ===', sErr ? sErr.message : '');
for (const s of sales || []) {
  const sm = s.metadata || s.payload || {};
  console.log('---', (s.artifact_id || '').slice(0, 8), 'created:', s.created_at, 'cols:', Object.keys(s).join(','));
  console.log('  buyer_name:', sm.buyer_name || sm.renter_name, '| phone:', sm.buyer_phone || sm.renter_phone || sm.phone, '| item:', sm.item_id || sm.bike_id);
  console.log('  full meta (2k):', JSON.stringify(sm).slice(0, 2000));
}
