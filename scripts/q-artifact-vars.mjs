// Inspect stored contract artifact vars for web orders with gear (honda
// a697dc47 / aprilia c99687c7) to check for gear double-count in the doc.
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  "https://inmctohsodgdohamhzag.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const keys = [
  "rental-honda-cbr600rr-2003-1788597036381",
  "rental-aprilia-shiver-1789056053188",
];

for (const key of keys) {
  const { data, error } = await sb
    .schema("private").from("rental_contract_artifacts")
    .select("*")
    .eq("document_key", key)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) { console.error("ERR", error.message); process.exit(1); }
  const row = data?.[0];
  console.log("=== artifact", key, row ? `(${row.created_at})` : "NOT FOUND");
  if (!row) continue;
  const v = typeof row.variables === "string" ? JSON.parse(row.variables) : row.variables;
  for (const k of ["price_digits", "price_words", "total_price_rub", "subtotal_rub", "equipment_total_cost", "total_payable", "deposit_rub", "total_sum", "daily_price_rub", "hourly_price_rub", "rent_days", "equipment_price_list", "equipment_summary", "price_breakdown"]) {
    if (v && v[k] !== undefined) console.log("  ", k, "=", JSON.stringify(v[k]).slice(0, 400));
  }
}
