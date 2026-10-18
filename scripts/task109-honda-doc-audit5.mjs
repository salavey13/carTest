// task109 part 5: honda lead updated_at + fixed todos query + falcon operator + docx content
// READ-ONLY. node --env-file=.env.local scripts/task109-honda-doc-audit5.mjs
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);
const fmt = (o) => JSON.stringify(o, null, 2);
const HONDA = 'b24dd324-b3e8-4bd5-8397-f5e6a9bb2b2f';
const FALCON = '221cbd97-bdff-467a-8890-8c681a2ac640';

// 1. honda lead — WHEN was it updated? (if updated_at ≈ 13:36 → tail completed past lead)
const { data: hLead } = await sb
  .from('franchize_intents')
  .select('id, stage, created_at, updated_at, metadata, telegram_user_id, bike_id, phone')
  .eq('metadata->>rentalId', HONDA)
  .maybeSingle();
console.log('=== HONDA lead ===');
console.log(fmt(hLead ? { ...hLead, metadata: { rentalId: hLead.metadata?.rentalId, sourceRoute: hLead.metadata?.sourceRoute } } : null));

// 2. falcon lead by any means (renter Баукин — phone/name/intent around Oct 18)
const { data: fRental } = await sb.from('rentals').select('metadata, created_by_operator_chat_id, user_id').eq('rental_id', FALCON).maybeSingle();
console.log('\n=== FALCON rental meta ===');
console.log(fmt({ operator: fRental?.created_by_operator_chat_id, user: fRental?.user_id, renter: fRental?.metadata?.renter_name, phone: fRental?.metadata?.renter_phone }));
const { data: fLeads } = await sb
  .from('franchize_intents')
  .select('id, stage, created_at, updated_at, metadata, telegram_user_id, bike_id, phone')
  .or(`metadata->>rentalId.eq.${FALCON},phone.eq.${fRental?.metadata?.renter_phone || '---'}`)
  .order('updated_at', { ascending: false })
  .limit(5);
console.log('=== FALCON leads (by rentalId or phone) ===');
for (const l of fLeads || []) console.log(fmt({ id: l.id, stage: l.stage, bike: l.bike_id, phone: l.phone, tg: l.telegram_user_id, created: l.created_at, updated: l.updated_at, rentalId: l.metadata?.rentalId, route: l.metadata?.sourceRoute }));
if (!fLeads?.length) console.log('!!! falcon: NO lead at all — tail died BEFORE lead upsert');

// 3. crew_todos WITHOUT metadata column — window around both incidents
const { data: todos1, error: tErr1 } = await sb
  .from('crew_todos')
  .select('id, title, priority, created_at, lead_id, status')
  .gte('created_at', '2026-10-18T07:50:00Z')
  .lte('created_at', '2026-10-18T13:45:00Z')
  .order('created_at');
console.log('\n=== crew_todos Oct18 07:50-13:45 (suzuki/falcon/honda windows) ===', tErr1 ? tErr1.message : '');
for (const t of todos1 || []) console.log(t.created_at, t.title?.slice(0, 70), t.priority, 'lead:', t.lead_id?.slice(0, 8));
if (!todos1?.length) console.log('(none — todo creation did NOT run for suzuki/falcon/honda)');

// 4. suzuki control: lead updated?
const { data: sLead } = await sb
  .from('franchize_intents')
  .select('id, stage, created_at, updated_at, metadata')
  .eq('metadata->>rentalId', 'f17df94a-2736-4b0f-b084-089aeb77ca17')
  .maybeSingle();
console.log('\n=== SUZUKI lead ===');
console.log(fmt(sLead ? { id: sLead.id, created: sLead.created_at, updated: sLead.updated_at, rentalId: sLead.metadata?.rentalId } : null));
