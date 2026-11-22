// Task 84 (2026-10-08) — FULL BACKUP of the Supabase project for
// inmctohsodgdohamhzag → staging dir with restore instructions, zipped by the caller.
//
// RESUMABLE by design: every finished artifact (data/<table>.json,
// storage/<bucket>/<obj>) is skipped on re-run — drive it with repeated
// foreground invocations:
//   node --env-file=.env.local scripts/task84-backup.mjs                 # tables+sql+storage
//   node --env-file=.env.local scripts/task84-backup.mjs --phase tables  # only missing tables
//   node --env-file=.env.local scripts/task84-backup.mjs --phase sql     # regenerate SQL
//   node --env-file=.env.local scripts/task84-backup.mjs --phase storage # only missing objects
//   node --env-file=.env.local scripts/task84-backup.mjs --phase manifest
//
// Captures (service-role key, REST only):
//   data/*.json + *.sql, data.sql, storage/<bucket>/…, schema/openapi.json,
//   schema/storage-buckets.json, MANIFEST.json
// NOT capturable (documented in RESTORE.md): auth.users, non-exposed schemas
// (private.* — recreated empty by repo migrations), edge/Vercel secrets.

import { createRequire } from "module";
import { mkdirSync, writeFileSync, existsSync, readFileSync, statSync, readdirSync } from "fs";
import { join, dirname, relative } from "path";
import { execSync } from "child_process";

const require = createRequire(import.meta.url);
const repoRoot = execSync("git rev-parse --show-toplevel", { cwd: import.meta.dirname }).toString().trim();

const args = process.argv.slice(2);
const phaseArg = args.includes("--phase") ? args[args.indexOf("--phase") + 1] : "all";
const bucketFilter = args.includes("--bucket") ? args[args.indexOf("--bucket") + 1] : null;
const doTables = phaseArg === "all" || phaseArg === "tables";
const doSql = phaseArg === "all" || phaseArg === "sql";
const doStorage = phaseArg === "all" || phaseArg === "storage";
const doDbkeys = phaseArg === "all" || phaseArg === "dbkeys";
const doManifest = phaseArg === "all" || phaseArg === "manifest";

