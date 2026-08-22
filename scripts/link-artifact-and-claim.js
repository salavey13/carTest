// /home/z/my-project/scripts/link-artifact-and-claim.js
// Link the two rental_contract_artifacts rows to the new rental_ids
// (created via recreate-failed-rentals.js), then call claim_rental_by_qr
// RPC to atomically propagate the claim to all linked tables.
//
// PostgREST doesn't expose private schema tables, BUT it DOES expose
// SECURITY DEFINER functions that operate on private schema tables.
// We've added a new migration that creates:
//   public.link_artifact_rental_id_by_sha256(p_doc_sha256, p_rental_id) RETURNS TEXT
//
// This script:
//   1) Tries to call that RPC via REST.
//   2) If the RPC doesn't exist yet (migration not applied), it prints
//      the SQL the user needs to run via the Supabase SQL Editor.
//   3) Then calls claim_rental_by_qr for each renter.

const SUPABASE_URL = "https://inmctohsodgdohamhzag.supabase.co";
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlubWN0b2hzb2RnZG9oYW1oemFnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczODMzOTU4NSwiZXhwIjoyMDUzOTE1NTg1fQ.xD91Es2o8T1vM-2Ok8iKCn4jGDA5TwBbapD5eqhblLM";

const headers = {
  apikey: SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
  "Content-Type": "application/json",
};

const LINKS = [
  {
    label: "Яков Головин + Ducati 1199 Panigale",
    docSha256: "8d8c8502951e9e09aa5c82d760f2986c4fa2067fc48d2f82e28851cfb927eb13",
    rentalId: "7b2bab65-5327-42f2-aa46-9a1cd3fcac53",
    renterChatId: "1317807980",
  },
  {
    label: "Ладонежский Олег + Ducati Panigale S Electro Black Aero",
    docSha256: "0386e2a6ffd9959e30d8efbac227b95719a83c80123c49b36b0a10eacef7d748",
    rentalId: "cc4bf3d6-fbb7-4e29-bb85-ccbfd1c4d4b4",
    renterChatId: "1440836416",
  },
];

async function rpc(name, params) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers,
    body: JSON.stringify(params),
  });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

async function main() {
  console.log("=== Step 1: Try to call link_artifact_rental_id_by_sha256 RPC ===");
  console.log("(if it fails with 404, you need to apply the migration first)");
  console.log("");

  let linkRpcAvailable = true;
  for (const link of LINKS) {
    console.log(`[${link.label}]`);
    console.log(`  doc_sha256: ${link.docSha256.slice(0, 12)}...`);
    console.log(`  rental_id: ${link.rentalId}`);
    const result = await rpc("link_artifact_rental_id_by_sha256", {
      p_doc_sha256: link.docSha256,
      p_rental_id: link.rentalId,
    });
    if (result.status === 404) {
      linkRpcAvailable = false;
      console.log(`  ❌ RPC not found (migration not applied).`);
    } else if (!result.ok) {
      console.log(`  ❌ RPC failed: ${result.status} ${JSON.stringify(result.data).slice(0, 200)}`);
    } else {
      console.log(`  ✅ Linked: ${JSON.stringify(result.data)}`);
    }
  }

  if (!linkRpcAvailable) {
    console.log("");
    console.log("=== Migration not applied — printing SQL to run via Supabase SQL Editor ===");
    console.log("");
    console.log("Paste this SQL into https://supabase.com/dashboard/project/inmctohsodgdohamhzag/sql/new:");
    console.log("");
    console.log("```sql");
    console.log("-- 1) Apply migration to add the link_artifact_rental_id_by_sha256 RPC:");
    console.log("CREATE OR REPLACE FUNCTION public.link_artifact_rental_id_by_sha256(");
    console.log("  p_doc_sha256 TEXT, p_rental_id UUID");
    console.log(") RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER");
    console.log("SET search_path = public, private AS $$");
    console.log("DECLARE v_updated INT; v_existing TEXT;");
    console.log("BEGIN");
    console.log("  SELECT rental_id::text INTO v_existing FROM private.rental_contract_artifacts");
    console.log("  WHERE original_sha256 = p_doc_sha256 LIMIT 1;");
    console.log("  IF v_existing IS NOT NULL AND v_existing != p_rental_id::text THEN");
    console.log("    RAISE EXCEPTION 'Artifact already linked to %', v_existing;");
    console.log("  END IF;");
    console.log("  UPDATE private.rental_contract_artifacts SET rental_id = p_rental_id");
    console.log("  WHERE original_sha256 = p_doc_sha256 AND (rental_id IS NULL OR rental_id::text = p_rental_id::text);");
    console.log("  GET DIAGNOSTICS v_updated = ROW_COUNT;");
    console.log("  RETURN CASE WHEN v_updated > 0 THEN p_rental_id::text ELSE NULL END;");
    console.log("END; $$;");
    console.log("GRANT EXECUTE ON FUNCTION public.link_artifact_rental_id_by_sha256 TO service_role;");
    console.log("");
    console.log("-- 2) Link the two artifacts:");
    for (const link of LINKS) {
      console.log(`UPDATE private.rental_contract_artifacts SET rental_id = '${link.rentalId}' WHERE original_sha256 = '${link.docSha256}' AND rental_id IS NULL;`);
    }
    console.log("");
    console.log("-- 3) Call claim_rental_by_qr RPC for each renter:");
    for (const link of LINKS) {
      console.log(`SELECT * FROM public.claim_rental_by_qr('${link.docSha256}', '${link.renterChatId}');`);
    }
    console.log("```");
    console.log("");
    console.log("After running the SQL, the rentals will be fully linked.");
    return;
  }

  console.log("");
  console.log("=== Step 2: Call claim_rental_by_qr RPC for each renter ===");
  for (const link of LINKS) {
    console.log(`[${link.label}]`);
    console.log(`  renter_chat_id: ${link.renterChatId}`);
    const claimResult = await rpc("claim_rental_by_qr", {
      p_doc_sha256: link.docSha256,
      p_renter_chat_id: link.renterChatId,
    });
    if (!claimResult.ok) {
      console.log(`  ❌ RPC failed: ${claimResult.status} ${JSON.stringify(claimResult.data).slice(0, 300)}`);
    } else {
      console.log(`  ✅ RPC result: ${JSON.stringify(claimResult.data)}`);
    }
  }

  console.log("");
  console.log("=== Step 3: Verify rentals are now linked to renters ===");
  for (const link of LINKS) {
    const verifyRes = await fetch(
      `${SUPABASE_URL}/rest/v1/rentals?rental_id=eq.${link.rentalId}&select=rental_id,user_id,owner_id,created_by_operator_chat_id,status,total_cost`,
      { headers },
    );
    const verifyData = await verifyRes.json();
    if (verifyData.length > 0) {
      const r = verifyData[0];
      const userMatches = r.user_id === link.renterChatId;
      console.log(`  ${link.label}`);
      console.log(`    rental_id: ${r.rental_id}`);
      console.log(`    user_id: ${r.user_id} ${userMatches ? "✅ (renter)" : "❌ (expected " + link.renterChatId + ")"}`);
      console.log(`    owner_id: ${r.owner_id}`);
      console.log(`    created_by_operator_chat_id: ${r.created_by_operator_chat_id}`);
      console.log(`    status: ${r.status} | total_cost: ${r.total_cost}`);
    } else {
      console.log(`  ❌ Rental ${link.rentalId} not found`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
