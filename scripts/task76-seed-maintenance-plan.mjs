// scripts/task76-seed-maintenance-plan.mjs
//
// Task 76 (boss 2026-10-07): demo planned-service checklist for suzuki
// boulevard — «1/ правка диска 2/ ремонт второй передачи».
//
// DIRECT DATA CORRECT via service-role key → per the long-standing convention
// an AUDIT BLOCK is mandatory. It lives at cars.specs.owner_fix_20261007_mplan
// (owner_ prefix = double-invisible in any admin UI) and records who/what/why.
//
// IDEMPOTENT: skips when the audit marker already exists (the demo items may
// have been edited by the crew since — re-running must NOT clobber them).
//
// Run: node --env-file=.env.local scripts/task76-seed-maintenance-plan.mjs
import { createClient } from "../node_modules/@supabase/supabase-js/dist/main/index.js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const sb = createClient(url, key);

const BIKE_ID = "suzuki-vzr1800-boulevard-2006";
const CREW_SLUG = "vip-bike";
const AUDIT_KEY = "owner_fix_20261007_mplan";
// Paul (salavey13) — the boss himself seeds the demo; his global admin id
// resolves through userNameOf too, but the stamp keeps the human label.
const OWNER_ID = "413553377";
const DEMO_ITEMS = ["правка диска", "ремонт второй передачи"];

const { data: crew } = await sb.from("crews").select("id, slug").eq("slug", CREW_SLUG).maybeSingle();
if (!crew) {
  console.error(`crew ${CREW_SLUG} not found`);
  process.exit(1);
}

const { data: car, error } = await sb
  .from("cars")
  .select("id, crew_id, specs")
  .eq("id", BIKE_ID)
  .eq("crew_id", crew.id)
  .maybeSingle();
if (error || !car) {
  console.error(`bike ${BIKE_ID} not found in ${CREW_SLUG}:`, error?.message ?? "no row");
  process.exit(1);
}

const specs = { ...(car.specs ?? {}) };
if (specs[AUDIT_KEY]) {
  console.log(`SKIP: audit marker specs.${AUDIT_KEY} already present — demo plan (or its crew edits) stays as is.`);
  console.log(JSON.stringify(specs.maintenance_plan?.items?.map((i) => `${i.done ? "x" : " "} ${i.text}`) ?? [], null, 1));
  process.exit(0);
}

const now = new Date().toISOString();
const plan = {
  items: DEMO_ITEMS.map((text, i) => ({
    id: `mp-demo-boulevard-${i + 1}`,
    text,
    done: false,
    doneAt: null,
    doneBy: null,
    doneByName: null,
    createdAt: now,
    createdBy: OWNER_ID,
    createdByName: "Paul",
  })),
  updatedAt: now,
  updatedBy: OWNER_ID,
};

specs.maintenance_plan = plan;
specs[AUDIT_KEY] = {
  by: "task76-seed-maintenance-plan.mjs",
  ts: now,
  fix: "seed demo maintenance plan (плановый сервис) for suzuki boulevard",
  items: DEMO_ITEMS,
  storage: "cars.specs.maintenance_plan (items/history/updatedAt/updatedBy)",
};

const { error: updErr } = await sb.from("cars").update({ specs }).eq("id", BIKE_ID);
if (updErr) {
  console.error("update failed:", updErr.message);
  process.exit(1);
}
console.log(`OK: seeded ${DEMO_ITEMS.length} demo items into cars.specs.maintenance_plan for ${BIKE_ID}`);
console.log(`Audit block: specs.${AUDIT_KEY}`);
