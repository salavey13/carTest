#!/usr/bin/env node
// Task 88 delivery: upload QR PDF to Supabase storage, sendDocument by URL to Paul
// run: node --env-file=.env.local scripts/task88-send-pdf.mjs
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const PDF_PATH = '/home/z/my-project/download/vip-bike-qr-rent-deeplinks.pdf';
const STORE_PATH = 'vip-bike-qr/vip-bike-qr-rent-deeplinks.pdf';
const CHAT_ID = 413553377; // salavey13

// 1) upload (upsert)
const buf = readFileSync(PDF_PATH);
const up = await sb.storage.from('carpix').upload(STORE_PATH, buf, {
  contentType: 'application/pdf',
  upsert: true,
});
if (up.error) { console.error('UPLOAD ERROR:', up.error.message); process.exit(1); }
const pub = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/carpix/${STORE_PATH}`;
console.log('UPLOADED:', pub);

// 2) head-check the public URL
const head = await fetch(pub, { method: 'HEAD' });
console.log('HEAD:', head.status, head.headers.get('content-type'), head.headers.get('content-length'));

// 3) caption
const caption = [
  '<b>Готово: QR-коды на все 32 байка VIP-BIKE — один PDF</b>',
  '',
  'Каждый QR ведёт сразу в форму аренды конкретного байка:',
  '<code>t.me/oneBikePlsBot/app?startapp=rent_{bikeId}</code>',
  'роутер (useStartParamRouter) резолвит id → <code>/franchize/vip-bike?vehicle=…&amp;flow=rent</code>',
  '',
  'Внутри: обложка с форматом ссылки + по странице на байк: крупный QR, фото, цена/сутки, пробег, VIN, мотор.',
  'Скрытые из каталога тоже в комплекте и помечены.',
  '',
  'Пользоваться: распечатать страницу и приклеить на байк/стенд — камера телефона открывает бота, байк уже выбран.',
  '',
  'P.S. вариант <code>rent_cbr600rr_2003</code> не сработал бы: парсер режет payload по первому «_», правильный синтаксис — id байка с дефисами, как в базе (<code>rent_honda-cbr600rr-2003</code>).',
  '',
  'PDF также в репо: docs/vip-bike-qr-rent-deeplinks.pdf',
].join('\n');
console.log('caption chars:', caption.length);

// 4) sendDocument by URL (no body limit)
const res = await fetch('https://v0-car-test.vercel.app/api/forward-telegram', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: 'https://v0-car-test.vercel.app' },
  body: JSON.stringify({
    chat_id: CHAT_ID,
    method: 'sendDocument',
    payload: { document: pub, caption, parse_mode: 'HTML' },
  }),
});
const j = await res.json();
console.log('SEND:', res.status, JSON.stringify(j).slice(0, 400));
if (!j.ok) process.exit(2);
console.log('✓ message_id', j.result?.message_id);
