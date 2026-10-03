import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://inmctohsodgdohamhzag.supabase.co', process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: rentals } = await sb.from('rentals')
  .select('rental_id,status,total_cost,agreed_start_date,requested_start_date,created_at,metadata')
  .eq('vehicle_id','kawasaki-ex650k');
const mskMonth = (iso) => iso ? new Date(new Date(iso).getTime() + 3*3600*1000).toISOString().slice(0,7) : null;
const buckets = {};
for (const r of rentals||[]) {
  if (!['completed','active'].includes(r.status)) continue;
  const start = r.agreed_start_date || r.requested_start_date || r.created_at;
  const m = mskMonth(start);
  if (!m || m < '2026-07') continue;
  buckets[m] = buckets[m] || { revenue: 0, count: 0 };
  buckets[m].revenue += Math.round(Number(r.total_cost) || 0);
  buckets[m].count += 1;
}
console.log(JSON.stringify(buckets, null, 1));
