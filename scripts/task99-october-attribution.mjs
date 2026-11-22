// task99: October 2026 attribution audit — exact parity with resolveRentalOperator
// (operator-attribution.ts): created_by_operator_chat_id → pickup_freeze.frozen_by →
// metadata.return_confirmed_by → shift-at-created_at → none.
import { createClient } from "@supabase/supabase-js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const CREW = "2d5fde70-1dd3-4f0d-8d72-66ccf6908746";
const DJ = "7813830016";
const SALAVEY = "413553377";

const from = "2026-10-01T00:00:00+00:00";
const to = "2026-11-01T00:00:00+00:00";

const { data: rentals, error } = await sb
  .from("rentals")
  .select("rental_id, created_at, status, total_cost, created_by_operator_chat_id, metadata, cars(make, model, type)")
  .eq("crew_id", CREW)
  .gte("created_at", from)
  .lt("created_at", to)
  .order("created_at");
if (error) { console.error("rentals err:", error.message); process.exit(1); }

// completed shifts (for shift-fallback parity)
const { data: shifts } = await sb
  .from("crew_member_shifts")
  .select("member_id, clock_in_time, clock_out_time")
  .eq("crew_id", CREW)
  .gte("clock_in_time", "2026-09-25T00:00:00+00:00")
  .lt("clock_in_time", to);
const shiftAt = (iso) =>
  shifts?.find((s) => new Date(s.clock_in_time) <= new Date(iso) && new Date(iso) <= new Date(s.clock_out_time || s.clock_in_time));

const { data: users } = await sb.from("users").select("user_id, username, full_name");
const label = (id) => {
  if (!id) return "—";
  const u = users?.find((x) => String(x.user_id) === String(id));
  return u ? `@${u.username || u.full_name || id}` : String(id);
};

console.log(`October rentals: ${rentals.length}\n`);
const sums = {};
for (const r of rentals) {
  const md = r.metadata ?? {};
  const fb = md?.pickup_freeze?.frozen_by ?? null;
  const rb = md?.return_confirmed_by ?? null;
  const direct = (r.created_by_operator_chat_id || "").trim() || null;

  let opId = direct, source = "doc_command";
  if (!opId && fb) { opId = fb; source = "handout"; }
  if (!opId && rb) { opId = rb; source = "return"; }
  if (!opId) { const sh = shiftAt(r.created_at); if (sh) { opId = sh.member_id; source = "shift"; } }
  const who = opId ? label(opId) : "none";
  sums[who] = sums[who] || { n: 0, cost: 0 };
  sums[who].n++;
  sums[who].cost += Number(r.total_cost || 0);
  const bike = r.cars ? `${r.cars.make || ""} ${r.cars.model || ""}`.trim() : "?";
  const isSal = String(opId) === SALAVEY, isDj = String(opId) === DJ;
  if (isSal || isDj) {
    console.log(
      `${r.created_at.slice(0, 10)} ${String(r.rental_id).slice(0, 8)} ${r.status.padEnd(11)} ${bike.padEnd(16)} cost=${String(r.total_cost ?? "—").padEnd(6)} → ${who.padEnd(14)} (${source})${r.cars?.type ? " [" + r.cars.type + "]" : ""}`
    );
  }
}
console.log("\nPer-operator totals (all october rentals):");
for (const [k, v] of Object.entries(sums).sort((a, b) => b[1].cost - a[1].cost)) console.log(`  ${k.padEnd(16)} n=${String(v.n).padStart(2)}  cost=${v.cost}`);
