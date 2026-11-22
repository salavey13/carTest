// scripts/task76-fix-demo-attribution.mjs
//
// ONE-OFF correction of the Task 76 demo data (run once, 2026-10-07).
//
// WHAT WAS WRONG: the original seed (task76-seed-maintenance-plan.mjs, env
// reset lost its copy) attributed the two demo items to user 356282674 with
// the label «Paul». 356282674 is ИЛЬЯ I.O.S. (vip-bike crew owner); PAUL is
// 413553377 (salavey13, vprAdmin). Also the e2e toggle check left
// «правка диска» done=true — the demo must stay pristine (two OPEN items).
//
// DIRECT DATA CORRECT via service-role → audit block appended at
// specs.owner_fix_20261007_mplan (the original seed marker — extended, not
// duplicated) per the standing convention.
//
// Run: node --env-file=.env.local scripts/task76-fix-demo-attribution.mjs
import { createClient } from "../node_modules/@supabase/supabase-js/dist/main/index.js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const sb = createClient(url, key);

const BIKE_ID = "suzuki-vzr1800-boulevard-2006";
const AUDIT_KEY = "owner_fix_20261007_mplan";
const PAUL = "413553377";
const DEMO = [
  { id: "mp-demo-boulevard-1", text: "правка диска" },
  { id: "mp-demo-boulevard-2", text: "ремонт второй передачи" },
];

const { data: car, error } = await sb.from("cars").select("id, specs").eq("id", BIKE_ID).maybeSingle();
if (error || !car) {
  console.error("bike not found:", error?.message ?? "no row");
  process.exit(1);
}

const specs = { ...(car.specs ?? {}) };
const before = JSON.stringify(specs.maintenance_plan ?? null);

const now = new Date().toISOString();
specs.maintenance_plan = {
  items: DEMO.map(({ id, text }) => ({
    id,
    text,
    done: false,
    doneAt: null,
    doneBy: null,
    doneByName: null,
    createdAt: specs.maintenance_plan?.items?.find((i) => i.id === id)?.createdAt ?? now,
    createdBy: PAUL,
    createdByName: "Paul",
  })),
  updatedAt: now,
  updatedBy: PAUL,
};

// Extend (not replace) the existing audit marker.
const audit = (specs[AUDIT_KEY] ?? {}) || {};
specs[AUDIT_KEY] = {
  ...audit,
  corrected: {
    by: "task76-fix-demo-attribution.mjs",
    ts: now,
    fix: "demo items re-attributed to 413553377 (Paul, was 356282674=Илья with wrong label) + e2e toggle reverted to pristine demo state",
    before: before?.slice(0, 800),
  },
};

const { error: updErr } = await sb.from("cars").update({ specs }).eq("id", BIKE_ID);
if (updErr) {
  console.error("update failed:", updErr.message);
  process.exit(1);
}
console.log("OK: demo plan corrected + audit extended.");
console.log(JSON.stringify(specs.maintenance_plan.items.map((i) => `${i.text} ← ${i.createdByName} (${i.createdBy})`), null, 1));
