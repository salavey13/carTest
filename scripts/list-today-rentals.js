// /home/z/my-project/scripts/list-today-rentals.js
// List today's rentals (created today) so user can identify the "test" rental to delete.

const SUPABASE_URL = "https://inmctohsodgdohamhzag.supabase.co";
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlubWN0b2hzb2RnZG9oYW1oemFnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczODMzOTU4NSwiZXhwIjoyMDUzOTE1NTg1fQ.xD91Es2o8T1vM-2Ok8iKCn4jGDA5TwBbapD5eqhblLM";

async function main() {
  // Today's date in ISO format (Europe/Moscow timezone)
  const now = new Date();
  // Moscow is UTC+3
  const moscowOffset = 3 * 60 * 60 * 1000;
  const moscowNow = new Date(now.getTime() + moscowOffset);
  const todayStart = new Date(Date.UTC(moscowNow.getUTCFullYear(), moscowNow.getUTCMonth(), moscowNow.getUTCDate()));
  const todayStartIso = todayStart.toISOString();
  console.log(`Today start (MSK): ${new Date(todayStartIso).toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })}`);
  console.log("");

  // 1) List rentals created today
  console.log("=== Rentals created today ===");
  const rentRes = await fetch(
    `${SUPABASE_URL}/rest/v1/rentals?select=rental_id,user_id,vehicle_id,status,payment_status,requested_start_date,requested_end_date,total_cost,created_at,metadata,created_by_operator_chat_id,vehicle:cars!inner(id,make,model,crew_id)&created_at=gte.${todayStartIso}&order=created_at.desc&limit=50`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    },
  );
  if (!rentRes.ok) {
    console.error("Rentals query failed:", rentRes.status, await rentRes.text());
    process.exit(1);
  }
  const rentals = await rentRes.json();
  console.log(`Found ${rentals.length} rentals created today`);
  for (const r of rentals) {
    const vehicle = Array.isArray(r.vehicle) ? r.vehicle[0] : r.vehicle;
    const bikeName = `${vehicle?.make || ""} ${vehicle?.model || ""}`.trim();
    const meta = r.metadata || {};
    const renterName = meta.renter_name || meta.renter_full_name || "(no renter name)";
    const renterPhone = meta.renter_phone || meta.customer_phone || "(no phone)";
    const source = meta.source || "(no source)";
    console.log(`  [${r.rental_id.slice(0, 8)}] ${bikeName} | ${renterName} | ${renterPhone} | ${r.status} | ${source} | ${r.total_cost} ₽ | created: ${r.created_at}`);
  }

  // 2) List rental_contract_artifacts created today
  console.log("");
  console.log("=== Rental contract artifacts created today (private schema via RPC) ===");
  const artRes = await fetch(
    `${SUPABASE_URL}/rest/v1/rental_contract_artifacts?select=id,contract_key,rental_id,renter_full_name,renter_phone,requested_bike_id,resolved_bike_id,total_sum,created_at,created_by_operator_chat_id,storage_path&created_at=gte.${todayStartIso}&order=created_at.desc&limit=50`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    },
  );
  if (!artRes.ok) {
    console.error("Artifacts query failed:", artRes.status, await artRes.text());
  } else {
    const artifacts = await artRes.json();
    console.log(`Found ${artifacts.length} rental_contract_artifacts created today`);
    for (const a of artifacts) {
      console.log(`  [${a.id.slice(0, 8)}] key=${a.contract_key} | rental_id=${a.rental_id || "null"} | ${a.renter_full_name || "—"} | ${a.renter_phone || "—"} | ${a.total_sum} ₽ | created: ${a.created_at}`);
    }
  }

  // 3) List testdrive_contract_artifacts created today
  console.log("");
  console.log("=== Testdrive contract artifacts created today ===");
  const tdRes = await fetch(
    `${SUPABASE_URL}/rest/v1/testdrive_contract_artifacts?select=id,contract_key,crew_slug,requested_bike_id,resolved_bike_id,customer_full_name,customer_phone,total_sum,created_at,created_by_operator_chat_id,storage_path,telegram_chat_id&created_at=gte.${todayStartIso}&order=created_at.desc&limit=50`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    },
  );
  if (!tdRes.ok) {
    console.error("Testdrive query failed:", tdRes.status, await tdRes.text());
  } else {
    const tds = await tdRes.json();
    console.log(`Found ${tds.length} testdrive_contract_artifacts created today`);
    for (const t of tds) {
      console.log(`  [${t.id.slice(0, 8)}] key=${t.contract_key} | bike=${t.requested_bike_id} | ${t.customer_full_name || "—"} | ${t.customer_phone || "—"} | sum=${t.total_sum} | created: ${t.created_at}`);
    }
  }

  // 4) List franchize_intents created today
  console.log("");
  console.log("=== Franchize intents created today ===");
  const intentRes = await fetch(
    `${SUPABASE_URL}/rest/v1/franchize_intents?select=id,slug,intent_type,stage,phone,telegram_user_id,bike_id,metadata,created_at,last_seen_at&created_at=gte.${todayStartIso}&order=created_at.desc&limit=50`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    },
  );
  if (!intentRes.ok) {
    console.error("Intents query failed:", intentRes.status, await intentRes.text());
  } else {
    const intents = await intentRes.json();
    console.log(`Found ${intents.length} franchize_intents created today`);
    for (const i of intents) {
      const meta = i.metadata || {};
      console.log(`  [${i.id.slice(0, 8)}] slug=${i.slug} | ${i.intent_type} | stage=${i.stage} | phone=${i.phone || "—"} | tg=${i.telegram_user_id || "—"} | bike=${i.bike_id || "—"} | meta=${JSON.stringify(meta).slice(0, 120)} | created: ${i.created_at}`);
    }
  }

  // 5) List crew_todos created today (related to test rental)
  console.log("");
  console.log("=== Crew todos created today ===");
  const todoRes = await fetch(
    `${SUPABASE_URL}/rest/v1/crew_todos?select=id,crew_id,lead_id,rental_id,title,description,status,priority,category,metadata,created_at&created_at=gte.${todayStartIso}&order=created_at.desc&limit=50`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    },
  );
  if (!todoRes.ok) {
    console.error("Todos query failed:", todoRes.status, await todoRes.text());
  } else {
    const todos = await todoRes.json();
    console.log(`Found ${todos.length} crew_todos created today`);
    for (const t of todos) {
      console.log(`  [${t.id.slice(0, 8)}] rental_id=${t.rental_id || "null"} | lead_id=${t.lead_id || "null"} | ${t.title} | ${t.status} | ${t.priority} | created: ${t.created_at}`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
