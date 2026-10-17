// task102: verify deposit_entries damage from the swallowed function
// READ-ONLY. node --env-file=.env.local scripts/task102-deposit-damage.mjs
import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// recent doc_command rentals vs their deposit_entries
const { data: docRentals } = await sb.from('rentals')
  .select('rental_id, vehicle_id, deposit_amount, deposit_method, created_at, metadata')
  .eq('metadata->>source', 'doc_command')
  .gte('created_at', '2026-10-01T00:00:00Z')
  .order('created_at', { ascending: false })
  .limit(12);
console.log('=== doc_command rentals since Oct 1 vs deposit_entries ===');
for (const r of docRentals || []) {
  const { count } = await sb.from('deposit_entries').select('id', { count: 'exact', head: true }).eq('rental_id', r.rental_id);
  console.log(r.rental_id.slice(0, 8), r.vehicle_id?.slice(0, 16), `deposit=${r.deposit_amount}/${r.deposit_method}`, `entries=${count}`, r.created_at?.slice(0, 16));
}

// web-order rentals (franchize_web_order) for contrast — different writer
const { data: webRentals } = await sb.from('rentals')
  .select('rental_id, vehicle_id, deposit_amount, created_at, metadata')
  .eq('metadata->>source', 'franchize_web_order')
  .gte('created_at', '2026-10-01T00:00:00Z')
  .order('created_at', { ascending: false })
  .limit(6);
console.log('\n=== web-order rentals (contrast) ===');
for (const r of webRentals || []) {
  const { count } = await sb.from('deposit_entries').select('id', { count: 'exact', head: true }).eq('rental_id', r.rental_id);
  console.log(r.rental_id.slice(0, 8), r.vehicle_id?.slice(0, 16), `deposit=${r.deposit_amount}`, `entries=${count}`, r.created_at?.slice(0, 16));
}
