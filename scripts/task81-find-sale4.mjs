// Task 81: sweep owner_cash_entries + description searches for the 69k Surge sale.
import { createClient } from "/home/z/cartest/node_modules/@supabase/supabase-js/dist/main/index.js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// 0. owner_cash_entries columns
const { data: oc1, error: ocErr } = await sb.from("owner_cash_entries").select("*").limit(1);
if (ocErr) console.log("owner_cash_entries probe err:", ocErr.message);
else {
  console.log("owner_cash_entries cols:", Object.keys(oc1?.[0] || {}).join(", "));
  const { data: oc, error } = await sb.from("owner_cash_entries").select("*")
    .or("amount.eq.69000,amount.eq.690000").order("created_at", { ascending: false }).limit(10);
  if (error) console.log("oc amount err:", error.message);
  console.log(`owner_cash_entries 69000/690000: ${oc?.length || 0}`);
  for (const t of oc || []) console.log(JSON.stringify(t).slice(0, 400));
  const { data: ocs, error: ocsErr } = await sb.from("owner_cash_entries").select("*")
    .or("comment.ilike.%surge%,description.ilike.%surge%,note.ilike.%surge%,title.ilike.%surge%")
    .order("created_at", { ascending: false }).limit(10);
  if (ocsErr) console.log("oc surge err:", ocsErr.message);
  else {
    console.log(`owner_cash_entries surge: ${ocs?.length || 0}`);
    for (const t of ocs || []) console.log(JSON.stringify(t).slice(0, 400));
  }
}

// 1. cash_transactions description/comment sweep
const { data: ct1 } = await sb.from("cash_transactions").select("id, transaction_type, amount, description, metadata, created_at, sale_contract_id, rental_id")
  .eq("amount", 690000).order("created_at", { ascending: false }).limit(10);
console.log(`\ncash_transactions amount=690000: ${ct1?.length || 0}`);
for (const t of ct1 || []) console.log(JSON.stringify(t).slice(0, 400));

// 2. artifacts by contract_key surge
const { data: ck } = await sb.schema("private").from("sale_contract_artifacts")
  .select("id, contract_key, sale_price, total_sum, created_at, resolved_bike_id, buyer_full_name, crew_slug")
  .or("contract_key.ilike.%surge%,requested_bike_id.ilike.%surge%")
  .order("created_at", { ascending: false }).limit(20);
console.log(`\nartifacts contract_key/requested ~surge: ${ck?.length || 0}`);
for (const s of ck || []) console.log(`  ${s.created_at?.slice(0, 16)} key=${s.contract_key} price=${JSON.stringify(s.sale_price)} total=${s.total_sum} bike=${s.resolved_bike_id} buyer=${JSON.stringify(s.buyer_full_name)} id=${s.id.slice(0, 8)}`);

// 3. ANY artifact created in September 2026 (all bikes) — maybe "last selling" misattributed
const { data: sep } = await sb.schema("private").from("sale_contract_artifacts")
  .select("id, sale_price, total_sum, created_at, resolved_bike_id, buyer_full_name, crew_slug")
  .gte("created_at", "2026-09-01T00:00:00+00:00").order("created_at", { ascending: false }).limit(30);
console.log(`\nALL sale artifacts since 01.09: ${sep?.length || 0}`);
for (const s of sep || []) console.log(`  ${s.created_at?.slice(0, 16)} price=${JSON.stringify(s.sale_price)} total=${s.total_sum} bike=${s.resolved_bike_id} crew=${s.crew_slug} buyer=${JSON.stringify(s.buyer_full_name)} id=${s.id.slice(0, 8)}`);
