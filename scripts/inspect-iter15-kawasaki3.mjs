// iter15c: deposit columns + private schema via select options
import { createClient } from '@supabase/supabase-js';

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });
const PRIV = { 'Accept-Profile': 'private', 'Content-Profile': 'private' };
const RENTAL_ID = 'e4791134-de27-4ca0-a782-9408137599dc';

// 1. rental deposit columns
const { data: rent } = await sb.from('rentals').select('deposit_amount,deposit_method,deposit_collected_at,deposit_returned,deposit_returned_at,deposit_returned_by,deposit_notes,payment_status,total_cost,interest_amount').eq('rental_id', RENTAL_ID).single();
console.log('=== rental deposit columns ===');
console.log(JSON.stringify(rent, null, 1));

// 2. private.rental_contract_artifacts
const { data: art, error: aErr } = await sb.from('rental_contract_artifacts').select('*', { headers: PRIV }).eq('rental_id', RENTAL_ID).maybeSingle();
console.log('\n=== private.rental_contract_artifacts ===', aErr ? aErr.message : (art ? 'FOUND' : 'none'));
if (art) {
  const am = art.metadata || {};
  console.log('cols:', Object.keys(art).join(', '));
  for (const k of ['deposit_amount', 'deposit_method', 'renter_phone', 'renter_name', 'total_amount', 'equipment']) console.log(k + ':', JSON.stringify(am[k]));
  console.log('meta keys:', Object.keys(am).join(', '));
  console.log('storage_path:', art.storage_path, '| doc_url:', art.doc_url);
}

// 3. artifacts for ducati rental (reference — has one, from web flow with ПЭП)
const { data: art2, error: a2e } = await sb.from('rental_contract_artifacts').select('*', { headers: PRIV }).order('created_at', { ascending: false }).limit(5);
console.log('\n=== latest 5 rental artifacts ===', a2e ? a2e.message : '');
for (const a of art2 || []) {
  const am = a.metadata || {};
  console.log('---', String(a.artifact_id).slice(0, 8), 'rental:', String(a.rental_id).slice(0, 8), 'created:', a.created_at, '| deposit:', am.deposit_amount, '| phone:', am.renter_phone, '| odo:', am.odometer_before ?? am.odometer_km);
}

// 4. sale artifacts
const { data: sales, error: sErr } = await sb.from('sale_contract_artifacts').select('*', { headers: PRIV }).order('created_at', { ascending: false }).limit(3);
console.log('\n=== latest sale_contract_artifacts ===', sErr ? sErr.message : '');
for (const s of sales || []) {
  const sm = s.metadata || {};
  console.log('---', String(s.artifact_id).slice(0, 8), 'created:', s.created_at);
  console.log('  cols:', Object.keys(s).join(', '));
  console.log('  meta (2.5k):', JSON.stringify(sm).slice(0, 2500));
}

// 5. sales rows (falcon-gt-2026)
const { data: salesRows, error: srErr } = await sb.from('sales').select('*').order('created_at', { ascending: false }).limit(3);
console.log('\n=== latest sales rows ===', srErr ? srErr.message : '');
for (const s of salesRows || []) {
  console.log('---', JSON.stringify(s).slice(0, 1200));
}
