// Task 81: search posts/walls for a fake surge sale post.
import { writeFileSync } from "node:fs";
import { createClient } from "/home/z/cartest/node_modules/@supabase/supabase-js/dist/main/index.js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const out = {};

// find post-like tables
const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, { headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` } });
const spec = await res.json();
const tables = Object.keys(spec.paths || {}).map((p) => p.replace(/^\//, "")).filter((p) => /post|wall|feed|listing|market|announce/i.test(p));
out.postTables = tables;

for (const tbl of tables) {
  const { data: probe, error } = await sb.from(tbl).select("*").limit(1);
  if (error) { out[tbl] = "err: " + error.message; continue; }
  out[tbl + "_cols"] = Object.keys(probe?.[0] || {});
}
writeFileSync("/home/z/cartest/scripts/task81-posts-out.json", JSON.stringify(out, null, 1));
console.log("written");