const URL_ = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
if (!URL_ || !KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const OUT_BASE = "/home/z/my-project/backup-staging";
const stampFile = join(OUT_BASE, "STAMP");
let STAMP;
if (existsSync(stampFile)) STAMP = readFileSync(stampFile, "utf8").trim();
else {
  STAMP = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
  mkdirSync(OUT_BASE, { recursive: true });
  writeFileSync(stampFile, STAMP);
}
const OUT = join(OUT_BASE, `cartest-backup-${STAMP}`);
const DATA_DIR = join(OUT, "data");
const STORAGE_DIR = join(OUT, "storage");
const SCHEMA_DIR = join(OUT, "schema");
for (const d of [OUT, DATA_DIR, STORAGE_DIR, SCHEMA_DIR]) mkdirSync(d, { recursive: true });

const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` };

async function restFetch(path, init = {}) {
  return fetch(`${URL_}/rest/v1/${path}`, { ...init, headers: { ...headers, ...(init.headers || {}) } });
}

// ── spec (always ensure present) ────────────────────────────────────────────
const specPath = join(SCHEMA_DIR, "openapi.json");
let spec;
if (existsSync(specPath)) {
  spec = JSON.parse(readFileSync(specPath, "utf8"));
} else {
  const specRes = await restFetch("/");
  if (!specRes.ok) {
    console.error("OpenAPI fetch failed:", specRes.status);
    process.exit(1);
  }
  spec = await specRes.json();
  writeFileSync(specPath, JSON.stringify(spec, null, 2));
}
const definitions = spec.definitions || spec.components?.schemas || {};
const tables = Object.keys(definitions).filter((t) => !t.startsWith("views."));

// ── PRIVATE (and other non-default) SCHEMAS ────────────────────────────────
// The default OpenAPI at /rest/v1/ describes the PUBLIC schema only, but the
// service role can address OTHER exposed schemas via Accept-Profile. The
// crown-jewel tables (sale/rental_contract_artifacts, user_rental_secrets, …)
// live in `private` — a public-only backup would silently skip them.
const EXTRA_SCHEMAS = ["private"];
const schemaTables = []; // {schema, table, cols, pk}
for (const schema of EXTRA_SCHEMAS) {
  const specPathX = join(SCHEMA_DIR, `openapi-${schema}.json`);
  let specX;
  if (existsSync(specPathX)) specX = JSON.parse(readFileSync(specPathX, "utf8"));
  else {
    const r = await fetch(`${URL_}/rest/v1/`, { headers: { ...headers, "Accept-Profile": schema } });
    if (!r.ok) {
      writeFileSync(specPathX, JSON.stringify({ error: r.status }));
      console.log(`  – schema ${schema}: OpenAPI ${r.status} (not exposed)`);
      continue;
    }
    specX = await r.json();
    writeFileSync(specPathX, JSON.stringify(specX, null, 2));
  }
  const defsX = specX.definitions || specX.components?.schemas || {};
  for (const name of Object.keys(defsX)) {
    if (name.startsWith("views.")) continue;
    schemaTables.push({
      schema,
      table: name,
      cols: defsX[name].properties || {},
      pk: defsX[name].primaryKeys || [],
      file: `${schema}-${name}`,
    });
  }
  console.log(`  – schema ${schema}: ${schemaTables.filter((t) => t.schema === schema).length} tables`);
}

function tableDef(name) {
  const def = definitions[name] || {};
  const cols = def.properties || {};
  const pk = (def.primaryKeys || []).length
    ? def.primaryKeys
    : String(def.description || "").match(/Primary key: ([^;\s]+)/)?.[1]?.split(",") || [];
  return { cols, pk: pk.filter(Boolean) };
}

// ── tables phase ────────────────────────────────────────────────────────────
if (doTables) {
  const PAGE = 5000;
  const allTables = [
    ...tables.map((t) => ({ schema: "public", table: t, file: t, ...tableDef(t) })),
    ...schemaTables.map((t) => ({ ...t })),
  ];
  for (const t of allTables) {
    const outFile = join(DATA_DIR, `${t.file}.json`);
    if (existsSync(outFile)) continue;
    const profileHeader = t.schema === "public" ? {} : { "Accept-Profile": t.schema };
    const { cols, pk } = t;
    const selectCols = Object.keys(cols).join(",");
    const orderParam = pk.length ? `&order=${pk.map((c) => encodeURIComponent(c)).join(",")}` : "";
    const rows = [];
    let offset = 0;
    let failed = false;
    for (;;) {
      const res = await restFetch(
        `/${encodeURIComponent(t.table)}?select=${encodeURIComponent(selectCols)}&limit=${PAGE}&offset=${offset}${orderParam}`,
        { headers: { Accept: "application/json", ...profileHeader } },
      );
      if (!res.ok) {
        console.error(`  ✗ ${t.schema}/${t.table}: ${res.status} ${(await res.text()).slice(0, 160)}`);
        failed = true;
        break;
      }
      const chunk = await res.json();
      rows.push(...chunk);
      if (chunk.length < PAGE) break;
      offset += PAGE;
    }
    if (failed) continue; // resumable: re-run retries this table
    writeFileSync(outFile, JSON.stringify(rows));
    console.log(`  ✓ ${t.schema}/${t.table}: ${rows.length} rows`);
  }
}

// ── sql phase ───────────────────────────────────────────────────────────────
function sqlLiteral(value, format) {
  if (value === null || value === undefined) return "NULL";
  const f = (format || "").toLowerCase();
  if (f.includes("json")) return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
  if (typeof value === "number") {
    if (Number.isFinite(value)) return String(value);
    return value > 0 ? "'Infinity'" : "'-Infinity'";
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") return `'${value.replace(/'/g, "''")}'`;
  if (Array.isArray(value)) {
    // Postgres array literal (text[], uuid[]…); json[] is a rare corner —
    // fall back to jsonb cast for it.
    if (f.includes("json")) return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
    const inner = value.map((v) => `"${String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`).join(",");
    return `'${`{${inner}}`}'`;
  }
  if (typeof value === "object") return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
  return `'${String(value).replace(/'/g, "''")}'`;
}

if (doSql) {
  const sqlAll = [
    `-- cartest backup data.sql — generated (resumable build)`,
    `-- commit ${execSync("git rev-parse HEAD", { cwd: repoRoot }).toString().trim()}`,
    `-- Restore onto a FRESH project AFTER repo migrations created the schema.`,
    `-- ON CONFLICT DO NOTHING keeps re-runs idempotent.`,
    ``,
  ];
  for (const table of tables) {
    const jsonPath = join(DATA_DIR, `${table}.json`);
    if (!existsSync(jsonPath)) continue;
    const rows = JSON.parse(readFileSync(jsonPath, "utf8"));
    const { cols, pk } = tableDef(table);
    let body = `-- ${table}: ${rows.length} rows\n`;
    if (rows.length) {
      const colNames = Object.keys(cols).map((c) => `"${c}"`).join(", ");
      const conflict = pk.length ? ` ON CONFLICT (${pk.map((c) => `"${c}"`).join(",")}) DO NOTHING` : "";
      body += rows
        .map((row) => {
          const vals = Object.keys(cols).map((c) => sqlLiteral(row[c], cols[c].format)).join(", ");
          return `INSERT INTO public."${table}" (${colNames}) VALUES (${vals})${conflict};`;
        })
        .join("\n") + "\n";
    }
    writeFileSync(join(DATA_DIR, `${table}.sql`), body);
    sqlAll.push(body, "");
  }
  writeFileSync(join(OUT, "data.sql"), sqlAll.join("\n"));
  console.log("  ✓ sql phase done");
}

