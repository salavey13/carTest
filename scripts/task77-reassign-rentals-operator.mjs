// scripts/task77-reassign-rentals-operator.mjs
//
// Task 77 (boss 2026-10-07): «Please also fix operator for rentals, actually
// all rentals we created by operator djorudjov, not i_o_s_nn ;) please
// reassign, so djorudjov's profile will show correct comissions in salary».
//
// WHO: i_o_s_nn = Илья I.O.S. (356282674, owner role) — his chat id sat on
// every /doc rental; djorudjov = ORUDJOV (7813830016, admin) — the operator
// who actually ran them. Paul (413553377) and Гундермурд (5219192922)
// attributions are REAL and stay.
//
// WHAT the flip touches (the full operator-attribution chain of
// app/franchize/lib/operator-attribution.ts):
//   1. rentals.created_by_operator_chat_id  '356282674' → '7813830016'  (140)
//   2. rentals.metadata.pickup_freeze.frozen_by   (2)  — read-modify-write
//   3. rentals.metadata.return_confirmed_by       (6)  — read-modify-write
// Salary commissions under the category model (computeCategoryBonuses →
// resolveRentalOperator) are computed LIVE from these fields, so djorudjov's
// profile / salary page pick the corrected history up immediately.
//
// NOT touched (flagged to the boss instead): sales — private.
// sale_contract_artifacts has exactly ONE row by 356282674 (22 by
// djorudjov); the boss scoped this task to rentals.
//
// AUDIT: crews.metadata.owner_fix_20261007_rentals_operator
//
// Run:  node --env-file=.env.local scripts/task77-reassign-rentals-operator.mjs          (dry-run)
//       node --env-file=.env.local scripts/task77-reassign-rentals-operator.mjs --apply  (execute)
import { createClient } from "../node_modules/@supabase/supabase-js/dist/main/index.js";

const APPLY = process.argv.includes("--apply");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const sb = createClient(url, key);

const FROM = "356282674"; // i_o_s_nn
const TO = "7813830016"; // djorudjov
const CREW_ID = "2d5fde70-1dd3-4f0d-8d72-66ccf6908746"; // VIP_BIKE
const AUDIT_KEY = "owner_fix_20261007_rentals_operator";

const log = (...a) => console.log(...a);

// ── 1. direct operator column ───────────────────────────────────────────────
const { data: directRows, error: e1 } = await sb
  .from("rentals")
  .select("rental_id, created_at, status")
  .eq("created_by_operator_chat_id", FROM);
if (e1) {
  console.error("direct fetch failed:", e1.message);
  process.exit(1);
}
log(`1. created_by_operator_chat_id = ${FROM}: ${directRows.length} rentals`);
if (directRows.length) {
  log(`   range: ${directRows[0].created_at?.slice(0, 10)} … ${directRows[directRows.length - 1].created_at?.slice(0, 10)}`);
}

// ── 2+3. metadata traces (read-modify-write) ────────────────────────────────
const { data: allMeta, error: e2 } = await sb
  .from("rentals")
  .select("rental_id, metadata");
if (e2) {
  console.error("metadata fetch failed:", e2.message);
  process.exit(1);
}
const freezeHits = [];
const returnHits = [];
for (const r of allMeta ?? []) {
  const md = r.metadata ?? {};
  const fb = md?.pickup_freeze?.frozen_by;
  if (fb === FROM) freezeHits.push(r);
  if (md?.return_confirmed_by === FROM) returnHits.push(r);
}
log(`2. metadata.pickup_freeze.frozen_by = ${FROM}: ${freezeHits.length}`);
log(`3. metadata.return_confirmed_by = ${FROM}: ${returnHits.length}`);

const totalOps = directRows.length + freezeHits.length + returnHits.length;
log(`\ntotal operations: ${totalOps}`);

if (!APPLY) {
  log("\nDRY RUN — re-run with --apply to execute.");
  process.exit(0);
}

log("\nAPPLYING…");
const results = [];

