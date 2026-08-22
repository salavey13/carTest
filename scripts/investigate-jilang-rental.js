// /home/z/my-project/scripts/investigate-jilang-rental.js
// Investigate the latest jilang-max-pro rental: equipment cost, confirmation message, and stored data.

const SUPABASE_URL = "https://inmctohsodgdohamhzag.supabase.co";
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlubWN0b2hzb2RnZG9oYW1oemFnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczODMzOTU4NSwiZXhwIjoyMDUzOTE1NTg1fQ.xD91Es2o8T1vM-2Ok8iKCn4jGDA5TwBbapD5eqhblLM";
const headers = { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` };

async function main() {
  // 1. Latest rental for jilang-max-pro
  console.log("=== Latest rentals for jilang-max-pro ===");
  const rentRes = await fetch(
    `${SUPABASE_URL}/rest/v1/rentals?vehicle_id=eq.jilang-max-pro&select=rental_id,user_id,status,total_cost,requested_start_date,requested_end_date,created_at,metadata&order=created_at.desc&limit=3`,
    { headers },
  );
  const rentals = await rentRes.json();
  for (const r of rentals) {
    console.log(`  [${r.rental_id.slice(0, 8)}] status=${r.status} cost=${r.total_cost} created=${r.created_at}`);
    console.log(`    dates: ${r.requested_start_date} → ${r.requested_end_date}`);
    console.log(`    metadata: ${JSON.stringify(r.metadata, null, 2).slice(0, 800)}`);
    console.log("");
  }

  // 2. Latest rental_contract_artifacts (private schema - try via REST)
  console.log("=== Latest rental_contract_artifacts ===");
  const artRes = await fetch(
    `${SUPABASE_URL}/rest/v1/rental_contract_artifacts?select=*&order=created_at.desc&limit=3`,
    { headers },
  );
  if (artRes.ok) {
    const arts = await artRes.json();
    for (const a of arts) {
      console.log(`  [${a.id?.toString().slice(0, 8)}] key=${a.contract_key} rental_id=${a.rental_id || "null"}`);
      console.log(`    renter: ${a.renter_full_name} | phone: ${a.renter_phone}`);
      console.log(`    daily_price: ${a.daily_price} | total_sum: ${a.total_sum}`);
      console.log(`    dates: ${a.rent_start_date} → ${a.rent_end_date}`);
      console.log(`    created: ${a.created_at}`);
      console.log("");
    }
  } else {
    console.log(`  private schema not accessible via REST: ${artRes.status}`);
  }

  // 3. Check the equipment pricing in the /doc flow
  console.log("=== Equipment pricing check ===");
  console.log("ADDITIONAL_ITEMS from doc-manual.ts:");
  console.log("  helmet: price=1000, hourlyPrice=500, type=count, max=2");
  console.log("  gloves: price=500, type=toggle");
  console.log("  jacket: price=500, type=toggle");
  console.log("  boots: price=500, type=toggle");
  console.log("  net: price=500, type=toggle");
  console.log("  backpack: price=500, type=toggle");
  console.log("  charger: price=0, type=toggle");
  console.log("");
  console.log("For 3-hour rental (<24h), hourlyPrice applies:");
  console.log("  1 helmet = 500₽ (hourlyPrice)");
  console.log("  2 helmets = 1000₽ (2 × 500)");
  console.log("  So 1000₽ for 2 helmets on 3h rental is CORRECT");
  console.log("  But if the user selected 1 helmet and got charged 1000, that's a bug");
  console.log("");

  // 4. Check the latest rental's metadata for equipment count
  if (rentals.length > 0) {
    const latest = rentals[0];
    const meta = latest.metadata || {};
    console.log("=== Latest rental metadata analysis ===");
    console.log(`  rental_id: ${latest.rental_id}`);
    console.log(`  total_cost: ${latest.total_cost}`);
    console.log(`  metadata.daily_price: ${meta.daily_price}`);
    console.log(`  metadata.equipment: ${JSON.stringify(meta.equipment)}`);
    console.log(`  metadata.payment_split: ${JSON.stringify(meta.payment_split)}`);
    console.log(`  metadata.deposit_amount: ${meta.deposit_amount}`);
    console.log(`  metadata.renter_name: ${meta.renter_name}`);
    console.log(`  metadata.renter_phone: ${meta.renter_phone}`);
    console.log(`  metadata.price_overridden: ${meta.price_overridden}`);
    console.log(`  All metadata keys: ${Object.keys(meta).join(", ")}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
