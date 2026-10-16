// task100: current october salary state (did Paul run normalize? did attribution change?)
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const CREW = "2d5fde70-1dd3-4f0d-8d72-66ccf6908746";

const { data: shifts } = await sb.from("crew_member_shifts")
  .select("member_id, clock_in_time, hourly_rate, salary_amount, duration_minutes")
  .eq("crew_id", CREW)
  .gte("clock_in_time", "2026-10-01T00:00:00+00:00").lt("clock_in_time", "2026-11-01T00:00:00+00:00");
const by = {};
for (const s of shifts || []) {
  const k = String(s.member_id);
  by[k] = by[k] || { n: 0, h: 0, rates: {}, pay: 0 };
  by[k].n++; by[k].h += (s.duration_minutes || 0) / 60; by[k].pay += Number(s.salary_amount || 0);
  by[k].rates[s.hourly_rate] = (by[k].rates[s.hourly_rate] || 0) + 1;
}
console.log("== october shifts ==");
for (const [k, v] of Object.entries(by)) console.log(k.slice(0, 8), JSON.stringify(v));

const { data: crew } = await sb.from("crews").select("metadata").eq("id", CREW).single();
const specs = crew?.metadata?.specs || {};
console.log("\n== specs ==");
for (const k of Object.keys(specs)) if (k.includes("20261016") || k.includes("20261017")) console.log(k, "→", JSON.stringify(specs[k]).slice(0, 220));

const { data: u } = await sb.from("users").select("username, full_name, metadata, updated_at").eq("user_id", "7813830016").single();
console.log("\ndj user row:", u?.username, "/", u?.full_name, "updated:", u?.updated_at, "specs-restore:", JSON.stringify(u?.metadata?.owner_fix_20261017_identity_restore || null));
