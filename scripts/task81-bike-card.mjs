// Task 81: bike card specs + sale intents for y-volt-surge-v.
import { createClient } from "/home/z/cartest/node_modules/@supabase/supabase-js/dist/main/index.js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const log = console.log;

const { data: bike } = await sb.from("cars").select("*").eq("id", "y-volt-surge-v").maybeSingle();
log("y-volt-surge-v card:");
log("  make/model:", bike?.make, bike?.model);
log("  status:", bike?.status, "| crew:", bike?.crew_id, "| type:", bike?.type);
log("  daily_price:", bike?.daily_price);
log("  specs:", JSON.stringify(bike?.specs, null, 1)?.slice(0, 1500));

// sale intents
const { data: ints, error: iErr } = await sb.from("franchize_intents").select("*")
  .eq("bike_id", "y-volt-surge-v").order("created_at", { ascending: false }).limit(15);
if (iErr) log("intents err:", iErr.message);
else {
  log(`\nfranchize_intents for the bike: ${ints?.length || 0}`);
  for (const i of ints || []) log(`  ${i.created_at?.slice(0, 16)} type=${i.intent_type} stage=${i.stage} route=${i.source_route} tg=${i.telegram_user_id} meta=${JSON.stringify(i.metadata)?.slice(0, 150)} id=${i.id?.slice(0, 8)}`);
}

// any 69000 anywhere in specs of any car (jsonb text scan not possible via PostgREST contains?) —
// check sale_price in specs across vip-bike cars
const { data: cars } = await sb.from("cars").select("id, make, model, specs->>sale_price, specs->>rent_weekday, crew_id").eq("crew_id", "2d5fde70-1dd3-4f0d-8d72-66ccf6908746");
const withSale = (cars || []).filter((c) => c.sale_price != null);
log(`\nvip-bike cars with specs.sale_price: ${withSale.length}`);
for (const c of withSale) log(`  ${c.id} ${c.make} ${c.model} sale_price=${c.sale_price} rent_weekday=${c.rent_weekday}`);
