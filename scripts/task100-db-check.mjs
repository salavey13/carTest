// task100 read-only diagnostic: naming + october shift rates + trigger + specs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(url, key, { auth: { persistSession: false } });

const CREW = "2d5fde70-1dd3-4f0d-8d72-66ccf6908746"; // vip-bike

// 1) crew members naming surface
const { data: members } = await sb.from("crew_members").select("user_id, role, membership_status, users(username, full_name, metadata)").eq("crew_id", CREW);
console.log("== crew members (vip-bike) ==");
for (const m of members || []) {
  const u = m.users || {};
  console.log(JSON.stringify({
    user_id: String(m.user_id).slice(0, 8), role: m.role, status: m.membership_status,
    username: u.username, full_name: u.full_name,
    meta_name: u.metadata?.name, meta_username: u.metadata?.username,
  }));
}

// 2) october shifts: rate distribution + per-member
const { data: shifts } = await sb.from("crew_member_shifts")
  .select("member_id, clock_in_time, clock_out_time, hourly_rate, salary_amount, duration_minutes, notes")
  .eq("crew_id", CREW)
  .gte("clock_in_time", "2026-10-01T00:00:00+00:00")
  .lt("clock_in_time", "2026-11-01T00:00:00+00:00")
  .order("clock_in_time");
console.log("\n== october shifts ==", (shifts || []).length);
const byMember = {};
for (const s of shifts || []) {
  const k = String(s.member_id).slice(0, 8);
  byMember[k] = byMember[k] || { count: 0, hours: 0, rates: {}, pay: 0 };
  byMember[k].count++;
  byMember[k].rates[s.hourly_rate] = (byMember[k].rates[s.hourly_rate] || 0) + 1;
  byMember[k].pay += Number(s.salary_amount || 0);
  if (s.clock_out_time) byMember[k].hours += (new Date(s.clock_out_time) - new Date(s.clock_in_time)) / 36e5;
}
console.log(JSON.stringify(byMember, null, 2));

// 3) trigger function source
const { data: trig } = await sb.rpc("pg_meta_system_events") // probe (may fail, fine)
  .catch(() => ({ data: null }));
const { data: funcs } = await sb.from("pg_catalog_pg_proc").select().limit(1).catch(() => ({ data: null }));
console.log("\n(trigger probe via REST not available — will use service-role SQL via pg function if exists)", { trig: !!trig, funcs: !!funcs });

// 4) crews.specs audit keys
const { data: crew } = await sb.from("crews").select("specs, metadata").eq("id", CREW).single();
const specs = crew?.specs || {};
console.log("\n== crews.specs keys ==", Object.keys(specs));
console.log("owner_fix_20261016_salary_defaults:", JSON.stringify(specs.owner_fix_20261016_salary_defaults || null));
console.log("owner_fix_20261016_operator_sweep:", JSON.stringify(specs.owner_fix_20261016_operator_sweep || null));
