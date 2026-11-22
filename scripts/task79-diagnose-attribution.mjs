// Task 79: diagnose djorudjov salary attribution (rentals + sales) — live DB state
// Run: node --env-file=.env.local scripts/task79-diagnose-attribution.mjs
import { createClient } from '../node_modules/@supabase/supabase-js/dist/main/index.js';

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const CREW_ID = '2d5fde70-1dd3-4f0d-8d72-66ccf6908746'; // vip-bike

// ── 1. rentals attribution (post-task77 state)
const { data: carsAll } = await sb.from('cars').select('id').eq('crew_id', CREW_ID);
const carIdsAll = (carsAll || []).map(c => c.id);
const { data: rentals, error: rerr } = await sb.from('rentals').select('rental_id,created_by_operator_chat_id,status,created_at,metadata').in('vehicle_id', carIdsAll).neq('status', 'cancelled').order('created_at', { ascending: false }).limit(3000);
if (rerr) console.log('RENTALS ERR:', rerr.message);
else {
  const direct = {};
  let freezeHits = 0, returnHits = 0;
  for (const r of rentals) {
    direct[r.created_by_operator_chat_id ?? 'null'] = (direct[r.created_by_operator_chat_id ?? 'null'] || 0) + 1;
    if (r.metadata?.pickup_freeze?.frozen_by) freezeHits++;
    if (r.metadata?.return_confirmed_by) returnHits++;
  }
  console.log(`RENTALS non-cancelled (last ${rentals.length}) by direct operator:`, JSON.stringify(direct));
  console.log(`  metadata traces: pickup_freeze.frozen_by set on ${freezeHits}, return_confirmed_by set on ${returnHits}`);
}

// ── 2. sales (private schema) — telegram_chat_id distribution
const { data: cars } = await sb.from('cars').select('id').eq('crew_id', CREW_ID);
const carIds = (cars || []).map(c => c.id);
console.log('CARS in vip-bike:', carIds.length);
const { data: sales, error: serr } = await sb.schema('private').from('sale_contract_artifacts').select('id,sale_price,resolved_bike_id,created_at,telegram_chat_id').in('resolved_bike_id', carIds).order('created_at', { ascending: false }).limit(500);
if (serr) console.log('SALES ERR:', serr.message);
else {
  const by = {};
  for (const s of sales) by[s.telegram_chat_id ?? 'null'] = (by[s.telegram_chat_id ?? 'null'] || 0) + 1;
  console.log(`SALES vip-bike (${sales.length}) by telegram_chat_id:`, JSON.stringify(by));
  const fromIos = sales.filter(s => s.telegram_chat_id === '356282674');
  console.log('SALES still on i_o_s_nn (356282674):');
  for (const s of fromIos) console.log(`  id=${s.id} price=${s.sale_price} bike=${s.resolved_bike_id} at=${s.created_at}`);
}

// ── 3. crew_members roster (what salary pipeline sees)
const { data: members, error: merr } = await sb.from('crew_members').select('id,user_id,role,membership_status').eq('crew_id', CREW_ID);
if (merr) console.log('MEMBERS ERR:', merr.message);
else console.log('CREW_MEMBERS:', JSON.stringify(members));

// ── 4. shifts coverage sanity for djorudjov (recent)
const { data: shifts } = await sb.from('crew_member_shifts').select('id,member_id,clock_in_time,clock_out_time,salary_amount').eq('crew_id', CREW_ID).order('clock_in_time', { ascending: false }).limit(50);
if (shifts) {
  const by = {};
  for (const s of shifts) by[s.member_id] = (by[s.member_id] || 0) + 1;
  console.log('RECENT SHIFTS (last 50) by member:', JSON.stringify(by));
  const open = shifts.filter(s => !s.clock_out_time);
  console.log('open shifts:', open.length);
}
