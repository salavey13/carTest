// Task 81: list sale-* docx in storage; find surge contracts and their prices.
import { writeFileSync } from "node:fs";
import { createClient } from "/home/z/cartest/node_modules/@supabase/supabase-js/dist/main/index.js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const out = {};

// list root of rental-contracts bucket / vip-bike prefix
let all = [];
let offset = 0;
for (;;) {
  const { data, error } = await sb.storage.from("rental-contracts").list("vip-bike", { limit: 500, offset, sortBy: { column: "created_at", order: "desc" } });
  if (error) { out.listErr = error.message; break; }
  all = all.concat(data || []);
  if (!data || data.length < 500) break;
  offset += 500;
}
out.totalObjects = all.length;
out.saleDocs = all.filter((o) => /^sale-/i.test(o.name)).map((o) => `${o.name} ${o.created_at?.slice(0, 16)}`);
out.surgeDocs = out.saleDocs.filter((n) => /y-volt|surge/i.test(n));
writeFileSync("/home/z/cartest/scripts/task81-storage-out.json", JSON.stringify(out, null, 1));
console.log("total:", all.length, "| sale docs:", out.saleDocs.length);
