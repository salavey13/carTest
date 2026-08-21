// /home/z/my-project/scripts/find-doc-sha-for-rentals.js
// Find the doc_sha256 for both failed /doc rentals by querying the
// franchize_intents table (where doc_sha256 is stored in metadata).

const SUPABASE_URL = "https://inmctohsodgdohamhzag.supabase.co";
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlubWN0b2hzb2RnZG9oYW1oemFnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczODMzOTU4NSwiZXhwIjoyMDUzOTE1NTg1fQ.xD91Es2o8T1vM-2Ok8iKCn4jGDA5TwBbapD5eqhblLM";
const headers = { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` };

async function main() {
  // Find rent intents created today
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/franchize_intents?intent_type=eq.rent&created_at=gte.2026-08-21T00:00:00Z&select=id,phone,telegram_user_id,bike_id,metadata,created_at,slug&order=created_at.desc&limit=10`,
    { headers },
  );
  const intents = await res.json();
  console.log(`Found ${intents.length} rent intents today:`);
  for (const i of intents) {
    const meta = i.metadata || {};
    console.log(`  [${i.id}]`);
    console.log(`    name: ${meta.name || "—"}`);
    console.log(`    phone: ${i.phone || "—"}`);
    console.log(`    bike: ${i.bike_id}`);
    console.log(`    docSha256: ${meta.docSha256 || "NOT SET"}`);
    console.log(`    operatorId: ${meta.operatorId}`);
    console.log(`    stage: ${i.stage}`);
    console.log(`    created: ${i.created_at}`);
    console.log(`    ---`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
