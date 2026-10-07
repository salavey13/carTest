// Task 81: salary ledger rows related to the surge sale.
import { createClient } from "/home/z/cartest/node_modules/@supabase/supabase-js/dist/main/index.js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const log = console.log;
const CREW = "2d5fde70-1dd3-4f0d-8d72-66ccf6908746";

const { data: rows, error } = await sb.from("v_crew_member_salary_ledger").select("*")
  .eq("crew_id", CREW).order("paid_at", { ascending: false }).limit(200);
if (error) { log("err:", error.message); process.exit(1); }
log(`ledger rows (latest 200): ${rows.length}`);
const saleRows = rows.filter((r) => /продаж|surge|y-volt|продажа/i.test(JSON.stringify(r)));
log(`rows mentioning продажа/surge: ${saleRows.length}`);
for (const r of saleRows.slice(0, 25)) log(`  ${r.paid_at?.slice(0, 16)} member=${r.member_id} amount=${r.amount} src=${r.source} ref=${r.ref_id?.slice(0, 12)} desc=${JSON.stringify(r.description)?.slice(0, 90)}`);

// 69000 anywhere in ledger
const six9 = rows.filter((r) => Number(r.amount) === 69000 || /69 ?000|69k/i.test(JSON.stringify(r.description || "")));
log(`\nledger rows with 69k amount/text: ${six9.length}`);
for (const r of six9.slice(0, 10)) log("  " + JSON.stringify(r).slice(0, 260));
