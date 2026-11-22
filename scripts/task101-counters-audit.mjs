// Task 101 — audit profile counters (shiftsCompleted/totalHoursWorked) vs DB truth.
// READ-ONLY. Explains the «731 смены за 3 месяца» report.
// Run: node --env-file=.env.local scripts/task101-counters-audit.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("missing env"); process.exit(1); }
const sb = createClient(url, key, { auth: { persistSession: false } });

// 1) find salavey13 + vip-bike crew
const { data: users, error: uErr } = await sb
  .from("users")
  .select("user_id, username, full_name, metadata")
  .ilike("username", "salavey13");
if (uErr) { console.error("users err", uErr.message); process.exit(1); }
const sal = users?.[0];
if (!sal) { console.error("salavey13 not found"); process.exit(1); }
console.log("salavey13 user_id:", sal.user_id);

const prof = sal.metadata?.franchizeProfiles || {};
console.log("franchizeProfiles slugs:", Object.keys(prof));
for (const [slug, st] of Object.entries(prof)) {
  const counters = st?.counters || {};
  const ach = st?.achievements || {};
  console.log(`\n[${slug}] counters:`, JSON.stringify(counters));
  console.log(`[${slug}] achievements unlocked: ${Object.keys(ach).length}`);
  console.log(`[${slug}] achievement ids:`, Object.keys(ach).join(", "));
}

// 2) DB truth: shifts of salavey13 per crew
const { data: shifts, error: sErr } = await sb
  .from("crew_member_shifts")
  .select("crew_id, clock_in_time, clock_out_time, duration_minutes, salary_amount")
  .eq("member_id", String(sal.user_id))
  .not("clock_out_time", "is", null);
if (sErr) { console.error("shifts err", sErr.message); process.exit(1); }
console.log(`\nDB truth: salavey13 completed shifts total = ${shifts.length}`);
const byCrew = {};
let totalMin = 0;
for (const s of shifts) {
  byCrew[s.crew_id] = (byCrew[s.crew_id] || 0) + 1;
  totalMin += s.duration_minutes || 0;
}
console.log("by crew:", JSON.stringify(byCrew));
console.log("total hours:", Math.round(totalMin / 60));

// last 3 months window
const cutoff = new Date(Date.now() - 92 * 864e5).toISOString();
const recent = shifts.filter((s) => (s.clock_out_time || "") >= cutoff);
const recentMin = recent.reduce((a, s) => a + (s.duration_minutes || 0), 0);
console.log(`last ~3 months: ${recent.length} shifts, ${Math.round(recentMin / 60)} h`);

// 3) same audit for ALL users with franchizeProfiles counters (find every corrupted counter)
const { data: allUsers, error: aErr } = await sb
  .from("users")
  .select("user_id, username, metadata")
  .not("metadata", "is", null);
if (aErr) { console.error("allUsers err", aErr.message); process.exit(1); }
const corrupt = [];
for (const u of allUsers || []) {
  const profiles = u.metadata?.franchizeProfiles || {};
  for (const [slug, st] of Object.entries(profiles)) {
    const c = st?.counters || {};
    if (typeof c.shiftsCompleted === "number" && c.shiftsCompleted > 0) {
      corrupt.push({
        username: u.username || String(u.user_id),
        slug,
        storedShifts: c.shiftsCompleted,
        storedHours: Math.round((c.totalHoursWorked || 0) * 10) / 10,
      });
    }
  }
}
console.log("\n=== all users with stored counters ===");
for (const c of corrupt) console.log(JSON.stringify(c));

// 4) DB truth for those users (per crew? counters are per crew-slug)
// crew id → slug map
const { data: crews, error: cErr } = await sb.from("crews").select("id, slug");
if (cErr) { console.error("crews err", cErr.message); process.exit(1); }
const crewSlug = new Map((crews || []).map((c) => [c.id, c.slug]));
console.log("\n=== truth per user:slug (completed shifts / hours in THAT crew) ===");
for (const c of corrupt) {
  const u = (allUsers || []).find(
    (x) => (x.username || "") === c.username.replace(/^@/, "") || String(x.user_id) === c.username,
  );
  if (!u) continue;
  const crewId = [...crewSlug.entries()].find(([, s]) => s === c.slug)?.[0];
  if (!crewId) { console.log(`${c.username} @ ${c.slug}: crew not found`); continue; }
  const { data: us } = await sb
    .from("crew_member_shifts")
    .select("duration_minutes")
    .eq("member_id", String(u.user_id))
    .eq("crew_id", crewId)
    .not("clock_out_time", "is", null);
  const mins = (us || []).reduce((a, s) => a + (s.duration_minutes || 0), 0);
  console.log(
    `${c.username} @ ${c.slug}: stored ${c.storedShifts} shifts / ${c.storedHours} h  ||  TRUTH ${us?.length || 0} shifts / ${Math.round(mins / 60)} h`,
  );
}
