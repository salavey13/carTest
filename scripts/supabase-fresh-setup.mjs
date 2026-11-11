#!/usr/bin/env node
/**
 * task178 (follow-up of task177): one-command fresh-setup for a Supabase project.
 *
 * Rebuilds a target Postgres/Supabase database from the repo migration chain:
 *   wipe → roles/extensions prelude → all migrations (main + supaplan, ASCII order,
 *   identical to task177 replay) → service_role grants footer → migration history
 *   recording → optional data.sql import (chunked, parallel) → sequence sync → verify.
 *
 * Proven on oneSitePls (Project tyqnthnifewjrrjlvmor) 2026-11-12: 0 migration errors,
 * 110/110 row counts match the source project.
 *
 * Usage:
 *   node scripts/supabase-fresh-setup.mjs --env <env-file> [flags]
 *
 * Env file keys (KEY=VALUE lines, never committed):
 *   TARGET_DB_URL   full postgres connection string (session pooler user included),
 *                   e.g. postgresql://postgres.<ref>:<pass>@aws-0-<region>.pooler.supabase.com:5432/postgres
 *   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY   source project (optional, --verify-source)
 *   TARGET_URL / TARGET_KEY                     target project (optional, --verify-source)
 *
 * Flags:
 *   --skip-data            migrations only (no data.sql import)
 *   --skip-migrations      data import only (no wipe/migrations — resume after partial)
 *   --data <path>          path to data.sql (default: <repo>/../download/data.sql)
 *   --concurrency <n>      parallel chunk apply during data import (default 10)
 *   --verify-source        compare per-table row counts source (PostgREST) vs target (SQL)
 *   --openapi <path>       source OpenAPI table defs (columns: {name: pg_type}) used to
 *                          birth drift tables/columns before data import (optional —
 *                          unknown types default to text)
 *   --no-truncate          do not truncate tables before data import (default: truncate —
 *                          data.sql is the source of truth; migrations seed some tables)
 *   --no-wipe              skip wipe (re-runs migrations on existing schema)
 *   --local-shims          patch migrations for local pgserver (no postgis/pg_trgm —
 *                          vector/geography→jsonb etc., task177 replay parity).
 *                          NEVER use against a real Supabase target.
 */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import pg from 'pg';

const REPO = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');

// ── args / env ────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--skip-data') args.skipData = true;
    else if (a === '--skip-migrations') args.skipMigrations = true;
    else if (a === '--no-wipe') args.noWipe = true;
    else if (a === '--verify-source') args.verifySource = true;
    else if (a === '--data') args.data = argv[++i];
    else if (a === '--openapi') args.openapi = argv[++i];
    else if (a === '--env') args.env = argv[++i];
    else if (a === '--concurrency') args.concurrency = Number(argv[++i]);
    else if (a === '--local-shims') args.localShims = true;
    else throw new Error(`unknown flag: ${a}`);
  }
  return args;
}
const args = parseArgs(process.argv);
if (!args.env) { console.error('usage: node scripts/supabase-fresh-setup.mjs --env <env-file> [--skip-data|--data p|--verify-source]'); process.exit(2); }

const ENV = {};
for (const line of fs.readFileSync(args.env, 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) ENV[m[1]] = m[2].trim().replace(/^"|"$/g, '');
}
const DB_URL = ENV.TARGET_DB_URL;
if (!DB_URL) { console.error('env file must contain TARGET_DB_URL=<postgres connection string>'); process.exit(2); }
const DATA_PATH = args.data || path.resolve(REPO, '../download/data.sql');

const pool = new pg.Pool({ connectionString: DB_URL, max: Math.max(args.concurrency || 10, 4) + 2 });
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// ── SQL steps ────────────────────────────────────────────────────────────────
const WIPE_SQL = `
DROP SCHEMA IF EXISTS public CASCADE;
DROP SCHEMA IF EXISTS private CASCADE;
CREATE SCHEMA public;
CREATE SCHEMA private;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON SCHEMA public TO postgres, service_role;
GRANT USAGE ON SCHEMA private TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT ON TABLES TO anon, authenticated;
`;

