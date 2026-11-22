// Task 81: subrent artifacts + operator 413553377 recent sales.
import { createClient } from "/home/z/cartest/node_modules/@supabase/supabase-js/dist/main/index.js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const log = console.log;

// 1. subrent_contract_artifacts for the bike / 69k
const { data: sub, error: subErr } = await sb.schema("private").from("subrent_contract_artifacts").select("*")
  .or("requested_bike_id.eq.y-volt-surge-v,resolved_bike_id.eq.y-volt-surge-v")
  .order("created_at", { ascending: false }).limit(10);
if (subErr) log("subrent err:", subErr.message);
else {
  log(`subrent artifacts for surge: ${sub?.length || 0}`);
  for (const s of sub || []) {
    const keys = Object.keys(s);
    log(`  ${s.created_at?.slice(0, 16)} id=${s.id?.slice(0, 8)}`);
    for (const k of ["contract_key", "subrent_price", "total_sum", "price", "rental_price"]) {
      if (s[k] != null) log(`    ${k}=${JSON.stringify(s[k])}`);
    }
    if (keys.length) log(`    cols: ${keys.join(",")}`);
  }
}

// 2. all artifact tables — any row with a price-ish column = 69000 (any bike)
for (const tbl of ["sale_contract_artifacts", "rental_contract_artifacts", "subrent_contract_artifacts"]) {
  const { data: probe, error } = await sb.schema("private").from(tbl).select("*").limit(1);
  if (error) { log(`\n${tbl}: ${error.message}`); continue; }
  const cols = Object.keys(probe?.[0] || {}).filter((c) => /price|sum|amount|cost/i.test(c));
  log(`\n${tbl} money cols: ${cols.join(",") || "none"}`);
  for (const col of cols) {
    const { data: hits, error: hErr } = await sb.schema("private").from(tbl).select("*").eq(col, 69000).limit(5);
    if (hErr) continue;
    if (hits?.length) { log(`  ${col}=69000: ${hits.length} rows`); for (const h of hits) log("    " + JSON.stringify(h).slice(0, 300)); }
  }
}

// 3. operator 413553377 — all sales created, latest 15 (any bike)
const { data: opSales } = await sb.schema("private").from("sale_contract_artifacts").select("id, sale_price, created_at, resolved_bike_id, buyer_full_name")
  .eq("telegram_chat_id", "413553377").order("created_at", { ascending: false }).limit(15);
log(`\nsales by tg 413553377 (latest 15): ${opSales?.length || 0}`);
for (const s of opSales || []) {
  const { data: b } = await sb.from("cars").select("make, model").eq("id", s.resolved_bike_id).maybeSingle();
  log(`  ${s.created_at?.slice(0, 16)} price=${JSON.stringify(s.sale_price)} bike=${b ? `${b.make} ${b.model}` : s.resolved_bike_id} buyer=${JSON.stringify(s.buyer_full_name)} id=${s.id.slice(0, 8)}`);
}
