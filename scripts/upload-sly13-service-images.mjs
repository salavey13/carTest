#!/usr/bin/env node
/**
 * upload-sly13-service-images.mjs
 * Compress generated art → Supabase carpix + assign to sly13 service items.
 *
 * For each of the 7 sly13 type=service items:
 *   portrait.png  (768x1344)  → sharp cover 720x1280 mozjpeg q82 → carpix/<id>/image_1.jpg
 *   landscape.png (1152x864)  → sharp cover 1080x810 mozjpeg q82 → carpix/<id>/image_1_4x3.jpg
 *   PATCH cars: image_url = <image_1 public URL>, specs.gallery = [both URLs] (specs merged)
 * Idempotent: storage x-upsert + full specs merge.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire('/home/z/.npm-global/lib/node_modules/sharp/package.json');
const sharp = require('sharp');

const KEY = readFileSync('/home/z/my-project/scripts/.sb_key', 'utf8').trim();
const URL = 'https://inmctohsodgdohamhzag.supabase.co';
const SRC = '/home/z/my-project/download/sly13-services';
const PUB = (p) => `${URL}/storage/v1/object/public/carpix/${p}`;

const ALL_ITEMS = [
  'sly13-vibe-001', 'sly13-vibe-002',
  'sly13-setup-001', 'sly13-setup-002',
  'sly13-edu-001', 'sly13-edu-002',
  'sly13-mnt-001',
];
// optional CLI filter: node upload-sly13-service-images.mjs sly13-edu-002 sly13-mnt-001
const ITEMS = process.argv.slice(2).length ? process.argv.slice(2) : ALL_ITEMS;

const H = (extra = {}) => ({
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  ...extra,
});

async function uploadJpeg(id, name, buffer) {
  const path = `carpix/${id}/${name}`;
  const res = await fetch(`${URL}/storage/v1/object/${path}`, {
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
  return { path, publicUrl: PUB(`${id}/${name}`) };
}

async function assignItem(id) {
  // 1. current row (need existing specs to merge, not clobber)
  const rowRes = await fetch(`${URL}/rest/v1/cars?select=specs&type=eq.service&id=eq.${id}`, { headers: H() });
  if (!rowRes.ok) throw new Error(`fetch row ${id}: HTTP ${rowRes.status}`);
  const row = (await rowRes.json())[0];
  if (!row) throw new Error(`row ${id} not found`);
  const specs = { ...(row.specs || {}) };

  // 2. compress both variants
  const img1 = await sharp(`${SRC}/${id}/portrait.png`)
    .resize(720, 1280, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
  const img43 = await sharp(`${SRC}/${id}/landscape.png`)
    .resize(1080, 810, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();

  // 3. upload (upsert)
  const up1 = await uploadJpeg(id, 'image_1.jpg', img1);
  const up43 = await uploadJpeg(id, 'image_1_4x3.jpg', img43);

  // 4. assign: image_url + specs.gallery (keep service/subtype/dailyPrice)
  specs.gallery = [up1.publicUrl, up43.publicUrl];
  const patchRes = await fetch(`${URL}/rest/v1/cars?id=eq.${id}`, {
    method: 'PATCH',
    headers: H({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
    body: JSON.stringify({ image_url: up1.publicUrl, specs }),
  });
  if (!patchRes.ok) {
    throw new Error(`patch ${id}: HTTP ${patchRes.status} ${(await patchRes.text()).slice(0, 200)}`);
  }
  return { image_1: `${Math.round(img1.length / 1024)} KB`, image_43: `${Math.round(img43.length / 1024)} KB` };
}

let failed = 0;
for (const id of ITEMS) {
  try {
    const sizes = await assignItem(id);
    console.log(`OK  ${id}  (image_1 ${sizes.image_1}, 4x3 ${sizes.image_43})`);
  } catch (e) {
    failed++;
    console.error(`FAIL ${id}: ${e.message}`);
  }
}
console.log(failed ? `DONE failed=${failed}` : 'DONE all 7 assigned');
process.exit(failed ? 1 : 0);
