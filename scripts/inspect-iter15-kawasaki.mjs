// iter15: kawasaki rental forensics — deposit, phone, odometer, deposit-returned, artifacts
import { createClient } from '@supabase/supabase-js';

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });
const priv = { headers: { 'Accept-Profile': 'private', 'Content-Profile': 'private' } };

// 1. the rental row
const { data: rentals, error: rErr } = await sb
  .from('rentals')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(6);
if (rErr) { console.error('rentals err', rErr.message); process.exit(1); }

for (const r of rentals) {
  const md = r.metadata || {};
  console.log('════════'.repeat(8));
  console.log('rental_id:', r.rental_id);
  console.log(' bike:', r.bike_id, 'renter_chat_id:', r.renter_chat_id, 'user_id:', r.user_id);
  console.log(' status:', r.status, 'start:', r.start_time, 'end:', r.end_time, 'created:', r.created_at);
  console.log(' price_total:', r.price_total);
  console.log(' metadata keys:', Object.keys(md));
  console.log(' metadata.renter_name:', md.renter_name, '| renter_phone:', md.renter_phone);
  console.log(' metadata.deposit_amount:', md.deposit_amount, '| deposit_method:', md.deposit_method);
  console.log(' metadata.odometer_before:', md.odometer_before, '| pickup_freeze.odo:', md.pickup_freeze?.odometer_km);
  console.log(' metadata.equipment:', JSON.stringify(md.equipment));
  console.log(' metadata.payment_split:', JSON.stringify(md.payment_split));
  console.log(' metadata.order_id:', md.order_id, '| source:', md.source);
  console.log(' full metadata:', JSON.stringify(md).slice(0, 3000));
}

// 2. contract artifacts for kawasaki rental
const kawa = rentals.find(r => String(r.bike_id).includes('kawasaki') || (r.metadata||{}).order_id === 'order-mtbnsf97-zukmfy');
if (kawa) {
  console.log('\n=== KAWASAKI rental id:', kawa.rental_id, '===');
  const { data: arts, error: aErr } = await sb
    .from('rental_contract_artifacts')
    .select('*')
    .eq('rental_id', kawa.rental_id)
    .single();
  if (aErr) console.log('artifact by rental_id err:', aErr.message);
  else {
    console.log('artifact:', arts.artifact_id?.slice(0,8), 'created:', arts.created_at);
    console.log('artifact.doc_url:', arts.doc_url);
    const m = arts.metadata || arts.payload || {};
    console.log('artifact meta keys:', Object.keys(m));
    console.log('deposit in artifact:', JSON.stringify({ deposit_amount: m.deposit_amount, deposit: m.deposit, deposit_method: m.deposit_method, deposit_returned: m.deposit_returned, payment_split: m.payment_split }).slice(0,500));
    console.log('renter in artifact:', JSON.stringify({ renter_name: m.renter_name, renter_phone: m.renter_phone, buyer_phone: m.buyer_phone, phone: m.phone }).slice(0,500));
    console.log('equipment in artifact:', JSON.stringify(m.equipment).slice(0,500));
    console.log('total/price in artifact:', JSON.stringify({ price_total: m.price_total, total: m.total, total_amount: m.total_amount, items: m.items }));
    console.log('full artifact meta (4k):', JSON.stringify(m).slice(0, 4000));
  }
}

// 3. deposit entries for kawasaki
if (kawa) {
  const { data: deps, error: dErr } = await sb
    .from('deposit_entries')
    .select('*')
    .eq('rental_id', kawa.rental_id);
  console.log('\n=== deposit_entries for kawasaki ===', dErr ? dErr.message : JSON.stringify(deps).slice(0,2000));
}

// 4. bike specs — odometer for kawasaki
const { data: bikes, error: bErr } = await sb
  .from('bikes')
  .select('bike_id,specs')
  .like('bike_id', '%kawasaki%');
console.log('\n=== kawasaki bikes ===', bErr ? bErr.message : '');
for (const b of bikes || []) {
  const sp = b.specs || {};
  console.log(b.bike_id, '→ last_known_odometer:', sp.last_known_odometer, '| odometer:', sp.odometer, '| odometer_km:', sp.odometer_km);
}

// 5. order notification payload (the source of truth for phone/equipment)
const { data: orders, error: oErr } = await sb
  .from('franchize_order_notifications')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(3);
console.log('\n=== latest order notifications ===', oErr ? oErr.message : '');
for (const o of orders || []) {
  console.log('---', o.order_id || o.id, o.created_at, 'status:', o.status);
  const p = o.payload || o.order_payload || {};
  console.log('payload.phone:', p.phone || p.renter_phone, '| deposit:', JSON.stringify({ amount: p.deposit_amount, method: p.deposit_method, returned: p.deposit_returned }));
  console.log('payload.equipment:', JSON.stringify(p.equipment));
  console.log('payload keys:', Object.keys(p));
  console.log('payload full:', JSON.stringify(p).slice(0, 3500));
}
