// Task 88: introspect cars/crews, list all vip-bike bikes for QR deeplinks
// run: node --env-file=.env.local scripts/task88-lookup-bikes.mjs
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// 1) find vip-bike crew
const { data: crew, error: crewErr } = await sb
  .from('crews')
  .select('*')
  .eq('slug', 'vip-bike')
  .maybeSingle();
if (crewErr) console.error('crewErr:', crewErr.message);
console.log('CREW:', crew ? { id: crew.id, slug: crew.slug, name: crew.name } : 'NOT FOUND');

// 2) introspect cars table columns (one row)
const { data: one, error: oneErr } = await sb.from('cars').select('*').limit(1);
if (oneErr) { console.error('cars introspect error:', oneErr.message); process.exit(1); }
console.log('CARS COLUMNS:', Object.keys(one?.[0] || {}).join(', '));

// 3) all vip-bike bikes
const { data: bikes, error: bErr } = await sb
  .from('cars')
  .select('*')
  .eq('crew_id', crew.id)
  .order('id', { ascending: true });
if (bErr) { console.error('bikes error:', bErr.message); process.exit(1); }
console.log(`VIP-BIKE BIKES: ${bikes.length}`);
for (const b of bikes) {
  console.log(JSON.stringify({
    id: b.id,
    model: b.model ?? b.name ?? b.title,
    brand: b.brand ?? null,
    year: b.year ?? null,
    status: b.status ?? null,
    price: b.price ?? b.price_per_day ?? null,
    odometer: b.odometer ?? b.mileage ?? null,
    photo: (b.photo ?? b.image ?? b.photo_url ?? '').toString().slice(0, 90) || null,
  }));
}
