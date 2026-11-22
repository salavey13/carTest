// Task 81: original_price_rub / discount check.
import { writeFileSync } from "node:fs";
import { createClient } from "/home/z/cartest/node_modules/@supabase/supabase-js/dist/main/index.js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: bike, error } = await sb.from("cars").select("specs").eq("id", "y-volt-surge-v").maybeSingle();
const s = bike?.specs || {};
const out = {
  error: error?.message || null,
  price_rub: s.price_rub,
  original_price_rub: s.original_price_rub,
  sale_price: s.sale_price,
  discount_percent: s.discount_percent,
  rent_price_label: s.rent_price_label,
  sold_count: s.sold_count,
  rent_weekday: s.rent_weekday,
  rent_weekend: s.rent_weekend,
  rent_weekday_hour: s.rent_weekday_hour,
  rent_weekend_hour: s.rent_weekend_hour,
  price_per_hour: s.price_per_hour,
  price_per_2h: s.price_per_2h,
  price_per_3h: s.price_per_3h,
  price_per_6h: s.price_per_6h,
  price_per_12h: s.price_per_12h,
};
writeFileSync("/home/z/cartest/scripts/task81-prices-out.json", JSON.stringify(out, null, 1));
console.log("written");
