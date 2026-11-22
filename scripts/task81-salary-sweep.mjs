// Task 81: salary tables sweep for 69000 / surge.
import { writeFileSync } from "node:fs";
import { createClient } from "/home/z/cartest/node_modules/@supabase/supabase-js/dist/main/index.js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const out = {};

for (const tbl of ["salary_calculations", "salary_calc", "salary_plans", "commission_rates", "referral_commissions"]) {
  const { data: probe, error: pErr } = await sb.from(tbl).select("*").limit(1);
  if (pErr) { out[tbl] = "probe err: " + pErr.message; continue; }
  const cols = Object.keys(probe?.[0] || {});
  out[tbl + "_cols"] = cols;
  // numeric-ish columns → search 69000
  for (const c of cols) {
    if (!/amount|price|sum|total|value|bonus|payout/i.test(c)) continue;
    const { data: hits, error } = await sb.from(tbl).select("*").eq(c, 69000).limit(5);
    if (error) continue;
    if (hits?.length) out[tbl + "_" + c + "_69000"] = hits.map((h) => JSON.stringify(h).slice(0, 300));
  }
}
writeFileSync("/home/z/cartest/scripts/task81-salary-out.json", JSON.stringify(out, null, 1));
console.log("written");