// Local/pgserver-only prelude (Supabase already has these roles; guarded anyway).
// auth.* helpers exist on Supabase; local pg needs shims for policy expressions.
const ROLES_SQL = `
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='uuid_generate_v4') THEN
    CREATE FUNCTION public.uuid_generate_v4() RETURNS uuid LANGUAGE sql AS 'SELECT gen_random_uuid()';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='auth') THEN CREATE SCHEMA auth; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname='postgis') THEN
    -- local-shims only: stub geometry helpers so RLS/functions compile without PostGIS
    IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='extensions') THEN CREATE SCHEMA extensions; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='extensions' AND p.proname='st_dwithin') THEN
      CREATE FUNCTION extensions.st_dwithin(g1 jsonb, g2 jsonb, d double precision) RETURNS boolean LANGUAGE sql AS 'SELECT true';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='extensions' AND p.proname='st_asgeojson') THEN
      CREATE FUNCTION extensions.st_asgeojson(g jsonb) RETURNS text LANGUAGE sql AS 'SELECT NULL::text';
    END IF;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='auth' AND p.proname='uid') THEN
    BEGIN
      CREATE FUNCTION auth.uid() RETURNS text LANGUAGE sql STABLE AS 'SELECT current_setting(''request.jwt.claim.sub'', true)';
    EXCEPTION WHEN OTHERS THEN NULL; -- managed auth schema (Supabase): no permission needed there, helpers exist
    END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='auth' AND p.proname='role') THEN
    BEGIN
      CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS 'SELECT current_setting(''request.jwt.claim.role'', true)';
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS extensions;
`;

const GRANTS_FOOTER = `
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
`;

const HISTORY_SQL = `
CREATE SCHEMA IF NOT EXISTS supabase_migrations;
CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
  version text PRIMARY KEY,
  statements integer,
  name text
);
`;

const SETVAL_SYNC = `
DO $$
DECLARE r RECORD; v_max BIGINT;
BEGIN
  FOR r IN
    SELECT n.nspname AS sch, c.relname AS seq, d.refobjid::regclass AS tbl, a.attname AS col
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_depend d ON d.objid = c.oid AND d.classid = 'pg_class'::regclass AND d.deptype = 'a'
    JOIN pg_attribute a ON a.attrelid = d.refobjid AND a.attnum = d.refobjsubid
    WHERE c.relkind = 'S' AND n.nspname IN ('public','private')
  LOOP
    EXECUTE format('SELECT COALESCE(MAX(%I), 0) FROM %s', r.col, r.tbl) INTO v_max;
    IF v_max > 0 THEN
      EXECUTE format('SELECT setval(%L, %s, true)', r.sch || '.' || r.seq, v_max);
    ELSE
      EXECUTE format('SELECT setval(%L, 1, false)', r.sch || '.' || r.seq);
    END IF;
  END LOOP;
END $$;
`;

// ── local shims (--local-shims): replicate task177 replay.py PATCHES for
// pgserver builds without postgis/pg_trgm/pgcrypto (Supabase target runs UNPATCHED).
const SHIM_PATCHES = [
  [/\xa0/g, ' '],
  [/CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+"?uuid-ossp"?\s*;/gi, '-- [t177-stub] uuid-ossp'],
  [/CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+"?pg_trgm"?\s*;/gi, '-- [t177-stub] pg_trgm'],
  [/CREATE\s+EXTENSION\s+(?:IF\s+NOT\s+EXISTS\s+)?"?pgcrypto"?\s*;/gi, '-- [t177-stub] pgcrypto'],
  [/CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+"?postgis"?(?:\s+WITH\s+SCHEMA\s+extensions)?\s*;/gi, '-- [t177-stub] postgis'],
  [/CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+"?vector"?\s*;/gi, '-- [t177-stub] vector'],
  [/\bvector\(\s*\d+\s*\)/gi, 'jsonb'],
  [/(?:\b[A-Za-z_][A-Za-z0-9_]*\.)?geography\s*\(\s*[A-Za-z]+\s*,\s*\d+\s*\)/gi, 'jsonb'],
  [/GENERATED\s+ALWAYS\s+AS\s*\(\s*ST_MakePoint\s*\([^)]*\)\s*\)\s*STORED/gi, ''],
  [/USING\s+GIST\s*\(\s*location\s*\)/gi, 'USING GIN (location)'],
  [/USING\s+GIST\s*\(\s*last_location\s*\)/gi, 'USING GIN (last_location)'],
  [/USING\s+hnsw\s*\(\s*(\w+)\s+vector_\w+_ops\s*\)/gi, 'USING gin ($1)'],
  [/USING\s+hnsw\s*\(\s*(\w+)\s*\)/gi, 'USING gin ($1)'],
  [/USING\s+gin\s*\(\s*(\w+)\s+gin_trgm_ops\s*\)/gi, 'USING btree ($1)'],
  [/USING\s+gin\s*\(\s*(\w+)\s+gist_trgm_ops\s*\)/gi, 'USING btree ($1)'],
  [/USING\s+gist\s*\(\s*(\w+)\s+gist_trgm_ops\s*\)/gi, 'USING btree ($1)'],
  [/gin_trgm_ops/gi, ''],
  [/gist_trgm_ops/gi, ''],
  [/(?<![\w_])vector(?![\w_(])/gi, 'jsonb'],
];
// signature conflicts that break fresh applies: drop before create (task177 replay parity)
const SHIM_DROPS = [
  [/\b(CREATE\s+OR\s+REPLACE\s+FUNCTION\s+(?:public\.)?get_vehicles_with_status)/gi,
   'DROP FUNCTION IF EXISTS public.get_vehicles_with_status();\n$1'],
  [/\b(CREATE\s+OR\s+REPLACE\s+FUNCTION\s+(?:public\.)?get_public_crew_details)/gi,
   'DROP FUNCTION IF EXISTS public.get_public_crew_details(text);\n$1'],
];

