// Task 81: final wide sweep for the fake 69k Surge V sale.
import { createClient } from "/home/z/cartest/node_modules/@supabase/supabase-js/dist/main/index.js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const log = console.log;

// 1. owner_cash_entries — title/person sweep
const { data: oc, error: ocErr } = await sb.from("owner_cash_entries").select("*")
  .or("title.ilike.*surge*,title.ilike.*продаж*,person.ilike.*surge*")
  .order("entry_date", { ascending: false }).limit(20);
if (ocErr) log("oc err:", ocErr.message);
else {
  log(`owner_cash_entries surge/продажа: ${oc?.length || 0}`);
  for (const t of oc || []) log(`  ${t.entry_date} dir=${t.direction} kind=${t.kind} amount=${t.amount} title=${JSON.stringify(t.title)} person=${JSON.stringify(t.person)} src=${t.source} id=${t.id?.slice(0, 8)}`);
}
// 69000/690000 amounts there
const { data: oc69 } = await sb.from("owner_cash_entries").select("*").in("amount", [69000, 690000]).limit(10);
log(`owner_cash_entries amount 69k/690k: ${oc69?.length || 0}`);
for (const t of oc69 || []) log(`  ${t.entry_date} ${t.direction} ${t.amount} ${JSON.stringify(t.title)} id=${t.id?.slice(0, 8)}`);

// 2. cash_transactions by description surge (not linked to artifacts)
const { data: ct, error: ctErr } = await sb.from("cash_transactions").select("id, transaction_type, flow_direction, amount, description, metadata, created_at, sale_contract_id, rental_id, crew_id")
  .or("description.ilike.*surge*,description.ilike.*y-volt*,description.ilike.*сурдж*")
  .order("created_at", { ascending: false }).limit(30);
if (ctErr) log("ct err:", ctErr.message);
else {
  log(`\ncash_transactions desc~surge/y-volt: ${ct?.length || 0}`);
  for (const t of ct || []) log(`  ${t.created_at?.slice(0, 16)} type=${t.transaction_type} amount=${t.amount} desc=${JSON.stringify(t.description)} sale=${t.sale_contract_id?.slice(0, 8) || "-"} rental=${t.rental_id?.slice(0, 8) || "-"} meta=${JSON.stringify(t.metadata)?.slice(0, 120)}`);
}

// 3. cash_transactions 69 000-ish amounts (69000, 69000.0, 69001...) — exact + range
const { data: ct69, error: ct69Err } = await sb.from("cash_transactions").select("id, transaction_type, amount, description, created_at, sale_contract_id, rental_id")
  .gte("amount", 68000).lte("amount", 70000).order("created_at", { ascending: false }).limit(30);
if (ct69Err) log("ct69 err:", ct69Err.message);
else {
  log(`\ncash_transactions amount 68000..70000: ${ct69?.length || 0}`);
  for (const t of ct69 || []) log(`  ${t.created_at?.slice(0, 16)} type=${t.transaction_type} amount=${t.amount} desc=${JSON.stringify(t.description)?.slice(0, 80)} sale=${t.sale_contract_id?.slice(0, 8) || "-"} rental=${t.rental_id?.slice(0, 8) || "-"}`);
}

// 4. Any 69k in the bike's own rental/contract artifacts? rental_contract_artifacts for surge
const { data: rc, error: rcErr } = await sb.schema("private").from("rental_contract_artifacts").select("*").or("requested_bike_id.eq.y-volt-surge-v,resolved_bike_id.eq.y-volt-surge-v").order("created_at", { ascending: false }).limit(5);
if (rcErr) log("\nrental artifacts err:", rcErr.message);
else {
  log(`\nrental_contract_artifacts surge: ${rc?.length || 0}`);
  for (const s of rc || []) log(`  ${s.created_at?.slice(0, 16)} key=${s.contract_key} price=${JSON.stringify(s.rental_price ?? s.total_sum ?? s.price)} id=${s.id?.slice(0, 8)}`);
}

// 5. invoices / processed_orders mentioning 69000 or surge
for (const [tbl, cols] of [["invoices", "*"], ["processed_orders", "*"], ["orders", "*"]]) {
  const { data, error } = await sb.from(tbl).select(cols).limit(1);
  if (error) { log(`\n${tbl}: probe err ${error.message}`); continue; }
  const colsList = Object.keys(data?.[0] || {});
  log(`\n${tbl} cols: ${colsList.slice(0, 20).join(",")}`);
}
