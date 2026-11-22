// Query last rentals (esp. aprilia-shiver) from Supabase to diagnose the
// "displayed 1000, doc 9500+1000" price bug.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://inmctohsodgdohamhzag.supabase.co";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

const sb = createClient(url, key);

const { data, error } = await sb
  .from("rentals")
  .select("rental_id, vehicle_id, total_cost, status, metadata, requested_start_date, requested_end_date, agreed_start_date, agreed_end_date, created_at")
  .order("created_at", { ascending: false })
  .limit(12);

if (error) {
  console.error("ERR", error.message);
  process.exit(1);
}

for (const r of data) {
  const m = r.metadata || {};
  console.log("=== rental", r.rental_id, "created", r.created_at);
  console.log("  car:", r.vehicle_id, "status:", r.status, "total_cost:", r.total_cost);
  console.log("  period:", r.requested_start_date, r.requested_end_date, "→", r.agreed_start_date, r.agreed_end_date);
  console.log("  metadata:", JSON.stringify(m));
}
