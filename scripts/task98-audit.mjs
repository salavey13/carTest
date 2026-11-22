// Task 98 audit — djorudjov (7813830016) / vip-bike (2d5fde70):
// 1. crew_member_shifts for October — boss expects one per day except Oct 15
// 2. rentals 01–25 Oct: per-rental salary + attribution chain (reconcile
//    profile 16 880 vs CSV 19 255, экип split, missing sweep +2 375)
// 3. users.metadata.hourly_rate for members (default 500 → planned 100)
// Read-only. Run: node --env-file=.env.local scripts/task98-audit.mjs
import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(url, key, { auth: { persistSession: false } });

const CREW = "2d5fde70-1dd3-4f0d-8d72-66ccf6908746";
const DJ = "7813830016";
const octStart = "2026-09-30T00:00:00+03:00";
const octEnd = "2026-10-26T00:00:00+03:00";

// ── 1. Shifts ──
const { data: shifts } = await sb
  .from("crew_member_shifts")
  .select("shift_id, member_id, clock_in_time, clock_out_time, duration_minutes, hourly_rate, salary_amount")
  .eq("crew_id", CREW)
  .gte("clock_in_time", octStart)
  .lt("clock_in_time", octEnd)
  .order("clock_in_time", { ascending: true });

console.log(`== crew_member_shifts Oct (all members): ${shifts?.length ?? 0} rows ==`);
const byMember = new Map();
for (const s of shifts || []) {
  if (!byMember.has(s.member_id)) byMember.set(s.member_id, []);
  byMember.get(s.member_id).push(s);
}
for (const [mid, rows] of byMember) {
  console.log(`\nmember ${mid}: ${rows.length} shifts`);
  if (mid === DJ) {
    for (const s of rows) {
      const d = new Date(Date.parse(s.clock_in_time) + 3 * 3600 * 1000);
      console.log(`  ${d.toISOString().slice(0, 16)}Z+3 rate=${s.hourly_rate} min=${s.duration_minutes} sal=${s.salary_amount}`);
    }
  }
}
// Expected days: every day 01–25 Oct except 15th
const djShifts = byMember.get(DJ) || [];
const djDays = new Set(djShifts.map((s) => new Date(Date.parse(s.clock_in_time) + 3 * 3600 * 1000).toISOString().slice(8, 10)));
const expected = [];
for (let d = 1; d <= 25; d++) if (d !== 15) expected.push(String(d).padStart(2, "0"));
const missing = expected.filter((d) => !djDays.has(d));
const extra = [...djDays].filter((d) => !expected.includes(d));
console.log(`\nDJ expected days: ${expected.length}, present: ${djDays.size}, MISSING: [${missing.join(",")}]${extra.length ? `, EXTRA: [${extra.join(",")}]` : ""}`);

// ── 2. Rentals + attribution ──
const pStart = "2026-10-01T00:00:00+03:00";
const pEnd = "2026-10-26T00:00:00+03:00";
const { data: rentals } = await sb
  .from("rentals")
  .select(`rental_id, total_cost, metadata, created_at, created_by_operator_chat_id, status,
    requested_start_date, requested_end_date,
    vehicle:cars!inner(id, make, model, crew_id, specs, daily_price)`)
  .eq("vehicle.crew_id", CREW)
  .neq("status", "cancelled")
  .gte("requested_start_date", pStart)
  .lt("requested_start_date", pEnd)
  .order("requested_start_date", { ascending: true });

// shifts for attribution fallback (±1 day margin like computeCategoryBonuses)
const { data: shiftRows } = await sb
  .from("crew_member_shifts")
  .select("member_id, clock_in_time, clock_out_time")
  .eq("crew_id", CREW)
  .gte("clock_in_time", "2026-09-30T00:00:00+03:00")
  .lte("clock_in_time", "2026-10-27T00:00:00+03:00");

const { data: users } = await sb.from("users").select("user_id, username, full_name");
const nameOf = (id) => {
  const u = (users || []).find((x) => String(x.user_id) === String(id));
  return u ? (u.username ? `@${u.username}` : u.full_name || id) : id || "—";
};

