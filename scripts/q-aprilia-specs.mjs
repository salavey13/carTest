// Reproduce the client-side calculatePrice for the aprilia-shiver order
// (order-mtvplvi6-8bqpvm, 2026-09-10 17:00 → 2026-09-11 07:00, 1 helmet).
import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  "https://inmctohsodgdohamhzag.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const { data: car, error } = await sb
  .from("cars")
  .select("id, make, model, specs")
  .eq("id", "aprilia-shiver")
  .maybeSingle();
if (error) { console.error("ERR", error.message); process.exit(1); }

const specs = car?.specs ?? {};
console.log("=== aprilia-shiver specs (pricing fields):");
for (const k of ["price_per_hour","price_per_2h","price_per_3h","price_per_6h","price_per_12h","dailyPrice","rent_weekday","rent_weekend","rent_2_4d","rent_5_10d","rent_11_30d","deposit_rub","type"]) {
  console.log(`  ${k}:`, JSON.stringify(specs[k]), typeof specs[k]);
}

// Run the REAL calculator from the repo
const { calculatePrice } = await import("../lib/rental-pricing-calculator.ts").catch(() => ({}));
if (!calculatePrice) {
  console.log("(cannot import TS directly — will inline-replicate)");
} else {
  const result = calculatePrice(specs, "2026-09-10", "2026-09-11", "17:00", "07:00", 1, {});
  console.log("=== calculatePrice(2026-09-10 17:00 → 2026-09-11 07:00, 1 helmet):");
  console.log(JSON.stringify(result, null, 2));
}
