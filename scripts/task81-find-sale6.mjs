// Task 81: leads/intents + full last-artifact inspection.
import { createClient } from "/home/z/cartest/node_modules/@supabase/supabase-js/dist/main/index.js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const log = console.log;

// leads columns
const { data: l1, error: l1Err } = await sb.from("leads").select("*").limit(1);
if (l1Err) log("leads probe err:", l1Err.message);
else {
  log("leads cols:", Object.keys(l1?.[0] || {}).join(","));
  // search surge / 69000
  const { data: ls, error } = await sb.from("leads").select("*")
    .or("metadata->>bike_id.eq.y-volt-surge-v,metadata->>car_id.eq.y-volt-surge-v,metadata->>resolved_bike_id.eq.y-volt-surge-v")
    .order("created_at", { ascending: false }).limit(10);
  if (error) log("leads surge err:", error.message);
  else {
    log(`leads mentioning surge in metadata: ${ls?.length || 0}`);
    for (const l of ls || []) log(`  ${l.created_at?.slice(0, 16)} ${JSON.stringify(l).slice(0, 300)}`);
  }
}

// full last artifact
const { data: last } = await sb.schema("private").from("sale_contract_artifacts").select("*")
  .eq("id", "57258f91-4d3e-4cdb-9bf4-c7786478d007").maybeSingle();
log("\nLAST y-volt-surge-v artifact (27.09 Молев):");
for (const [k, v] of Object.entries(last || {})) {
  const s = JSON.stringify(v);
  if (s && s !== "null" && s !== '""') log(`  ${k} = ${s.length > 140 ? s.slice(0, 140) + "…" : s}`);
}

// Any OTHER artifact tables? sale price_words containing "шестьдесят девять"
const { data: pw } = await sb.schema("private").from("sale_contract_artifacts").select("id, sale_price, price_words, created_at, resolved_bike_id, buyer_full_name")
  .or("price_words.ilike.*девять тысяч*,price_words.ilike.*69*")
  .order("created_at", { ascending: false }).limit(10);
log(`\nprice_words ~69k: ${pw?.length || 0}`);
for (const s of pw || []) log(`  ${s.created_at?.slice(0, 16)} price=${JSON.stringify(s.sale_price)} words=${JSON.stringify(s.price_words)?.slice(0, 100)} bike=${s.resolved_bike_id} buyer=${JSON.stringify(s.buyer_full_name)}`);

// franchize_intents probe
const { data: fi, error: fiErr } = await sb.from("franchize_intents").select("*").limit(1);
if (fiErr) log("\nfranchize_intents probe err:", fiErr.message);
else {
  log("\nfranchize_intents cols:", Object.keys(fi?.[0] || {}).join(","));
}
