/**
 * task144b: verification catch-up —
 *  (a) 7 NEW held-row rentals → compute canon snapshots + INSERT rental_verifications (verified);
 *  (b) 4 REPRICED v3 rows (Киселёв/Михайлов/Шихабоддин/Долинский) → RECOMPUTE snapshot + PATCH
 *      (old snapshots were computed with total_cost=null → эталон/комиссия = 0, now stale).
 * Stamps (operator/owner confirmed) preserved on PATCH — snapshot only, task121b recipe.
 * Run: bun scripts/task144b-verify.mjs   (bun auto-loads .env.local; server-only stub must exist)
 */
import { createClient } from "@supabase/supabase-js";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CREW = "2d5fde70-1dd3-4f0d-8d72-66ccf6908746";
const OPERATOR = "7813830016";
const OWNER = "356282674";
const APPLY = process.argv.includes("--apply");
const db = createClient(URL_, SRK, { auth: { persistSession: false } });

const { computeRentalVerificationSnapshot } = await import(
  "@/app/franchize/lib/rental-verify"
);

// 7 new inserts (task144b-june-finish) + 4 repriced v3 rows
const TARGETS = [
  "1c15cac1-f172-4b32-8a30-1b8a4d95a9ce", // placeholder — replaced by dynamic fetch below
].slice(0, 0); // dynamic: fetch by ids from DB instead of hardcoding

const NEW_IDS = (process.env.VERIFY_NEW_IDS ||
  "1c15cac1,eb6fc951,06af888f,0632ec8f,97971f7e,eb4ae90d,b8ec3818").split(",").map((s) => s.trim()).filter(Boolean);
const REPRICED_PREFIXES = (process.env.VERIFY_REPRICED_IDS ||
  "ca21b7de,6c36a227,7e1f0065,9623de5e").split(",").map((s) => s.trim()).filter(Boolean);

async function resolveByPrefix(prefixes) {
  const { data, error } = await db
    .from("rentals")
    .select("rental_id")
    .eq("crew_id", CREW)
    .gte("agreed_start_date", "2026-04-01")
    .lt("agreed_start_date", "2026-11-01");
  if (error) throw error;
  const ids = [];
  for (const p of prefixes) {
    const hit = (data || []).find((x) => x.rental_id.startsWith(p));
    if (!hit) throw new Error(`prefix not found in season: ${p}`);
    ids.push(hit.rental_id);
  }
  return ids;
}

async function main() {
  const ids = [
    ...(await resolveByPrefix(NEW_IDS)),
    ...(await resolveByPrefix(REPRICED_PREFIXES)),
  ];
  console.log(`targets: ${ids.length}`);

  const { data: rentals, error } = await db
    .from("rentals")
    .select(
      `rental_id,total_cost,metadata,requested_start_date,requested_end_date,
       agreed_start_date,agreed_end_date,created_by_operator_chat_id,created_at,
       start_photo_count,end_photo_count,
       vehicle:cars(id,make,model,specs,daily_price,type)`
    )
    .eq("crew_id", CREW)
    .in("rental_id", ids);
  if (error) throw error;

  const { data: verifs } = await db
    .from("rental_verifications")
    .select("id,rental_id,status,snapshot")
    .eq("crew_id", CREW)
    .in("rental_id", ids);
  const verifByRental = new Map((verifs || []).map((v) => [v.rental_id, v]));

  let ins = 0, patched = 0, failed = 0;
  let poolNew = 0;
  for (const r of rentals || []) {
    const v = Array.isArray(r.vehicle) ? r.vehicle[0] : r.vehicle;
    if (!v) { console.error("no vehicle", r.rental_id); failed++; continue; }
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
      const commission = snap.total || 0;
      const existing = verifByRental.get(r.rental_id);
      const name = ((r.metadata || {}).renter_name || "").slice(0, 24);
      if (existing) {
        console.log(
          `RECOMPUTE ${r.rental_id.slice(0, 8)} ${name.padEnd(24)} cost=${r.total_cost} ` +
          `commission ${existing.snapshot?.total ?? 0} -> ${commission}`
        );
        if (APPLY) {
          const { error: e2 } = await db
            .from("rental_verifications")
            .update({ snapshot: snap, updated_at: new Date().toISOString() })
            .eq("id", existing.id);
          if (e2) throw e2;
        }
        patched++;
      } else {
        console.log(
          `NEW       ${r.rental_id.slice(0, 8)} ${name.padEnd(24)} cost=${r.total_cost} commission=${commission}`
        );
        poolNew += commission;
        if (APPLY) {
          const ts = requestedAtIso;
          const { error: e2 } = await db.from("rental_verifications").insert({
            rental_id: r.rental_id,
            crew_id: CREW,
            crew_slug: "vip-bike",
            operator_chat_id: OPERATOR,
            owner_chat_id: OWNER,
            requested_by: OPERATOR,
            requested_at: ts,
            status: "verified",
            operator_confirmed_at: ts,
            owner_confirmed_at: ts,
            verified_at: new Date().toISOString(),
            source: "retro_backfill",
            snapshot: snap,
          });
          if (e2) throw e2;
        }
        ins++;
      }
    } catch (e) {
      failed++;
      console.error("FAIL", r.rental_id, (e && e.message) || e);
    }
  }
  console.log(
    `\n${APPLY ? "APPLIED" : "DRY"}: new=${ins} (pool +${poolNew} ₽), recomputed=${patched}, failed=${failed}`
  );
}

main();