function pickShiftAt(shiftsArr, atMs) {
  let best = null, bestDur = -1, bestIn = Infinity;
  for (const s of shiftsArr) {
    const inMs = Date.parse(s.clock_in_time);
    if (!Number.isFinite(inMs) || inMs > atMs) continue;
    const outMs = s.clock_out_time ? Date.parse(s.clock_out_time) : null;
    if (outMs != null && outMs < atMs) continue;
    const dur = outMs == null ? Number.MAX_SAFE_INTEGER : outMs - inMs;
    if (dur > bestDur || (dur === bestDur && inMs < bestIn)) { best = s; bestDur = dur; bestIn = inMs; }
  }
  return best;
}

function attr(r) {
  if (r.created_by_operator_chat_id) return { id: String(r.created_by_operator_chat_id), src: "doc_command" };
  const fr = r.metadata?.pickup_freeze;
  if (fr?.frozen_by) return { id: String(fr.frozen_by), src: "handout" };
  if (r.metadata?.return_confirmed_by) return { id: String(r.metadata.return_confirmed_by), src: "return" };
  const t = Date.parse(r.created_at);
  if (Number.isFinite(t)) {
    const s = pickShiftAt(shiftRows || [], t);
    if (s) return { id: String(s.member_id), src: "shift" };
  }
  return { id: null, src: "none" };
}

console.log(`\n== bike rentals 01–25 Oct: ${rentals?.length ?? 0} (incl equipment/service) ==`);
const bikes = (rentals || []).filter((r) => {
  const v = Array.isArray(r.vehicle) ? r.vehicle[0] : r.vehicle;
  const meta = r.metadata || {};
  return !(meta.item_type === "equipment" || v?.type === "equipment" || v?.type === "service");
});
console.log(`bike rentals only: ${bikes.length}`);

let djTotal = 0, otherTotal = 0, djCount = 0;
for (const r of bikes) {
  const a = attr(r);
  const v = Array.isArray(r.vehicle) ? r.vehicle[0] : r.vehicle;
  const d = (r.requested_start_date || "").slice(5, 10);
  const eq = r.metadata?.equipment || {};
  const eqFlags = [
    Number(eq.helmets) > 0 ? `${eq.helmets}шл` : "",
    Number(eq.gloves) > 0 ? `${eq.gloves}перч` : "",
    eq.jacket ? "курт" : "", eq.pants ? "шт" : "", eq.boots ? "бот" : "",
    eq.net ? "сет" : "", eq.backpack ? "рюк" : "", eq.charger ? "заряд" : "",
  ].filter(Boolean).join("+");
  const mark = a.id === DJ ? "DJ " : "   ";
  const amount = "";
  if (a.id === DJ) { djTotal++; djCount++; }
  else otherTotal++;
  console.log(`${mark}${d} ${String(r.total_cost).padStart(6)} ЗПкол ${eqFlags.padEnd(12)} ${String(r.rental_id).slice(0, 8)} создал=${nameOf(r.created_by_operator_chat_id)} атрибуция=${nameOf(a.id)} (${a.src})`);
}
console.log(`\nDJ-attributed: ${djCount}, other: ${otherTotal}`);
console.log(`(зп per rental needs salary config — computed in app; here we only check attribution split)`);
console.log(`From worklog: profile=16 880 (14 /doc) vs CSV=19 255 → sweep pending +2 375 = 2 rentals`);

// ── 3. hourly_rate metadata ──
const { data: crewMembers } = await sb.from("crew_members").select("user_id").eq("crew_id", CREW).eq("membership_status", "active");
const ids = (crewMembers || []).map((m) => m.user_id);
const { data: memUsers } = await sb.from("users").select("user_id, username, metadata").in("user_id", ids);
console.log(`\n== users.metadata.hourly_rate (crew members) ==`);
for (const u of memUsers || []) {
  const hr = u.metadata?.hourly_rate;
  if (hr !== undefined) console.log(`  ${u.username || u.user_id}: ${hr}`);
}
