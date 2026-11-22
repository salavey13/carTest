// Task 81: dump bike specs to a JSON file for reliable Read-tool inspection.
import { writeFileSync } from "node:fs";
import { createClient } from "/home/z/cartest/node_modules/@supabase/supabase-js/dist/main/index.js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data: bike, error } = await sb.from("cars").select("specs, description").eq("id", "y-volt-surge-v").maybeSingle();
const out = {
  error: error?.message || null,
  specsKeys: Object.keys(bike?.specs || {}),
  buy_options: bike?.specs?.buy_options ?? "(absent)",
  buy_colors: bike?.specs?.buy_colors ?? "(absent)",
  spec_labels: bike?.specs?.spec_labels ?? "(absent)",
  sale_price: bike?.specs?.sale_price ?? "(absent)",
  sale: bike?.specs?.sale ?? "(absent)",
  price_rub: bike?.specs?.price_rub ?? "(absent)",
  sold_count: bike?.specs?.sold_count ?? "(absent)",
  description: bike?.description ?? null,
  metadata: bike?.metadata ?? null,
  stringsWith69: (JSON.stringify(bike?.specs || {}).match(/"[^"]*69[^"]*"/g) || []).slice(0, 25),
};
writeFileSync("/home/z/cartest/scripts/task81-specs-out.json", JSON.stringify(out, null, 1));
console.log("written");
