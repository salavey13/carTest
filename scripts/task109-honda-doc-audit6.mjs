// task109 part 7: cars.crew_id for the /doc bikes — does honda's car pass the dashboard join?
// READ-ONLY. node --env-file=.env.local scripts/task109-honda-doc-audit6.mjs
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);
const fmt = (o) => JSON.stringify(o, null, 2);
const VIP = '2d5fde70-1dd3-4f0d-8d72-66ccf6908746';

const bikes = ['honda-cbr600rr-2003', 'aprilia-shiver', 'falcon-gt-2026', 'suzuki-vzr1800-boulevard-2006', 'bmw-f800r', 'yamaha-r6-2007', 'the-meta-helmet', 'equip-jacket-air-system-2xl'];
const { data: cars, error } = await sb
  .from('cars')
  .select('id, make, model, crew_id, owner_id, type')
  .in('id', bikes);
console.log('=== CARS (dashboard join candidates) ===', error ? fmt(error) : '');
for (const c of cars || []) {
  console.log(`${c.id}  crew_id=${c.crew_id}  ${c.crew_id === VIP ? '== vip-bike ✓' : '⚠️ != vip-bike → INNER-JOIN DROPS IT'}  type=${c.type} owner=${c.owner_id}`);
}

// also: is honda in MULTIPLE crews? any other car rows referencing honda
const { data: hondaAll } = await sb.from('cars').select('id, crew_id, type').ilike('id', '%honda%');
console.log('\n=== ALL honda cars ===');
for (const c of hondaAll || []) console.log(c.id, c.crew_id, c.type);