// ── storage phase ───────────────────────────────────────────────────────────
if (doStorage) {
  const sHeaders = { apikey: KEY, Authorization: `Bearer ${KEY}` };
  const bucketsPath = join(SCHEMA_DIR, "storage-buckets.json");
  let buckets;
  if (existsSync(bucketsPath)) buckets = JSON.parse(readFileSync(bucketsPath, "utf8"));
  else {
    const bucketsRes = await fetch(`${URL_}/storage/v1/bucket`, { headers: sHeaders });
    buckets = bucketsRes.ok ? await bucketsRes.json() : [];
    writeFileSync(bucketsPath, JSON.stringify(buckets, null, 2));
  }
  for (const bucket of buckets) {
    if (bucketFilter && bucket.name !== bucketFilter) continue;
    const bdir = join(STORAGE_DIR, bucket.name);
    mkdirSync(bdir, { recursive: true });
    const listPath = join(SCHEMA_DIR, `storage-objects-v2-${bucket.name}.json`);
    let objects;
    if (existsSync(listPath)) objects = JSON.parse(readFileSync(listPath, "utf8"));
    else {
      // RECURSIVE walk: the storage list endpoint delimits by "/" by default —
      // a flat prefix:"" call returns folder placeholders (id:null) for any
      // bucket with nesting (rental-photos, doc-verifier, …), so real objects
      // deeper down were invisible to the first backup attempt.
      objects = [];
      const queue = [""];
      while (queue.length) {
        const prefix = queue.shift();
        let offset = 0;
        for (;;) {
          const listRes = await fetch(`${URL_}/storage/v1/object/list/${bucket.name}`, {
            method: "POST",
            headers: { ...sHeaders, "Content-Type": "application/json" },
            body: JSON.stringify({ prefix, limit: 1000, offset }),
          });
          if (!listRes.ok) {
            console.error(`  ✗ storage/${bucket.name}: list ${listRes.status} @ "${prefix}"`);
            break;
          }
          const chunk = await listRes.json();
          for (const obj of chunk) {
            if (obj.id == null && obj.name) {
              // folder placeholder → descend (idempotent: placeholder name may
              // repeat with/without trailing slash)
              queue.push(obj.name.endsWith("/") ? obj.name : `${obj.name}/`);
            } else if (obj.id != null && obj.name && !obj.name.endsWith("/")) {
              objects.push(obj);
            }
          }
          if (chunk.length < 1000) break;
          offset += 1000;
        }
      }
      writeFileSync(listPath, JSON.stringify(objects));
    }
    let downloaded = 0;
    let bytes = 0;
    const orphaned = [];
    for (const obj of objects) {
      // Folder placeholders (id === null, e.g. "public/") return 400 on GET —
      // they carry no bytes, the real objects live under them.
      if (!obj.name || obj.name.endsWith("/") || obj.id == null) continue;
      const objPath = join(bdir, obj.name);
      if (existsSync(objPath)) {
        downloaded += 1;
        bytes += statSync(objPath).size;
        continue;
      }
      mkdirSync(dirname(objPath), { recursive: true });
      const dl = await fetch(`${URL_}/storage/v1/object/${bucket.name}/${obj.name.split("/").map(encodeURIComponent).join("/")}`, { headers: sHeaders });
      if (!dl.ok) {
        // NoSuchKey (HTTP 400 + 404 body) = ORPHANED metadata row: the object
        // is listed by /list but the bytes are gone from the storage backend
        // (verified across /object, /object/authenticated, /object/public).
        // Recorded so the manifest shows exactly what was unrecoverable.
        orphaned.push({ bucket: bucket.name, name: obj.name, status: dl.status });
        continue;
      }
      const buf = Buffer.from(await dl.arrayBuffer());
      writeFileSync(objPath, buf);
      bytes += buf.length;
      downloaded += 1;
    }
    console.log(`  ✓ storage/${bucket.name}: ${downloaded}/${objects.length} objects, ${(bytes / 1048576).toFixed(1)} MB${orphaned.length ? `, orphaned(unrecoverable): ${orphaned.length}` : ""}`);
    if (orphaned.length) {
      writeFileSync(join(SCHEMA_DIR, `storage-orphaned-${bucket.name}.json`), JSON.stringify(orphaned, null, 2));
    }
  }
}

