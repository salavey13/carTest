// Verify the production testdrive E2E landed: notification log, artifacts, TG.
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  "https://inmctohsodgdohamhzag.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const orderId = process.argv[2] || `order-tde2e-${process.argv[3]}`;

// 1. notification log
const { data: notif } = await sb
  .from("franchize_order_notifications")
  .select("order_id, send_status, created_at, doc_file_name, rendered_markdown")
  .eq("order_id", orderId)
  .order("created_at", { ascending: false })
  .limit(1);
console.log("notification:", notif?.[0] ? { status: notif[0].send_status, file: notif[0].doc_file_name, created: notif[0].created_at, md: (notif[0].rendered_markdown || "").slice(0, 300) } : "NOT FOUND");

// 2. rental artifacts for testdrive docs (private schema)
const { data: art, error: artErr } = await sb
  .schema("private")
  .from("rental_contract_artifacts")
  .select("contract_key, original_sha256, storage_path, created_at, renter_full_name, total_sum")
  .like("contract_key", `testdrive-vip-bike-${orderId}%`)
  .order("created_at", { ascending: false })
  .limit(1);
if (artErr) console.log("artifacts ERR:", artErr.message);
console.log("artifact:", art?.[0] ?? "NOT FOUND");
