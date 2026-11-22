#!/usr/bin/env node
/**
 * backup-doc-storage.mjs — Incremental Supabase Storage backup (dependency-free, curl only)
 *
 * Backs up document storage buckets to a local directory. Designed for cron:
 *   - INCREMENTAL: downloads only NEW/CHANGED files (manifest with etag+size per bucket)
 *   - Read-only, safe to run anytime
 *
 * Buckets backed up (documents/photos that are NOT in the git mirror):
 *   rental-contracts  — generated DOCX contracts (web + /doc flow)
 *   docpix            — passport/license OCR photos
 *   rental-photos     — ДО/ПОСЛЕ rental photos
 *   doc-verifier      — contract verification artifacts
 *
 * Usage:
 *   node scripts/backup-doc-storage.mjs                  # Incremental backup of all buckets
 *   node scripts/backup-doc-storage.mjs --bucket rental-contracts   # One bucket
 *   node scripts/backup-doc-storage.mjs --full           # Re-download everything (ignore manifest)
 *   node scripts/backup-doc-storage.mjs --list           # Show bucket stats only
 *
 * Output layout:
 *   backups/doc-storage/
 *     rental-contracts/vip-bike/rental-*.docx
 *     docpix/...
 *     .manifest.json   — { bucketPath: { etag, size, backedUpAt } } for incremental skips
 *
 * Cron example (daily 03:17):
 *   17 3 * * * cd /home/z/my-project && node scripts/backup-doc-storage.mjs >> backups/doc-storage.log 2>&1
 */

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';

// ─── Config ──────────────────────────────────────────────────────────────────
const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const BACKUP_ROOT = join(process.cwd(), 'backups', 'doc-storage');
const MANIFEST_PATH = join(BACKUP_ROOT, '.manifest.json');

// Buckets holding documents/photos worth backing up.
// carpix etc. are already mirrored into public/supabase-mirror — skip them.
const DEFAULT_BUCKETS = ['rental-contracts', 'docpix', 'rental-photos', 'doc-verifier'];

