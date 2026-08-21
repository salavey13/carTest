// /home/z/my-project/scripts/investigate-failed-rentals.js
// Investigate the two failed /doc rentals from today (21.08.2026).
// Find:
//   1. Crew ownership (was the issue multiple owners?)
//   2. Rental contract artifacts (by doc_sha256 from user message: 8d8c8502951e for first)
//   3. user_rental_secrets entries for the two renters
//   4. Users table (last 5 entries to find the QR-claimed users)
//   5. Bike IDs (Ducati 1199 Panigale, Ducati Panigale S Electro Black Aero)

const SUPABASE_URL = "https://inmctohsodgdohamhzag.supabase.co";
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlubWN0b2hzb2RnZG9oYW1oemFnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczODMzOTU4NSwiZXhwIjoyMDUzOTE1NTg1fQ.xD91Es2o8T1vM-2Ok8iKCn4jGDA5TwBbapD5eqhblLM";
const CREW_ID = "2d5fde70-1dd3-4f0d-8d72-66ccf6908746";  // vip-bike crew (from error log)

const headers = {
  apikey: SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
};

async function main() {
  // 1) Crew members — see current ownership state (after user changed 2 to co_owners)
  console.log("=== 1. crew_members (current state) ===");
  const cmRes = await fetch(
    `${SUPABASE_URL}/rest/v1/crew_members?crew_id=eq.${CREW_ID}&select=user_id,role,membership_status,joined_at&order=joined_at.asc`,
    { headers },
  );
  if (!cmRes.ok) {
    console.error("crew_members query failed:", cmRes.status, await cmRes.text());
  } else {
    const cms = await cmRes.json();
    console.log(`Found ${cms.length} crew members:`);
    // Fetch user info separately to avoid join issues
    const userIds = cms.map((cm) => cm.user_id);
    const usersRes = await fetch(
      `${SUPABASE_URL}/rest/v1/users?user_id=in.(${userIds.map((id) => `"${id}"`).join(",")})&select=user_id,full_name,username`,
      { headers },
    );
    const users = usersRes.ok ? await usersRes.json() : [];
    const userMap = new Map(users.map((u) => [u.user_id, u]));
    for (const cm of cms) {
      const u = userMap.get(cm.user_id);
      console.log(`  ${cm.user_id} | role=${cm.role} | status=${cm.membership_status} | ${u?.full_name || "—"} | @${u?.username || "—"}`);
    }
  }

  // 2) Find crew owner (role = 'owner')
  console.log("");
  console.log("=== 2. Crew owner lookup ===");
  const ownerRes = await fetch(
    `${SUPABASE_URL}/rest/v1/crew_members?crew_id=eq.${CREW_ID}&role=eq.owner&select=user_id,role,membership_status`,
    { headers },
  );
  const owners = ownerRes.ok ? await ownerRes.json() : [];
  console.log(`Owners (role='owner'): ${owners.length}`);
  for (const o of owners) {
    console.log(`  ${o.user_id} | role=${o.role} | status=${o.membership_status}`);
  }

  // 3) Find bikes (Ducati 1199 Panigale + Ducati Panigale S Electro Black Aero)
  console.log("");
  console.log("=== 3. Bikes ===");
  const bikesRes = await fetch(
    `${SUPABASE_URL}/rest/v1/cars?make=ilike.Ducati*&select=id,make,model,crew_id,daily_price,specs`,
    { headers },
  );
  const bikes = await bikesRes.json();
  console.log(`Ducati bikes: ${bikes.length}`);
  for (const b of bikes) {
    console.log(`  ${b.id} | ${b.make} ${b.model} | crew=${b.crew_id} | price=${b.daily_price}`);
  }

  // 4) user_rental_secrets — find recent entries
  console.log("");
  console.log("=== 4. Recent user_rental_secrets (private schema — try via RPC) ===");
  // user_rental_secrets is private — try the claim RPC's underlying data
  // Or check if there's a public view. Try direct REST:
  const ursRes = await fetch(
    `${SUPABASE_URL}/rest/v1/user_rental_secrets?select=*&limit=10`,
    { headers },
  );
  if (!ursRes.ok) {
    console.log(`  user_rental_secrets: ${ursRes.status} (private schema — expected)`);
  } else {
    const urs = await ursRes.json();
    console.log(`Found ${urs.length} rows`);
    for (const r of urs) console.log(`  ${JSON.stringify(r).slice(0, 200)}`);
  }

  // 5) Users table — last 8 entries (to find the 2 new QR-claimed users)
  console.log("");
  console.log("=== 5. Recent users (last 10) ===");
  const usersRes = await fetch(
    `${SUPABASE_URL}/rest/v1/users?select=user_id,full_name,username,metadata,created_at&order=created_at.desc&limit=10`,
    { headers },
  );
  const users = await usersRes.json();
  console.log(`Found ${users.length} recent users:`);
  for (const u of users) {
    const meta = u.metadata || {};
    console.log(`  ${u.user_id} | ${u.full_name || "—"} | @${u.username || "—"} | phone=${meta.phone || "—"} | created: ${u.created_at}`);
  }

  // 6) Find today's rental_contract_artifacts via RPC or alternative method
  console.log("");
  console.log("=== 6. Recent rental_contract_artifacts (today) ===");
  // rental_contract_artifacts is in private schema — try direct fetch (may 404)
  const rcaRes = await fetch(
    `${SUPABASE_URL}/rest/v1/rental_contract_artifacts?select=*&created_at=gte.2026-08-21T00:00:00Z&order=created_at.desc&limit=10`,
    { headers },
  );
  if (!rcaRes.ok) {
    console.log(`  rental_contract_artifacts: ${rcaRes.status} (private schema — expected)`);
  } else {
    const rcas = await rcaRes.json();
    console.log(`Found ${rcas.length} rows`);
    for (const r of rcas) console.log(`  ${JSON.stringify(r).slice(0, 200)}`);
  }

  // 7) Today's rentals (to see if any rental rows exist for these bikes)
  console.log("");
  console.log("=== 7. Today's rentals (already exists?) ===");
  const rentalsRes = await fetch(
    `${SUPABASE_URL}/rest/v1/rentals?select=rental_id,user_id,vehicle_id,status,requested_start_date,requested_end_date,total_cost,created_at,metadata&created_at=gte.2026-08-21T00:00:00Z&order=created_at.desc&limit=10`,
    { headers },
  );
  const rentals = await rentalsRes.json();
  console.log(`Rentals created today: ${rentals.length}`);
  for (const r of rentals) {
    const meta = r.metadata || {};
    console.log(`  [${r.rental_id.slice(0, 8)}] bike=${r.vehicle_id} | user=${r.user_id} | ${r.status} | ${meta.renter_name || "—"} | ${meta.renter_phone || "—"} | created: ${r.created_at}`);
  }

  // 8) Find franchize_intents for today's /doc attempts
  console.log("");
  console.log("=== 8. Today's rent intents ===");
  const intentsRes = await fetch(
    `${SUPABASE_URL}/rest/v1/franchize_intents?intent_type=eq.rent&created_at=gte.2026-08-21T00:00:00Z&select=id,slug,phone,telegram_user_id,bike_id,metadata,stage,created_at&order=created_at.desc&limit=10`,
    { headers },
  );
  const intents = await intentsRes.json();
  console.log(`Rent intents today: ${intents.length}`);
  for (const i of intents) {
    const meta = i.metadata || {};
    console.log(`  [${i.id.slice(0, 8)}] bike=${i.bike_id} | phone=${i.phone} | name=${meta.name} | stage=${i.stage} | created: ${i.created_at}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
