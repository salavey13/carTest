// Task 89 part 2: deep checks — pending rows, agreed dates, availability_rules, app logic cross-ref
// run: node --env-file=.env.local scripts/task89-deep.mjs
import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// 1) the 6 pending_confirmation rows — agent's test bookings?
const { data: pend } = await sb.from('rentals')
  .select('rental_id,user_id,vehicle_id,crew_id,status,payment_status,interest_amount,total_cost,requested_start_date,requested_end_date,created_by_operator_chat_id,created_at')
  .eq('status', 'pending_confirmation').order('created_at', { ascending: false }).limit(10);
console.log('PENDING_CONFIRMATION:', JSON.stringify(pend, null, 1));

// 2) agreed_* set and different from requested?
const { data: agreed } = await sb.from('rentals')
  .select('rental_id,status,requested_start_date,agreed_start_date,requested_end_date,agreed_end_date')
  .not('agreed_start_date', 'is', null).limit(10);
console.log('\nROWS WITH AGREED_DATES:', agreed?.length);
for (const a of agreed ?? []) {
  console.log(` ${a.rental_id.slice(0,8)} ${a.status} req:${a.requested_start_date}→${a.requested_end_date} agr:${a.agreed_start_date}→${a.agreed_end_date}`);
}

// 3) active rentals now — what's occupying bikes today
const { data: act } = await sb.from('rentals')
  .select('rental_id,vehicle_id,status,requested_start_date,requested_end_date,crew_id')
  .eq('status', 'active');
console.log('\nACTIVE RENTALS:', JSON.stringify(act, null, 1));

// 4) availability_rules structure on cars
const { data: rules } = await sb.from('cars')
  .select('id,crew_id,quantity,availability_rules,specs')
  .eq('crew_id', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746')
  .not('availability_rules', 'is', null).limit(5);
console.log('\nCARS WITH availability_rules:', rules?.length);
for (const c of rules ?? []) {
  console.log(` ${c.id} qty=${c.quantity} rules=${JSON.stringify(c.availability_rules).slice(0, 200)} hidden=${c.specs?.hidden}`);
}

// 5) quantity>1 for vip-bike?
const { data: qty } = await sb.from('cars')
  .select('id,quantity,type').eq('crew_id', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746').gt('quantity', 1);
console.log('\nQTY>1:', JSON.stringify(qty));
