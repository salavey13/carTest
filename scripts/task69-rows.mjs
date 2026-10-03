// task69-rows.mjs — detailed row dump for the two ducatis (metadata focus)
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const key = env.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m)?.[1]?.trim();
const sb = createClient('https://inmctohsodgdohamhzag.supabase.co', key, { auth: { persistSession: false } });

for (const bike of ['ducati-1199-panigale-2012', 'ducati-panigale-s-electro-black-aero', 'kawasaki-ex650k']) {
  const { data } = await sb.from('rentals')
    .select('rental_id,status,payment_status,total_cost,agreed_start_date,agreed_end_date,requested_start_date,requested_end_date,created_at,user_id,metadata')
    .eq('vehicle_id', bike)
    .order('created_at', { ascending: true });
  console.log(`\n=== ${bike} ===`);
  for (const r of data ?? []) {
    const m = r.metadata ?? {};
    console.log(JSON.stringify({
      id: String(r.rental_id).slice(0, 8),
      created: String(r.created_at).slice(0, 10),
      win: `${String(r.agreed_start_date ?? r.requested_start_date ?? '?').slice(0, 10)}→${String(r.agreed_end_date ?? r.requested_end_date ?? '?').slice(0, 10)}`,
      st: r.status,
      pay: r.payment_status,
      total: r.total_cost,
      bike_price: m.bike_price ?? null,
      equip_price: m.equipment_price ?? null,
      item_type: m.item_type ?? null,
      primary: m.primary_rental_id ? String(m.primary_rental_id).slice(0, 8) : null,
      subr: m.subrenter_chat_id ?? null,
      equip: m.equipment ?? null,
      renter: m.renter_name ?? null,
      user: r.user_id,
    }));
  }
}

// partner names
const { data: users } = await sb.from('users').select('user_id, full_name, username').in('user_id', ['1090242359', '425137783']);
console.log('\n=== partners ===');
for (const u of users ?? []) console.log(JSON.stringify(u));

// contract pct
const { data: art } = await sb.schema('private').from('subrent_contract_artifacts').select('crew_id, owner_percentage, created_at').order('created_at', { ascending: false }).limit(5);
console.log('\n=== contract artifacts ===', art ?? 'EMPTY');
