// task119 · step 1 — locate the Aprilia 46 000 ₽ rental + its verification row (READ-ONLY).
// Run: node --env-file=.env.local scripts/task119-verify-find.mjs
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data: rentals, error } = await sb
  .from('rentals')
  .select('rental_id, crew_id, owner_id, total_cost, status, metadata, created_at, created_by_operator_chat_id, requested_start_date, requested_end_date, agreed_start_date, agreed_end_date, vehicle:cars(id, make, model, daily_price, specs, type, image_url)')
  .eq('total_cost', 46000)
  .order('created_at', { ascending: false })
  .limit(10);
if (error) { console.error('ERR', error.message); process.exit(1); }
console.log(`rentals with total_cost=46000: ${(rentals || []).length}`);
for (const r of rentals || []) {
  const v = Array.isArray(r.vehicle) ? r.vehicle[0] : r.vehicle;
  console.log('---');
  console.log(JSON.stringify({
    rental_id: r.rental_id,
    status: r.status,
    created_at: r.created_at,
    created_by: r.created_by_operator_chat_id,
    window: [r.requested_start_date, r.requested_end_date],
    agreed_window: [r.agreed_start_date, r.agreed_end_date],
    bike: `${v?.make || ''} ${v?.model || ''}`.trim(),
    bike_type: v?.type,
    daily_price: v?.daily_price,
    equipment: r.metadata?.equipment,
    meta_keys: Object.keys(r.metadata || {}),
  }, null, 1));
}
// verification rows for those rentals
const ids = (rentals || []).map((r) => r.rental_id);
if (ids.length) {
  const { data: rows } = await sb.from('rental_verifications').select('*').in('rental_id', ids);
  for (const row of rows || []) {
    console.log('=== VERIFICATION ROW', row.rental_id, '===');
    console.log(JSON.stringify({
      status: row.status,
      operator: row.operator_chat_id,
      owner: row.owner_chat_id,
      snapshot_base: row.snapshot?.base,
      snapshot_equipment: row.snapshot?.equipment,
      snapshot_overprice: row.snapshot?.overprice,
      snapshot_total: row.snapshot?.total,
      snapshot_totalCost: row.snapshot?.totalCost,
      formula: row.snapshot?.formula,
      negotiation: row.negotiation,
      source: row.source,
      requested_at: row.requested_at,
    }, null, 1));
  }
}