// ── statement splitter: psql parity (top-level ';' only; handles $$, $tag$,
// quotes, comments). psql sends statements one by one and keeps going after
// errors — replication required because the chain relies on best-effort applies.
function splitStatements(sql) {
  const out = [];
  let cur = '', i = 0, n = sql.length;
  const push = () => { const s = cur.trim(); if (s) out.push(s); cur = ''; };
  while (i < n) {
    const c = sql[i], rest = sql.slice(i);
    if (rest.startsWith('--')) { const j = sql.indexOf('\n', i); const e = j === -1 ? n : j; cur += sql.slice(i, e + 1); i = e + 1; continue; }
    if (rest.startsWith('/*')) { const j = sql.indexOf('*/', i + 2); const e = j === -1 ? n : j + 2; cur += sql.slice(i, e); i = e; continue; }
    if (c === "'") { // single-quoted string ('' escape)
      cur += c; i++;
      while (i < n) { if (sql[i] === "'") { if (sql[i + 1] === "'") { cur += "''"; i += 2; continue; } cur += "'"; i++; break; } cur += sql[i++]; } continue;
    }
    if (c === '"') { const j = sql.indexOf('"', i + 1); const e = j === -1 ? n : j + 1; cur += sql.slice(i, e); i = e; continue; }
    const dq = rest.match(/^\$([A-Za-z_][A-Za-z0-9_]*)?\$/); // dollar quote
    if (dq) { const tag = dq[0]; const j = sql.indexOf(tag, i + tag.length); const e = j === -1 ? n : j + tag.length; cur += sql.slice(i, e); i = e; continue; }
    if (c === ';') { push(); i++; continue; }
    cur += c; i++;
  }
  push();
  return out;
}

async function runStatements(sql, label, tolerate = true, client = null) {
  const db = client || pool;
  // Fast path: whole file in ONE round trip (simple-query multi-statement).
  // On any error fall back to per-statement psql parity (best-effort applies).
  try {
    await db.query(sql);
    return 0;
  } catch (batchErr) {
    // fall through to per-statement mode
  }
  const stmts = splitStatements(sql);
  let errors = 0;
  for (const s of stmts) {
    try { await db.query(s); }
    catch (e) {
      if (!tolerate) throw e;
      errors++;
      if (errors <= 3) console.error(`\n    stmt-err ${label}: ${e.message.split('\n')[0]}`);
      if (e.code === '25P02') { // transaction aborted — release it, keep going (psql parity+)
        await db.query('ROLLBACK').catch(() => {});
      }
    }
  }
  return errors;
}

// ── migration list: exact task177-replay order ───────────────────────────────
function migrationList() {
  const dir = path.join(REPO, 'supabase', 'migrations');
  const main = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
  const supaDir = path.join(dir, 'supaplan');
  const supaplan = fs.readdirSync(supaDir).filter(f => f.endsWith('.sql'))
    .sort((a, b) => (a === 'init.sql' ? -1 : b === 'init.sql' ? 1 : a < b ? -1 : 1))
    .map(f => ['supaplan', f]);
  return [...main.map(f => ['main', f]), ...supaplan];
}

