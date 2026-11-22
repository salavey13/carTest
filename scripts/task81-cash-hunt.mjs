// Task 81: cash_transactions hunt for the 69k y-volt sale.
import { createClient } from "/home/z/cartest/node_modules/@supabase/supabase-js/dist/main/index.js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// columns first
const { data: probe, error: pErr } = await sb.from("cash_transactions").select("*").limit(1);
if (pErr) { console.log("probe err:", pErr.message); process.exit(1); }
console.log("cols:", Object.keys(probe?.[0] || {}).join(", "));

// any 69000 amount
const { data: t69, error: e1 } = await sb.from("cash_transactions").select("*").eq("amount", 69000).order("created_at", { ascending: false }).limit(20);
if (e1) console.log("t69 err:", e1.message);
console.log(`\namount=69000: ${t69?.length || 0}`);
for (const t of t69 || []) console.log(JSON.stringify(t, null, 1).slice(0, 600));

// sale-type transactions for the bike
const { data: tsale, error: e2 } = await sb.from("cash_transactions").select("*").eq("car_id", "y-volt-surge-v").order("created_at", { ascending: false }).limit(30);
if (e2) {
  console.log("\ncar_id err:", e2.message, "— trying vehicle_id");
  const { data: tv, error: e3 } = await sb.from("cash_transactions").select("*").eq("vehicle_id", "y-volt-surge-v").order("created_at", { ascending: false }).limit(30);
  if (e3) console.log("vehicle_id err:", e3.message);
  else printRows(tv, "vehicle_id=y-volt-surge-v");
} else printRows(tsale, "car_id=y-volt-surge-v");

function printRows(rows, label) {
  console.log(`\n${label}: ${rows?.length || 0}`);
  for (const t of rows || []) console.log(`  ${t.created_at?.slice(0, 16)} type=${t.transaction_type} amount=${t.amount} comment=${JSON.stringify(t.comment)?.slice(0, 60)} rental=${t.rental_id?.slice(0, 8) || "-"} id=${t.id}`);
}
