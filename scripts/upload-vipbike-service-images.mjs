#!/usr/bin/env node
/**
 * upload-vipbike-service-images.mjs
 * Compress generated "talking" art → Supabase carpix + assign to vip-bike service items.
 *
 * Per item: landscape.png (1152x864) → sharp flatten + cover 'attention':
 *   image_1.jpg     1080x1080 (catalog service card is aspect-square)
 *   image_1_4x3.jpg 1080x810  (gallery second frame)
 * PATCH cars: image_url + specs.gallery=[sq,4x3] (specs merged, idempotent, x-upsert).
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire('/home/z/.npm-global/lib/node_modules/sharp/package.json');
const sharp = require('sharp');

const KEY = readFileSync('/home/z/my-project/scripts/.sb_key', 'utf8').trim();
const SB = 'https://inmctohsodgdohamhzag.supabase.co';
const SRC = '/home/z/my-project/download/vipbike-services';
const PUB = (p) => `${SB}/storage/v1/object/public/carpix/${p}`;

// optional CLI filter: node upload-vipbike-service-images.mjs vip-bike-svc-001 ...
const IDS = process.argv.slice(2).length
  ? process.argv.slice(2)
  : Array.from({ length: 48 }, (_, i) => `vip-bike-svc-${String(i + 1).padStart(3, '0')}`);

const H = (extra = {}) => ({
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  ...extra,
});

async function uploadJpeg(id, name, buffer) {
  const path = `carpix/${id}/${name}`;
  const res = await fetch(`${SB}/storage/v1/object/${path}`, {
    method: 'POST',
    headers: H({
      'Content-Type': 'image/jpeg',
      'x-upsert': 'true',
      'cache-control': '31536000',
    }),
    body: buffer,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`upload ${path}: HTTP ${res.status} ${text.slice(0, 200)}`);
  return PUB(`${id}/${name}`);
}

async function assignItem(id) {
  const rowRes = await fetch(`${SB}/rest/v1/cars?select=specs&type=eq.service&id=eq.${id}`, { headers: H() });
  if (!rowRes.ok) throw new Error(`fetch row ${id}: HTTP ${rowRes.status}`);
  const row = (await rowRes.json())[0];
  if (!row) throw new Error(`row ${id} not found`);
  const specs = { ...(row.specs || {}) };

  const base = sharp(`${SRC}/${id}/landscape.png`).flatten({ background: '#ffffff' });
  const imgSq = await base.clone()
    .resize(1080, 1080, { fit: 'cover', position: 'attention' })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
  const img43 = await base.clone()
    .resize(1080, 810, { fit: 'cover', position: 'attention' })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();

  const urlSq = await uploadJpeg(id, 'image_1.jpg', imgSq);
  const url43 = await uploadJpeg(id, 'image_1_4x3.jpg', img43);

  specs.gallery = [urlSq, url43];
  const patchRes = await fetch(`${SB}/rest/v1/cars?id=eq.${id}`, {
    method: 'PATCH',
    headers: H({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
    body: JSON.stringify({ image_url: urlSq, specs }),
  });
  if (!patchRes.ok) {
    throw new Error(`patch ${id}: HTTP ${patchRes.status} ${(await patchRes.text()).slice(0, 200)}`);
  }
  return { sq: `${Math.round(imgSq.length / 1024)} KB`, k43: `${Math.round(img43.length / 1024)} KB` };
}

let failed = 0;
for (const id of IDS) {
  try {
    const sizes = await assignItem(id);
    console.log(`OK  ${id}  (square ${sizes.sq}, 4x3 ${sizes.k43})`);
  } catch (e) {
    failed++;
    console.error(`FAIL ${id}: ${e.message}`);
  }
}
console.log(failed ? `DONE failed=${failed}` : `DONE all ${IDS.length} assigned`);
process.exit(failed ? 1 : 0);
