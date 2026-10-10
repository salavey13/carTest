// Task 91: upload QR catalogue v2 (landscape) to Supabase storage + deliver via
// forward-telegram (photo w/ TL;DR + document by URL) to Paul, I_O_S_NN, DJORUDJOV.
// Run: node --env-file=.env.local scripts/task91-send.mjs
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const PDF = '/home/z/my-project/download/vip-bike-qr-catalogue-2026-10-v2.pdf';
const PIC = '/home/z/my-project/download/task91-catalogue-cover.png';
const STORE_PATH = 'vip-bike-qr/vip-bike-qr-catalogue-2026-10-v2.pdf';
const FORWARD_URL = process.env.FORWARD_TELEGRAM_URL || 'https://v0-car-test.vercel.app/api/forward-telegram';
const FORWARD_ORIGIN = process.env.FORWARD_TELEGRAM_ORIGIN || 'https://v0-car-test.vercel.app';
const CREW = '2d5fde70-1dd3-4f0d-8d72-66ccf6908746';

// salavey13 (Paul) · I_O_S_NN (owner) · DJORUDJOV (admin) — Roman НЕ заказан
const RECIPIENTS = [
  { chat: '413553377', who: 'salavey13 (Paul)' },
  { chat: '356282674', who: 'I_O_S_NN' },
  { chat: '7813830016', who: 'DJORUDJOV' },
];

const TLDR = [
  '📗 <b>VIP-BIKE: каталог v2 — альбомный, 29 страниц, сезон в цифрах</b>',
  '',
  'Переделал печатный каталог по замечаниям:',
  '• 📐 Альбомный A4 — <b>два байка на страницу</b>, фото 9:16 влезли целиком, без обрезки',
  '• 🙈 Скрытые байки <b>убраны</b> полностью (осталось 27 из 32)',
  '• 📊 На каждой карточке — <b>статы сезона-2026</b>: выезды, дни, выручка, райдеры',
  '• 🔧 Больше характеристик: мотор/батарея/ход у электро, КПП/бак/тормоза у бензина, залог и почасовая',
  '• 🎨 У разделов — общие фоны: мятный у электро, кремовый у бензина; аренда — заливка, продажа — контур',
  '• 🏷 Разделители 01–04 — уровня обложки: статы раздела, цены, список моделей со страницами',
  '',
  'Электро·аренда 11 (стр. 3–9), электро·продажа 14 (10–17), бензин·аренда 13 (18–25), бензин·продажа 6 (26–29). Двухпоточные — в обоих разделах, с кросс-ссылками.',
  '',
  'Все 44 QR проверены сканером — каждый ведёт в свой поток. Печать экономная: белая бумага, светлые заливки.',
].join('\n');

const DOC_CAPTION = '📎 Каталог v2 (29 стр., альбомный): обложка с демо-QR и цифрами сезона, содержание, 4 раздела с разделителями, 2 байка на страницу. Версия 2026-10 (портретная) тоже актуальна, эта — улучшенная.';

const tldrLen = [...TLDR].length;
console.log(`TLDR chars: ${tldrLen} (limit 1024)`);
if (tldrLen > 1024) { console.error('TLDR too long'); process.exit(1); }

// 1) upload PDF
const buf = readFileSync(PDF);
const up = await sb.storage.from('carpix').upload(STORE_PATH, buf, { contentType: 'application/pdf', upsert: true });
if (up.error) { console.error('UPLOAD ERROR:', up.error.message); process.exit(1); }
const pub = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/carpix/${STORE_PATH}`;
const head = await fetch(pub, { method: 'HEAD' });
console.log('UPLOADED:', pub);
console.log('HEAD:', head.status, head.headers.get('content-type'), head.headers.get('content-length'));
if (head.status !== 200) process.exit(1);

// 1b) audit block (storage upload via service-role)
{
  const { data: crew } = await sb.from('crews').select('id, metadata').eq('id', CREW).single();
  const meta = crew?.metadata || {};
  meta.specs = meta.specs || {};
  meta.specs.owner_fix_20261011_catalogue_v2 = {
    applied_at: new Date().toISOString(),
    action: 'storage_upload',
    file: STORE_PATH,
    size_bytes: buf.length,
    pages: 29,
    qr_verified: '44/44 zxing',
    source: 'task91-make-catalogue.mjs',
    reason: 'boss: landscape 2-per-page, hidden bikes out, season stats, section backgrounds, premium dividers',
  };
  const { error: eUpd } = await sb.from('crews').update({ metadata: meta }).eq('id', CREW);
  console.log('AUDIT owner_fix_20261011_catalogue_v2:', eUpd ? 'FAILED ' + eUpd.message : 'written');
}

// 2) deliver
const picB64 = readFileSync(PIC).toString('base64');
async function forward(chatId, method, payload, files) {
  const resp = await fetch(FORWARD_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: FORWARD_ORIGIN },
    body: JSON.stringify({ chat_id: chatId, method, payload, files }),
    signal: AbortSignal.timeout(60000),
  });
  const text = await resp.text();
  try { return { status: resp.status, json: JSON.parse(text) }; }
  catch { return { status: resp.status, json: { ok: false, raw: text.slice(0, 200) } }; }
}

const fails = [];
for (const { chat, who } of RECIPIENTS) {
  try {
    let r = await forward(chat, 'sendPhoto', { caption: TLDR, parse_mode: 'HTML' },
      { photo: { data: picB64, filename: 'vip-bike-qr-catalogue-v2-2026-10.png', contentType: 'image/png' } });
    const photoOk = r.json?.ok === true;
    console.log(`${who} (${chat}) photo: HTTP ${r.status} ok=${photoOk} id=${r.json?.result?.message_id ?? '-'}${photoOk ? '' : ' body=' + JSON.stringify(r.json).slice(0, 200)}`);
    if (!photoOk) fails.push(`${who}:photo`);

    r = await forward(chat, 'sendDocument', { document: pub, caption: DOC_CAPTION, parse_mode: 'HTML' }, {});
    const docOk = r.json?.ok === true;
    console.log(`${who} (${chat}) doc:   HTTP ${r.status} ok=${docOk} id=${r.json?.result?.message_id ?? '-'}${docOk ? '' : ' body=' + JSON.stringify(r.json).slice(0, 200)}`);
    if (!docOk) fails.push(`${who}:doc`);
  } catch (e) {
    console.error(`${who} FAILED:`, e.message);
    fails.push(`${who}:${e.message}`);
  }
}

console.log(fails.length ? `DELIVERY INCOMPLETE: ${fails.join(', ')}` : 'DELIVERED: all 3 recipients got photo + TL;DR + PDF');
process.exit(fails.length ? 1 : 0);
