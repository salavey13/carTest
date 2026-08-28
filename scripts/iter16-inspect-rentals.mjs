// iter16: inspect live data for today's rentals (aprilia + ducati aero)
// 1. rental rows + metadata (pep_signature, payment_split, equipment)
// 2. order notification payload (pepInitData present?)
// 3. artifact rows (doc sha, total)
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const raw = readFileSync('/home/z/my-project/upload/secrets_all.txt', 'utf8');
const SB_URL = (raw.match(/NEXT_PUBLIC_SUPABASE_URL=(\S+)/) || [])[1];
const SB_KEY = (raw.match(/SUPABASE_SERVICE_ROLE_KEY=(\S+)/) || [])[1];
const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });
const priv = { headers: { 'Accept-Profile': 'private', 'Content-Profile': 'private' } };
const pub = { headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public' } };

const since = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();

// 1. rentals since Aug 27
const { data: rentals, error: rErr } = await sb
  .from('rentals')
  .select('id, bike_id, renter_name, renter_phone, status, start_date, end_date, total_cost, deposit_amount, created_at, metadata')
  .gte('created_at', since)
  .order('created_at', { ascending: false })
  .limit(30);
if (rErr) console.log('rentals err', rErr.message);
console.log('=== RENTALS (last 3 days) ===');
for (const r of rentals || []) {
  console.log(`\n--- ${r.bike_id} | ${r.renter_name} | ${r.status}`);
  console.log(`  id=${r.id} ${r.start_date} → ${r.end_date} total=${r.total_cost} deposit=${r.deposit_amount} created=${r.created_at}`);
  const md = r.metadata || {};
  console.log(`  metadata keys: ${Object.keys(md).join(', ')}`);
  if (md.pep_signature) console.log(`  PEP_SIGNATURE: ${JSON.stringify(md.pep_signature)}`);
  if (md.payment_split) console.log(`  payment_split: ${JSON.stringify(md.payment_split)}`);
  if (md.equipment) console.log(`  equipment: ${JSON.stringify(md.equipment)}`);
  if (md.deposit_notes) console.log(`  deposit_notes: ${md.deposit_notes}`);
  if (md.deposit_amount) console.log(`  md.deposit_amount: ${md.deposit_amount}`);
  if (md.extras) console.log(`  md.extras: ${JSON.stringify(md.extras)}`);
}

// 2. order notifications
const { data: notifs, error: nErr } = await sb
  .from('franchize_order_notifications')
  .select('id, created_at, payload')
  .gte('created_at', since)
  .order('created_at', { ascending: false })
  .limit(20);
if (nErr) console.log('notifs err', nErr.message);
console.log('\n=== ORDER NOTIFICATIONS (last 3 days) ===');
for (const n of notifs || []) {
  const p = n.payload || {};
  console.log(`\n--- notif ${n.id} @ ${n.created_at}`);
  console.log(`  keys: ${Object.keys(p).join(', ')}`);
  console.log(`  pepInitData present: ${typeof p.pepInitData === 'string' && p.pepInitData.length > 0}`);
  console.log(`  cartLines: ${JSON.stringify((p.cartLines || []).map(l => ({ itemId: l.itemId, qty: l.qty, lineTotal: l.lineTotal, perk: l.options?.perk, extras: l.options?.extras })))}`);
  console.log(`  extrasTotal=${p.extrasTotal} totalAmount=${p.totalAmount} signatureName=${p.signatureName}`);
}

// 3. artifacts
const { data: arts, error: aErr } = await sb
  .from('rental_contract_artefact')
  .select('id, contract_key, created_at, total_sum, deposit_rub, renter_phone')
  .gte('created_at', since)
  .order('created_at', { ascending: false })
  .limit(20);
if (aErr) console.log('artifacts err', aErr.message);
console.log('\n=== ARTIFACTS (last 3 days) ===');
for (const a of arts || []) {
  console.log(`${a.contract_key} | total=${a.total_sum} deposit=${a.deposit_rub} phone=${a.renter_phone} @ ${a.created_at}`);
}
