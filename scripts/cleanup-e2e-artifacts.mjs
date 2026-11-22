// scripts/cleanup-e2e-artifacts.mjs — 2026-09-11
// Clean the E2E/boss test artifacts the testdrive web-flow harnesses created
// in PRODUCTION (owner: «Don't forget to clean up test artefacts - though i'm
// amazed that you test right in production :))»).
//
//   node scripts/cleanup-e2e-artifacts.mjs            → INSPECT (list only)
//   node scripts/cleanup-e2e-artifacts.mjs --apply    → DELETE the test rows
//
// Scope (narrow — must never touch real customers):
//   • public.franchize_order_notifications  order_id ~ tde2e/boss (7 rows)
//   • private.rental_contract_artifacts     contract_key testdrive-vip-bike-order-{tde2e,boss*}-* (6 rows)
//     (real BOT testdrives — testdrive-kawasaki-*, testdrive-ducati-* — are KEPT)
//   • public.franchize_intents              harness phones + CTA telemetry from the boss UI window
//   • public.users                          synthetic harness users (user_id = phone)
//   • storage rental-contracts bucket       the deleted artifacts' .docx files
// Real rentals (incl. the active aprilia-shiver c99687c7) are NEVER touched.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://inmctohsodgdohamhzag.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_KEY) { console.error("SUPABASE_SERVICE_ROLE_KEY missing"); process.exit(1); }
const pub = createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: "public" } });
const priv = createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: "private" } });

const APPLY = process.argv.includes("--apply");
const HARNESS_PHONES = ["+79001234567", "+79006660011", "+79007778899", "+79005554443"];
// The boss-agent UI-test window (2026-09-10 20:40–21:00 UTC) — anonymous CTA
// telemetry intents fired while the boss clicked through the modal.
const BOSS_WINDOW_START = "2026-09-10T20:30:00Z";
const BOSS_WINDOW_END = "2026-09-10T21:10:00Z";

let deleted = 0;

async function del(table, client, col, val) {
  const { error } = await client.from(table).delete().eq(col, val);
  if (error) console.log(`    ERR ${table}.${col}=${val}: ${error.message}`);
  else { deleted++; console.log(`    deleted ${table} ${col}=${val}`); }
}

// ── 1. notifications ────────────────────────────────────────────────────────
const { data: notifs } = await pub.from("franchize_order_notifications")
  .select("id, order_id, send_status, created_at")
  .or("order_id.ilike.%tde2e%,order_id.ilike.%bossui%,order_id.ilike.%bossguard%,order_id.ilike.%bosscap%");
console.log(`[1] franchize_order_notifications test rows: ${notifs?.length ?? 0}`);
(notifs || []).forEach(r => console.log(`    ${r.order_id} · ${r.send_status} · ${r.created_at}`));
if (APPLY) for (const r of notifs || []) await del("franchize_order_notifications", pub, "id", r.id);

// ── 2. private testdrive artifacts (web-order keys only) ───────────────────
const { data: arts } = await priv.from("rental_contract_artifacts")
  .select("id, contract_key, renter_full_name, storage_path, created_at")
  .or("contract_key.ilike.testdrive-vip-bike-order-tde2e-%,contract_key.ilike.testdrive-vip-bike-order-boss%")
  .order("created_at", { ascending: false });
console.log(`[2] rental_contract_artifacts web-testdrive rows: ${arts?.length ?? 0}`);
(arts || []).forEach(r => console.log(`    ${r.contract_key} · ${r.renter_full_name}`));
if (APPLY) {
  for (const r of arts || []) {
    await del("rental_contract_artifacts", priv, "id", r.id);
    if (r.storage_path) {
      const { error } = await priv.storage.from("rental-contracts").remove([r.storage_path]);
      console.log(`    storage ${r.storage_path}: ${error ? "ERR " + error.message : "removed"}`);
    }
  }
}

// ── 3. harness intents ──────────────────────────────────────────────────────
const phoneOr = HARNESS_PHONES.map(p => `phone.eq.${p}`).join(",");
const { data: phoneIntents } = await pub.from("franchize_intents")
  .select("id, intent_type, phone, metadata, created_at, updated_at").or(phoneOr);
// Anonymous CTA telemetry inside the boss window (metadata.action testdrive/rent clicks)
const { data: anonIntents } = await pub.from("franchize_intents")
  .select("id, intent_type, phone, metadata, created_at, updated_at")
  .is("phone", null).gte("created_at", BOSS_WINDOW_START).lte("created_at", BOSS_WINDOW_END);
const intents = [...(phoneIntents || []), ...(anonIntents || [])];
console.log(`[3] franchize_intents harness rows: ${intents.length} (by phone: ${phoneIntents?.length ?? 0}, boss-window anonymous CTA: ${anonIntents?.length ?? 0})`);
intents.forEach(r => console.log(`    ${r.id.slice(0, 8)} · ${r.intent_type} · ${r.phone} · ${r.created_at}`));
if (APPLY) for (const r of intents) await del("franchize_intents", pub, "id", r.id);

// ── 4. synthetic users ──────────────────────────────────────────────────────
const { data: users } = await pub.from("users").select("user_id, full_name, created_at").in("user_id", HARNESS_PHONES);
console.log(`[4] synthetic users: ${users?.length ?? 0}`);
(users || []).forEach(u => console.log(`    ${u.user_id} · ${u.full_name}`));
if (APPLY) for (const u of users || []) await del("users", pub, "user_id", u.user_id);

// ── 5. crew_todos safety check (already 0 expected) ─────────────────────────
const todosOr = HARNESS_PHONES.map(p => `lead_id.eq.${p}`).join(",");
const { data: todos } = await pub.from("crew_todos").select("id, title, lead_id, created_at").or(todosOr);
console.log(`[5] crew_todos harness rows: ${todos?.length ?? 0}`);
if (APPLY) for (const r of todos || []) await del("crew_todos", pub, "id", r.id);

// ── 6. sanity: the real active shiver rental stays ──────────────────────────
const { data: shiver } = await pub.from("rentals").select("rental_id, status, total_cost")
  .eq("rental_id", "c99687c7-2f28-4cb6-beda-cdad5cd738ae").maybeSingle();
console.log(`[6] sanity — real shiver rental untouched: ${shiver?.rental_id.slice(0, 8)} · ${shiver?.status} · ${shiver?.total_cost}`);

console.log(APPLY ? `\nDONE — ${deleted} rows deleted.` : "\nINSPECT ONLY — rerun with --apply to delete.");
