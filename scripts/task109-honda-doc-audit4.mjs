// task109 part 4: control group — did OTHER recent /doc flows complete their tail (lead)?
// READ-ONLY. node --env-file=.env.local scripts/task109-honda-doc-audit4.mjs
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);
const fmt = (o) => JSON.stringify(o, null, 2);

// rentals to check (all doc_command): suzuki Oct18 07:52, falcon Oct18 10:01, honda Oct18 13:36,
// yamaha Oct12 12:05, motoland Oct10 10:30, f800 Oct14 08:34, aprilia Oct17 09:16
const cases = [
  ['suzuki Oct18 07:52', 'f17df94a-2736-4b0f-b084-089aeb77ca17'],
  ['falcon Oct18 10:01', '221cbd97-bdff-467a-8890-8c681a2ac640'],
  ['honda  Oct18 13:36', 'b24dd324-b3e8-4bd5-8397-f5e6a9bb2b2f'],
  ['yamaha Oct12 12:05', '9f6c55fb-6c9a-4cf4-945b-544330f4aea6'],
  ['f800   Oct14 08:34', '28702ae4-21a2-45bb-9dd2-e770223ff933'],
  ['aprilia Oct17 09:16', 'a5532f57-7e00-41d3-a5c5-1abfb615de0a'],
  ['motoland Oct10 10:30', '03e18650-74a8-439a-b2ba-efddbea0af96'],
];

for (const [label, rentalId] of cases) {
  const { data: lead } = await sb
    .from('franchize_intents')
    .select('id, stage, created_at, updated_at, metadata')
    .eq('metadata->>rentalId', rentalId)
    .maybeSingle();
  console.log(`${label} rental=${rentalId.slice(0, 8)} → lead: ${lead ? `YES stage=${lead.stage} created=${lead.created_at}` : 'NO — tail died'}`);
}

// also: any intents created in the incident minute (maybe without rentalId link)
const { data: around } = await sb
  .from('franchize_intents')
  .select('id, stage, intent_type, created_at, metadata')
  .gte('created_at', '2026-10-18T13:30:00Z')
  .lte('created_at', '2026-10-18T14:00:00Z')
  .order('created_at');
console.log('\n=== intents created 13:30-14:00 Oct 18 ===');
for (const l of around || []) console.log(l.id, l.intent_type, l.stage, l.created_at, 'rentalId:', l.metadata?.rentalId || '—');
if (!around?.length) console.log('(none)');
