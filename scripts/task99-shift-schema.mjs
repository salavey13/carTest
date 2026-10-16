// task99: inspect crew_member_shifts schema — which columns are GENERATED (SQL failed with 428C9 on duration_minutes)
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("no env"); process.exit(1); }
const sb = createClient(url, key);

const { data, error } = await sb
  .from("crew_member_shifts")
  .select("*")
  .limit(1);

if (error) { console.error("select err:", error.message); process.exit(1); }
console.log("sample row keys:", Object.keys(data?.[0] ?? {}));

// Use RPC-free schema introspection via pg_catalog through PostgREST is not possible;
// fallback: ask Supabase for columns via information_schema through a view? Not exposed.
// Instead: run raw query through supabase-js "rest" is limited -> use pg meta via service role? Not available.
// Simplest reliable path: check openapi spec
const res = await fetch(`${url}/rest/v1/`, {
  headers: { apikey: key, Authorization: `Bearer ${key}` },
});
const spec = await res.json();
const def = spec?.definitions?.["crew_member_shifts"];
if (def) {
  for (const [col, meta] of Object.entries(def.properties)) {
    console.log(
      col.padEnd(22),
      String(meta.format ?? meta.type).padEnd(10),
      meta.description?.includes("GENERATED") ? "GENERATED?" : "",
      meta.default !== undefined ? `default=${JSON.stringify(meta.default)}` : ""
    );
  }
  console.log("--- required:", def.required?.join(","));
} else {
  console.log("no openapi def; keys:", Object.keys(spec?.definitions ?? {}).filter(k => k.includes("shift")));
}