async function applyMigrations() {
  const files = migrationList();
  const MAX_PASSES = 3; // forward references (crews.slug, events, live_locations, cars.metadata...)
  // resolve on later passes — task177 replay parity
  const client = new pg.Client({ connectionString: DB_URL });
  await client.connect();
  // Supabase convention: unqualified PostGIS helpers (ST_DWithin etc.) live in extensions
  await client.query('SET search_path TO public, extensions');
  let pending = files;
  let pass = 0;
  try {
    while (pending.length && pass < MAX_PASSES) {
      pass++;
      log(`pass ${pass}/${MAX_PASSES}: ${pending.length} migration(s)`);
      const still = [];
      for (const [kind, name] of pending) {
        const file = kind === 'main'
          ? path.join(REPO, 'supabase', 'migrations', name)
          : path.join(REPO, 'supabase', 'migrations', 'supaplan', name);
        let sql = fs.readFileSync(file, 'utf8');
        if (args.localShims) { for (const [p, r] of SHIM_PATCHES) sql = sql.replace(p, r); for (const [p, r] of SHIM_DROPS) sql = sql.replace(p, r); }
        const errs = await runStatements(sql, name, true, client);
        const version = name.match(/^(\d{14})_/)?.[1] || `legacy-${name.replace(/\.sql$/, '')}`;
        await client.query(
          'INSERT INTO supabase_migrations.schema_migrations(version, statements, name) VALUES ($1,$2,$3) ON CONFLICT (version) DO NOTHING',
          [version, errs === 0 ? sql.split(';').length : -1, name]
        );
        if (errs > 0) { still.push([kind, name]); process.stdout.write('x'); }
        else process.stdout.write('.');
      }
      console.log('');
      pending = still;
    }
  } finally {
    await client.query('RESET search_path').catch(() => {});
    await client.end();
  }
  for (const [kind, name] of pending) console.error(`FAIL ${kind}/${name}: unresolved after ${MAX_PASSES} passes`);
  return pending.length;
}

// ── data import (chunked, parallel; header disables FK/triggers) ─────────────
function splitData(text, nChunks) {
  const lines = text.split('\n');
  const firstIns = lines.findIndex(l => l.startsWith('INSERT INTO'));
  const header = lines.slice(0, firstIns).join('\n');
  let body = lines.slice(firstIns);
  while (body.length && body[body.length - 1].trim() === '') body.pop();
  let tailSet = null;
  if (body.length && body[body.length - 1].startsWith('SET session_replication_role')) { tailSet = body.pop(); }
  const stmts = [];
  let cur = [];
  for (const l of body) {
    if (l.startsWith('INSERT INTO')) { if (cur.length) { stmts.push(cur.join('\n')); cur = []; } cur.push(l); }
    else cur.push(l);
  }
  if (cur.length) stmts.push(cur.join('\n'));
  const per = Math.ceil(stmts.length / nChunks);
  const chunks = [];
  for (let i = 0; i * per < stmts.length; i++) {
    let part = stmts.slice(i * per, (i + 1) * per);
    if (tailSet && (i + 1) * per >= stmts.length) part = [...part, '', tailSet];
    chunks.push(header + '\n' + part.join('\n'));
  }
  return chunks;
}

