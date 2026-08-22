// /home/z/my-project/scripts/link-renters-via-rest.js
// Manually link the two renters to their rentals via REST API (public schema only).
// For private schema updates, print SQL for the user to run via SQL Editor.

const SUPABASE_URL = "https://inmctohsodgdohamhzag.supabase.co";
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlubWN0b2hzb2RnZG9oYW1oemFnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczODMzOTU4NSwiZXhwIjoyMDUzOTE1NTg1fQ.xD91Es2o8T1vM-2Ok8iKCn4jGDA5TwBbapD5eqhblLM";
const CREW_SLUG = "vip-bike";
const OPERATOR_TG_ID = "413553377";

const headers = {
  apikey: SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

const LINKS = [
  {
    label: "Яков Головин + Ducati 1199 Panigale",
    docSha256: "8d8c8502951e9e09aa5c82d760f2986c4fa2067fc48d2f82e28851cfb927eb13",
    rentalId: "7b2bab65-5327-42f2-aa46-9a1cd3fcac53",
    renterChatId: "1317807980",
    intentId: "42eaced2-744a-462d-9af0-5718a47ed881",  // from earlier query
  },
  {
    label: "Ладонежский Олег + Ducati Panigale S Electro Black Aero",
    docSha256: "0386e2a6ffd9959e30d8efbac227b95719a83c80123c49b36b0a10eacef7d748",
    rentalId: "cc4bf3d6-fbb7-4e29-bb85-ccbfd1c4d4b4",
    renterChatId: "1440836416",
    intentId: "56ad2f42-73fe-4694-8010-900ed2c3c29b",  // from earlier query
  },
];

async function main() {
  console.log("=== Step 1: Update public.rentals.user_id → renter ===");
  for (const link of LINKS) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/rentals?rental_id=eq.${link.rentalId}&select=rental_id,user_id,owner_id,created_by_operator_chat_id`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({ user_id: link.renterChatId }),
      },
    );
    const data = await res.json();
    if (!res.ok || data.length === 0) {
      console.log(`  ❌ ${link.label}: ${res.status} ${JSON.stringify(data).slice(0, 200)}`);
    } else {
      console.log(`  ✅ ${link.label}: user_id=${data[0].user_id} (was ${OPERATOR_TG_ID})`);
    }
  }

  console.log("");
  console.log("=== Step 2: Update public.franchize_intents — link to renter ===");
  for (const link of LINKS) {
    // Update telegram_user_id from operator → renter
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/franchize_intents?id=eq.${link.intentId}&select=id,telegram_user_id,metadata`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          telegram_user_id: link.renterChatId,
          // Add rentalId to metadata + mark as closed (per /doc-manual fix pattern)
          // We'll merge the existing metadata with our new fields.
          // PostgREST doesn't support JSONB merge natively, so we need to
          // read the existing metadata first, then write the merged version.
        }),
      },
    );
    const data = await res.json();
    if (!res.ok) {
      console.log(`  ❌ ${link.label} (initial patch): ${res.status} ${JSON.stringify(data).slice(0, 200)}`);
      continue;
    }
    if (data.length === 0) {
      console.log(`  ⚠️  ${link.label}: intent not found`);
      continue;
    }

    const existingMeta = data[0].metadata || {};
    const newMeta = {
      ...existingMeta,
      rentalId: link.rentalId,
      convertedToRentalAt: new Date().toISOString(),
    };

    // Now patch with merged metadata
    const res2 = await fetch(
      `${SUPABASE_URL}/rest/v1/franchize_intents?id=eq.${link.intentId}`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          telegram_user_id: link.renterChatId,
          metadata: newMeta,
          last_seen_at: new Date().toISOString(),
        }),
      },
    );
    if (!res2.ok) {
      const errBody = await res2.text();
      console.log(`  ❌ ${link.label} (merge metadata): ${res2.status} ${errBody.slice(0, 200)}`);
    } else {
      console.log(`  ✅ ${link.label}: intent ${link.intentId.slice(0, 8)} → renter ${link.renterChatId}`);
    }
  }

  console.log("");
  console.log("=== Step 3: Update public.crew_todos (lead_id = operator → renter) ===");
  // Match by lead_id = operator AND created today (the test rentals were today)
  for (const link of LINKS) {
    // First, fetch the todos to update
    const listRes = await fetch(
      `${SUPABASE_URL}/rest/v1/crew_todos?lead_id=eq.${OPERATOR_TG_ID}&created_at=gte.2026-08-21T15:00:00Z&select=id,title,rental_id,lead_id`,
      { headers },
    );
    const todos = listRes.ok ? await listRes.json() : [];
    // Filter by title containing the bike's model name
    const bikeKeywords = link.label.includes("1199") ? ["1199", "Panigale"] :
                          link.label.includes("Aero") ? ["Aero", "Black Aero"] : [];
    const matched = todos.filter((t) => bikeKeywords.some((kw) => t.title?.includes(kw)));
    console.log(`  ${link.label}: found ${matched.length} matching todos (out of ${todos.length} today's todos for operator)`);
    if (matched.length === 0) continue;

    const todoIds = matched.map((t) => `"${t.id}"`).join(",");
    // Update: lead_id → renter + rental_id → new rental
    const updateRes = await fetch(
      `${SUPABASE_URL}/rest/v1/crew_todos?id=in.(${todoIds})`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          lead_id: link.renterChatId,
          rental_id: link.rentalId,
        }),
      },
    );
    const updated = updateRes.ok ? await updateRes.json() : [];
    console.log(`    → updated ${updated.length} todo(s): lead_id=${link.renterChatId}, rental_id=${link.rentalId}`);
  }

  console.log("");
  console.log("=== Step 4: Verify rentals are now linked to renters ===");
  for (const link of LINKS) {
    const verifyRes = await fetch(
      `${SUPABASE_URL}/rest/v1/rentals?rental_id=eq.${link.rentalId}&select=rental_id,user_id,owner_id,created_by_operator_chat_id,status,total_cost,metadata`,
      { headers },
    );
    const verifyData = await verifyRes.json();
    if (verifyData.length > 0) {
      const r = verifyData[0];
      const userMatches = r.user_id === link.renterChatId;
      console.log(`  ${link.label}`);
      console.log(`    rental_id: ${r.rental_id}`);
      console.log(`    user_id: ${r.user_id} ${userMatches ? "✅" : "❌ (expected " + link.renterChatId + ")"}`);
      console.log(`    owner_id: ${r.owner_id}`);
      console.log(`    created_by_operator_chat_id: ${r.created_by_operator_chat_id}`);
      console.log(`    status: ${r.status} | total_cost: ${r.total_cost}`);
      const meta = r.metadata || {};
      console.log(`    metadata.renter_name: ${meta.renter_name || "—"}`);
      console.log(`    metadata.doc_sha256: ${meta.doc_sha256?.slice(0, 12) || "—"}`);
    }
  }

  console.log("");
  console.log("=== Step 5: Print SQL for private schema updates ===");
  console.log("Run this SQL via Supabase SQL Editor (https://supabase.com/dashboard/project/inmctohsodgdohamhzag/sql/new):");
  console.log("");
  console.log("```sql");
  console.log("-- Update private.user_rental_secrets: claim by renter + link rental_id");
  for (const link of LINKS) {
    console.log(`UPDATE private.user_rental_secrets SET chat_id = '${link.renterChatId}', source_rental_id = '${link.rentalId}', qr_claimed_at = COALESCE(qr_claimed_at, now()), updated_at = now() WHERE doc_sha256 = '${link.docSha256}';`);
  }
  console.log("");
  console.log("-- Update private.rental_contract_artifacts: link rental_id + telegram_chat_id");
  for (const link of LINKS) {
    console.log(`UPDATE private.rental_contract_artifacts SET rental_id = '${link.rentalId}', telegram_chat_id = '${link.renterChatId}', created_by_operator_chat_id = COALESCE(created_by_operator_chat_id, '${OPERATOR_TG_ID}') WHERE original_sha256 = '${link.docSha256}';`);
  }
  console.log("```");
}

main().catch((e) => { console.error(e); process.exit(1); });
