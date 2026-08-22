// /home/z/my-project/scripts/find-test-rental.js
// Find the "test" rental the user created today via /doc command.
// The intent was found (f1af5157) but rentals query returned 0 — let's check why.

const SUPABASE_URL = "https://inmctohsodgdohamhzag.supabase.co";
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlubWN0b2hzb2RnZG9oYW1oemFnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczODMzOTU4NSwiZXhwIjoyMDUzOTE1NTg1fQ.xD91Es2o8T1vM-2Ok8iKCn4jGDA5TwBbapD5eqhblLM";

async function main() {
  // 1) List ALL rentals (no date filter) to see what's there
  console.log("=== ALL rentals (latest 20) ===");
  const rentRes = await fetch(
    `${SUPABASE_URL}/rest/v1/rentals?select=rental_id,user_id,vehicle_id,status,payment_status,requested_start_date,requested_end_date,total_cost,created_at,metadata,created_by_operator_chat_id&order=created_at.desc&limit=20`,
    {
      headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
    },
  );
  if (!rentRes.ok) {
    console.error("Rentals query failed:", rentRes.status, await rentRes.text());
    return;
  }
  const rentals = await rentRes.json();
  console.log(`Found ${rentals.length} rentals (latest 20)`);
  for (const r of rentals) {
    const meta = r.metadata || {};
    const renterName = meta.renter_name || meta.renter_full_name || "(no renter name)";
    const renterPhone = meta.renter_phone || meta.customer_phone || "(no phone)";
    const source = meta.source || "(no source)";
    const docSha = meta.doc_sha256 ? meta.doc_sha256.slice(0, 12) : "—";
    console.log(`  [${r.rental_id.slice(0, 8)}] bike=${r.vehicle_id} | user=${r.user_id?.slice(0, 8)} | op=${r.created_by_operator_chat_id || "—"} | ${r.status} | ${r.total_cost} ₽ | ${renterName} | ${renterPhone} | src=${source} | sha=${docSha} | created: ${r.created_at}`);
  }

  // 2) Get the specific intent to see its full metadata (maybe rental_id was stored there)
  console.log("");
  console.log("=== Intent f1af5157 (the test rent) full metadata ===");
  const intentRes = await fetch(
    `${SUPABASE_URL}/rest/v1/franchize_intents?id=eq.f1af5157-0000-0000-0000-000000000000&select=*`,
    { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } },
  );
  // The ID prefix isn't the full UUID — let me query by phone + intent_type instead
  const intentByPhoneRes = await fetch(
    `${SUPABASE_URL}/rest/v1/franchize_intents?phone=eq.%2B79123456789&intent_type=eq.rent&select=*&order=created_at.desc&limit=5`,
    { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } },
  );
  if (intentByPhoneRes.ok) {
    const intents = await intentByPhoneRes.json();
    for (const i of intents) {
      console.log(`  intent_id=${i.id}`);
      console.log(`  intent_type=${i.intent_type} | stage=${i.stage} | bike_id=${i.bike_id}`);
      console.log(`  phone=${i.phone} | telegram_user_id=${i.telegram_user_id}`);
      console.log(`  metadata=${JSON.stringify(i.metadata, null, 2)}`);
      console.log(`  created_at=${i.created_at}`);
      console.log(`  ---`);
    }
  }

  // 3) Find the rental by metadata.renter_phone = +79123456789
  console.log("");
  console.log("=== Rentals with renter_phone = +79123456789 in metadata ===");
  const rentByPhoneRes = await fetch(
    `${SUPABASE_URL}/rest/v1/rentals?select=rental_id,user_id,vehicle_id,status,created_at,metadata&order=created_at.desc&limit=20`,
    { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } },
  );
  if (rentByPhoneRes.ok) {
    const allRentals = await rentByPhoneRes.json();
    const testRentals = allRentals.filter((r) => {
      const meta = r.metadata || {};
      return meta.renter_phone === "+79123456789" || meta.renter_phone === "+7 912 345 67 89" || meta.renter_phone === "+79123456789";
    });
    console.log(`Found ${testRentals.length} rentals with phone +79123456789`);
    for (const r of testRentals) {
      console.log(`  [${r.rental_id}] bike=${r.vehicle_id} | ${r.status} | created: ${r.created_at}`);
    }
  }

  // 4) Also check if maybe the rental was created with renter_name = "Test Test Test"
  console.log("");
  console.log("=== Rentals with renter_name = 'Test Test Test' in metadata ===");
  const rentByNameRes = await fetch(
    `${SUPABASE_URL}/rest/v1/rentals?select=rental_id,vehicle_id,status,created_at,metadata&order=created_at.desc&limit=100`,
    { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } },
  );
  if (rentByNameRes.ok) {
    const allRentals = await rentByNameRes.json();
    const testRentals = allRentals.filter((r) => {
      const meta = r.metadata || {};
      return meta.renter_name === "Test Test Test" || meta.renter_name?.includes("Test Test");
    });
    console.log(`Found ${testRentals.length} rentals with name 'Test Test Test'`);
    for (const r of testRentals) {
      console.log(`  rental_id=${r.rental_id}`);
      console.log(`  bike=${r.vehicle_id} | ${r.status} | created: ${r.created_at}`);
      console.log(`  metadata=${JSON.stringify(r.metadata, null, 2).slice(0, 500)}`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
