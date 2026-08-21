// /home/z/my-project/scripts/find-rental-contracts-by-storage.js
// Find today's rental contract .docx files in Supabase Storage bucket.
// Match them by filename pattern to identify the two failed rentals.
// Filename pattern from /doc-manual.ts:
//   rental-{bike.make}-{bike.model}-{ISO_DATE}.docx
// For bikes:
//   - ducati-1199-panigale-2012 → "rental-Ducati-1199-Panigale-2026-08-21.docx"
//   - ducati-panigale-s-electro-black-aero → "rental-Ducati-Panigale-S-Electro-Black-Aero-2026-08-21.docx"

const SUPABASE_URL = "https://inmctohsodgdohamhzag.supabase.co";
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlubWN0b2hzb2RnZG9oYW1oemFnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczODMzOTU4NSwiZXhwIjoyMDUzOTE1NTg1fQ.xD91Es2o8T1vM-2Ok8iKCn4jGDA5TwBbapD5eqhblLM";
const BUCKET = "rental-contracts";

async function listAll(prefix) {
  const out = [];
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${BUCKET}`, {
    method: "POST",
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prefix, limit: 1000, offset: 0 }),
  });
  if (!r.ok) return out;
  const data = await r.json();
  for (const e of data) {
    if (e.id) out.push({ path: `${prefix}${e.name}`, size: e.metadata?.size || null, updatedAt: e.updated_at, id: e.id });
    else out.push(...await listAll(`${prefix}${e.name}/`));
  }
  return out;
}

async function main() {
  const all = await listAll("");
  // Today's files (UTC date 2026-08-21)
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayFiles = all.filter((f) => f.updatedAt && new Date(f.updatedAt).getTime() >= todayStart.getTime());
  console.log(`Files updated today: ${todayFiles.length}`);
  console.log("");

  // The two failed rentals would be 'rental-*.docx' files updated today (not 'testdrive-*')
  const rentalFiles = todayFiles.filter((f) => {
    const name = f.path.split("/").pop() || "";
    return name.startsWith("rental-") && name.endsWith(".docx");
  });
  console.log(`Rental contract files updated today: ${rentalFiles.length}`);
  for (const f of rentalFiles) {
    console.log(`  ${f.path}  size=${f.size}  updatedAt=${f.updatedAt}  id=${f.id}`);
  }

  // Also list ALL 'rental-*.docx' files (last 20) so we can see if older ones exist
  console.log("");
  console.log(`All rental-*.docx files (last 20):`);
  const allRental = all.filter((f) => {
    const name = f.path.split("/").pop() || "";
    return name.startsWith("rental-") && name.endsWith(".docx");
  }).slice(0, 20);
  for (const f of allRental) {
    console.log(`  ${f.path}  size=${f.size}  updatedAt=${f.updatedAt}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
