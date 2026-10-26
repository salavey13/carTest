/**
 * task144: compute canon verification snapshots for retro rentals via the REAL
 * computeRentalVerificationSnapshot (task121b recipe: bun + server-only stub + .env.local).
 * Output: scripts/task144-verify-snapshots.json  (rental_id → snapshot)
 */
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CREW = "2d5fde70-1dd3-4f0d-8d72-66ccf6908746";
const db = createClient(URL_, SRK, { auth: { persistSession: false } });

const { computeRentalVerificationSnapshot } = await import(
  "@/app/franchize/lib/rental-verify"
);

async function main() {
  const { data: rentals, error } = await db
    .from("rentals")
    .select(
      `rental_id,total_cost,metadata,requested_start_date,requested_end_date,
       agreed_start_date,agreed_end_date,created_by_operator_chat_id,created_at,
       start_photo_count,end_photo_count,
       vehicle:cars(id,make,model,specs,daily_price,type)`
    )
    .eq("crew_id", CREW)
    .eq("user_id", "356282674")
    .eq("owner_id", "356282674")
    .eq("status", "completed")
    .gte("requested_start_date", "2026-04-01T00:00:00+00:00")
    .lt("requested_start_date", "2026-11-01T00:00:00+00:00");
  if (error) throw error;

  const { data: existingVerifs } = await db
    .from("rental_verifications")
    .select("rental_id")
    .eq("crew_id", CREW);
  const hasVerif = new Set((existingVerifs || []).map((v) => v.rental_id));

  const out = {};
  let skipped = 0, ok = 0, failed = 0;
  for (const r of rentals || []) {
    const v = Array.isArray(r.vehicle) ? r.vehicle[0] : r.vehicle;
    if (!v || v.type !== "bike") continue; // bikes only (services/equipment excluded)
    if (hasVerif.has(r.rental_id)) { skipped++; continue; }
    try {
      const requestedAtIso =
        r.requested_end_date || r.agreed_end_date || r.requested_start_date;
      const snap = await computeRentalVerificationSnapshot({
        rental: {
          rental_id: r.rental_id,
          total_cost: r.total_cost,
          metadata: r.metadata,
          requested_start_date: r.requested_start_date,
          requested_end_date: r.requested_end_date,
          agreed_start_date: r.agreed_start_date,
          agreed_end_date: r.agreed_end_date,
          created_by_operator_chat_id: r.created_by_operator_chat_id,
          created_at: r.created_at,
          start_photo_count: r.start_photo_count ?? null,
          end_photo_count: r.end_photo_count ?? null,
          vehicle: v,
        },
        crewId: CREW,
        requestedAtIso,
      });
      out[r.rental_id] = { requestedAtIso, snapshot: snap };
      ok++;
    } catch (e) {
      failed++;
      out[r.rental_id] = { error: String(e && e.message || e) };
      console.error("FAIL", r.rental_id, e && e.message || e);
    }
  }
  writeFileSync(
    "/home/z/cartest/scripts/task144-verify-snapshots.json",
    JSON.stringify(out, null, 1)
  );
  console.log(`bikes total=${(rentals || []).length}, computed=${ok}, alreadyHave=${skipped}, failed=${failed}`);
}
main();
