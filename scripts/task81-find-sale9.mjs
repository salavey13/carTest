// Task 81: last-resort surfaces.
import { createClient } from "/home/z/cartest/node_modules/@supabase/supabase-js/dist/main/index.js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const log = console.log;

// 1. ANY car with volt/y-volt in make or model (any type, any crew)
const { data: volt, error: vErr } = await sb.from("cars").select("id, make, model, type, crew_id, daily_price").or("make.ilike.*volt*,model.ilike.*volt*");
if (vErr) log("volt err:", vErr.message);
else {
  log(`volt-ish cars: ${volt?.length || 0}`);
  for (const c of volt || []) log(`  id=${c.id} ${c.make} ${c.model} type=${c.type} crew=${c.crew_id}`);
}

// 2. daily_cash_flow view — 69k rows
const { data: dcf, error: dErr } = await sb.from("daily_cash_flow").select("*").limit(1);
if (dErr) log("dcf probe err:", dErr.message);
else {
  log("dcf cols:", Object.keys(dcf?.[0] || {}).join(","));
  const { data: d69, error } = await sb.from("daily_cash_flow").select("*").or("amount.gte.68000,amount.lte.70000").limit(100).catch?.(() => ({ data: [] })) ?? { data: [] };
  if (error) log("dcf 69 err:", error.message);
  else {
    const rows = (d69 || []).filter((r) => Number(r.amount) >= 68000 && Number(r.amount) <= 70000);
    log(`dcf 68000..70000: ${rows.length}`);
    for (const r of rows.slice(0, 10)) log("  " + JSON.stringify(r).slice(0, 220));
  }
}

// 3. invoices mentioning surge in metadata
const { data: invS, error: invSErr } = await sb.from("invoices").select("*").or("metadata->>bike_id.eq.y-volt-surge-v,metadata->>car_id.eq.y-volt-surge-v").limit(10);
if (invSErr) log("invoices surge err:", invSErr.message);
else log(`invoices for surge: ${invS?.length || 0}`);

// 4. user_purchases 69000
const { data: up, error: upErr } = await sb.from("user_purchases").select("*").eq("total_price", 69000).limit(10);
if (upErr) log("user_purchases err:", upErr.message);
else { log(`user_purchases 69000: ${up.length}`); for (const u of up) log("  " + JSON.stringify(u).slice(0, 250)); }

// 5. rental_verification_docs / processed_services mentioning 69000?
const { data: ps, error: psErr } = await sb.from("processed_services").select("*").limit(1);
if (psErr) log("processed_services probe err:", psErr.message);
else log("processed_services cols:", Object.keys(ps?.[0] || {}).join(","));
