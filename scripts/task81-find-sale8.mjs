// Task 81: y-volt free-text variants + all October artifacts.
import { createClient } from "/home/z/cartest/node_modules/@supabase/supabase-js/dist/main/index.js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const log = console.log;

const { data: a, error } = await sb.schema("private").from("sale_contract_artifacts")
  .select("id, contract_key, requested_bike_id, resolved_bike_id, sale_price, total_sum, created_at, buyer_full_name, buyer_phone, telegram_chat_id, crew_slug")
  .or("requested_bike_id.ilike.*y-volt*,resolved_bike_id.ilike.*y-volt*,contract_key.ilike.*y-volt*,buyer_full_name.ilike.*молев*")
  .order("created_at", { ascending: false }).limit(30);
if (error) log("err:", error.message);
log(`y-volt-ish artifacts: ${a?.length || 0}`);
for (const s of a || []) log(`  ${s.created_at?.slice(0, 16)} req=${JSON.stringify(s.requested_bike_id)} res=${s.resolved_bike_id} price=${JSON.stringify(s.sale_price)} buyer=${JSON.stringify(s.buyer_full_name)} op=${s.created_by_operator_chat_id ?? "?"} id=${s.id.slice(0, 8)}`);

const { data: oct } = await sb.schema("private").from("sale_contract_artifacts")
  .select("id, requested_bike_id, resolved_bike_id, sale_price, created_at, buyer_full_name, crew_slug")
  .gte("created_at", "2026-10-01T00:00:00+00:00")
  .order("created_at", { ascending: false }).limit(30);
log(`\nALL artifacts created in October: ${oct?.length || 0}`);
for (const s of oct || []) log(`  ${s.created_at?.slice(0, 16)} req=${JSON.stringify(s.requested_bike_id)} res=${s.resolved_bike_id} price=${JSON.stringify(s.sale_price)} buyer=${JSON.stringify(s.buyer_full_name)} id=${s.id.slice(0, 8)}`);

// cash_transactions income_sale in October
const { data: coct } = await sb.from("cash_transactions").select("id, transaction_type, amount, description, created_at, sale_contract_id")
  .eq("transaction_type", "income_sale").gte("created_at", "2026-09-25T00:00:00+00:00")
  .order("created_at", { ascending: false }).limit(20);
log(`\nincome_sale since 25.09: ${coct?.length || 0}`);
for (const t of coct || []) log(`  ${t.created_at?.slice(0, 16)} amount=${t.amount} desc=${JSON.stringify(t.description)} sale=${t.sale_contract_id?.slice(0, 8) || "-"}`);
