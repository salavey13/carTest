// /home/z/my-project/scripts/delete-test-rental.js
// Delete today's "test" rental data from Supabase.
// Test rental identified by:
//   - renter_name: "Test Test Test"
//   - renter_phone: "+79123456789"
//   - intent_id: f1af5157-c918-428b-92fa-6b90f8146a41
//   - created: 2026-08-21T15:15:33 UTC (today)
//
// Clean up:
//   1. franchize_intents (public schema)
//   2. crew_todos (public schema) — where lead_id matches the operator's TG id
//      AND title contains test indicators OR created today
//   3. user_rental_secrets (private schema — via RPC if available, else skip)
//   4. rental_contract_artifacts (private schema — via RPC if available, else skip)
//   5. Any doc_verifier_records (private schema)
//
// DRY-RUN mode: prints what WOULD be deleted. Pass --commit to actually delete.

const SUPABASE_URL = "https://inmctohsodgdohamhzag.supabase.co";
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlubWN0b2hzb2RnZG9oYW1oemFnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczODMzOTU4NSwiZXhwIjoyMDUzOTE1NTg1fQ.xD91Es2o8T1vM-2Ok8iKCn4jGDA5TwBbapD5eqhblLM";

const COMMIT = process.argv.includes("--commit");
const TEST_PHONE = "+79123456789";
const TEST_NAME = "Test Test Test";
const OPERATOR_TG_ID = "413553377";  // salavey13 — created the test rental

const headers = {
  apikey: SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
  "Content-Type": "application/json",
};