// ── dbkeys phase: DB-referenced storage keys (authoritative) ────────────────
// The storage list endpoint returns STALE metadata rows whose bytes are gone,
// while the REAL current keys (rental-contracts/vip-bike/<file>.docx, …) are
// referenced by DB rows (private.*.storage_path, wallpost media, docx builder
// outputs) — and the list's `name` field strips the directory prefix, so a
// basename alone is not a key. This phase harvests storage-looking strings
// from every dumped table JSON and downloads whatever resolves, probing
// crew-slug prefixes for the rest. Failed probes are cached (schema/dbkeys-
// failed-<bucket>.json) so re-runs don't re-request confirmed-missing keys.
if (doDbkeys) {
  const sHeaders = { apikey: KEY, Authorization: `Bearer ${KEY}` };
  const strings = new Set();
  const walkVal = (v) => {
    if (typeof v === "string") {
      if (v.length > 3 && v.length < 500 && !v.includes(" ")) strings.add(v);
    } else if (Array.isArray(v)) v.forEach(walkVal);
    else if (v && typeof v === "object") Object.values(v).forEach(walkVal);
  };
  for (const f of readdirSync(DATA_DIR)) {
    if (!f.endsWith(".json")) continue;
    try {
      walkVal(JSON.parse(readFileSync(join(DATA_DIR, f), "utf8")));
    } catch {}
  }
  console.log(`  – dbkeys: ${strings.size} candidate strings harvested from dumps`);

  const bucketsPath = join(SCHEMA_DIR, "storage-buckets.json");
  const buckets = existsSync(bucketsPath) ? JSON.parse(readFileSync(bucketsPath, "utf8")) : [];

  // crew slugs for prefix probing (contract/testdrive docx live at <slug>/<file>)
  let crewSlugs = [];
  const crewsPath = join(DATA_DIR, "crews.json");
  if (existsSync(crewsPath)) {
    try {
      crewSlugs = (JSON.parse(readFileSync(crewsPath, "utf8")) || [])
        .map((c) => c.slug)
        .filter(Boolean);
    } catch {}
  }

  for (const bucket of buckets) {
    if (bucketFilter && bucket.name !== bucketFilter) continue;
    const bdir = join(STORAGE_DIR, bucket.name);
    mkdirSync(bdir, { recursive: true });
    const keys = new Set();
    // authoritative full keys from DB strings
    for (const s of strings) {
      const m = s.match(/\/storage\/v1\/object\/(?:public\/|authenticated\/)?([^/]+)\/(.+)$/);
      if (m && m[1] === bucket.name) keys.add(decodeURIComponent(m[2]));
      else if (s.startsWith(`${bucket.name}/`)) keys.add(s.slice(bucket.name.length + 1));
    }
    // rental_photos.storage_path values are BARE keys (<rentalId>/<type>/…jpg)
    // inside the rental-photos bucket — no bucket prefix in the DB.
    if (bucket.name === "rental-photos") {
      const rpPath = join(DATA_DIR, "rental_photos.json");
      if (existsSync(rpPath)) {
        try {
          for (const row of JSON.parse(readFileSync(rpPath, "utf8"))) {
            if (row?.storage_path) keys.add(row.storage_path);
          }
        } catch {}
      }
    }
    // listed basenames whose bytes 400'd (or not yet tried) → resolve via DB
    // suffix match, then crew-slug probing
    const listPath = join(SCHEMA_DIR, `storage-objects-v2-${bucket.name}.json`);
    let bases = [];
    if (existsSync(listPath)) {
      bases = JSON.parse(readFileSync(listPath, "utf8"))
        .filter((o) => o.id != null && o.name && !o.name.endsWith("/"))
        .map((o) => o.name);
    }
    const resolved = new Set();
    const unresolved = [];
    for (const base of bases) {
      if ([...keys].some((k) => k === base || k.endsWith(`/${base}`))) {
        resolved.add(base);
        continue;
      }
      const hit = [...strings].find((s) => s === base || s.endsWith(`/${base}`));
      if (hit) {
        keys.add(hit);
        resolved.add(base);
      } else unresolved.push(base);
    }
    const failedPath = join(SCHEMA_DIR, `dbkeys-failed-${bucket.name}.json`);
    const failed = new Set(existsSync(failedPath) ? JSON.parse(readFileSync(failedPath, "utf8")) : []);
    // crew slugs ordered by rental volume (vip-bike first — the active crew)
    const orderedSlugs = ["vip-bike", ...crewSlugs.filter((s) => s !== "vip-bike")];
    // eager probe: for each unresolved basename try slugs until bytes land
    let probed = 0;
    for (const base of unresolved) {
      if (resolved.has(base)) continue;
      for (const slug of orderedSlugs) {
        const candidate = `${slug}/${base}`;
        if (failed.has(candidate)) continue;
        const objPath = join(bdir, candidate);
        if (existsSync(objPath)) {
          resolved.add(base);
          break;
        }
        mkdirSync(dirname(objPath), { recursive: true });
        const dl = await fetch(
          `${URL_}/storage/v1/object/${bucket.name}/${candidate.split("/").map(encodeURIComponent).join("/")}`,
          { headers: sHeaders },
        );
        probed += 1;
        if (dl.ok) {
          writeFileSync(objPath, Buffer.from(await dl.arrayBuffer()));
          resolved.add(base);
          break;
        }
        failed.add(candidate);
      }
    }
    let ok = 0;
    let missing = 0;
    for (const key of [...keys].sort()) {
      const objPath = join(bdir, key);
      if (existsSync(objPath)) {
        ok += 1;
        continue;
      }
      if (failed.has(key)) {
        missing += 1;
        continue;
      }
      mkdirSync(dirname(objPath), { recursive: true });
      const dl = await fetch(
        `${URL_}/storage/v1/object/${bucket.name}/${key.split("/").map(encodeURIComponent).join("/")}`,
        { headers: sHeaders },
      );
      if (!dl.ok) {
        failed.add(key);
        missing += 1;
        continue;
      }
      writeFileSync(objPath, Buffer.from(await dl.arrayBuffer()));
      ok += 1;
    }
    writeFileSync(failedPath, JSON.stringify([...failed], null, 2));
    console.log(
      `  ✓ dbkeys/${bucket.name}: have ${ok}, confirmed-missing ${missing}, probed ${probed}, unresolved bases ${unresolved.filter((b) => !resolved.has(b)).length}`,
    );
  }
}

