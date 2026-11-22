// Task 88 part 3: full bike list for QR doc
// run: node --env-file=.env.local scripts/task88-lookup-bikes3.mjs
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'node:fs';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const CREW_ID = '2d5fde70-1dd3-4f0d-8d72-66ccf6908746';

const { data: bikes, error } = await sb
  .from('cars')
  .select('id, make, model, type, daily_price, image_url, specs')
  .eq('crew_id', CREW_ID)
  .eq('type', 'bike')
  .order('id');
if (error) { console.error('err:', error.message); process.exit(1); }

const rows = bikes.map(b => ({
  id: b.id,
  make: b.make || b.specs?.make || '',
  model: b.model || b.specs?.model || '',
  year: b.specs?.year || '',
  color: b.specs?.color || '',
  engine_cc: b.specs?.engine_cc || '',
  power_hp: b.specs?.power_hp || '',
  daily_price: b.daily_price,
  price_2_4d: b.specs?.rent_2_4d ?? null,
  image_url: b.image_url || b.specs?.gallery?.[0] || null,
  hidden: !!b.specs?.hidden,
  rent_flag: b.specs?.rent ?? null,
  odometer: b.specs?.last_known_odometer ?? null,
  vin: b.specs?.vin || '',
  underscore_in_id: b.id.includes('_'),
}));

console.log(`TOTAL BIKES: ${rows.length}`);
console.log(`HIDDEN: ${rows.filter(r => r.hidden).length}`);
console.log(`IDS WITH UNDERSCORE (parse hazard): ${rows.filter(r => r.underscore_in_id).map(r => r.id).join(', ') || 'none'}`);
for (const r of rows) {
  console.log(`${r.hidden ? '[H]' : '   '} rent_${r.id}  |  ${r.make} ${r.model} ${r.year} | ${r.daily_price}₽ | odo:${r.odometer ?? '-'}`);
}
writeFileSync('/home/z/cartest/scripts/task88-bikes.json', JSON.stringify(rows, null, 2));
console.log('saved → scripts/task88-bikes.json');
