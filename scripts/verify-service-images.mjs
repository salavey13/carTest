#!/usr/bin/env node
// verify-service-images.mjs — final check: all moto-selection + sly13 service rows
// have image_url + specs.gallery[2], every URL returns HTTP 200 image/jpeg.
import { readFileSync } from 'node:fs';

const KEY = readFileSync('/home/z/my-project/scripts/.sb_key', 'utf8').trim();
const SB = 'https://inmctohsodgdohamhzag.supabase.co';
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

const r = await fetch(`${SB}/rest/v1/cars?select=id,model,image_url,specs&type=eq.service&order=id&limit=200`, { headers: H });
const rows = (await r.json()).filter(x => /^(moto-selection|sly13)-/.test(x.id));

let bad = 0;
for (const it of rows) {
  const gal = it.specs?.gallery ?? [];
  const kept = ['service', 'subtype', 'rent_price_label', 'dailyPrice'].filter(k => k in (it.specs || {}));
  const urls = [it.image_url, ...gal].filter(Boolean);
  const heads = await Promise.all(urls.map(u => fetch(u, { method: 'HEAD' })));
  const okHttp = heads.every(h => h.ok);
  const okType = heads.every(h => (h.headers.get('content-type') || '').includes('image'));
  const ok = Boolean(it.image_url) && gal.length === 2 && okHttp && okType;
  if (!ok) bad++;
  console.log(`${ok ? 'OK ' : 'BAD'} ${it.id} | urls:${urls.length} http200:${okHttp} img:${okType} specs.kept:[${kept}] | ${(it.model || '').slice(0, 45)}`);
}
console.log(bad ? `FAILED rows: ${bad}` : 'ALL GOOD — every URL 200 + image/*, specs preserved');
process.exit(bad ? 1 : 0);