// ── manifest phase ──────────────────────────────────────────────────────────
if (doManifest) {
  const manifest = {
    generatedAt: new Date().toISOString(),
    repoCommit: execSync("git rev-parse HEAD", { cwd: repoRoot }).toString().trim(),
    supabaseUrl: URL_,
    tables: {},
    storage: {},
    notes: [
      "auth.users (passwords/MFA), edge function secrets and Vercel env vars",
      "are NOT included — see RESTORE.md for the full scope and restore steps.",
      "private-schema tables are dumped as data/private-<table>.json.",
      "Storage objects that the backend confirms missing (NoSuchKey on every",
      "path) are listed in schema/storage-orphaned-*.json.",
    ],
  };
  for (const f of readdirSync(DATA_DIR)) {
    if (!f.endsWith(".json")) continue;
    const rows = JSON.parse(readFileSync(join(DATA_DIR, f), "utf8"));
    const name = f.replace(/\.json$/, "");
    const schema = name.startsWith("private-") ? "private" : "public";
    const table = schema === "private" ? name.slice("private-".length) : name;
    const key = schema === "public" ? table : `${schema}.${table}`;
    manifest.tables[key] = {
      rows: rows.length,
      primaryKeys: (schemaTables.find((t) => t.schema === schema && t.table === table) || {}).pk || tableDef(table).pk,
    };
  }
  if (existsSync(STORAGE_DIR)) {
    for (const bucket of readdirSync(STORAGE_DIR)) {
      const bdir = join(STORAGE_DIR, bucket);
      let count = 0;
      let bytes = 0;
      const walk = (dir) => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          const p = join(dir, entry.name);
          if (entry.isDirectory()) walk(p);
          else {
            count += 1;
            bytes += statSync(p).size;
          }
        }
      };
      walk(bdir);
      manifest.storage[bucket] = { objects: count, bytes };
    }
  }
  writeFileSync(join(OUT, "MANIFEST.json"), JSON.stringify(manifest, null, 2));
  console.log(`  ✓ manifest: ${Object.keys(manifest.tables).length} tables, ${Object.values(manifest.tables).reduce((s, t) => s + t.rows, 0)} rows; storage buckets: ${Object.keys(manifest.storage).length}`);
}
console.log(`phase=${phaseArg} out=${relative("/home/z/my-project", OUT)}`);