// ─── Args ────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const bucketArg = args.find(a => a.startsWith('--bucket='))?.split('=')[1];
const FULL = args.includes('--full');
const LIST_ONLY = args.includes('--list');
const BUCKETS = bucketArg ? [bucketArg] : DEFAULT_BUCKETS;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function die(msg) {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

if (!SUPABASE_URL) die('Missing NEXT_PUBLIC_SUPABASE_URL (set it or source upload/secrets.txt)');
if (!SERVICE_KEY) die('Missing SUPABASE_SERVICE_ROLE_KEY (set it or source upload/secrets.txt)');

/** POST {prefix} list — returns [{name, id, metadata:{size,...}}] */
function listFolder(bucket, prefix) {
  const r = spawnSync('curl', ['-sS',
    `${SUPABASE_URL}/storage/v1/object/list/${bucket}`,
    '-X', 'POST',
    '-H', `apikey: ${SERVICE_KEY}`,
    '-H', `Authorization: Bearer ${SERVICE_KEY}`,
    '-H', 'Content-Type: application/json',
    '-d', JSON.stringify({ prefix, limit: 1000, sortBy: { column: 'name', order: 'asc' } }),
  ], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  if (r.status !== 0) return { error: r.stderr };
  let data;
  try { data = JSON.parse(r.stdout || '[]'); } catch { return { error: `parse: ${r.stdout?.slice(0, 200)}` }; }
  if (!Array.isArray(data)) return { error: JSON.stringify(data).slice(0, 200) };
  return { data };
}

/** Recursively walk a bucket; returns flat [{path, size}] of file objects. */
function walkBucket(bucket, prefix = '', acc = [], depth = 0) {
  if (depth > 12) return acc; // safety: don't recurse forever
  const { data, error } = listFolder(bucket, prefix);
  if (error) {
    console.warn(`  ⚠️  list ${bucket}/${prefix}: ${error}`);
    return acc;
  }
  for (const item of data || []) {
    const name = item.name || '';
    const full = `${prefix}${name}`;
    if (item.id === null || item.id === undefined) {
      // Directory — recurse
      walkBucket(bucket, `${full}/`, acc, depth + 1);
    } else {
      acc.push({ path: full, size: item.metadata?.size ?? 0 });
    }
  }
  return acc;
}

/** Download one object to destPath via curl (streamed, no node buffer bloat). */
function downloadObject(bucket, objectPath, destPath) {
  mkdirSync(dirname(destPath), { recursive: true });
  const r = spawnSync('curl', ['-sS', '-f',
    `${SUPABASE_URL}/storage/v1/object/${bucket}/${objectPath}`,
    '-H', `apikey: ${SERVICE_KEY}`,
    '-H', `Authorization: Bearer ${SERVICE_KEY}`,
    '-o', destPath,
  ], { encoding: 'utf8', timeout: 60000 });
  if (r.status !== 0) {
    return { ok: false, error: (r.stderr || `curl exit ${r.status}`).slice(0, 200) };
  }
  let size = 0;
  try { size = statSync(destPath).size; } catch { /* gone? */ }
  return { ok: true, size };
}

function loadManifest() {
  if (FULL || !existsSync(MANIFEST_PATH)) return {};
  try { return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')); } catch { return {}; }
}

function saveManifest(manifest) {
  mkdirSync(BACKUP_ROOT, { recursive: true });
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 1));
}

// ─── Main ────────────────────────────────────────────────────────────────────
const manifest = loadManifest();
const manifestKey = (bucket, p) => `${bucket}/${p}`;
const summary = [];

console.log(`\n💾 Doc-storage backup → ${BACKUP_ROOT}${FULL ? ' (FULL)' : ' (incremental)'}\n`);

for (const bucket of BUCKETS) {
  console.log(`📦 Bucket: ${bucket}`);
  const files = walkBucket(bucket);
  if (files.length === 0) {
    console.log('   (empty or unreachable)\n');
    summary.push({ bucket, total: 0, downloaded: 0, skipped: 0, bytes: 0 });
    continue;
  }

  let downloaded = 0, skipped = 0, bytes = 0, errors = 0;

  for (const file of files) {
    const key = manifestKey(bucket, file.path);
    const dest = join(BACKUP_ROOT, bucket, file.path);
    const prev = manifest[key];

    // Incremental skip: already backed up with same size
    if (!FULL && prev && prev.size === file.size && existsSync(dest) && statSync(dest).size === file.size) {
      skipped++;
      continue;
    }

    const res = downloadObject(bucket, file.path, dest);
    if (res.ok) {
      downloaded++;
      bytes += res.size || file.size;
      manifest[key] = { size: file.size, backedUpAt: new Date().toISOString() };
      if (downloaded <= 5 || downloaded % 50 === 0) {
        console.log(`   ⬇️  ${file.path} (${((res.size || 0) / 1024).toFixed(1)} KB)`);
      }
    } else {
      errors++;
      console.warn(`   ❌ ${file.path}: ${res.error}`);
    }
  }

  console.log(`   ✓ ${bucket}: ${files.length} total, ${downloaded} downloaded, ${skipped} skipped, ${errors} errors\n`);
  summary.push({ bucket, total: files.length, downloaded, skipped, errors, bytes });
}

saveManifest(manifest);

// ─── Report ──────────────────────────────────────────────────────────────────
const totalDownloaded = summary.reduce((s, b) => s + b.downloaded, 0);
const totalBytes = summary.reduce((s, b) => s + b.bytes, 0);
const totalErrors = summary.reduce((s, b) => s + (b.errors || 0), 0);

console.log('═'.repeat(60));
for (const s of summary) {
  console.log(`  ${s.bucket.padEnd(20)} ${String(s.total).padStart(4)} files | ⬇️ ${s.downloaded} | ⏭ ${s.skipped} | ${((s.bytes || 0) / 1024 / 1024).toFixed(2)} MB`);
}
console.log('═'.repeat(60));
console.log(`  Total new/changed: ${totalDownloaded} files, ${(totalBytes / 1024 / 1024).toFixed(2)} MB${totalErrors ? `, ${totalErrors} errors` : ''}`);
console.log('');

// Non-zero exit when downloads failed — cron log will show it
if (totalErrors > 0) process.exit(2);
