// Task 88 part 2: type distribution + real bikes with details
// run: node --env-file=.env.local scripts/task88-lookup-bikes2.mjs
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const CREW_ID = '2d5fde70-1dd3-4f0d-8d72-66ccf6908746';

// 1) type distribution
const { data: all, error } = await sb.from('cars').select('id, make, model, type, daily_price, image_url, specs, quantity, rent_link').eq('crew_id', CREW_ID);
if (error) { console.error('err:', error.message); process.exit(1); }
const byType = {};
for (const r of all) byType[r.type ?? 'NULL'] = (byType[r.type ?? 'NULL'] || 0) + 1;
console.log('TYPE DISTRIBUTION:', JSON.stringify(byType, null, 2));

// 2) sample specs of a bike row
const sample = all.find(r => r.type !== 'equip' && (r.id.includes('cbr') || r.id.includes('aprilia')));
console.log('SAMPLE (cbr/aprilia):', JSON.stringify(sample, null, 2).slice(0, 1500));
