// /home/z/my-project/scripts/compare-catalog-bikes.js
// Compare the two missing bikes (honda-cbr600rr-2003, ducati-1199-panigale-2012)
// to two working bikes that DO appear in the vip-bike catalog.
//
// Working bikes (control group) — pick the most recent / similar:
//   - ducati-panigale-s-electro-black-aero (added today, shows up)
//   - kawasaki-ex650k (older, shows up)
//
// Compares every column to identify what's different/missing.

const SUPABASE_URL = "https://inmctohsodgdohamhzag.supabase.co";
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlubWN0b2hzb2RnZG9oYW1oemFnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczODMzOTU4NSwiZXhwIjoyMDUzOTE1NTg1fQ.xD91Es2o8T1vM-2Ok8iKCn4jGDA5TwBbapD5eqhblLM";
const CREW_ID = "2d5fde70-1dd3-4f0d-8d72-66ccf6908746";  // vip-bike

const headers = {
  apikey: SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
};

async function fetchBike(id) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/cars?id=eq.${encodeURIComponent(id)}&select=*`,
    { headers },
  );
  const data = await res.json();
  return data[0] || null;
}

async function main() {
  const missing = [
    await fetchBike("honda-cbr600rr-2003"),
    await fetchBike("ducati-1199-panigale-2012"),
  ];
  const working = [
    await fetchBike("ducati-panigale-s-electro-black-aero"),
    await fetchBike("kawasaki-ex650k"),
  ];

  console.log("=== MISSING bikes (don't appear in catalog) ===");
  for (const b of missing) {
    if (!b) { console.log("  (not found)"); continue; }
    console.log(`  ${b.id} | ${b.make} ${b.model}`);
    console.log(`    type: ${b.type}`);
    console.log(`    crew_id: ${b.crew_id}`);
    console.log(`    owner_id: ${b.owner_id}`);
    console.log(`    daily_price: ${b.daily_price}`);
    console.log(`    image_url: ${b.image_url?.slice(0, 80) || 'null'}`);
    console.log(`    rent_link: ${b.rent_link?.slice(0, 80) || 'null'}`);
    console.log(`    is_test_result: ${b.is_test_result}`);
    console.log(`    specs: ${JSON.stringify(b.specs).slice(0, 300)}`);
    console.log(`    description: ${(b.description || '').slice(0, 80)}`);
    console.log(`    embedding: ${b.embedding ? 'set' : 'null'}`);
    console.log(`    --- (full row):`);
    console.log(`    ${JSON.stringify(b, null, 2).slice(0, 1500)}`);
    console.log("");
  }

  console.log("=== WORKING bikes (control group — appear in catalog) ===");
  for (const b of working) {
    if (!b) { console.log("  (not found)"); continue; }
    console.log(`  ${b.id} | ${b.make} ${b.model}`);
    console.log(`    type: ${b.type}`);
    console.log(`    crew_id: ${b.crew_id}`);
    console.log(`    owner_id: ${b.owner_id}`);
    console.log(`    daily_price: ${b.daily_price}`);
    console.log(`    image_url: ${b.image_url?.slice(0, 80) || 'null'}`);
    console.log(`    rent_link: ${b.rent_link?.slice(0, 80) || 'null'}`);
    console.log(`    is_test_result: ${b.is_test_result}`);
    console.log(`    specs: ${JSON.stringify(b.specs).slice(0, 300)}`);
    console.log(`    description: ${(b.description || '').slice(0, 80)}`);
    console.log(`    embedding: ${b.embedding ? 'set' : 'null'}`);
    console.log("");
  }

  // Diff: compare columns side-by-side
  console.log("=== DIFF: missing bike #1 (honda) vs working bike #1 (panigale-aero) ===");
  if (missing[0] && working[0]) {
    const allKeys = new Set([...Object.keys(missing[0]), ...Object.keys(working[0])]);
    for (const k of Array.from(allKeys).sort()) {
      const m = JSON.stringify(missing[0][k]);
      const w = JSON.stringify(working[0][k]);
      if (m !== w) {
        console.log(`  [${k}]`);
        console.log(`    missing: ${m?.slice(0, 200)}`);
        console.log(`    working: ${w?.slice(0, 200)}`);
      }
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
