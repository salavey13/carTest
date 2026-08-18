#!/usr/bin/env node
/**
 * upload-equipment-images.mjs — Batch upload экип-фото по паттерну байков
 *
 * Читает локальные папки workspace/EQUIPMENT/<категория>/<id>/ и загружает
 * в Supabase Storage: carpix/<id>/image_1.jpg, image_2.jpg, ... (upsert).
 * Имена исходных файлов неважны — скрипт сам нумерует по алфавиту.
 * После загрузки обновляет public.cars:
 *   - image_url = carpix/<id>/image_1.jpg
 *   - specs.gallery = [все загруженные URL]
 *
 * Usage:
 *   node scripts/upload-equipment-images.mjs                    # dry-run (ничего не пишет)
 *   node scripts/upload-equipment-images.mjs --apply            # реальная загрузка + update БД
 *   node scripts/upload-equipment-images.mjs --apply --limit 3  # только первые 3 позиции
 *
 * Папка по умолчанию: ../workspace/EQUIPMENT (можно переопределить: --dir /path)
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');

// ─── env ───
const env = {};
for (const line of readFileSync(join(REPO_ROOT, '.env.local'), 'utf-8').split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const LIMIT = (() => {
  const i = args.indexOf('--limit');
  return i >= 0 ? parseInt(args[i + 1], 10) : Infinity;
})();
const DIR = (() => {
  const i = args.indexOf('--dir');
  return i >= 0 ? args[i + 1] : '/opt/vip-bike-electro-factory/workspace/EQUIPMENT';
})();

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const BUCKET = 'carpix';
const STORAGE_BASE = `${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}`;

// ─── scan folders: категория/<id>/*.{jpg,jpeg,png,webp} ───
// Любое имя файла принимается: скрипт сам нумерует в image_1.jpg, image_2.jpg...
// по алфавитному порядку — можно валить фото как есть, без переименования.
const CATEGORIES = ['jackets', 'pants', 'suits'];

function scan() {
  const items = [];
  for (const cat of CATEGORIES) {
    const catDir = join(DIR, cat);
    let ids;
    try { ids = readdirSync(catDir); } catch { continue; }
    for (const id of ids) {
      if (id.startsWith('.')) continue;
      const idDir = join(catDir, id);
      if (!statSync(idDir).isDirectory()) continue;
      let files;
      try { files = readdirSync(idDir); } catch { continue; }
      const imgs = files
        .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
        .sort((a, b) => a.localeCompare(b, "ru"))
        .map((f, i) => ({ name: `image_${i + 1}.jpg`, path: join(idDir, f), orig: f }));
      if (imgs.length) items.push({ cat, id, imgs });
    }
  }
  return items;
}

async function uploadImage(id, img) {
  const storagePath = `${id}/${img.name}`;
  const buffer = readFileSync(img.path);
  const contentType = /\.png$/i.test(img.orig) ? 'image/png'
    : /\.webp$/i.test(img.orig) ? 'image/webp' : 'image/jpeg';
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType, upsert: true });
  if (error) throw new Error(`upload ${storagePath}: ${error.message}`);
  return `${STORAGE_BASE}/${storagePath}`;
}

async function main() {
  const items = scan();
  const total = items.reduce((s, it) => s + it.imgs.length, 0);
  console.log(`\n🖼  EQUIPMENT image upload → ${BUCKET}/<id>/image_N.jpg`);
  console.log(`📁 Source: ${DIR}`);
  console.log(`   Folders with photos: ${items.length}, files: ${total}`);
  console.log(`   Mode: ${APPLY ? 'APPLY (пишем в storage + БД)' : 'DRY-RUN (ничего не пишем)'}\n`);

  if (!items.length) { console.log('⚠️  Нет фото — положите любые jpg/png/webp в EQUIPMENT/<категория>/<id>/ (имена не важны, скрипт сам пронумерует)'); return; }

  let uploaded = 0, failed = 0, updated = 0;
  const seen = new Set();
  for (const it of items.slice(0, LIMIT)) {
    const urls = [];
    for (const img of it.imgs) {
      const key = `${it.id}/${img.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      try {
        if (APPLY) {
          const url = await uploadImage(it.id, img);
          urls.push(url);
          uploaded++;
          console.log(`  ✓ carpix/${key} ← ${img.orig || img.name} (${(statSync(img.path).size / 1024).toFixed(1)} KB)`);
        } else {
          urls.push(`${STORAGE_BASE}/${key}`);
          console.log(`  · would upload carpix/${key} ← ${img.orig || img.name}`);
        }
      } catch (e) {
        failed++;
        console.error(`  ✗ ${key}: ${e.message}`);
      }
    }
    if (APPLY && urls.length) {
      const { data: row, error: selErr } = await supabase
        .from('cars').select('id, specs').eq('id', it.id).single();
      if (selErr) { console.error(`  ✗ select ${it.id}: ${selErr.message}`); continue; }
      const specs = typeof row.specs === 'string' ? JSON.parse(row.specs) : (row.specs || {});
      specs.gallery = urls;
      const { error: updErr } = await supabase
        .from('cars').update({ image_url: urls[0], specs }).eq('id', it.id);
      if (updErr) { console.error(`  ✗ update ${it.id}: ${updErr.message}`); continue; }
      updated++;
      console.log(`  ✓ cars.${it.id}: image_url + specs.gallery (${urls.length} photos)`);
    }
  }

  console.log(`\n📊 Итог: uploaded=${uploaded}, updated_cars=${updated}, failed=${failed}, dry_run=${!APPLY}`);
  if (!APPLY) console.log('ℹ️  Запустите с --apply для реальной загрузки.');
}

main().catch(e => { console.error('❌ Fatal:', e); process.exit(1); });