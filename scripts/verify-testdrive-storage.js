// /home/z/my-project/scripts/verify-testdrive-storage.js
// Verifies that testdrive-*.docx files are actually present in Supabase Storage bucket "rental-contracts".
// PostgREST only exposes public schema, so we list the bucket directly.

const SUPABASE_URL = "https://inmctohsodgdohamhzag.supabase.co";
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlubWN0b2hzb2RnZG9oYW1oemFnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczODMzOTU4NSwiZXhwIjoyMDUzOTE1NTg1fQ.xD91Es2o8T1vM-2Ok8iKCn4jGDA5TwBbapD5eqhblLM";
const BUCKET = "rental-contracts";

async function listAll(prefix) {
  const out = [];
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${BUCKET}`, {
    method: "POST",
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prefix, limit: 1000, offset: 0 }),
  });
  if (!r.ok) {
    console.error(`list prefix='${prefix}' failed:`, r.status, await r.text());
    return out;
  }
  const data = await r.json();
  for (const e of data) {
    if (e.id) {
      out.push({ path: `${prefix}${e.name}`, size: e.metadata?.size || null, updatedAt: e.updated_at });
    } else {
      out.push(...await listAll(`${prefix}${e.name}/`));
    }
  }
  return out;
}

async function headObject(path) {
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: "HEAD",
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
  });
  return { ok: r.ok, status: r.status, len: r.headers.get("content-length") || null, type: r.headers.get("content-type") || null };
}

async function main() {
  // 1) List top-level entries
  const all = await listAll("");
  console.log(`Bucket '${BUCKET}' contains ${all.length} files total`);

  // 2) Filter testdrive files
  const tdFiles = all.filter((f) => f.path.includes("/testdrive-") || f.path.startsWith("testdrive-"));
  console.log(`Testdrive-*.docx files: ${tdFiles.length}`);
  console.log("");

  // 3) Show sample
  for (const f of tdFiles.slice(0, 20)) {
    const h = await headObject(f.path);
    console.log(`[${h.ok ? "OK" : "MISS"}] ${f.path}  size=${f.size || h.len}  (${f.updatedAt || ""})`);
  }

  if (tdFiles.length === 0) {
    console.log("");
    console.log("⚠️  No testdrive-*.docx files found in storage bucket. Sample of all files:");
    for (const f of all.slice(0, 15)) console.log(`  ${f.path}  size=${f.size}`);
  }

  // 4) Aggregate stats
  console.log("");
  console.log("=== Aggregated stats ===");
  console.log(`Total files in bucket: ${all.length}`);
  console.log(`Testdrive files: ${tdFiles.length}`);
  console.log(`Non-testdrive files: ${all.length - tdFiles.length}`);
  const byCrew = {};
  for (const f of all) {
    const crew = f.path.split("/")[0] || "(root)";
    byCrew[crew] = (byCrew[crew] || 0) + 1;
  }
  console.log("By crew/folder:");
  for (const [c, n] of Object.entries(byCrew).sort((a,b) => b[1] - a[1])) console.log(`  ${c}: ${n}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
