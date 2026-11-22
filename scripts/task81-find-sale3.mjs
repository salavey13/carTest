// Task 81: widen the 69k hunt — total_sum, requested_bike_id, 690000.
import { createClient } from "/home/z/cartest/node_modules/@supabase/supabase-js/dist/main/index.js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const BIKE = "y-volt-surge-v";

// 1. All artifacts for the bike WITH total_sum + requested_bike_id
const { data: arts } = await sb.schema("private").from("sale_contract_artifacts")
  .select("id, contract_key, requested_bike_id, resolved_bike_id, sale_price, total_sum, created_at, buyer_full_name, telegram_chat_id, crew_slug, delivery_method")
  .or(`resolved_bike_id.eq.${BIKE},requested_bike_id.eq.${BIKE}`)
  .order("created_at", { ascending: false }).limit(20);
console.log(`artifacts touching ${BIKE}: ${arts?.length || 0}`);
for (const s of arts || []) {
  console.log(`  ${s.created_at?.slice(0, 16)} sale_price=${JSON.stringify(s.sale_price)} total_sum=${JSON.stringify(s.total_sum)} req=${s.requested_bike_id} res=${s.resolved_bike_id} buyer=${JSON.stringify(s.buyer_full_name)} crew=${s.crew_slug} id=${s.id.slice(0, 8)}`);
}

// 2. Any artifact anywhere with total_sum 69000 / 690000 or sale_price text 69*
const { data: c1, error: e1 } = await sb.schema("private").from("sale_contract_artifacts")
  .select("id, sale_price, total_sum, created_at, resolved_bike_id, buyer_full_name")
  .in("total_sum", [69000, 690000]).order("created_at", { ascending: false }).limit(10);
if (e1) console.log("c1 err:", e1.message);
console.log(`\ntotal_sum in (69000,690000): ${c1?.length || 0}`);
for (const s of c1 || []) console.log(`  ${s.created_at?.slice(0, 16)} price=${JSON.stringify(s.sale_price)} total=${s.total_sum} bike=${s.resolved_bike_id} buyer=${JSON.stringify(s.buyer_full_name)} id=${s.id.slice(0, 8)}`);

const { data: c2, error: e2 } = await sb.schema("private").from("sale_contract_artifacts")
  .select("id, sale_price, total_sum, created_at, resolved_bike_id, buyer_full_name")
  .like("sale_price", "%69%").order("created_at", { ascending: false }).limit(20);
if (e2) console.log("c2 err:", e2.message);
console.log(`\nsale_price LIKE %69% (all bikes): ${c2?.length || 0}`);
for (const s of c2 || []) {
  let bike = s.resolved_bike_id;
  console.log(`  ${s.created_at?.slice(0, 16)} price=${JSON.stringify(s.sale_price)} total=${s.total_sum} bike=${bike} buyer=${JSON.stringify(s.buyer_full_name)} id=${s.id.slice(0, 8)}`);
}

// 3. cash_transactions linked to this bike's artifacts
const ids = (arts || []).map((s) => s.id);
if (ids.length) {
  const { data: tx } = await sb.from("cash_transactions")
    .select("id, transaction_type, flow_direction, amount, payment_method, description, transaction_date, created_at, rental_id, sale_contract_id, metadata")
    .in("sale_contract_id", ids).order("created_at", { ascending: false }).limit(30);
  console.log(`\ncash_transactions for those artifacts: ${tx?.length || 0}`);
  for (const t of tx || []) console.log(`  ${t.created_at?.slice(0, 16)} type=${t.transaction_type} dir=${t.flow_direction} amount=${t.amount} sale=${t.sale_contract_id?.slice(0, 8)} desc=${JSON.stringify(t.description)?.slice(0, 60)}`);
}

// 4. rentals mentioning sale of this bike? (rental->sale conversions)
const { data: r61 } = await sb.from("rentals").select("rental_id, status, total_cost, metadata, requested_start_date").eq("vehicle_id", BIKE).order("requested_start_date", { ascending: false }).limit(5);
console.log(`\nrecent rentals of the bike: ${r61?.length || 0}`);
for (const r of r61 || []) console.log(`  ${r.requested_start_date?.slice(0, 16)} status=${r.status} cost=${r.total_cost} src=${r.metadata?.source}`);

// 5. leads / intents sale for the bike?
const { data: li, error: liErr } = await sb.from("leads").select("id, type, status, price, created_at, metadata").or(`car_id.eq.${BIKE},bike_id.eq.${BIKE}`).order("created_at", { ascending: false }).limit(10);
if (liErr) {
  console.log("\nleads err:", liErr.message);
} else {
  console.log(`\nleads for bike: ${li?.length || 0}`);
  for (const l of li || []) console.log(`  ${l.created_at?.slice(0, 16)} type=${l.type} status=${l.status} price=${l.price} id=${l.id?.slice(0, 8)}`);
}
