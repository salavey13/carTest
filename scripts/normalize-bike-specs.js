// /home/z/my-project/scripts/normalize-bike-specs.js
// Normalize specs.rent / specs.sale from strings ("1", "true", "false") to
// proper JSON types (number 1, boolean true, boolean false) for the two
// newly-added bikes. This is a defensive fix — isSpecExplicitlyEnabled in
// catalog-utils.ts already handles both string + number/boolean, but
// inconsistent types can cause subtle bugs elsewhere (e.g. strict === checks).

const SUPABASE_URL = "https://inmctohsodgdohamhzag.supabase.co";
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlubWN0b2hzb2RnZG9oYW1oemFnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczODMzOTU4NSwiZXhwIjoyMDUzOTE1NTg1fQ.xD91Es2o8T1vM-2Ok8iKCn4jGDA5TwBbapD5eqhblLM";
const headers = {
  apikey: SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

const TARGET_BIKES = [
  { id: "honda-cbr600rr-2003", expectedRent: 1, expectedSale: false },
  { id: "ducati-1199-panigale-2012", expectedRent: 1, expectedSale: true },
];

async function main() {
  for (const bike of TARGET_BIKES) {
    console.log(`=== ${bike.id} ===`);
    // 1) Fetch current row
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/cars?id=eq.${bike.id}&select=id,specs,rent_link`,
      { headers },
    );
    const data = await res.json();
    if (!data[0]) { console.log(`  ❌ not found`); continue; }
    const row = data[0];
    const specs = row.specs || {};
    let changed = false;

    // 2) Normalize rent
    if (typeof specs.rent === "string") {
      const v = specs.rent.toLowerCase();
      specs.rent = (v === "1" || v === "true") ? 1 : 0;
      changed = true;
      console.log(`  specs.rent: "${row.specs.rent}" → ${specs.rent} (number)`);
    }
    // 3) Normalize sale
    if (typeof specs.sale === "string") {
      const v = specs.sale.toLowerCase();
      specs.sale = (v === "1" || v === "true");
      changed = true;
      console.log(`  specs.sale: "${row.specs.sale}" → ${specs.sale} (boolean)`);
    }
    // 4) Normalize hidden
    if (typeof specs.hidden === "string") {
      const v = specs.hidden.toLowerCase();
      specs.hidden = (v === "1" || v === "true");
      changed = true;
      console.log(`  specs.hidden: "${row.specs.hidden}" → ${specs.hidden} (boolean)`);
    }
    // 5) Also set rent_link if null (Honda was missing it)
    const patch = { specs };
    if (!row.rent_link) {
      patch.rent_link = `/rent/${bike.id}`;
      console.log(`  rent_link: null → /rent/${bike.id}`);
      changed = true;
    }

    if (!changed) {
      console.log(`  ✅ already normalized, no changes needed`);
      continue;
    }

    // 6) Patch
    const patchRes = await fetch(
      `${SUPABASE_URL}/rest/v1/cars?id=eq.${bike.id}`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify(patch),
      },
    );
    const patchData = await patchRes.json();
    if (!patchRes.ok) {
      console.log(`  ❌ PATCH failed: ${patchRes.status} ${JSON.stringify(patchData).slice(0, 200)}`);
    } else {
      console.log(`  ✅ PATCH succeeded — row updated`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
