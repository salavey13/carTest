// Task 81: textual search for the 69k y-volt-surge-v sale + money trail.
import { createClient } from "/home/z/cartest/node_modules/@supabase/supabase-js/dist/main/index.js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const BIKE = "y-volt-surge-v";

const { data: sales, error } = await sb.schema("private").from("sale_contract_artifacts")
  .select("id, contract_key, sale_price, total_sum, price_words, created_at, buyer_full_name, buyer_phone, telegram_chat_id, created_by_operator_chat_id, crew_slug, storage_path")
  .eq("resolved_bike_id", BIKE)
  .or("sale_price.ilike.%69%,total_sum.ilike.69*")
  .order("created_at", { ascending: false }).limit(20);
if (error) console.log("err1:", error.message);
console.log(`y-volt-surge-v sales matching 69: ${sales?.length || 0}`);
for (const s of sales || []) {
  console.log(`  id=${s.id}\n    price=${JSON.stringify(s.sale_price)} total_sum=${JSON.stringify(s.total_sum)} at=${s.created_at}\n    buyer=${JSON.stringify(s.buyer_full_name)} phone=${JSON.stringify(s.buyer_phone)} tg=${s.telegram_chat_id} op=${s.created_by_operator_chat_id} crew=${s.crew_slug}\n    words=${JSON.stringify(s.price_words)?.slice(0, 80)} storage=${s.storage_path?.slice(0, 60)}`);
}

// ALL artifacts for this bike sorted desc — full picture of "last selling"
const { data: all } = await sb.schema("private").from("sale_contract_artifacts")
  .select("id, sale_price, total_sum, created_at, buyer_full_name, telegram_chat_id")
  .eq("resolved_bike_id", BIKE)
  .order("created_at", { ascending: false }).limit(15);
console.log(`\nlatest artifacts for the bike (desc):`);
for (const s of all || []) console.log(`  ${s.created_at?.slice(0, 16)} price=${JSON.stringify(s.sale_price)} buyer=${JSON.stringify(s.buyer_full_name)} tg=${s.telegram_chat_id} id=${s.id.slice(0, 8)}`);

// Money trail: cash_transactions income_sale for this bike/price
console.log("\n── cash_transactions income_sale 69000-ish ──");
const { data: tx, error: txErr } = await sb.schema("private").from("cash_transactions")
  .select("*")
  .or("amount.eq.69000,amount.ilike.69*,comment.ilike.%69 000%,comment.ilike.%69000%")
  .order("created_at", { ascending: false }).limit(20);
if (txErr) console.log("tx err:", txErr.message, "(check cols)");
for (const t of tx || []) console.log(`  id=${t.id} type=${t.transaction_type} amount=${t.amount} at=${t.created_at} car=${t.car_id || t.vehicle_id} comment=${JSON.stringify(t.comment)?.slice(0, 70)} rental=${t.rental_id || "-"}`);

// What tables exist with 'cash'/'transaction' in the name (verify names)
const { data: tables } = await sb.rpc("get_schema_tables", {}).catch(() => ({ data: null }));
console.log("tables rpc:", tables ? "ok" : "n/a");
