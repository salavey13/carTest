// Task 84 — RESTORE script: rebuilds DATA + STORAGE from a cartest backup zip
// into a FRESH Supabase project. Run AFTER repo migrations created the schema:
//
//   node scripts/restore.mjs --url https://NEWPROJECT.supabase.co \
//        --key <NEW-SERVICE-ROLE-KEY> --dir /path/to/cartest-backup-XXXX
//
// What it does:
//   1. Creates storage buckets from schema/storage-buckets.json (idempotent).
//   2. Uploads every file from storage/<bucket>/… (x-upsert, resumable).
//   3. Inserts table rows from data/<table>.json via PostgREST
//      (public + private schemas; merge-duplicates on known PKs → re-runnable).
//
// Data order matters (FKs): parents listed in ORDER_FIRST go first; private
// artifact tables go last (leaf rows). If a table still fails on FK, restore
// that table's parent first via a targeted re-run: --only tablename.

import { readFileSync, existsSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";

const args = process.argv.slice(2);
const getArg = (name) => {
  const i = args.indexOf(name);
  return i > -1 ? args[i + 1] : null;
};
const URL_ = (getArg("--url") || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const KEY = getArg("--key") || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const DIR = getArg("--dir") || process.cwd();
const ONLY = getArg("--only");
if (!URL_ || !KEY) {
  console.error("Usage: node restore.mjs --url https://xxx.supabase.co --key SERVICE_KEY [--dir backupDir] [--only table]");
  process.exit(1);
}

const DATA_DIR = join(DIR, "data");
const STORAGE_DIR = join(DIR, "storage");
const SCHEMA_DIR = join(DIR, "schema");
if (!existsSync(DATA_DIR)) {
  console.error(`No data/ under ${DIR} — point --dir at the unzipped backup root.`);
  process.exit(1);
}

// parents first (FK targets), private artifacts last (leaves)
const ORDER_FIRST = [
  "users", "profiles", "crews", "cars", "crew_members", "crews_secrets",
  "service_types", "analytics_passwords", "storage_objects_meta",
];

const h = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

const tableFiles = readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"));
const entries = tableFiles.map((f) => {
  const name = f.replace(/\.json$/, "");
  const isPrivate = name.startsWith("private-");
  const schema = isPrivate ? "private" : "public";
  const table = isPrivate ? name.slice("private-".length) : name;
  const rows = JSON.parse(readFileSync(join(DATA_DIR, f), "utf8"));
  return { schema, table, rows, file: f };
});

entries.sort((a, b) => {
  const rank = (e) => {
    if (ORDER_FIRST.includes(e.table)) return 0;
    if (e.schema === "private") return 2;
    return 1;
  };
  return rank(a) - rank(b) || a.table.localeCompare(b.table);
});

async function insertTable(e) {
  if (ONLY && e.table !== ONLY && e.file !== ONLY) return null;
  if (!e.rows.length) return { skipped: true };
  const profile = e.schema === "public" ? {} : { "Accept-Profile": e.schema };
  // PKs from the backup manifest (fresh-project OpenAPI may differ)
  const manifestPath = join(DIR, "MANIFEST.json");
  let pk = [];
  if (existsSync(manifestPath)) {
    try {
      pk = (JSON.parse(readFileSync(manifestPath, "utf8")).tables || {})[
        e.schema === "public" ? e.table : `${e.schema}.${e.table}`
      ]?.primaryKeys || [];
    } catch {}
  }
  const conflictQ = pk.length
    ? `on_conflict=${pk.map(encodeURIComponent).join(",")}&`
    : "";
  let inserted = 0;
  const CHUNK = 400;
  for (let i = 0; i < e.rows.length; i += CHUNK) {
    const chunk = e.rows.slice(i, i + CHUNK);
    const res = await fetch(`${URL_}/rest/v1/${encodeURIComponent(e.table)}?${conflictQ}select=*`, {
      method: "POST",
      headers: {
        ...h,
        ...profile,
        Prefer: pk.length
          ? "resolution=merge-duplicates,return=representation"
          : "resolution=ignore-duplicates,return=representation",
      },
      body: JSON.stringify(chunk),
    });
    if (!res.ok) {
      const body = await res.text();
      return { error: `${res.status} ${body.slice(0, 200)} @ rows ${i}…${i + chunk.length}` };
    }
    inserted += chunk.length;
  }
  return { inserted };
}

console.log(`RESTORE data → ${URL_}`);
const problems = [];
for (const e of entries) {
  const r = await insertTable(e);
  if (r === null) continue;
  if (r.skipped) console.log(`  = ${e.schema}/${e.table}: 0 rows`);
  else if (r.error) {
    console.error(`  ✗ ${e.schema}/${e.table}: ${r.error}`);
    problems.push(e);
  } else console.log(`  ✓ ${e.schema}/${e.table}: ${r.inserted} rows`);
}

// ── storage: buckets then objects ───────────────────────────────────────────
const bucketsPath = join(SCHEMA_DIR, "storage-buckets.json");
if (existsSync(bucketsPath)) {
  const buckets = JSON.parse(readFileSync(bucketsPath, "utf8"));
  for (const b of buckets) {
    const res = await fetch(`${URL_}/storage/v1/bucket`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({
        id: b.name,
        name: b.name,
        public: b.public ?? false,
        file_size_limit: b.file_size_limit ?? null,
        allowed_mime_types: b.allowed_mime_types ?? null,
      }),
    });
    // 409 = already exists (fresh project default buckets) — fine
    console.log(`  bucket ${b.name}: ${res.ok ? "created" : res.status === 409 ? "exists" : res.status}`);
  }
}

if (existsSync(STORAGE_DIR)) {
  for (const bucket of readdirSync(STORAGE_DIR)) {
    const bdir = join(STORAGE_DIR, bucket);
    if (!statSync(bdir).isDirectory()) continue;
    let uploaded = 0;
    let failed = 0;
    const walk = async (dir) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(p);
          continue;
        }
        if (entry.name.endsWith(".missing")) continue; // confirmed-missing marker
        const key = relative(join(STORAGE_DIR, bucket), p).split(/\\|\//).map(encodeURIComponent).join("/");
        const bytes = readFileSync(p);
        const res = await fetch(`${URL_}/storage/v1/object/${bucket}/${key}?x-upsert=true`, {
          method: "POST",
          headers: {
            ...h,
            "x-upsert": "true",
            "Content-Type": "application/octet-stream",
            "Cache-Control": "3600",
          },
          body: bytes,
        });
        if (res.ok) uploaded += 1;
        else {
          failed += 1;
          if (failed <= 3) console.error(`    ✗ ${bucket}/${key}: ${res.status}`);
        }
      }
    };
    await walk(bdir);
    console.log(`  storage/${bucket}: uploaded ${uploaded}, failed ${failed}`);
  }
}

console.log(
  problems.length
    ? `\nDONE with ${problems.length} table problem(s). Re-run with --only <table> after its parent exists, or paste rows via SQL editor.`
    : "\nDONE — data and storage restored. Now set Vercel env vars + Telegram webhook (see RESTORE.md).",
);
