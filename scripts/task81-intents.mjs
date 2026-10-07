// Task 81: full intent metadata for surge sale intents.
import { writeFileSync } from "node:fs";
import { createClient } from "/home/z/cartest/node_modules/@supabase/supabase-js/dist/main/index.js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data: ints, error } = await sb.from("franchize_intents").select("*")
  .eq("bike_id", "y-volt-surge-v").eq("intent_type", "sale")
  .order("created_at", { ascending: false }).limit(15);
const out = { error: error?.message || null, count: ints?.length || 0, intents: ints || [] };
writeFileSync("/home/z/cartest/scripts/task81-intents-out.json", JSON.stringify(out, null, 1));
console.log("written", out.count);
