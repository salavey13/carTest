// task156 — inspect rental_verifications: where do dispute comments live?
// Boss: owner disputed + sent «комментарий: бла бла» via bot; comment shows in
// bot replies but NOT in rentals-analytics tableview «Заметки»/«Комментарий».
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const key = readFileSync("/home/z/cartest/.sb_key", "utf8").trim();
const url = "https://inmctohsodgdohamhzag.supabase.co";
const sb = createClient(url, key, { auth: { persistSession: false } });

const { data, error } = await sb
  .from("rental_verifications")
  .select("rental_id, status, operator_chat_id, owner_chat_id, negotiation, updated_at")
  .order("updated_at", { ascending: false })
  .limit(30);
if (error) { console.error("ERR", error.message); process.exit(1); }

for (const r of data || []) {
  const n = r.negotiation || {};
  const parts = [];
  if (n.draft) parts.push(`draft(by=${n.draft.by},role=${n.draft.role},comment=${JSON.stringify(n.draft.comment)})`);
  if (n.open) parts.push(`open(by=${n.open.by},role=${n.open.role},comment=${JSON.stringify(n.open.comment)})`);
  if (n.agreed) parts.push(`agreed(total=${n.agreed.split?.base + n.agreed.split?.equipment + n.agreed.split?.overprice})`);
  if (Array.isArray(n.rounds)) parts.push(`rounds=[${n.rounds.map((x) => `${x.action}/${x.role}:${JSON.stringify(x.comment ?? "")}`).join(" , ")}]`);
  console.log(`${r.updated_at} ${r.status.padEnd(18)} ${r.rental_id}`);
  if (parts.length) console.log("   ", parts.join("\n    "));
}
console.log("rows:", (data || []).length);
