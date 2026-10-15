// task96b — details of mismatch artifact bc8f9342 + correct october query
import { createClient } from '@supabase/supabase-js';
const SB = 'https://inmctohsodgdohamhzag.supabase.co';
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(SB, SR, { auth: { persistSession: false } });
const H = { apikey: SR, Authorization: `Bearer ${SR}` };

console.log('=== MISMATCH bc8f9342 ===');
const aRes = await fetch(`${SB}/rest/v1/rental_contract_artifacts?select=rental_id,created_by_operator_chat_id,created_at,telegram_chat_id&rental_id=eq.bc8f9342-*`, { headers: { ...H, 'Accept-Profile': 'private' } });
// id may be partial — fetch all sender artifacts and find ones not matching rentals
const allRes = await fetch(`${SB}/rest/v1/rental_contract_artifacts?select=rental_id,created_by_operator_chat_id,created_at&created_by_operator_chat_id=eq.7813830016`, { headers: { ...H, 'Accept-Profile': 'private' } });
const all = await allRes.json();
const full = all.find((x) => x.rental_id?.startsWith('bc8f9342'));
console.log('artifact:', full);

const { data: r } = await sb.from('rentals').select('rental_id,created_by_operator_chat_id,crew_id,user_id,total_cost,status,requested_start_date,requested_end_date,created_at').eq('rental_id', full.rental_id).maybeSingle();
console.log('rental:', r);
const { data: crew } = await sb.from('crews').select('id,slug,name').eq('id', r?.crew_id).maybeSingle();
console.log('crew:', crew);

console.log('\n=== OCTOBER VIP-BIKE (fixed query) ===');
const { data: c } = await sb.from('crews').select('id,slug').eq('slug', 'vip-bike').maybeSingle();
console.log('vip-bike crew id:', c?.id);
const { data: oct } = await sb.from('rentals').select('rental_id,total_cost,status,requested_start_date,created_by_operator_chat_id,vehicle:cars!inner(crew_id)').eq('vehicle.crew_id', c.id).gte('requested_start_date', '2026-10-01T00:00:00+03:00').lt('requested_start_date', '2026-11-01T00:00:00+03:00').neq('status', 'cancelled').order('requested_start_date');
console.log('rows:', oct?.length ?? 0);
const byOp = {};
for (const x of oct ?? []) {
  const op = x.created_by_operator_chat_id ?? 'NULL';
  byOp[op] = (byOp[op] ?? 0) + 1;
  console.log(`  ${String(x.requested_start_date).slice(0, 10)} ${x.rental_id.slice(0, 8)} op=${String(op).padEnd(12)} cost=${String(x.total_cost).padStart(7)} ${x.status}`);
}
console.log('by operator:', byOp);
