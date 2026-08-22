// /home/z/my-project/scripts/fix-jilang-metadata.js
const SUPABASE_URL = "https://inmctohsodgdohamhzag.supabase.co";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlubWN0b2hzb2RnZG9oYW1oemFnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczODMzOTU4NSwiZXhwIjoyMDUzOTE1NTg1fQ.xD91Es2o8T1vM-2Ok8iKCn4jGDA5TwBbapD5eqhblLM";
const RENTAL_ID = "38d38ec1-f6fb-4b98-a346-969f344da191";
const h = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

async function main() {
  // Read
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rentals?rental_id=eq.${RENTAL_ID}&select=metadata`, { headers: h });
  const data = await r.json();
  const meta = data[0].metadata;
  
  // Fix
  meta.payment_split.bank = 5500;
  meta.price_override_amount = 5500;
  
  // Write
  const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/rentals?rental_id=eq.${RENTAL_ID}`, {
    method: "PATCH",
    headers: { ...h, Prefer: "return=representation" },
    body: JSON.stringify({ metadata: meta }),
  });
  const patched = await patchRes.json();
  if (patched[0]) {
    const m = patched[0].metadata;
    console.log(`✅ bank=${m.payment_split.bank} override=${m.price_override_amount} total_cost=${patched[0].total_cost}`);
  } else {
    console.log(`❌ ${JSON.stringify(patched)}`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
