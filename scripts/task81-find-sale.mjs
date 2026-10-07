// Task 81: find y-volt-surge-v bike + the fake 69k sale + its money trail.
import { createClient } from "/home/z/cartest/node_modules/@supabase/supabase-js/dist/main/index.js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// Search bikes by make/model fragments
const { data: cars, error } = await sb.from("cars")
  .select("id, make, model, crew_id, type, daily_price, sale_price, status")
  .or("make.ilike.%volt%,model.ilike.%volt%,make.ilike.%surge%,model.ilike.%surge%,make.ilike.%y-volt%,model.ilike.%y-volt%");
if (error) { console.log("cars err:", error.message); }
for (const c of cars || []) console.log(`car id=${c.id} | ${c.make} | ${c.model} | crew=${c.crew_id} type=${c.type} daily=${c.daily_price} sale=${c.sale_price}`);

// Also check every crew's bike list for anything y-volt-ish via specs
const { data: allCars } = await sb.from("cars").select("id, make, model, crew_id, type").eq("type", "bike").order("make");
const sus = (allCars || []).filter((c) => /volt|surge|surje|сурдж|ёволт|йволт/i.test(`${c.make} ${c.model}`));
console.log("\nregex hits in bike list:");
for (const c of sus) console.log(`  id=${c.id} ${c.make} ${c.model} crew=${c.crew_id}`);

// Sales artifacts for the hits
for (const car of sus.length ? sus : (cars || [])) {
  const { data: sales } = await sb.schema("private").from("sale_contract_artifacts")
    .select("*")
    .eq("resolved_bike_id", car.id)
    .order("created_at", { ascending: false }).limit(10);
  console.log(`\nsale_contract_artifacts for ${car.make} ${car.model} (${car.id}): ${sales?.length || 0}`);
  for (const s of sales || []) {
    console.log(`  id=${s.id} price=${s.sale_price} at=${s.created_at} buyer=${JSON.stringify(s.buyer_full_name)} tg=${s.telegram_chat_id} status=${s.status}`);
    console.log(`    cols: ${Object.keys(s).join(",")}`);
  }
}

// Brute: any sale artifact with price 69000 (any bike)
const { data: s69 } = await sb.schema("private").from("sale_contract_artifacts")
  .select("id, sale_price, created_at, resolved_bike_id, buyer_full_name, telegram_chat_id, status")
  .eq("sale_price", 69000).order("created_at", { ascending: false }).limit(10);
console.log(`\nALL sales with price=69000: ${s69?.length || 0}`);
for (const s of s69 || []) {
  let bike = "?";
  if (s.resolved_bike_id) {
    const { data: b } = await sb.from("cars").select("make, model, crew_id").eq("id", s.resolved_bike_id).maybeSingle();
    bike = b ? `${b.make} ${b.model} (crew=${b.crew_id})` : s.resolved_bike_id;
  }
  console.log(`  id=${s.id} price=${s.sale_price} at=${s.created_at} bike=${bike} buyer=${JSON.stringify(s.buyer_full_name)} tg=${s.telegram_chat_id} status=${s.status}`);
}
