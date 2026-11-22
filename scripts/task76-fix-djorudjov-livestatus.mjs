// scripts/task76-fix-djorudjov-livestatus.mjs
//
// Task 76 tail (2026-10-07): the forgotten 22.09 clock-out also left
// crew_members.live_status = 'online' for 15 days (the shifts API flips it
// online on clock-in / offline on clock-out). With all shifts now closed the
// truthful value is 'offline'.
//
// Run: node --env-file=.env.local scripts/task76-fix-djorudjov-livestatus.mjs --apply
import { createClient } from "../node_modules/@supabase/supabase-js/dist/main/index.js";

const APPLY = process.argv.includes("--apply");
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const DJ = "7813830016";
const CREW_ID = "2d5fde70-1dd3-4f0d-8d72-66ccf6908746";
const AUDIT_KEY = "owner_fix_20261007_shifts";

const { data: mem } = await sb.from("crew_members").select("live_status").eq("user_id", DJ).eq("crew_id", CREW_ID).maybeSingle();
console.log("live_status:", mem?.live_status);
if (mem?.live_status !== "online") {
  console.log("Nothing to do.");
  process.exit(0);
}
if (!APPLY) {
  console.log("DRY RUN — re-run with --apply.");
  process.exit(0);
}
const { error } = await sb.from("crew_members").update({ live_status: "offline" }).eq("user_id", DJ).eq("crew_id", CREW_ID);
if (error) {
  console.error("failed:", error.message);
  process.exit(1);
}
const { data: crewRow } = await sb.from("crews").select("metadata").eq("id", CREW_ID).single();
const meta = { ...(crewRow?.metadata ?? {}) };
const audit = meta[AUDIT_KEY] ?? {};
audit.liveStatus = {
  ts: new Date().toISOString(),
  fix: "live_status online→offline — stuck since the forgotten 22.09 clock-out (all shifts now closed)",
};
meta[AUDIT_KEY] = audit;
await sb.from("crews").update({ metadata: meta }).eq("id", CREW_ID);
console.log("✓ live_status → offline; audit appended");
