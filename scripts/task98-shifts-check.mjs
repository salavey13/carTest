// Check crew_member_shifts table shape + where the 6 October shifts actually live
import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(url, key, { auth: { persistSession: false } });
const CREW = "2d5fde70-1dd3-4f0d-8d72-66ccf6908746";
const DJ = "7813830016";

// raw count without filters + error visibility
const { data: all, error: allErr } = await sb
  .from("crew_member_shifts")
  .select("shift_id, member_id, crew_id, clock_in_time, hourly_rate, salary_amount")
  .order("clock_in_time", { ascending: false })
  .limit(30);
console.log("ERR:", allErr?.message || "none");
console.log(`recent ${all?.length ?? 0} shifts (any crew):`);
for (const s of all || []) {
  console.log(`  ${s.clock_in_time?.slice(0, 16)} crew=${String(s.crew_id).slice(0, 8)} member=${s.member_id} rate=${s.hourly_rate} sal=${s.salary_amount}`);
}

// djorudjov across all time
const { data: dj, error: djErr } = await sb
  .from("crew_member_shifts")
  .select("shift_id, crew_id, clock_in_time, clock_out_time, duration_minutes, hourly_rate, salary_amount")
  .eq("member_id", DJ)
  .order("clock_in_time", { ascending: false })
  .limit(40);
console.log("\nDJ ERR:", djErr?.message || "none");
console.log(`DJ shifts all-time: ${dj?.length ?? 0}`);
for (const s of dj || []) {
  console.log(`  ${s.clock_in_time?.slice(0, 16)} → ${s.clock_out_time?.slice(0, 16) ?? "OPEN"} crew=${String(s.crew_id).slice(0, 8)} min=${s.duration_minutes} rate=${s.hourly_rate} sal=${s.salary_amount}`);
}
