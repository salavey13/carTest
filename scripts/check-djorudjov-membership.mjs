// Diagnose why "Аналитика аренд" can stay hidden for crew members (djorudjov / vip-bike).
// Checks: user row → crew_members rows (status/role) → crews.slug shape → crews.owner_id.
// Read-only. Run: node --env-file=.env.local scripts/check-djorudjov-membership.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("env missing"); process.exit(1); }
const sb = createClient(url, key, { auth: { persistSession: false } });

const USERNAMES = ["djorudjov"];

const { data: users, error: uerr } = await sb
  .from("users")
  .select("user_id, username, status, role")
  .in("username", USERNAMES);
if (uerr) { console.error("users query error:", uerr.message); process.exit(1); }
console.log("== users ==", JSON.stringify(users, null, 2));

for (const u of users || []) {
  const { data: mem, error: merr } = await sb
    .from("crew_members")
    .select("crew_id, role, membership_status, joined_at, crews(slug, name, owner_id)")
    .eq("user_id", u.user_id);
  console.log(`\n== crew_members for ${u.username} (err: ${merr?.message || "none"}) ==`);
  console.log(JSON.stringify(mem, null, 2));

  const { data: owned } = await sb
    .from("crews")
    .select("id, slug, name, owner_id")
    .eq("owner_id", u.user_id);
  console.log(`== owned crews for ${u.username} ==`, JSON.stringify(owned, null, 2));
}

// Also dump distinct membership_status values + slug shapes across all crews,
// to spot case/whitespace drift that breaks `m.slug === effectiveSlug` matching.
const { data: statuses } = await sb.from("crew_members").select("membership_status");
console.log("\n== distinct membership_status ==", [...new Set((statuses || []).map((r) => r.membership_status))]);

const { data: crewSlugs } = await sb.from("crews").select("slug, name, id").order("slug");
console.log("\n== all crew slugs (check case/space) ==");
for (const c of crewSlugs || []) {
  const raw = c.slug ?? "null";
  const suspicious = raw !== raw.trim().toLowerCase();
  console.log(`${suspicious ? "⚠️ " : "  "}${JSON.stringify(c.slug)}  (${c.name}) [${c.id}]`);
}
