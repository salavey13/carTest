#!/usr/bin/env node
/**
 * task178: storage bucket mirroring for the Supabase project copy (separate pass).
 *
 * Mirrors buckets source → target (name, public flag, size limits, mime types).
 * Object CONTENT is copied only with --objects (hardcoded image URLs keep pointing
 * to the source project, so structure parity is usually enough for a clone).
 *
 * Usage:
 *   node scripts/supabase-storage-copy.mjs --env <env-file> [--objects] [--bucket name]
 *
 * Env file keys (never committed):
 *   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY   source project
 *   TARGET_URL / TARGET_KEY                    target project
 */
import fs from 'node:fs';

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a === '--objects') args.objects = true;
  else if (a === '--bucket') args.bucket = process.argv[++i];
  else if (a === '--env') args.env = process.argv[++i];
  else throw new Error(`unknown flag: ${a}`);
}
if (!args.env) { console.error('usage: node scripts/supabase-storage-copy.mjs --env <env-file> [--objects]'); process.exit(2); }

const ENV = {};
for (const line of fs.readFileSync(args.env, 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) ENV[m[1]] = m[2].trim().replace(/^"|"$/g, '');
}
const SRC = ENV.SUPABASE_URL, SKEY = ENV.SUPABASE_SERVICE_ROLE_KEY;
const TGT = ENV.TARGET_URL, TKEY = ENV.TARGET_KEY;
if (!SRC || !SKEY || !TGT || !TKEY) { console.error('env needs SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TARGET_URL, TARGET_KEY'); process.exit(2); }

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const srcH = { apikey: SKEY, Authorization: `Bearer ${SKEY}` };
const tgtH = { apikey: TKEY, Authorization: `Bearer ${TKEY}` };

async function listBuckets(base, headers) {
  const r = await fetch(`${base}/storage/v1/bucket`, { headers });
  if (!r.ok) throw new Error(`bucket list ${r.status}: ${await r.text()}`);
  return r.json();
}

async function walkObjects(base, headers, bucket, prefix = '') {
  const out = [];
  const r = await fetch(`${base}/storage/v1/object/list/${bucket}`, {
    method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefix, limit: 1000, offset: 0, sortBy: { column: 'name', order: 'asc' } }),
  });
  if (!r.ok) throw new Error(`object list ${bucket}/${prefix} ${r.status}`);
  const items = await r.json();
  for (const it of items) {
    if (it.id === null) { // folder
      out.push(...await walkObjects(base, headers, bucket, `${prefix}${it.name}/`));
    } else {
      out.push({ path: `${prefix}${it.name}`, size: it.metadata?.size || 0 });
    }
  }
  return out;
}

(async () => {
  const srcBuckets = await listBuckets(SRC, srcH);
  const tgtBuckets = await listBuckets(TGT, tgtH);
  const tgtNames = new Set(tgtBuckets.map(b => b.name));
  const todo = args.bucket ? srcBuckets.filter(b => b.name === args.bucket) : srcBuckets;
  log(`source buckets: ${srcBuckets.length}, target buckets: ${tgtBuckets.length}`);

  let created = 0, copied = 0, bytes = 0, failed = 0;
  for (const b of todo) {
    if (!tgtNames.has(b.name)) {
      const payload = { name: b.name, public: !!b.public };
      if (b.file_size_limit) payload.file_size_limit = b.file_size_limit;
      if (b.allowed_mime_types) payload.allowed_mime_types = b.allowed_mime_types;
      const r = await fetch(`${TGT}/storage/v1/bucket`, {
        method: 'POST', headers: { ...tgtH, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (r.ok) { created++; log(`bucket created: ${b.name} (public=${!!b.public})`); }
      else { failed++; log(`bucket create FAILED ${b.name}: ${r.status} ${await r.text()}`); }
    } else {
      log(`bucket exists: ${b.name}`);
    }

    if (!args.objects) {
      const objs = await walkObjects(SRC, srcH, b.name).catch(() => []);
      if (objs.length) log(`  ${b.name}: ${objs.length} object(s), ${(objs.reduce((s, o) => s + o.size, 0) / 1e6).toFixed(1)} MB — use --objects to copy`);
      continue;
    }
    const objs = await walkObjects(SRC, srcH, b.name);
    for (const o of objs) {
      try {
        const dr = await fetch(`${SRC}/storage/v1/object/authenticated/${b.name}/${o.path}`, { headers: srcH });
        if (!dr.ok) throw new Error(`download ${dr.status}`);
        const body = Buffer.from(await dr.arrayBuffer());
        const ur = await fetch(`${TGT}/storage/v1/object/${b.name}/${o.path}`, {
          method: 'POST',
          headers: { ...tgtH, 'Content-Type': dr.headers.get('content-type') || 'application/octet-stream', 'x-upsert': 'true' },
          body: body,
        });
        if (!ur.ok) throw new Error(`upload ${ur.status}: ${(await ur.text()).slice(0, 120)}`);
        copied++; bytes += o.size;
        if (copied % 50 === 0) log(`  copied ${copied} objects, ${(bytes / 1e6).toFixed(1)} MB`);
      } catch (e) {
        failed++;
        log(`  object FAIL ${b.name}/${o.path}: ${e.message}`);
      }
    }
    log(`  ${b.name}: done (${objs.length} objects)`);
  }
  log(`DONE — buckets created: ${created}, objects copied: ${copied} (${(bytes / 1e6).toFixed(1)} MB), failures: ${failed}`);
})().catch(e => { console.error(e); process.exit(1); });
