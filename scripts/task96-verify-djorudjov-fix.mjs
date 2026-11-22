// task96 — verify Paul applied operator-attribution-fix-2026-10-15.sql
// checks the 5 rental_ids + full October attribution picture for vip-bike
import { createClient } from '@supabase/supabase-js';

const SB = 'https://inmctohsodgdohamhzag.supabase.co';
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(SB, SR, { auth: { persistSession: false } });

const EXPECT = [
  ['9d7582e5-dfa6-469d-bfad-5c47d3f51129', 950],
  ['15db0028-ece6-4e62-9c50-a891bcd32fe7', 1400],
  ['03e18650-74a8-439a-b2ba-efddbea0af96', 1150],
  ['9f6c55fb-6c9a-4cf4-945b-544330f4aea6', 2800],
  ['28702ae4-21a2-45bb-9dd2-e770223ff933', 1630],
];

console.log('=== 1) THE 5 FIXED RENTALS ===');
let ok = 0;
for (const [id, cost] of EXPECT) {
  const { data, error } = await sb.from('rentals').select('rental_id,created_by_operator_chat_id,total_cost,requested_start_date,status').eq('rental_id', id).maybeSingle();
  if (error) { console.log('ERR', id, error.message); continue; }
  if (!data) { console.log('MISSING', id); continue; }
  const good = data.created_by_operator_chat_id === '7813830016';
  if (good) ok++;
  console.log(`${good ? 'OK ' : 'BAD'} ${id.slice(0, 8)} op=${data.created_by_operator_chat_id} cost=${data.total_cost} (exp ${cost}) start=${String(data.requested_start_date).slice(0, 10)} status=${data.status}`);
}
console.log(`fixed: ${ok}/5`);

console.log('\n=== 2) ARTIFACT CROSS-CHECK (sender vs rentals row) ===');
const R = sb.rest.v1;
const H = { apikey: SR, Authorization: `Bearer ${SR}` };
const artsRes = await fetch(`${SB}/rest/v1/rental_contract_artifacts?select=rental_id,created_by_operator_chat_id&created_by_operator_chat_id=eq.7813830016`, { headers: { ...H, 'Accept-Profile': 'private' } });
const arts = artsRes.ok ? await artsRes.json() : [];
if (!artsRes.ok) console.log('artifact query failed:', artsRes.status);
console.log(`artifacts with sender=djorudjov: ${arts?.length ?? 0}`);
let match = 0, mismatch = 0, noRental = 0;
for (const a of arts ?? []) {
  if (!a?.rental_id) { noRental++; continue; }
  const { data: r } = await sb.from('rentals').select('created_by_operator_chat_id,crew_id').eq('rental_id', a.rental_id).maybeSingle();
  if (!r) { noRental++; continue; }
  if (r.created_by_operator_chat_id === '7813830016') match++;
  else { mismatch++; console.log(`  MISMATCH ${a.rental_id.slice(0, 8)} rentals_row=${r.created_by_operator_chat_id} crew=${r.crew_id ? 'set' : 'null'}`); }
}
console.log(`artifact→rentals cross-check: match=${match} mismatch=${mismatch} no-rental-row=${noRental}`);

console.log('\n=== 3) OCTOBER 2026 VIP-BIKE RENTALS — full attribution map ===');
const { data: crews } = await sb.from('crews').select('crew_id,slug').eq('slug', 'vip-bike').maybeSingle();
const crewId = crews?.crew_id;
const { data: octRentals } = await sb.from('rentals').select('rental_id,user_id,total_cost,status,requested_start_date,created_by_operator_chat_id,vehicle:cars!inner(crew_id)').eq('vehicle.crew_id', crewId).gte('requested_start_date', '2026-10-01T00:00:00+03:00').lt('requested_start_date', '2026-11-01T00:00:00+03:00').neq('status', 'cancelled').order('requested_start_date');
const byOp = {};
for (const r of octRentals ?? []) {
  const op = r.created_by_operator_chat_id ?? 'NULL';
  byOp[op] = (byOp[op] ?? 0) + 1;
  const flag = arts?.some((a) => a.rental_id === r.rental_id);
  console.log(`  ${String(r.requested_start_date).slice(0, 10)} ${r.rental_id.slice(0, 8)} op=${op.padEnd(12)} cost=${String(r.total_cost).padStart(7)} ${r.status}${flag ? ' ←/doc-artifact' : ''}`);
}
console.log('by operator:', byOp);
