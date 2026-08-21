// /home/z/my-project/scripts/cleanup-test-storage.js
// Find and delete the test rental's .docx file from Supabase Storage bucket.
// Pattern: rental-contracts/<crewSlug>/doc-*.docx or rental-*.docx created today.

const SUPABASE_URL = "https://inmctohsodgdohamhzag.supabase.co";
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlubWN0b2hzb2RnZG9oYW1oemFnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczODMzOTU4NSwiZXhwIjoyMDUzOTE1NTg1fQ.xD91Es2o8T1vM-2Ok8iKCn4jGDA5TwBbapD5eqhblLM";
const BUCKET = "rental-contracts";

const COMMIT = process.argv.includes("--commit");

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

async function deleteObject(path) {
  const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
  });
  return res.ok;
}

async function main() {
  console.log(`Mode: ${COMMIT ? "⚠️  COMMIT (will DELETE)" : "🔍 DRY RUN (no changes)"}`);
  console.log("");

  const all = await listAll("");
  console.log(`Bucket '${BUCKET}' has ${all.length} files total`);

  // Today's date in ISO (UTC)
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayStartIso = todayStart.toISOString();

  // Filter: files updated today (the test was today)
  const todaysFiles = all.filter((f) => {
    if (!f.updatedAt) return false;
    return new Date(f.updatedAt).getTime() >= new Date(todayStartIso).getTime();
  });
  console.log(`Files updated today: ${todaysFiles.length}`);
  console.log("");

  for (const f of todaysFiles) {
    console.log(`  ${f.path}  size=${f.size || "?"}  updatedAt=${f.updatedAt}`);
  }

  console.log("");

  // The test rental's docx file should be in vip-bike/ folder, named like
  // "doc-jilang-max-pro-<timestamp>.docx" or "rental-jilang-max-pro-<timestamp>.docx"
  // Let's look at all doc-*.docx and rental-*.docx files
  const candidateFiles = todaysFiles.filter((f) => {
    const name = f.path.split("/").pop() || "";
    return (name.startsWith("doc-") || name.startsWith("rental-")) && name.endsWith(".docx");
  });
  console.log(`Candidate test files (doc-*.docx or rental-*.docx updated today): ${candidateFiles.length}`);
  for (const f of candidateFiles) {
    console.log(`  ${f.path}  size=${f.size || "?"}`);
  }

  if (candidateFiles.length === 0) {
    console.log("");
    console.log("No candidate files found. The test rental's docx may have been uploaded with a different pattern.");
    console.log("Listing ALL files updated today for manual inspection:");
    for (const f of todaysFiles) {
      console.log(`  ${f.path}  size=${f.size || "?"}  updatedAt=${f.updatedAt}`);
    }
    return;
  }

  if (COMMIT) {
    console.log("");
    console.log("Deleting candidate files...");
    for (const f of candidateFiles) {
      const ok = await deleteObject(f.path);
      console.log(`  ${ok ? "✅ DELETED" : "❌ FAILED"} ${f.path}`);
    }
  } else {
    console.log("");
    console.log("DRY RUN — run with --commit to delete these files.");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