async function deleteRow(table, filter) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${filter}`;
  const method = COMMIT ? "DELETE" : "GET";
  const res = await fetch(url, {
    method,
    headers: {
      ...headers,
      Prefer: COMMIT ? "return=representation" : "count=exact",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    return { ok: false, status: res.status, error: text, count: 0 };
  }
  if (COMMIT) {
    const deleted = await res.json();
    return { ok: true, count: Array.isArray(deleted) ? deleted.length : 0, deleted };
  } else {
    const count = res.headers.get("content-range")?.split("/")[1] || "0";
    return { ok: true, count: parseInt(count, 10) || 0 };
  }
}

async function main() {
  console.log(`Mode: ${COMMIT ? "⚠️  COMMIT (will DELETE)" : "🔍 DRY RUN (no changes)"}`);
  console.log("");

  // 1. franchize_intents — match by phone OR by name in metadata
  console.log("=== 1. franchize_intents ===");
  // First find them by phone
  const intentByPhone = await fetch(
    `${SUPABASE_URL}/rest/v1/franchize_intents?phone=eq.${encodeURIComponent(TEST_PHONE)}&select=id,intent_type,stage,metadata,created_at`,
    { headers },
  ).then((r) => r.json()).catch(() => []);
  // Also find by telegram_user_id = operator (in case phone normalization differs)
  const intentByOp = await fetch(
    `${SUPABASE_URL}/rest/v1/franchize_intents?telegram_user_id=eq.${OPERATOR_TG_ID}&created_at=gte.2026-08-21T00:00:00Z&select=id,intent_type,stage,metadata,created_at`,
    { headers },
  ).then((r) => r.json()).catch(() => []);

  const allIntents = [...intentByPhone, ...intentByOp];
  // Dedupe by id
  const intentMap = new Map();
  for (const i of allIntents) intentMap.set(i.id, i);
  // Filter to only test-related (name contains "Test Test" OR phone matches)
  const testIntents = Array.from(intentMap.values()).filter((i) => {
    const meta = i.metadata || {};
    const name = meta.name || "";
    const phone = i.phone || meta.phone || "";
    return name.includes("Test Test") || phone === TEST_PHONE;
  });
  console.log(`Found ${testIntents.length} test-related franchize_intents:`);
  for (const i of testIntents) {
    console.log(`  ${i.id} | ${i.intent_type} | ${i.stage} | ${(i.metadata || {}).name || "—"} | ${i.created_at}`);
  }
  if (testIntents.length > 0) {
    const intentIds = testIntents.map((i) => `"${i.id}"`).join(",");
    const result = await deleteRow("franchize_intents", `id=in.(${intentIds})`);
    console.log(`  → ${COMMIT ? "DELETED" : "would delete"} ${result.count} intent(s)`);
    if (!result.ok) console.log(`  ERROR: ${result.error}`);
  }

  // 2. crew_todos — where lead_id = operator's TG id AND created today
  console.log("");
  console.log("=== 2. crew_todos (created today, lead_id = operator) ===");
  const todoRes = await fetch(
    `${SUPABASE_URL}/rest/v1/crew_todos?lead_id=eq.${OPERATOR_TG_ID}&created_at=gte.2026-08-21T00:00:00Z&select=id,title,status,rental_id,created_at`,
    { headers },
  );
  if (!todoRes.ok) {
    console.log(`  Query failed: ${todoRes.status} ${await todoRes.text()}`);
  } else {
    const todos = await todoRes.json();
    console.log(`Found ${todos.length} crew_todos for operator ${OPERATOR_TG_ID} created today:`);
    for (const t of todos) {
      console.log(`  ${t.id} | ${t.title} | ${t.status} | rental=${t.rental_id || "—"} | ${t.created_at}`);
    }
    if (todos.length > 0) {
      const todoIds = todos.map((t) => `"${t.id}"`).join(",");
      const result = await deleteRow("crew_todos", `id=in.(${todoIds})`);
      console.log(`  → ${COMMIT ? "DELETED" : "would delete"} ${result.count} todo(s)`);
    }
  }

  // 3. Try to clean up user_rental_secrets via RPC (private schema — check if RPC exists)
  console.log("");
  console.log("=== 3. user_rental_secrets (private schema) ===");
  console.log("  Cannot directly query private schema via REST. Trying to find via the renter_phone column...");
  // user_rental_secrets is in private schema — we can't access it via REST without an RPC
  // Let's check if there's a delete RPC. If not, we'll skip and note it.
  // The testdrive_contract_artifacts table is also private — same issue.
  console.log("  ⚠️  private schema not directly accessible via REST. Manual SQL needed:");
  console.log("     DELETE FROM private.user_rental_secrets WHERE renter_phone = '+79123456789';");
  console.log("     DELETE FROM private.rental_contract_artifacts WHERE renter_phone = '+79123456789';");
  console.log("     DELETE FROM private.testdrive_contract_artifacts WHERE customer_phone = '+79123456789';");

  // 4. users table — check if a synthetic user was created for the test
  console.log("");
  console.log("=== 4. users table (synthetic user for test lead) ===");
  // The intent has telegram_user_id=413553377 (the operator) — ensureUser would have
  // skipped the insert because the operator already exists. So no synthetic user to delete.
  // But let's check if there's a user with phone = +79123456789 in metadata
  const usersRes = await fetch(
    `${SUPABASE_URL}/rest/v1/users?select=user_id,full_name,metadata&limit=500`,
    { headers },
  );
  if (usersRes.ok) {
    const users = await usersRes.json();
    const testUsers = users.filter((u) => {
      const meta = u.metadata || {};
      return meta.phone === TEST_PHONE || u.full_name === TEST_NAME;
    });
    console.log(`Found ${testUsers.length} test users:`);
    for (const u of testUsers) {
      console.log(`  ${u.user_id} | ${u.full_name} | ${JSON.stringify(u.metadata).slice(0, 100)}`);
    }
    if (testUsers.length > 0) {
      const userIds = testUsers.map((u) => `"${u.user_id}"`).join(",");
      const result = await deleteRow("users", `user_id=in.(${userIds})`);
      console.log(`  → ${COMMIT ? "DELETED" : "would delete"} ${result.count} user(s)`);
    }
  }

  // 5. Any equipment_rental rows (for /doc rentals with equipment)
  console.log("");
  console.log("=== 5. equipment_rental ===");
  // equipment_rental has primary_rental_id FK — if no rental row was created, no equipment rows either
  // But let's check anyway
  const eqRes = await fetch(
    `${SUPABASE_URL}/rest/v1/equipment_rental?select=*&limit=5`,
    { headers },
  );
  if (!eqRes.ok) {
    console.log(`  Table not accessible or empty: ${eqRes.status}`);
  } else {
    const eqs = await eqRes.json();
    console.log(`  Found ${eqs.length} equipment_rental rows (no filter — table may be empty or inaccessible)`);
  }

  console.log("");
  console.log("=== Summary ===");
  if (!COMMIT) {
    console.log("DRY RUN — no changes made. Run with --commit to actually delete:");
    console.log("  node scripts/delete-test-rental.js --commit");
  } else {
    console.log("✅ Test rental data deleted.");
    console.log("");
    console.log("⚠️  Manual cleanup still needed in private schema (run in Supabase SQL Editor):");
    console.log("  DELETE FROM private.user_rental_secrets WHERE renter_phone = '+79123456789';");
    console.log("  DELETE FROM private.rental_contract_artifacts WHERE renter_phone = '+79123456789';");
    console.log("  DELETE FROM private.testdrive_contract_artifacts WHERE customer_phone = '+79123456789';");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
