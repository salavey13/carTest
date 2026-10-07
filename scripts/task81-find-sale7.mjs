// Task 81: sanity-check LIKE + salary ledger / deposit sweep for 69k surge sale.
import { createClient } from "/home/z/cartest/node_modules/@supabase/supabase-js/dist/main/index.js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const log = console.log;

// 0. SANITY: LIKE on sale_price — expect the 420 000 artifacts to come back
const { data: san, error: sanErr } = await sb.schema("private").from("sale_contract_artifacts")
  .select("id, sale_price, resolved_bike_id").like("sale_price", "%420%").limit(5);
log(`SANITY like %420%: ${san?.length || 0} rows (err: ${sanErr?.message || "none"})`);
const { data: san2, error: san2Err } = await sb.schema("private").from("sale_contract_artifacts")
  .select("id, sale_price, resolved_bike_id, buyer_full_name, created_at").or("sale_price.ilike.*69*,total_sum.eq.69000").limit(10);
log(`SANITY or(sale_price ilike *69*, total_sum=69000): ${san2?.length || 0} (err: ${san2Err?.message || "none"})`);
for (const s of san2 || []) log(`  ${s.created_at?.slice(0, 16)} price=${JSON.stringify(s.sale_price)} bike=${s.resolved_bike_id} buyer=${JSON.stringify(s.buyer_full_name)}`);

// 1. salary ledger view — 69k rows for vip-bike
const { data: sl, error: slErr } = await sb.from("v_crew_member_salary_ledger").select("*").limit(1);
if (slErr) log("\nledger probe err:", slErr.message);
else {
  log("\nledger cols:", Object.keys(sl?.[0] || {}).join(","));
  const { data: sl69, error } = await sb.from("v_crew_member_salary_ledger").select("*")
    .or("amount.gte.68000,amount.lte.70000").limit(30);
  if (error) log("ledger 69 err:", error.message);
  else {
    const rows69 = (sl69 || []).filter((r) => Number(r.amount) >= 68000 && Number(r.amount) <= 70000);
    log(`ledger rows 68000..70000: ${rows69.length}`);
    for (const r of rows69.slice(0, 15)) log("  " + JSON.stringify(r).slice(0, 240));
  }
}

// 2. deposit_entries probe
const { data: d1, error: dErr } = await sb.from("deposit_entries").select("*").limit(1);
if (dErr) log("\ndeposit probe err:", dErr.message);
else {
  log("\ndeposit_entries cols:", Object.keys(d1?.[0] || {}).join(","));
}

// 3. user_purchases probe (69k)
const { data: up1, error: upErr } = await sb.from("user_purchases").select("*").limit(1);
if (upErr) log("user_purchases probe err:", upErr.message);
else log("user_purchases cols:", Object.keys(up1?.[0] || {}).join(","));

// 4. invoices 69000
const { data: inv, error: invErr } = await sb.from("invoices").select("*").eq("amount", 69000).limit(10);
if (invErr) log("invoices 69k err:", invErr.message);
else { log(`invoices 69000: ${inv.length}`); for (const i of inv) log("  " + JSON.stringify(i).slice(0, 200)); }
