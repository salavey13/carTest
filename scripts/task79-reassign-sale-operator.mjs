// scripts/task79-reassign-sale-operator.mjs
//
// Task 79 (boss 2026-10-07): «all rentals and sales should be correctly
// assigned to him [djorudjov]» — this is the boss's confirmation of the
// Task 77 flag («1 sale artifact висит на i_o_s_nn — если тоже djorudjov,
// переведу одной строкой»).
//
// WHAT: private.sale_contract_artifacts — exactly ONE row carries
// telegram_chat_id = 356282674 (i_o_s_nn):
//   id=f1915967-1056-425d-874c-86e694ef514e, falcon-lite-2026, 290 000₽, 09.08.2026.
// Flip it to 7813830016 (djorudjov). Sales attribution (resolveSaleOperator,
// app/franchize/lib/operator-attribution.ts) credits via telegram_chat_id
// first, so djorudjov's salary picks it up LIVE (no cache in DB).
//
// NOT touched: 413553377 (Paul ×10 — real), 5707066146 (suiskaka — outside
// buyer/operator id, resolves through shift cross-reference), 88888888888
// (dummy test id — same).
//
// AUDIT: crews.metadata.owner_fix_20261007_sale_operator
//
// Run:  node --env-file=.env.local scripts/task79-reassign-sale-operator.mjs          (dry-run)
//       node --env-file=.env.local scripts/task79-reassign-sale-operator.mjs --apply  (execute)
import { createClient } from "../node_modules/@supabase/supabase-js/dist/main/index.js";

const APPLY = process.argv.includes("--apply");
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const FROM = "356282674"; // i_o_s_nn
const TO = "7813830016";  // djorudjov
const CREW_ID = "2d5fde70-1dd3-4f0d-8d72-66ccf6908746"; // vip-bike
const AUDIT_KEY = "owner_fix_20261007_sale_operator";

const log = (...a) => console.log(...a);

// ── 1. locate artifacts still on i_o_s_nn ───────────────────────────────────
const { data: cars } = await sb.from("cars").select("id").eq("crew_id", CREW_ID);
const carIds = (cars || []).map((c) => c.id);
const { data: hits, error: e1 } = await sb
  .schema("private")
  .from("sale_contract_artifacts")
  .select("id, sale_price, resolved_bike_id, created_at, telegram_chat_id")
  .eq("telegram_chat_id", FROM);
if (e1) {
  console.error("sale fetch failed:", e1.message);
  process.exit(1);
}
log(`1. sale_contract_artifacts.telegram_chat_id = ${FROM}: ${hits.length} row(s)`);
for (const s of hits) {
  const inCrew = carIds.includes(s.resolved_bike_id);
  log(`   id=${s.id} bike=${s.resolved_bike_id} (vip-bike: ${inCrew}) price=${s.sale_price} at=${s.created_at}`);
}

if (!APPLY) {
  log("\nDRY RUN — nothing written. Re-run with --apply.");
  process.exit(0);
}

// ── 2. flip telegram_chat_id ────────────────────────────────────────────────
for (const s of hits) {
  const { error: e2 } = await sb
    .schema("private")
    .from("sale_contract_artifacts")
    .update({ telegram_chat_id: TO })
    .eq("id", s.id);
  if (e2) {
    console.error(`flip failed for ${s.id}:`, e2.message);
    process.exit(1);
  }
  log(`2. flipped ${s.id}: ${FROM} → ${TO}`);
}

// ── 3. audit block (read-modify-write crews.metadata) ───────────────────────
const { data: crewRow } = await sb.from("crews").select("metadata").eq("id", CREW_ID).single();
const md = { ...(crewRow?.metadata ?? {}) };
const audit = {
  at: new Date().toISOString(),
  what: "sale operator reassignment i_o_s_nn → djorudjov (boss confirmed all sales are djorudjov's)",
  requested_by: "boss (salavey13) 2026-10-07: 'all rentals and sales should be correctly assigned to him'",
  flips: hits.map((s) => ({ id: s.id, price: s.sale_price, created_at: s.created_at, from: FROM, to: TO })),
  not_touched: "413553377 ×10 (real), 5707066146/88888888888 (non-member ids → shift cross-reference)",
};
md.specs = { ...(md.specs ?? {}), [AUDIT_KEY]: audit };
const { error: e3 } = await sb.from("crews").update({ metadata: md }).eq("id", CREW_ID);
if (e3) {
  console.error("audit write failed:", e3.message);
  process.exit(1);
}
log(`3. audit written → crews.metadata.specs.${AUDIT_KEY}`);

// ── 4. post-verify ──────────────────────────────────────────────────────────
const { data: after } = await sb
  .schema("private")
  .from("sale_contract_artifacts")
  .select("id, telegram_chat_id")
  .eq("telegram_chat_id", FROM);
log(`4. post-verify: artifacts still on ${FROM}: ${after.length} (expected 0)`);
