// Task 81: list tables + hunt 69000 across money surfaces.
import { createClient } from "/home/z/cartest/node_modules/@supabase/supabase-js/dist/main/index.js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

// 1. OpenAPI root → all exposed tables
const res = await fetch(`${URL}/rest/v1/`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
const spec = await res.json();
const paths = Object.keys(spec.paths || {}).map((p) => p.replace(/^\//, ""));
console.log(`exposed tables (${paths.length}):`);
console.log(paths.filter((p) => /sale|cash|transaction|deal|ledger|money|income/i.test(p)).join("\n"));
console.log("---all---");
console.log(paths.join("\n"));
