// task109 part 3: did the /doc tail chain complete? (lead + todos = post-success writes)
// READ-ONLY. node --env-file=.env.local scripts/task109-honda-doc-audit3.mjs
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);
const fmt = (o) => JSON.stringify(o, null, 2);
const HONDA = 'b24dd324-b3e8-4bd5-8397-f5e6a9bb2b2f';

// 1. franchize_intents (leads) linked to honda rental or created around the incident
const { data: leads, error: leadErr } = await sb
  .from('franchize_intents')
  .select('*')
  .or(`metadata->>rentalId.eq.${HONDA},created_at.gte.2026-10-18T13:30:00Z`)
  .gte('created_at', '2026-10-18T00:00:00Z')
  .order('created_at', { ascending: false })
  .limit(10);
console.log('=== FRANCHIZE_INTENTS (honda-linked or around 13:36) ===', leadErr ? fmt(leadErr) : '');
for (const l of leads || []) {
  console.log(fmt({
    id: l.id, stage: l.stage, intent: l.intent_type, bike: l.bike_id,
    phone: l.phone, full_name: l.full_name, route: l.source_route,
    rentalId: l.metadata?.rentalId, created: l.created_at, updated: l.updated_at,
  }));
}
if (!leads?.length) console.log('!!! NO lead for honda — flow died BEFORE lead upsert (after docx send)');

// 2. crew_todos for honda (equipment return + keys checks)
const { data: todos, error: todoErr } = await sb
  .from('crew_todos')
  .select('*')
  .or(`metadata->>rentalId.eq.${HONDA},metadata->>rental_id.eq.${HONDA}`)
  .gte('created_at', '2026-10-18T00:00:00Z')
  .limit(10);
console.log('\n=== CREW_TODOS for honda ===', todoErr ? fmt(todoErr) : '');
for (const t of todos || []) console.log(t.id, t.title?.slice(0, 80), t.priority, t.created_at);
if (!todos?.length) {
  // maybe todos link by lead_id — try created window instead
  const { data: td2 } = await sb
    .from('crew_todos')
    .select('id, title, priority, created_at, lead_id, metadata')
    .gte('created_at', '2026-10-18T13:36:00Z')
    .lte('created_at', '2026-10-18T13:40:00Z')
    .limit(10);
  console.log('=== CREW_TODOS created 13:36-13:40 (any) ===');
  for (const t of td2 || []) console.log(t.id, t.title?.slice(0, 80), t.priority, t.created_at, 'lead:', t.lead_id);
  if (!td2?.length) console.log('!!! NO crew_todos in the incident window — tail chain did NOT complete');
}

// 3. what does analytics page day 2026-10-18 see? (mirror of the dashboard query — count by crew+day)
const { data: dayRentals, error: dayErr } = await sb
  .from('rentals')
  .select('rental_id, vehicle_id, status, total_cost, crew_id, agreed_start_date, metadata')
  .eq('crew_id', '2d5fde70-1dd3-4f0d-8d72-66ccf6908746')
  .gte('agreed_start_date', '2026-10-17T00:00:00Z')
  .lte('agreed_start_date', '2026-10-19T00:00:00Z')
  .order('created_at', { ascending: false });
console.log('\n=== rentals crew=vip-bike agreed_start Oct17-19 ===', dayErr ? fmt(dayErr) : '');
for (const r of dayRentals || []) console.log(r.rental_id, r.status, r.vehicle_id, r.total_cost, r.agreed_start_date, r.metadata?.item_type || 'bike');
