#!/usr/bin/env node
/**
 * sync-supabase-images.mjs — DEPENDENCY-FREE (uses curl only)
 * 
 * Downloads all images from Supabase storage to local public/supabase-mirror/
 * 
 * Usage:
 *   node scripts/sync-supabase-images.mjs              # Bike gallery images
 *   node scripts/sync-supabase-images.mjs --logos       # Logos + branding
 *   node scripts/sync-supabase-images.mjs --all          # Everything
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, existsSync, statSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://inmctohsodgdohamhzag.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DO_LOGOS = process.argv.includes('--logos') || process.argv.includes('--all');
const DO_BIKES = !process.argv.includes('--logos') || process.argv.includes('--all');

if (!SERVICE_KEY) { console.error('Missing SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

const MIRROR_DIR = join(process.cwd(), 'public', 'supabase-mirror');
let downloaded = 0, skipped = 0, failed = 0;

function supabaseRest(path) {
  const r = spawnSync('curl', ['-sS', `${SUPABASE_URL}/rest/v1/${path}`,
    '-H', `apikey: ${SERVICE_KEY}`, '-H', `Authorization: Bearer ${SERVICE_KEY}`], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`REST failed: ${r.stderr}`);
  return JSON.parse(r.stdout || '[]');
}

function extractStoragePath(url) {
  if (!url || typeof url !== 'string') return null;
  const m = url.match(/\/storage\/v1\/object\/public\/(.+)$/);
  return m ? m[1] : null;
}

function downloadFile(storagePath) {
  const localPath = join(MIRROR_DIR, storagePath);
  if (existsSync(localPath) && statSync(localPath).size > 0) { skipped++; return true; }
  mkdirSync(dirname(localPath), { recursive: true });
  const r = spawnSync('curl', ['-sS', '-L', '-o', localPath,
    `${SUPABASE_URL}/storage/v1/object/public/${storagePath}`], { encoding: 'utf8' });
  if (r.status !== 0 || !existsSync(localPath) || statSync(localPath).size === 0) {
    console.error(`  ✗ ${storagePath}`); failed++; return false;
  }
  downloaded++;
  const kb = (statSync(localPath).size / 1024).toFixed(1);
  console.log(`  ✓ ${storagePath} (${kb} KB)`);
  return true;
}

const BRANDING_ASSETS = [
  'carpix/logo-electro-neon.png',
  'carpix/logo-rental.png', 
  'carpix/logo-vip-bike.png',
  'about/1000033868-a2e57b7e-5ed8-4440-9304-f3f54f63cc46.jpg',
  'carpix/IMG_bg-cf31dc2b-291b-440b-953b-6e1b4a838e4e.jpg',
  'carpix/nnmap.jpg',
];

// Main
console.log(`\n🖼  Supabase Image Sync → ${MIRROR_DIR}\n`);
mkdirSync(MIRROR_DIR, { recursive: true });

let allPaths = [];

if (DO_BIKES) {
  const bikes = supabaseRest('cars?select=id,image_url,specs&crew_id=eq.2d5fde70-1dd3-4f0d-8d72-66ccf6908746&type=in.(bike,ebike)');
  console.log(`📦 ${bikes.length} bikes found\n`);

  const urls = new Set();
  for (const b of bikes) {
    if (b.image_url) urls.add(b.image_url);
    const specs = typeof b.specs === 'string' ? JSON.parse(b.specs) : (b.specs || {});
    if (Array.isArray(specs.gallery)) specs.gallery.forEach(g => g && urls.add(g));
  }
  const bikePaths = [...urls].map(extractStoragePath).filter(Boolean);
  console.log(`📸 ${bikePaths.length} bike images\n`);
  allPaths.push(...bikePaths);
}

if (DO_LOGOS) {
  console.log(`🏷  ${BRANDING_ASSETS.length} branding assets\n`);
  allPaths.push(...BRANDING_ASSETS);
}

for (const p of allPaths) downloadFile(p);

console.log(`\n📊 Downloaded: ${downloaded} | Skipped: ${skipped} | Failed: ${failed}\n`);
process.exit(failed > 0 ? 1 : 0);
