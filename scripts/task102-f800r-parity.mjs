// task102: parity check — recovered f800r rental vs canonical aprilia doc rental
// READ-ONLY. node --env-file=.env.local scripts/task102-f800r-parity.mjs
import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const priv = sb.schema('private');

const { data: rows } = await sb.from('rentals')
  .select('rental_id, user_id, owner_id, created_by_operator_chat_id, crew_id, vehicle_id, status, total_cost, deposit_amount, deposit_method, requested_start_date, requested_end_date, agreed_start_date, agreed_end_date, metadata')
  .in('rental_id', ['bd948bd0-e9db-44ef-8955-97933cee066f', 'a5532f57-7e00-41d3-a5c5-1abfb615de0a']);
for (const r of rows || []) {
  console.log('\n===', r.rental_id.slice(0, 8), r.vehicle_id, '===');
  console.log(JSON.stringify({
    user_id: r.user_id, owner_id: r.owner_id, operator: r.created_by_operator_chat_id,
    status: r.status, total: r.total_cost, deposit: `${r.deposit_amount}/${r.deposit_method}`,
    start: r.agreed_start_date, end: r.agreed_end_date,
    md_keys: Object.keys(r.metadata || {}),
    doc_sha: r.metadata?.doc_sha256?.slice(0, 12), renter: r.metadata?.renter_name,
    bike_price: r.metadata?.bike_price, equip_price: r.metadata?.equipment_price,
    price_overridden: r.metadata?.price_overridden, audit: Object.keys(r.metadata?.specs || {}),
  }, null, 1));
}

// artifact parity
const { data: arts } = await priv.from('rental_contract_artifacts')
  .select('contract_key, rental_id, resolved_bike_id, storage_path, original_sha256, created_by_operator_chat_id, renter_full_name, total_sum, deposit_rub, rent_start_date')
  .in('rental_id', rows?.map((r) => r.rental_id) || []);
console.log('\n=== ARTIFACTS ===');
for (const a of arts || []) console.log(JSON.stringify(a, null, 1));

// does the analytics day query match? (requested_start_date within today UTC)
const { data: today } = await sb.from('rentals').select('rental_id, vehicle_id, status')
  .eq('vehicle_id', 'bmw-f800r')
  .gte('requested_start_date', '2026-10-17T00:00:00Z').lte('requested_start_date', '2026-10-17T23:59:59Z');
console.log('\n=== ANALYTICS DAY MATCH (bmw-f800r, Oct 17) ===');
for (const t of today || []) console.log(t.rental_id.slice(0, 8), t.status);
