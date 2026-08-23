// /home/z/my-project/scripts/cleanup-motoland-rental.js
// Delete the incorrect motoland-breakout rental (bd0cacde) and all related data.

const SUPABASE_URL = "https://inmctohsodgdohamhzag.supabase.co";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlubWN0b2hzb2RnZG9oYW1oemFnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczODMzOTU4NSwiZXhwIjoyMDUzOTE1NTg1fQ.xD91Es2o8T1vM-2Ok8iKCn4jGDA5TwBbapD5eqhblLM";
const RENTAL_ID = "bd0cacde-8685-4b23-9b76-a4bd33d72ccc";
const h = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", Prefer: "return=representation" };

async function main() {
  // 1. Delete crew_todos linked to this rental
  console.log("=== Deleting crew_todos ===");
  const tdRes = await fetch(`${SUPABASE_URL}/rest/v1/crew_todos?rental_id=eq.${RENTAL_ID}`, { method: "DELETE", headers: h });
  console.log(`  ${tdRes.ok ? "✅" : "❌"} crew_todos: ${tdRes.status}`);

  // 2. Delete deposit_entries
  console.log("=== Deleting deposit_entries ===");
  const deRes = await fetch(`${SUPABASE_URL}/rest/v1/deposit_entries?rental_id=eq.${RENTAL_ID}`, { method: "DELETE", headers: h });
  console.log(`  ${deRes.ok ? "✅" : "❌"} deposit_entries: ${deRes.status}`);

  // 3. Delete rental_handoffs (if any)
  console.log("=== Deleting rental_handoffs ===");
  const rhRes = await fetch(`${SUPABASE_URL}/rest/v1/rental_handoffs?rental_id=eq.${RENTAL_ID}`, { method: "DELETE", headers: h });
  console.log(`  ${rhRes.ok ? "✅" : "❌"} rental_handoffs: ${rhRes.status}`);

  // 4. Delete the rental itself
  console.log("=== Deleting rental ===");
  const rRes = await fetch(`${SUPABASE_URL}/rest/v1/rentals?rental_id=eq.${RENTAL_ID}`, { method: "DELETE", headers: h });
  const deleted = rRes.ok ? await rRes.json() : [];
  console.log(`  ${rRes.ok ? "✅" : "❌"} rentals: deleted ${deleted.length} row(s)`);

  // 5. Delete the DOCX from storage
  console.log("=== Finding + deleting DOCX ===");
  const meta = deleted[0]?.metadata;
  const docSha = meta?.doc_sha256;
  if (docSha) {
    console.log(`  doc_sha256: ${docSha}`);
    console.log(`  ⚠️ Storage file deletion requires manual SQL:`);
    console.log(`     DELETE FROM private.rental_contract_artifacts WHERE original_sha256 = '${docSha}';`);
    console.log("     + delete file from storage bucket 'rental-contracts' (path contains 'motoland-breakout')");
  }

  // 6. Delete franchize_intents for this renter+bike (if test)
  console.log("");
  console.log("=== Cleaning up franchize_intents ===");
  const intentRes = await fetch(
    `${SUPABASE_URL}/rest/v1/franchize_intents?bike_id=eq.motoland-breakout&phone=eq.%2B79202150383&select=id,intent_type,stage`,
    { headers: h },
  );
  const intents = intentRes.ok ? await intentRes.json() : [];
  console.log(`  Found ${intents.length} intents for motoland-breakout + phone`);
  for (const i of intents) {
    console.log(`    ${i.id} | ${i.intent_type} | ${i.stage}`);
    const delRes = await fetch(`${SUPABASE_URL}/rest/v1/franchize_intents?id=eq.${i.id}`, { method: "DELETE", headers: h });
    console.log(`    ${delRes.ok ? "✅" : "❌"} deleted`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
