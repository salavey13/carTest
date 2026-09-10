// Verify boss-R1 fixes landed in production: test_drive lead, 3 crew todos,
// artifact deposit_rub=0, user_rental_secrets row.
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  "https://inmctohsodgdohamhzag.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);
const orderId = process.argv[2];

// 1. notification
const { data: notif } = await sb
  .from("franchize_order_notifications")
  .select("send_status, doc_file_name, created_at")
  .eq("order_id", orderId)
  .order("created_at", { ascending: false })
  .limit(1);
console.log("notification:", notif?.[0]?.send_status ?? "NOT FOUND", notif?.[0]?.doc_file_name ?? "");

// 2. artifact — deposit_rub must be "0"
const { data: art } = await sb
  .schema("private")
  .from("rental_contract_artifacts")
  .select("contract_key, deposit_rub, total_sum, renter_full_name, renter_phone, storage_path, created_at")
  .like("contract_key", `testdrive-vip-bike-${orderId}%`)
  .order("created_at", { ascending: false })
  .limit(1);
console.log("artifact:", art?.[0] ? { deposit_rub: art[0].deposit_rub, total_sum: art[0].total_sum, renter: art[0].renter_full_name } : "NOT FOUND");

// 3. lead — intent_type must be test_drive, telegram id identity
const { data: lead } = await sb
  .from("franchize_intents")
  .select("id, intent_type, metadata, telegram_user_id, phone, created_at")
  .eq("metadata->>order_id", orderId)
  .order("created_at", { ascending: false })
  .limit(3);
for (const l of lead ?? []) {
  console.log("lead:", { intent: l.intent_type, tg: l.telegram_user_id, phone: l.phone, dealType: l.metadata?.dealType });
}

// 4. crew_todos — 3 testdrive follow-ups
const leadId = lead?.find((l) => l.intent_type === "test_drive")?.id;
const { data: todos } = await sb
  .from("crew_todos")
  .select("title, priority, status")
  .eq("lead_id", leadId ?? "-")
  .limit(6);
console.log("todos:", todos ?? "NOT FOUND");

// 5. secrets saved
const { data: secrets } = await sb
  .schema("private")
  .from("user_rental_secrets")
  .select("renter_full_name, renter_passport, renter_phone, crew_slug, created_at")
  .like("source_doc_key", `testdrive-vip-bike-${orderId}%`)
  .limit(1);
console.log("secrets:", secrets?.[0] ?? "NOT FOUND");
