#!/usr/bin/env node
/**
 * upload-moto-selection-service-images.mjs
 * Compress moto-selection service photos → Supabase carpix + assign to cars rows.
 *
 * Sources: /moto-selection landing photos (tildacdn) + 2 generated (svc-03, svc-04).
 * Catalog renders service cards as aspect-square → image_1.jpg = 1080x1080 cover
 * (sharp 'attention' smart crop keeps the subject), image_1_4x3.jpg = 1080x810.
 * PATCH cars: image_url = square URL, specs.gallery = [square, 4x3] (specs merged).
 * Idempotent: storage x-upsert + full specs merge.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire('/home/z/.npm-global/lib/node_modules/sharp/package.json');
const sharp = require('sharp');

const KEY = readFileSync('/home/z/my-project/scripts/.sb_key', 'utf8').trim();
const SB = 'https://inmctohsodgdohamhzag.supabase.co';
const SRC = '/home/z/my-project/download/moto-selection-services';
const PUB = (p) => `${SB}/storage/v1/object/public/carpix/${p}`;

const ITEMS = [
  { id: 'moto-selection-svc-01', src: `${SRC}/src/training.jpg` },
  { id: 'moto-selection-svc-02', src: `${SRC}/src/pickup.png` },
  { id: 'moto-selection-svc-03', src: `${SRC}/moto-selection-svc-03/landscape.png` },
  { id: 'moto-selection-svc-04', src: `${SRC}/moto-selection-svc-04/landscape.png` },
  { id: 'moto-selection-svc-05', src: `${SRC}/src/hero.jpg` },
  { id: 'moto-selection-svc-06', src: `${SRC}/src/storage.jpg` },
  { id: 'moto-selection-svc-07', src: `${SRC}/src/detailing.jpg` },
  { id: 'moto-selection-svc-08', src: `${SRC}/src/service.jpg` },
];

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

async function assignItem({ id, src }) {
  // 1. current row (need existing specs to merge, not clobber)
  const rowRes = await fetch(`${SB}/rest/v1/cars?select=specs&type=eq.service&id=eq.${id}`, { headers: H() });
  if (!rowRes.ok) throw new Error(`fetch row ${id}: HTTP ${rowRes.status}`);
  const row = (await rowRes.json())[0];
  if (!row) throw new Error(`row ${id} not found`);
  const specs = { ...(row.specs || {}) };

  // 2. compress: square (card) + 4x3 (gallery), attention crop keeps the subject
  const base = sharp(src).flatten({ background: '#ffffff' });
  const imgSq = await base.clone()
    .resize(1080, 1080, { fit: 'cover', position: 'attention' })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
  const img43 = await base.clone()
    .resize(1080, 810, { fit: 'cover', position: 'attention' })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();

  // 3. upload (upsert)
  const urlSq = await uploadJpeg(id, 'image_1.jpg', imgSq);
  const url43 = await uploadJpeg(id, 'image_1_4x3.jpg', img43);

  // 4. assign: image_url + specs.gallery (keep service/subtype/rent_price_label)
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
for (const item of ITEMS) {
  try {
    const sizes = await assignItem(item);
    console.log(`OK  ${item.id}  (square ${sizes.sq}, 4x3 ${sizes.k43})`);
  } catch (e) {
    failed++;
    console.error(`FAIL ${item.id}: ${e.message}`);
  }
}
console.log(failed ? `DONE failed=${failed}` : 'DONE all 8 assigned');
process.exit(failed ? 1 : 0);