// 1. direct column (chunked .in updates)
const ids = directRows.map((r) => r.rental_id);
for (let i = 0; i < ids.length; i += 100) {
  const chunk = ids.slice(i, i + 100);
  const { error: e } = await sb
    .from("rentals")
    .update({ created_by_operator_chat_id: TO })
    .in("rental_id", chunk);
  if (e) {
    log(`  ✗ direct chunk ${i}: ${e.message}`);
    process.exit(1);
  }
  results.push(...chunk);
  log(`  ✓ direct operator flipped: ${chunk.length} rows (chunk ${Math.floor(i / 100) + 1})`);
}

// 2+3. metadata read-modify-write
const flipMeta = async (rentalId, mutator, label) => {
  const { data: row, error: fe } = await sb.from("rentals").select("rental_id, metadata").eq("rental_id", rentalId).single();
  if (fe) {
    log(`  ✗ ${label} ${rentalId}: ${fe.message}`);
    process.exit(1);
  }
  const md = { ...(row.metadata ?? {}) };
  mutator(md);
  const { error: ue } = await sb.from("rentals").update({ metadata: md }).eq("rental_id", rentalId);
  if (ue) {
    log(`  ✗ ${label} ${rentalId}: ${ue.message}`);
    process.exit(1);
  }
  results.push(rentalId);
  log(`  ✓ ${label} flipped: ${rentalId.slice(0, 8)}`);
};

for (const r of freezeHits) {
  await flipMeta(r.rental_id, (md) => {
    md.pickup_freeze = { ...md.pickup_freeze, frozen_by: TO };
  }, "frozen_by");
}
for (const r of returnHits) {
  await flipMeta(r.rental_id, (md) => {
    md.return_confirmed_by = TO;
  }, "return_confirmed_by");
}

// ── post-verify: nothing left ───────────────────────────────────────────────
const { data: check } = await sb.from("rentals").select("created_by_operator_chat_id, metadata");
let leftoverDirect = 0, leftoverFz = 0, leftoverRc = 0, newOp = 0;
for (const r of check ?? []) {
  if (r.created_by_operator_chat_id === FROM) leftoverDirect++;
  if (r.created_by_operator_chat_id === TO) newOp++;
  if (r.metadata?.pickup_freeze?.frozen_by === FROM) leftoverFz++;
  if (r.metadata?.return_confirmed_by === FROM) leftoverRc++;
}
log(`\npost-verify: direct=${FROM} left: ${leftoverDirect} | frozen_by left: ${leftoverFz} | return_by left: ${leftoverRc} | rentals now by djorudjov: ${newOp}`);
if (leftoverDirect || leftoverFz || leftoverRc) {
  log("⚠ leftovers detected — investigate before finishing");
  process.exit(1);
}

// ── audit block ─────────────────────────────────────────────────────────────
const { data: crewRow } = await sb.from("crews").select("metadata").eq("id", CREW_ID).single();
const meta = { ...(crewRow?.metadata ?? {}) };
meta[AUDIT_KEY] = {
  by: "task77-reassign-rentals-operator.mjs",
  ts: new Date().toISOString(),
  fix: `rentals operator reassignment per boss: all rentals actually created by djorudjov (7813830016), not i_o_s_nn (356282674). Flipped the full attribution chain: created_by_operator_chat_id ×${directRows.length}, metadata.pickup_freeze.frozen_by ×${freezeHits.length}, metadata.return_confirmed_by ×${returnHits.length}. Paul/Гундермурд attributions untouched. Sales NOT touched (1 artifact by i_o_s_nn flagged to boss). Category-model commissions (computeCategoryBonuses → resolveRentalOperator) now credit djorudjov live.`,
  operations: {
    direct: results.slice(0, directRows.length),
    frozen_by: freezeHits.map((r) => r.rental_id),
    return_confirmed_by: returnHits.map((r) => r.rental_id),
  },
};
const { error: auditErr } = await sb.from("crews").update({ metadata: meta }).eq("id", CREW_ID);
if (auditErr) {
  log(`⚠ audit write failed: ${auditErr.message}`);
  process.exit(1);
}
log(`\nDONE: ${results.length} rentals corrected. Audit → crews.metadata.${AUDIT_KEY}`);
