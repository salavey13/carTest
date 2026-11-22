// Task 104 — READ-ONLY prod dry-run of profile-counters-recompute (mirrors the SQL logic).
// Predicts Paul's PREVIEW/FIX output without touching a single row.
// Run: node --env-file=/home/z/cartest/.env.local task104-prod-dryrun.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("missing env"); process.exit(1); }
const sb = createClient(url, key, { auth: { persistSession: false } });

const { data: crews } = await sb.from("crews").select("id, slug");
const slugById = new Map((crews || []).map((c) => [c.id, c.slug]));
console.log("crews:", [...slugById.values()].join(", ") || "NONE");

// truth per (slug, member) — mirrors the SQL truth CTE
const { data: shifts, error } = await sb
  .from("crew_member_shifts")
  .select("crew_id, member_id, duration_minutes")
  .not("clock_out_time", "is", null);
if (error) { console.error("shifts err", error.message); process.exit(1); }
const truth = new Map(); // `${slug}|${member}` -> {shifts, min}
for (const s of shifts || []) {
  const slug = slugById.get(s.crew_id);
  if (!slug) continue;
  const k = `${slug}|${s.member_id}`;
  const t = truth.get(k) || { shifts: 0, min: 0 };
  t.shifts++; t.min += s.duration_minutes || 0;
  truth.set(k, t);
}
console.log(`completed shifts: ${(shifts || []).length} → truth rows: ${truth.size}`);

// users + stored counters
const { data: users } = await sb.from("users").select("user_id, username, metadata").not("metadata", "is", null);
const rows = [];
for (const u of users || []) {
  const fp = u.metadata?.franchizeProfiles || {};
  const slugs = Object.keys(fp);
  for (const [slug, st] of Object.entries(fp)) {
    const t = truth.get(`${slug}|${String(u.user_id)}`);
    if (!t) continue; // no completed shifts in this crew → not in SQL truth CTE
    const hours = Math.round((t.min / 60.0) * 100) / 100; // mirrors ROUND(x/60.0, 2) numerically
    const c = st?.counters || {};
    // SQL compares TEXT: stored #>> vs truth::text; jsonb numbers lose trailing zeros
    const storedShiftsTxt = c.shiftsCompleted === undefined ? null : String(Number(c.shiftsCompleted));
    const storedHoursTxt = c.totalHoursWorked === undefined ? null : String(Number(c.totalHoursWorked));
    const truthShiftsTxt = String(t.shifts);
    const truthHoursTxt = hours.toFixed(2);
    const willPatch = storedShiftsTxt !== truthShiftsTxt || storedHoursTxt !== truthHoursTxt;
    rows.push({ user: u.username || String(u.user_id), userId: u.user_id, slug, multiCrew: slugs.length > 1,
      hasSpecs: !!u.metadata?.specs, stored: `${storedShiftsTxt ?? "—"}/${storedHoursTxt ?? "—"}`,
      truth: `${truthShiftsTxt}/${truthHoursTxt}`, willPatch });
  }
}
const patch = rows.filter((r) => r.willPatch);
console.log(`\n=== SQL will PATCH ${patch.length} (user,slug) pairs ===`);
for (const r of patch) console.log(JSON.stringify(r));
console.log(`\n=== already correct (no patch): ${rows.length - patch.length} ===`);
for (const r of rows.filter((r) => !r.willPatch)) console.log(JSON.stringify(r));
const multi = new Set(patch.filter((r) => r.multiCrew).map((r) => r.user));
console.log(`\nmulti-crew members among patched: ${[...multi].join(", ") || "none"}`);
console.log(`patched users WITH existing specs key: ${patch.filter((r) => r.hasSpecs).length}/${patch.length}`);
console.log("\nREAD-ONLY — nothing was written.");
