import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://inmctohsodgdohamhzag.supabase.co', process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: rentals } = await sb.from('rentals')
  .select('rental_id,vehicle_id,crew_id,status,payment_status,total_cost,deposit_amount,requested_start_date,requested_end_date,agreed_start_date,agreed_end_date,created_at,updated_at,metadata')
  .eq('vehicle_id','kawasaki-ex650k')
  .order('agreed_start_date', { ascending: false })
  .limit(50);
console.log('kawasaki rentals total:', (rentals||[]).length);
for (const r of rentals||[]) {
  const md = r.metadata || {};
  console.log('\n=== ' + r.rental_id.slice(0,8), '|', r.status, '/', r.payment_status);
  console.log('  agreed:', r.agreed_start_date, '→', r.agreed_end_date, '| requested:', r.requested_start_date, '→', r.requested_end_date);
  console.log('  created:', r.created_at, '| total:', r.total_cost, '| deposit:', r.deposit_amount);
  console.log('  meta.bike_price:', md.bike_price, '| meta.equipment_price:', md.equipment_price, '| meta.item_type:', md.item_type, '| meta.subrenter_chat_id:', md.subrenter_chat_id, '| meta.renter_name:', md.renter_name);
  if (md.equipment) console.log('  meta.equipment:', JSON.stringify(md.equipment));
  if (md.owner_fix) console.log('  meta.owner_fix:', JSON.stringify(md.owner_fix));
  const extra = Object.keys(md).filter(k=>!['bike_price','equipment_price','item_type','subrenter_chat_id','renter_name','equipment','owner_fix','deposit_amount','source','flow_type','document_number','contact','notes'].includes(k));
  if (extra.length) console.log('  other meta keys:', extra.join(','));
}
