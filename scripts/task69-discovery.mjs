// task69-discovery.mjs — rental counts per target bike, per MSK month,
// equipment mirrors vs primary rows, statuses. Read-only.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const key = env.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m)?.[1]?.trim();
const sb = createClient('https://inmctohsodgdohamhzag.supabase.co', key, { auth: { persistSession: false } });

const BIKES = ['kawasaki-ex650k', 'ducati-1199-panigale-2012', 'ducati-panigale-s-electro-black-aero'];

for (const bike of BIKES) {
  const { data, error } = await sb
    .from('rentals')
    .select('rental_id,status,payment_status,total_cost,agreed_start_date,agreed_end_date,created_at,metadata')
    .eq("vehicle_id", bike)
    .order('created_at', { ascending: true });
  if (error) { console.error(bike, 'ERR', error.message); continue; }
  const rows = data ?? [];
  const byMonth = new Map();
  for (const r of rows) {
    const d = r.agreed_start_date || r.created_at;
    const m = d ? String(d).slice(0, 7) : '????-??';
    if (!byMonth.has(m)) byMonth.set(m, { total: 0, completed: 0, cancelled: 0, active: 0, sum: 0, mirrors: 0 });
    const b = byMonth.get(m);
    b.total += 1;
    if (r.metadata?.item_type === 'equipment') b.mirrors += 1;
    if (r.status === 'completed') b.completed += 1;
    else if (r.status === 'cancelled') b.cancelled += 1;
    else b.active += 1;
    if (r.metadata?.item_type !== 'equipment' && r.status === 'completed' && r.total_cost != null) b.sum += Number(r.total_cost);
  }
  console.log(`\n=== ${bike} — ${rows.length} rows (${rows.filter(r => r.item_type === 'equipment').length} mirrors) ===`);
  for (const [m, b] of [...byMonth.entries()].sort()) {
    console.log(`  ${m}: ${b.total} rows (${b.completed} done / ${b.cancelled} cancel / ${b.active} other, ${b.mirrors} mirrors), completed sum ${b.sum}`);
  }
  // latest 5 rows raw for context
  console.log('  last 5:');
  for (const r of rows.slice(-5)) {
    console.log(`    ${String(r.created_at).slice(0, 10)} ${r.status} ${r.metadata?.item_type ?? 'bike'} ${r.total_cost} ${r.metadata?.renter_name ?? r.rental_id}`);
  }
}