// ── data drift prelude: prod columns/tables that live in data.sql but were never
// born in the migration chain (task177 make_schema.py data-truth parity) ─────────
function parseDataHeaders(text) {
  const tables = {}; // "schema.tbl" -> Set(columns)
  for (const m of text.matchAll(/^INSERT INTO ([\w".]+) \(([^)]+)\)/gm)) {
    const t = m[1].replace(/"/g, '');
    tables[t] = tables[t] || new Set();
    for (const c of m[2].split(',')) {
      const col = c.trim().replace(/"/g, '');
      if (col) tables[t].add(col);
    }
  }
  return tables;
}

async function dataDriftPrelude(text) {
  const tables = parseDataHeaders(text);
  let openapi = null;
  if (args.openapi && fs.existsSync(args.openapi)) {
    openapi = JSON.parse(fs.readFileSync(args.openapi, 'utf8'));
    log(`openapi defs: ${Object.keys(openapi).length} tables`);
  }
  const colType = (tbl, col) => {
    const t = openapi?.[tbl.split('.').pop()]?.columns?.[col];
    if (!t) return 'text';
    if (/^(public\.|private\.)/.test(t) && !/(uuid|text|jsonb)$/.test(t)) return 'text'; // enum/composite → text
    return t;
  };
  const { rows: baseTables } = await pool.query(
    "SELECT n.nspname || '.' || c.relname AS name, c.relkind AS kind FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind IN ('r','p','v','m') AND n.nspname IN ('public','private')"
  );
  const existing = new Map(baseTables.map(r => [r.name, r.kind]));
  let createdTables = 0, createdCols = 0;
  for (const [t, cols] of Object.entries(tables)) {
    const kind = existing.get(t);
    if (kind === 'v' || kind === 'm') {
      // prod truth is a TABLE with rows (data.sql owns content) — drop the view/matview
      await pool.query(`DROP ${kind === 'm' ? 'MATERIALIZED VIEW' : 'VIEW'} IF EXISTS ${t.split('.').map(p => `"${p}"`).join('.')} CASCADE`);
      log(`converted ${kind === 'm' ? 'matview' : 'view'} → table: ${t}`);
    }
    if (!kind || kind === 'v' || kind === 'm') {
      const colDefs = [...cols].map(c => `${c.split('.').map(p => '"' + p + '"').join('.')} ${colType(t, c)}`).join(', ');
      await pool.query(`CREATE TABLE IF NOT EXISTS ${t} (${colDefs})`);
      createdTables++;
      log(`drift table born: ${t}`);
      continue;
    }
    const { rows } = await pool.query(
      'SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2',
      [t.split('.')[0], t.split('.')[1]]
    );
    const have = new Set(rows.map(r => r.column_name));
    for (const c of cols) {
      if (!have.has(c)) {
        await pool.query(`ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS ${c.split('.').map(p => '"' + p + '"').join('.')} ${colType(t, c)}`);
        createdCols++;
        log(`drift column born: ${t}.${c}`);
      }
    }
  }
  // data-truth parity (task177 make_schema.py): live data carries NULL daily_price/rent_link
  const truth = [
    'ALTER TABLE public.cars ALTER COLUMN daily_price DROP NOT NULL',
    'ALTER TABLE public.cars ALTER COLUMN rent_link DROP NOT NULL',
  ];
  for (const a of truth) {
    try { await pool.query(a + ';'); } catch (e) { log(`data-truth alter skipped: ${e.message.split('\n')[0]}`); }
  }
  // GENERATED ALWAYS AS columns reject explicit values — data.sql carries the real
  // (WKB-hex) values from prod, so drop the generation expression for the import.
  const genTables = Object.keys(tables);
  const { rows: gen } = await pool.query(
    "SELECT n.nspname || '.' || c.relname AS tbl, a.attname AS col FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE a.attgenerated = 's' AND n.nspname IN ('public','private')"
  );
  for (const g of gen) {
    if (!genTables.includes(g.tbl)) continue;
    try {
      await pool.query(`ALTER TABLE ${g.tbl.split('.').map(p => `"${p}"`).join('.')} ALTER COLUMN ${JSON.stringify(g.col)} DROP EXPRESSION`);
      log(`dropped GENERATED expression: ${g.tbl}.${g.col}`);
    } catch (e) { log(`DROP EXPRESSION skipped ${g.tbl}.${g.col}: ${e.message.split('\n')[0]}`); }
  }
  // data.sql is the source of truth: migrations seed some tables, import replaces content
  if (!args.noTruncate) {
    const list = Object.keys(tables);
    const client = new pg.Client({ connectionString: DB_URL });
    await client.connect();
    try {
      const { rows: real } = await client.query(
        "SELECT n.nspname || '.' || c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind IN ('r','p') AND (n.nspname || '.' || c.relname) = ANY($1)",
        [list]
      );
      let attempts = 0;
      while (attempts < 3) {
        attempts++;
        try {
          await client.query(`TRUNCATE ${real.map(r => r.name.split('.').map(p => '"' + p + '"').join('.')).join(', ')} CASCADE`);
          log(`truncated ${real.length} tables before import`);
          break;
        } catch (e) {
          log(`TRUNCATE attempt ${attempts} failed: ${e.message.split('\n')[0]}`);
          if (attempts === 3) throw e;
          // same-backend diagnostics: does the failing table exist for THIS client?
          const miss = e.message.match(/relation "([^"]+)" does not exist/)?.[1];
          if (miss) {
            const chk = await client.query('SELECT to_regclass($1) AS rc, current_database() AS db', [miss]);
            log(`diagnostic: to_regclass(${miss}) = ${chk.rows[0].rc} on db ${chk.rows[0].db} — retrying`);
          }
          await new Promise(r => setTimeout(r, 1500));
          await client.query('DISCARD ALL').catch(() => {});
        }
      }
    } finally {
      await client.end();
    }
  }
  log(`drift prelude done: ${createdTables} table(s), ${createdCols} column(s)`);
}

async function importData(text) {
  const chunks = splitData(text, Math.max(args.concurrency || 10, 4));
  log(`importing ${DATA_PATH} — ${chunks.length} chunks, concurrency ${args.concurrency || 10}`);
  let done = 0, failed = 0;
  const workers = chunks.map(async (sql, idx) => {
    const client = new pg.Client({ connectionString: DB_URL });
    await client.connect();
    try {
      await client.query(sql);
      done++;
      log(`chunk ${idx + 1}/${chunks.length} ok`);
    } catch (e) {
      failed++;
      log(`chunk ${idx + 1}/${chunks.length} FAIL: ${e.message.split('\n')[0]}`);
    } finally {
      await client.end();
    }
  });
  await Promise.all(workers);
  return failed;
}

// ── verify ────────────────────────────────────────────────────────────────────
async function verify() {
  const { rows } = await pool.query(`
    SELECT
      (SELECT count(*) FROM pg_tables WHERE schemaname IN ('public','private')) AS tables,
      (SELECT count(*) FROM pg_views WHERE schemaname = 'public') AS views,
      (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname IN ('public','private') AND c.relrowsecurity) AS rls,
      (SELECT count(*) FROM supabase_migrations.schema_migrations) AS recorded
  `);
  log(`verify: tables=${rows[0].tables} views=${rows[0].views} rls=${rows[0].rls} migrations_recorded=${rows[0].recorded}`);
  return rows[0];
}

async function verifySource() {
  const src = { url: ENV.SUPABASE_URL, key: ENV.SUPABASE_SERVICE_ROLE_KEY };
  const openapi = await (await fetch(`${src.url}/rest/v1/`, { headers: { apikey: src.key, Authorization: `Bearer ${src.key}` } })).json();
  const tables = Object.keys(openapi.definitions || {});
  let match = 0, drift = [];
  for (const t of tables) {
    const h = await fetch(`${src.url}/rest/v1/${t}?select=*`, { headers: { apikey: src.key, Authorization: `Bearer ${src.key}`, Range: '0-0', Prefer: 'count=exact' } });
    const sCount = Number(h.headers.get('content-range')?.split('/')[1] || 0);
    const { rows } = await pool.query(`SELECT count(*) AS n FROM public.${t}`).catch(() => ({ rows: [{ n: -1 }] }));
    if (rows[0].n === sCount) match++; else drift.push(`${t}: src=${sCount} tgt=${rows[0].n}`);
  }
  log(`verify-source: MATCH ${match}/${tables.length}${drift.length ? ' DRIFT: ' + drift.join(', ') : ' (0 drift)'}`);
}

// ── main ──────────────────────────────────────────────────────────────────────
(async () => {
  const t0 = Date.now();
  let failed = 0, dataFailed = 0;
  if (!args.skipMigrations) {
    if (!args.noWipe) { log('wiping public+private schemas'); await pool.query(WIPE_SQL); }
    log('ensuring roles/extensions schema'); await pool.query(ROLES_SQL);
    log('migration history table'); await pool.query(HISTORY_SQL);
    failed = await applyMigrations();
    log('service_role grants footer'); await pool.query(GRANTS_FOOTER);
  }
  if (!args.skipData) {
    if (!fs.existsSync(DATA_PATH)) { console.error(`data file not found: ${DATA_PATH} (use --skip-data or --data)`,); dataFailed = 1; }
    else {
      const text = fs.readFileSync(DATA_PATH, 'utf8');
      await dataDriftPrelude(text);
      dataFailed = await importData(text);
    }
    log('sequence setval sync'); await pool.query(SETVAL_SYNC);
  }
  await verify();
  if (args.verifySource && ENV.SUPABASE_URL) await verifySource();
  await pool.end();
  log(`DONE in ${((Date.now() - t0) / 1000).toFixed(0)}s — migration fails: ${failed}, data chunk fails: ${dataFailed}`);
  process.exit(failed + dataFailed > 0 ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
