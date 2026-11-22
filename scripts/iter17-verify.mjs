// Final verification of iter17 retrofix
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

console.log("=== rentals ===");
const { data: rentals } = await sb.from("rentals")
  .select("rental_id, vehicle_id, status, total_cost, metadata")
  .in("rental_id", ["08d80058-8f44-43f9-9088-785e9f956a75", "63d243f1-fc1b-4953-aea0-a39d43408029", "7ced14e6-0423-4bd9-9f3d-570cec1e78b1", "5626326b-3644-4987-ab91-e79414bf382c"]);
for (const r of rentals ?? []) {
  console.log(`${r.vehicle_id}: ${r.total_cost} ₽ / ${r.status} / шлемы=${r.metadata?.equipment?.helmets ?? "-"} / split=${JSON.stringify(r.metadata?.payment_split)} / note="${r.metadata?.manual_correction?.text?.slice(0, 60) ?? "—"}"`);
}

console.log("=== artifacts ===");
const { data: arts } = await sb.schema("private").from("rental_contract_artifacts")
  .select("id, rental_id, resolved_bike_id, total_sum")
  .in("id", ["f12a8bdf-c53d-4327-b0f4-6f89af80783d", "9677c7a1-9632-488a-bd06-5aac40146359", "bc29e51f-d195-447b-8730-cf5f831e4e28"]);
for (const a of arts ?? []) console.log(`${a.resolved_bike_id}: artifact total_sum=${a.total_sum}`);

console.log("=== prefill rows ===");
const { data: secs } = await sb.schema("private").from("user_rental_secrets")
  .select("chat_id, crew_slug, source_doc_key, verification_status, renter_full_name, renter_phone, renter_passport, renter_driver_license, renter_registration, renter_passport_issued_by")
  .eq("source_doc_key", "profile_prefill")
  .order("created_at", { ascending: true });
for (const s of secs ?? []) console.log(`${s.chat_id} [${s.verification_status}] ${s.renter_full_name} • тел ${s.renter_phone ?? "—"} • паспорт ${s.renter_passport ? "✓" : "—"} • ВУ ${s.renter_driver_license ? "✓" : "—"} • рег ${s.renter_registration ? "✓" : "—"}`);
console.log(`total: ${secs?.length} rows`);
