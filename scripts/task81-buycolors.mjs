// Task 81: deep-dive bike specs — buy_options / buy_colors / any 69 anywhere.
import { createClient } from "/home/z/cartest/node_modules/@supabase/supabase-js/dist/main/index.js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const log = console.log;

const { data: bike } = await sb.from("cars").select("specs, description, metadata").eq("id", "y-volt-surge-v").maybeSingle();
log("buy_options:", JSON.stringify(bike?.specs?.buy_options, null, 1));
log("buy_colors:", JSON.stringify(bike?.specs?.buy_colors, null, 1));
log("spec_labels:", JSON.stringify(bike?.specs?.spec_labels, null, 1)?.slice(0, 400));
log("\ndescription:", (bike?.description || "").slice(0, 600));
log("\nmetadata keys:", Object.keys(bike?.metadata || {}).join(","));

// any string containing "69" in the whole specs json
const s = JSON.stringify(bike?.specs || {});
const matches = s.match(/"[^"]*69[^"]*"/g) || [];
log("\nspec strings containing 69:", matches.slice(0, 20));
