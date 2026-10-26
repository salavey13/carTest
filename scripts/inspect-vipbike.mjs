#!/usr/bin/env node
// inspect-vipbike.mjs — list all vip-bike service items with full details
import { readFileSync } from 'node:fs';

const KEY = readFileSync('/home/z/my-project/scripts/.sb_key', 'utf8').trim();
const SB = 'https://inmctohsodgdohamhzag.supabase.co';
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

const r = await fetch(`${SB}/rest/v1/cars?select=id,model,description,image_url,specs&type=eq.service&id=like.vip-bike-*&order=id`, { headers: H });
const rows = await r.json();
console.log(`TOTAL: ${rows.length}`);
let withImg = 0;
for (const it of rows) {
  if (it.image_url) withImg++;
  const gal = it.specs?.gallery?.length ?? 0;
  console.log(`${it.id} | img:${it.image_url ? 'Y' : 'N'}${gal ? ` gal:${gal}` : ''} | ${(it.model || '').slice(0, 75)}`);
  if (it.description) console.log(`    ${(it.description || '').replace(/\s+/g, ' ').slice(0, 140)}`);
}
console.log(`\nwith images already: ${withImg}`);
