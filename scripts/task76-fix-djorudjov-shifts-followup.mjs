// scripts/task76-fix-djorudjov-shifts-followup.mjs
//
// Task 76 follow-up (2026-10-07): the main repair trimmed the 25–27.08
// monster to 25.08 11:34→19:00 — but 25.08 ALREADY had its standard
// 07:00→19:00 row (the member opened twice that day; the second open became
// the monster). The trimmed sliver therefore DOUBLE-COUNTED 25.08 (overlap).
// This follow-up deletes the redundant sliver and appends the correction to
// the audit block crews.metadata.owner_fix_20261007_shifts.
//
// Run: node --env-file=.env.local scripts/task76-fix-djorudjov-shifts-followup.mjs --apply
import { createClient } from "../node_modules/@supabase/supabase-js/dist/main/index.js";

const APPLY = process.argv.includes("--apply");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing env");
  process.exit(1);
}
const sb = createClient(url, key);

const DJ = "7813830016";
const CREW_ID = "2d5fde70-1dd3-4f0d-8d72-66ccf6908746";
const AUDIT_KEY = "owner_fix_20261007_shifts";
const SLIVER_ID = "6e10294e"; // prefix of the trimmed monster row (25.08 11:34→19:00)

const { data: rows } = await sb
  .from("crew_member_shifts")
  .select("*")
  .eq("member_id", DJ)
  .eq("crew_id", CREW_ID)
  .gte("clock_in_time", "2026-08-25")
  .lt("clock_in_time", "2026-08-26")
  .order("clock_in_time");

const sliver = (rows ?? []).find((r) => r.id.startsWith(SLIVER_ID));
const standard = (rows ?? []).find((r) => r.clock_in_time.includes("T07:00"));

if (!sliver || !standard) {
  console.log("Nothing to do: sliver or standard row missing (already fixed?).");
  process.exit(0);
}
console.log(`overlap: ${sliver.clock_in_time} → ${sliver.clock_out_time} (${Math.round(sliver.salary_amount)}₽) duplicates the standard 25.08 day (${Math.round(standard.salary_amount)}₽)`);

if (!APPLY) {
  console.log("DRY RUN — re-run with --apply.");
  process.exit(0);
}

const { error } = await sb.from("crew_member_shifts").delete().eq("id", sliver.id);
if (error) {
  console.error("delete failed:", error.message);
  process.exit(1);
}
console.log("✓ deleted the redundant 25.08 sliver");

// append to the audit block
const { data: crewRow } = await sb.from("crews").select("metadata").eq("id", CREW_ID).single();
const meta = { ...(crewRow?.metadata ?? {}) };
const audit = meta[AUDIT_KEY] ?? {};
audit.followup = {
  ts: new Date().toISOString(),
  fix: "deleted the trimmed 25.08 11:34→19:00 sliver — the day already had its standard 07:00→19:00 row (member opened twice; the second open had become the 25–27.08 monster); removed a 1256₽ double-count and the last overlap",
  deleted: { id: sliver.id, clock_in_time: sliver.clock_in_time, clock_out_time: sliver.clock_out_time, salary_amount: sliver.salary_amount },
};
meta[AUDIT_KEY] = audit;
const { error: auditErr } = await sb.from("crews").update({ metadata: meta }).eq("id", CREW_ID);
if (auditErr) {
  console.error("audit write failed:", auditErr.message);
  process.exit(1);
}
console.log(`✓ audit updated (crews.metadata.${AUDIT_KEY}.followup)`);
