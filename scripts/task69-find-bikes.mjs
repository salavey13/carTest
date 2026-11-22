import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const key = env.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m)?.[1]?.trim();
const sb = createClient('https://inmctohsodgdohamhzag.supabase.co', key, { auth: { persistSession: false } });

const { data, error } = await sb
  .from('cars')
  .select('id, model, crew_id, daily_price, specs');
if (error) { console.error('ERR', error.message); process.exit(1); }
for (const c of data) {
  const hay = `${c.id ?? ''} ${c.model ?? ''}`.toLowerCase();
  if (hay.includes('kawasaki') || hay.includes('ducati') || hay.includes('1199') || hay.includes('aero')) {
    console.log(JSON.stringify({
      id: c.id,

      crew_id: c.crew_id,
      daily_price: c.daily_price,

      subrenter: c.specs?.subrenter_chat_id ?? null,
      subrenter_name: c.specs?.subrenter_name ?? null,
    }));
  }
}
