// Run the REAL computeCategoryBonuses for djorudjov Oct 1-25 + team totals,
// to pin the exact profile numbers and find alignment gaps vs CSV.
// Run: bun scripts/task98-run-canonical.ts
import { computeCategoryBonuses } from "@/app/franchize/lib/salary-category-bonuses";
import { createClient } from "@supabase/supabase-js";

const CREW = "2d5fde70-1dd3-4f0d-8d72-66ccf6908746";
const DJ = "7813830016";

// period like the app: MSK day bounds
const periodStart = "2026-10-01T00:00:00+03:00";
const periodEnd = "2026-10-26T00:00:00+03:00"; // exclusive-ish (app uses < end via .lt on date col? see action)

const res = await computeCategoryBonuses({
  crewId: CREW,
  memberId: DJ,
  periodStart,
  periodEnd,
});
console.log("DJ total:", res.total);
for (const d of res.details) console.log("  -", d.description, "=", d.amount);
console.log("rentalItems:", (res as any).rentalItems?.length ?? "NOT_IMPLEMENTED");

// team-wide: who else gets what
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const { data: members } = await sb.from("crew_members").select("user_id").eq("crew_id", CREW).eq("membership_status", "active");
const { data: users } = await sb.from("users").select("user_id, username");
for (const m of members || []) {
  if (m.user_id === DJ) continue;
  const r = await computeCategoryBonuses({ crewId: CREW, memberId: m.user_id, periodStart, periodEnd });
  if (r.total > 0) {
    const u = (users || []).find((x) => x.user_id === m.user_id);
    console.log(`${u?.username || m.user_id}: total=${r.total}`);
    for (const d of r.details) console.log("   -", d.description, "=", d.amount);
  }
}
process.exit(0);
