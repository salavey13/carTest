// task90: probe cars rows for vip-bike — sale + electric markers
// run: node --env-file=.env.local scripts/task90-probe-schema.mjs
import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const CREW = '2d5fde70-1dd3-4f0d-8d72-66ccf6908746';

const { data: bikes, error } = await sb.from('cars').select('*').eq('crew_id', CREW).eq('type', 'bike').order('id');
if (error) { console.error('err', error.message); process.exit(1); }
console.log('COUNT', bikes.length);

const keys = new Set();
for (const b of bikes) for (const k of Object.keys(b.specs || {})) keys.add(k);
console.log('SPEC KEYS:', [...keys].sort().join(', '));

const tkeys = new Set();
for (const b of bikes) for (const k of Object.keys(b)) tkeys.add(k);
console.log('ROW KEYS:', [...tkeys].sort().join(', '));

for (const b of bikes) {
  const s = b.specs || {};
  const pick = {};
  for (const k of Object.keys(s)) {
    if (/^(sale|sale_price|sale_enabled|saleAvailable|fuel|engine_type|motor_type|electric|powertrain|category|status|price_rub|book_value)$/i.test(k)) pick[k] = s[k];
  }
  console.log(
    b.id.padEnd(28),
    '| price_rub:', String(b.price_rub ?? '-').padStart(9),
    '| spec:', JSON.stringify(pick).slice(0, 200)
  );
}
