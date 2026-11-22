// Audit: chat_id pollution in leads data — check roster, todos, notes keys
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://inmctohsodgdohamhzag.supabase.co";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(url, key, { auth: { persistSession: false } });

const CREW_SLUG = "vip-bike";

async function main() {
  // 1. Crew + members (ALL statuses, incl. removed)
  const { data: crew } = await sb.from("crews").select("id, slug, owner_id, name").eq("slug", CREW_SLUG).maybeSingle();
  console.log("CREW:", crew);

  const { data: members } = await sb.from("crew_members").select("user_id, role, membership_status, joined_at").eq("crew_id", crew.id);
  console.log("MEMBERS (all statuses):");
  for (const m of members || []) console.log("  ", m);

  // 2. crew_todos — how are they keyed?
  const { data: todos } = await sb.from("crew_todos").select("id, lead_id, user_id, phone, rental_id, title, status, category, created_at").eq("crew_id", crew.id).order("created_at", { ascending: false }).limit(400);
  const byKey = {};
  for (const t of todos || []) {
    const k = t.rental_id ? `rental_id` : t.lead_id ? `lead_id:${(t.lead_id || "").slice(0, 6)}` : t.phone ? "phone" : t.user_id ? `user_id:${t.user_id}` : "none";
    byKey[k] = (byKey[k] || 0) + 1;
  }
  console.log("\nTODOS total:", (todos || []).length);
  console.log("TODOS keying histogram:", JSON.stringify(byKey, null, 0));

  const todoUserIds = [...new Set((todos || []).map((t) => t.user_id).filter(Boolean))];
  console.log("TODOS distinct user_id values:", todoUserIds);

  // 3. lead_notes — keyed by lead_id
  const { data: notes } = await sb.from("lead_notes").select("id, lead_id, crew_id, text, created_at").eq("crew_id", crew.id).order("created_at", { ascending: false }).limit(300);
  const noteKeys = {};
  for (const n of notes || []) {
    const k = (n.lead_id || "").slice(0, 10);
    noteKeys[k] = (noteKeys[k] || 0) + 1;
  }
  console.log("\nNOTES total:", (notes || []).length);
  console.log("NOTES lead_id histogram:", JSON.stringify(noteKeys, null, 0));

  // 4. franchize_intents — operator-keyed intents
  const { data: intents } = await sb.from("franchize_intents").select("id, telegram_user_id, phone, intent_type, stage, metadata, created_at, last_seen_at").eq("slug", CREW_SLUG).limit(800);
  const opIds = new Set([crew.owner_id, ...(members || []).map((m) => m.user_id)].filter(Boolean));
  console.log("\nOPERATOR IDS:", Array.from(opIds));
  const opIntents = (intents || []).filter((i) => i.telegram_user_id && opIds.has(i.telegram_user_id));
  console.log("INTENTS total:", (intents || []).length, "— keyed by operator id:", opIntents.length);
  for (const i of opIntents.slice(0, 12)) {
    const meta = i.metadata || {};
    console.log("  op-intent:", i.id, "tg:", i.telegram_user_id, "phone:", i.phone, "name:", meta.name, "opId:", meta.operatorId, "stage:", i.stage);
  }

  // 5. artifacts — telegram_chat_id = operator?
  const artQ = await sb.schema("private").from("rental_contract_artifacts").select("telegram_chat_id, renter_phone, renter_full_name, rental_id, created_by_operator_chat_id, created_at").eq("crew_slug", CREW_SLUG).limit(300);
  if (artQ.error) {
    console.log("\nARTIFACTS private schema query error:", artQ.error.message);
  } else {
    const opArt = (artQ.data || []).filter((a) => a.telegram_chat_id && opIds.has(a.telegram_chat_id));
    const noPhoneNoName = opArt.filter((a) => !a.renter_phone && !a.renter_full_name);
    console.log("\nARTIFACTS total:", (artQ.data || []).length, "— operator-keyed:", opArt.length, "— operator & no phone & no name:", noPhoneNoName.length);
    for (const a of noPhoneNoName.slice(0, 8)) console.log("   ", JSON.stringify(a));
  }

  // 6. sales
  const saleQ = await sb.schema("private").from("sale_contract_artifacts").select("id, telegram_chat_id, buyer_phone, created_at").eq("crew_slug", CREW_SLUG).limit(200);
  if (saleQ.error) console.log("\nSALES query error:", saleQ.error.message);
  else {
    const opSales = (saleQ.data || []).filter((s) => s.telegram_chat_id && opIds.has(s.telegram_chat_id));
    const noPhone = opSales.filter((s) => !s.buyer_phone);
    console.log("\nSALES total:", (saleQ.data || []).length, "— operator-keyed:", opSales.length, "— operator & no phone:", noPhone.length);
    for (const s of noPhone.slice(0, 8)) console.log("   ", JSON.stringify(s));
  }

  // 7. user_rental_secrets — chat_id = operator?
  const secQ = await sb.schema("private").from("user_rental_secrets").select("chat_id, renter_phone, renter_full_name, source_doc_key, created_at").eq("crew_slug", CREW_SLUG).limit(300);
  if (secQ.error) console.log("\nSECRETS query error:", secQ.error.message);
  else {
    const opSec = (secQ.data || []).filter((s) => s.chat_id && opIds.has(s.chat_id));
    console.log("\nSECRETS total:", (secQ.data || []).length, "— operator-keyed:", opSec.length);
    for (const s of opSec.slice(0, 8)) console.log("   ", JSON.stringify(s));
  }
}

main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
