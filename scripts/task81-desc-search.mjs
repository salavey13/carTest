// Task 81: description text searches for 69 + notes in rentals metadata (dump to file).
import { writeFileSync } from "node:fs";
import { createClient } from "/home/z/cartest/node_modules/@supabase/supabase-js/dist/main/index.js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const out = {};

// cash_transactions description ~69
const { data: ct69, error: e1 } = await sb.from("cash_transactions").select("id, transaction_type, amount, description, created_at, sale_contract_id, rental_id")
  .or("description.ilike.*69*,description.ilike.*шестьдесят*").order("created_at", { ascending: false }).limit(30);
out.cash69 = e1 ? e1.message : (ct69 || []).map((t) => `${t.created_at?.slice(0, 16)} ${t.transaction_type} ${t.amount} ${JSON.stringify(t.description)} sale=${t.sale_contract_id?.slice(0, 8)} rental=${t.rental_id?.slice(0, 8)}`);

// owner_cash_entries title ~69
const { data: oc69, error: e2 } = await sb.from("owner_cash_entries").select("*")
  .or("title.ilike.*69*,title.ilike.*шестьдесят*").order("entry_date", { ascending: false }).limit(20);
out.owner69 = e2 ? e2.message : (oc69 || []).map((t) => `${t.entry_date} ${t.direction} ${t.amount} ${JSON.stringify(t.title)} ${JSON.stringify(t.person)}`);

// rentals with metadata notes mentioning surge (fetch recent vip-bike rentals, JS-filter)
const { data: rr, error: e3 } = await sb.from("rentals").select("rental_id, vehicle_id, requested_start_date, status, total_cost, metadata")
  .eq("crew_id", "2d5fde70-1dd3-4f0d-8d72-66ccf6908746")
  .gte("requested_start_date", "2026-08-15T00:00:00+00:00").order("requested_start_date", { ascending: false }).limit(300);
out.rentalsErr = e3?.message || null;
out.rentalNotesSurge = (rr || [])
  .filter((r) => /surge|surje|сурдж/i.test(JSON.stringify(r.metadata || {})))
  .map((r) => `${r.requested_start_date?.slice(0, 16)} vehicle=${r.vehicle_id} status=${r.status} cost=${r.total_cost} meta=${JSON.stringify(r.metadata).slice(0, 220)}`);

writeFileSync("/home/z/cartest/scripts/task81-desc-out.json", JSON.stringify(out, null, 1));
console.log("written");
