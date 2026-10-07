// Task 81: inspect the 70k Panigale gold sale (the only ~69-70k sale anywhere).
import { writeFileSync } from "node:fs";
import { createClient } from "/home/z/cartest/node_modules/@supabase/supabase-js/dist/main/index.js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: art, error } = await sb.schema("private").from("sale_contract_artifacts").select("*")
  .eq("id", "675f4bf3-0000-0000-0000-000000000000").maybeSingle();

// fetch by prefix instead (id partially known)
const { data: list, error: lErr } = await sb.schema("private").from("sale_contract_artifacts").select("*")
  .eq("resolved_bike_id", "ducati-panigale-s-electro-gold")
  .order("created_at", { ascending: false }).limit(10);
const out = { lErr: lErr?.message || null, artifacts: list || [] };
writeFileSync("/home/z/cartest/scripts/task81-panigale-out.json", JSON.stringify(out, null, 1));
console.log("written");
