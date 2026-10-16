// task99: verify operator sweep state — audit block + which rentals got created_by_operator_chat_id
import { createClient } from "@supabase/supabase-js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const CREW = "2d5fde70-1dd3-4f0d-8d72-66ccf6908746";

const { data: crew } = await sb.from("crews").select("metadata").eq("id", CREW).single();
const specs = crew?.metadata?.specs ?? {};
console.log("specs keys:", Object.keys(specs));
console.log("owner_fix_20261016_operator_sweep:", JSON.stringify(specs.owner_fix_20261016_operator_sweep, null, 2));
console.log("owner_fix_20261016_salary_defaults:", JSON.stringify(specs.owner_fix_20261016_salary_defaults, null, 2));

// shifts backfill check: october days for dj
const { data: shifts } = await sb
  .from("crew_member_shifts")
  .select("clock_in_time, duration_minutes, hourly_rate, salary_amount, notes")
  .eq("member_id", "7813830016")
  .eq("crew_id", CREW)
  .gte("clock_in_time", "2026-10-01T00:00:00+00:00")
  .lt("clock_in_time", "2026-11-01T00:00:00+00:00")
  .order("clock_in_time");
console.log(`\ndj october shifts: ${shifts?.length ?? 0}`);
const days = new Set((shifts ?? []).map((s) => s.clock_in_time.slice(0, 10)));
const expected = [];
for (let d = 1; d <= 25; d++) if (d !== 15) expected.push(`2026-10-${String(d).padStart(2, "0")}`);
const missing = expected.filter((d) => !days.has(d));
const extra = [...days].filter((d) => !expected.includes(d) && !d.startsWith("2026-10-2[6-9]") && d > "2026-10-25");
console.log("missing days (01–25, except 15):", missing.length ? missing : "NONE ✓");
if (extra.length) console.log("days after 25th:", extra);
const byRate = {};
for (const s of shifts ?? []) {
  const k = `${s.hourly_rate}`;
  byRate[k] = (byRate[k] || 0) + 1;
}
console.log("rate histogram:", byRate);
const backfilled = (shifts ?? []).filter((s) => s.notes?.includes("task98")).length;
console.log("task98-backfilled rows present:", backfilled);
const shiftSalary = (shifts ?? []).reduce((a, s) => a + Number(s.salary_amount || 0), 0);
console.log("Σ october shift salary:", shiftSalary);
