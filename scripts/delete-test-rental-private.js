// /home/z/my-project/scripts/delete-test-rental-private.js
// Delete test rental data from PRIVATE schema tables (user_rental_secrets,
// rental_contract_artifacts, testdrive_contract_artifacts).
//
// PostgREST only exposes the public schema. To delete from private schema,
// we use the Supabase SQL endpoint via the management API (requires service role
// key — which we have).
//
// DRY-RUN by default. Pass --commit to actually delete.

const SUPABASE_URL = "https://inmctohsodgdohamhzag.supabase.co";
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlubWN0b2hzb2RnZG9oYW1oemFnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczODMzOTU4NSwiZXhwIjoyMDUzOTE1NTg1fQ.xD91Es2o8T1vM-2Ok8iKCn4jGDA5TwBbapD5eqhblLM";

const COMMIT = process.argv.includes("--commit");
const TEST_PHONE = "+79123456789";

async function main() {
  console.log(`Mode: ${COMMIT ? "⚠️  COMMIT (will DELETE)" : "🔍 DRY RUN (no changes)"}`);
  console.log("");

  // We can use the Supabase SQL endpoint via the pg-query API
  // POST https://<project>.supabase.co/pg/query  (requires service role key)
  // Body: { query: "SELECT * FROM private.user_rental_secrets WHERE renter_phone = $1", params: ["+79123456789"] }
  //
  // However, the /pg/query endpoint might not be enabled on all projects. Let's try.

  const queries = [
    {
      label: "private.user_rental_secrets",
      select: `SELECT id, chat_id, renter_full_name, renter_phone, source_doc_key, created_at FROM private.user_rental_secrets WHERE renter_phone = '${TEST_PHONE}'`,
      delete: `DELETE FROM private.user_rental_secrets WHERE renter_phone = '${TEST_PHONE}' RETURNING id`,
    },
    {
      label: "private.rental_contract_artifacts",
      select: `SELECT id, contract_key, rental_id, renter_full_name, renter_phone, created_at FROM private.rental_contract_artifacts WHERE renter_phone = '${TEST_PHONE}'`,
      delete: `DELETE FROM private.rental_contract_artifacts WHERE renter_phone = '${TEST_PHONE}' RETURNING id`,
    },
    {
      label: "private.testdrive_contract_artifacts",
      select: `SELECT id, contract_key, customer_full_name, customer_phone, created_at FROM private.testdrive_contract_artifacts WHERE customer_phone = '${TEST_PHONE}'`,
      delete: `DELETE FROM private.testdrive_contract_artifacts WHERE customer_phone = '${TEST_PHONE}' RETURNING id`,
    },
  ];

  for (const q of queries) {
    console.log(`=== ${q.label} ===`);
    // First SELECT to see what's there
    const selectRes = await fetch(`${SUPABASE_URL}/pg/query`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: q.select }),
    });
    if (!selectRes.ok) {
      const text = await selectRes.text();
      console.log(`  SELECT failed: ${selectRes.status} ${text.slice(0, 200)}`);
      // Try alternative: maybe the endpoint is /rest/v1/rpc/query
      continue;
    }
    const selectData = await selectRes.json();
    const rows = selectData.rows || selectData || [];
    console.log(`  Found ${rows.length} row(s)`);
    for (const r of rows) {
      console.log(`    ${JSON.stringify(r)}`);
    }
    if (rows.length === 0) continue;

    if (COMMIT) {
      const delRes = await fetch(`${SUPABASE_URL}/pg/query`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: q.delete }),
      });
      if (!delRes.ok) {
        const text = await delRes.text();
        console.log(`  DELETE failed: ${delRes.status} ${text.slice(0, 200)}`);
        continue;
      }
      const delData = await delRes.json();
      const deleted = delData.rows || delData || [];
      console.log(`  ✅ DELETED ${deleted.length} row(s)`);
    } else {
      console.log(`  → would delete ${rows.length} row(s) (run with --commit)`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
