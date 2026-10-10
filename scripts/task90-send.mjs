// Task 90: upload QR catalogue PDF to Supabase storage + deliver via
// forward-telegram (photo w/ TL;DR + document by URL) to Paul, I_O_S_NN, DJORUDJOV.
// Run: node --env-file=.env.local scripts/task90-send.mjs
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const PDF = '/home/z/my-project/download/vip-bike-qr-catalogue-2026-10.pdf';
const PIC = '/home/z/my-project/download/task90-catalogue-cover.png';
const STORE_PATH = 'vip-bike-qr/vip-bike-qr-catalogue-2026-10.pdf';
const FORWARD_URL = process.env.FORWARD_TELEGRAM_URL || 'https://v0-car-test.vercel.app/api/forward-telegram';
const FORWARD_ORIGIN = process.env.FORWARD_TELEGRAM_ORIGIN || 'https://v0-car-test.vercel.app';

// salavey13 (Paul) · I_O_S_NN (owner) · DJORUDJOV (admin) — Roman НЕ заказан
const RECIPIENTS = [
  { chat: '413553377', who: 'salavey13 (Paul)' },
  { chat: '356282674', who: 'I_O_S_NN' },
  { chat: '7813830016', who: 'DJORUDJOV' },
];

const TLDR = [
  '📄 <b>VIP-BIKE: каталог QR-кодов — аренда + продажа, 59 страниц</b>',
  '',
  'Собрал все QR по всем 32 байкам в один печатный каталог и разложил по полкам:',
  '• ⚡ Электро · аренда — 14 (стр. 3–17)',
  '• ⚡ Электро · продажа — 17 (стр. 18–35)',
  '• ⛽ Бензин · аренда — 15 (стр. 36–51)',
  '• ⛽ Бензин · продажа — 7 (стр. 52–59)',
  '',
  'Каждая страница = байк: крупный QR, фото, цена, пробег/VIN/характеристики. QR аренды (<code>rent_…</code>) ведёт сразу в форму аренды, QR продажи (<code>sale_…</code>) — в карточку покупки. Байки, которые и сдаются, и продаются, живут в обоих разделах — с правильным QR под каждый поток.',
  '',
  '🎨 Палитра под печать: белые страницы, тёмный текст и зелёный/бронзовый акценты — тонер экономит, контраст не пострадал. Все 54 QR проверены сканером.',
  '',
  'Пользоваться: распечатать страницу и приклеить на байк/стенд — камера телефона открывает бота с уже выбранным байком.',
].join('\n');

const DOC_CAPTION = '📎 Каталог целиком (59 стр.): обложка с общим входом, содержание с диапазонами страниц, 4 раздела с разделителями. Черно-золотая версия прошлого выпуска тоже актуальна, эта — для принтера.';

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
      { photo: { data: picB64, filename: 'vip-bike-qr-catalogue-2026-10.png', contentType: 'image/png' } });
    const photoOk = r.json?.ok === true;
    console.log(`${who} (${chat}) photo: HTTP ${r.status} ok=${photoOk} id=${r.json?.result?.message_id ?? '-'}${photoOk ? '' : ' body=' + JSON.stringify(r.json).slice(0, 200)}`);
    if (!photoOk) fails.push(`${who}:photo`);

    r = await forward(chat, 'sendDocument', { document: pub, caption: DOC_CAPTION, parse_mode: 'HTML' }, {});
    const docOk = r.json?.ok === true;
    console.log(`${who} (${chat}) doc:   HTTP ${r.status} ok=${docOk} id=${r.json?.result?.message_id ?? '-'}${docOk ? '' : ' body=' + JSON.stringify(r.json).slice(0, 200)}`);
    if (!docOk) fails.push(`${who}:doc`);
  } catch (e) {
    console.log(`${who} (${chat}): FAILED — ${e.message}`);
    fails.push(`${who}:${e.message}`);
  }
  await new Promise((res) => setTimeout(res, 1200));
}
console.log(fails.length ? `✗ FAILS: ${fails.join(', ')}` : '✓ all delivered');
process.exit(fails.length ? 2 : 0);
