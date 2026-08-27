// iter15: find kawasaki docx in storage
import { createClient } from '@supabase/supabase-js';

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

const { data, error } = await sb.storage.from('rental-contracts').list('vip-bike', {
  limit: 100,
  sortBy: { column: 'created_at', order: 'desc' },
});
if (error) { console.error('list err:', error.message); process.exit(1); }
for (const f of data || []) {
  if (/kawasaki/i.test(f.name) || /falcon/i.test(f.name)) {
    console.log('FOUND:', f.name, '| created:', f.created_at, '| size:', f.metadata?.size);
  }
}
// also show the 10 newest for context
console.log('\nNewest 12 objects:');
for (const f of (data || []).slice(0, 12)) console.log(' -', f.name, f.created_at);
