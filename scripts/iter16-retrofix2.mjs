// follow-up: metadata.deposit_rub has priority over deposit_amount in the page chain
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
const raw = readFileSync('/home/z/my-project/upload/secrets_all.txt', 'utf8');
const SB_URL = (raw.match(/NEXT_PUBLIC_SUPABASE_URL=(\S+)/) || [])[1];
const SB_KEY = (raw.match(/SUPABASE_SERVICE_ROLE_KEY=(\S+)/) || [])[1];
const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

const { data: r } = await sb.from('rentals').select('metadata').eq('rental_id', '38d0af71-f723-4dad-988f-e274823d73ec').maybeSingle();
const md = { ...(r.metadata || {}), deposit_rub: 15000 };
const { error } = await sb.from('rentals').update({ metadata: md, updated_at: new Date().toISOString() }).eq('rental_id', '38d0af71-f723-4dad-988f-e274823d73ec');
console.log(error ? 'ERR ' + error.message : 'deposit_rub → 15000 OK');
