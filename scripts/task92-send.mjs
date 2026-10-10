// Task 92: deliver tutorial PDF via forward-telegram (photo TL;DR + document by URL)
// run: node --env-file=.env.local scripts/task92-send.mjs
import { readFileSync } from 'node:fs';

const FORWARD_URL = process.env.FORWARD_TELEGRAM_URL || 'https://v0-car-test.vercel.app/api/forward-telegram';
const FORWARD_ORIGIN = process.env.FORWARD_TELEGRAM_ORIGIN || 'https://v0-car-test.vercel.app';
const PDF_URL = 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/tutorials/vip-bike-kak-arendovat-2026-10.pdf';
const PIC = '/home/z/cartest/task92-tutorial/task92-tg-notify.png';

const RECIPIENTS = [{ chat: '413553377', who: 'salavey13 (Paul)' }];

const TLDR = [
  '📘 <b>VIP BIKE: инструкция для райдера — «Как арендовать мотоцикл через приложение»</b>',
  '',
  'Сделал печатный туториал на русском по веб-приложению:',
  '• 🗺 8 шагов с живыми экранами: каталог → даты → экипировка → корзина → паспорт и права → договор DOCX + ПЭП → фото/одометр → активация',
  '• 📱 Скриншоты сняты с боевой сборки (мобайл-вид), демо-заказ Kawasaki с тестовым райдером — после съёмки из базы удалю',
  '• 🖨 A4, светлая печатная палитра: белая бумага, чернила, золото; обложка и финал — на уровне каталога',
  '• 📄 Внутри: как выглядит договор, сообщение бота с deeplink-кнопками, таблица статусов аренды, QR-стикер, контакты и ЧаВо',
  '',
  'PDF: ' + PDF_URL,
  '',
  'Готов к печати и к отправке клиентам — можно кидать ссылкой из бота или распечатать и положить на стойку.',
].join('\n');

const DOC_CAPTION = '📘 Туториал «Как арендовать мотоцикл через приложение» — 13 стр., A4, печать. HTML-исходник — рядом в репо (docs/).';

console.log(`TLDR chars: ${[...TLDR].length} (limit 1024)`);
if ([...TLDR].length > 1024) { console.error('TLDR too long'); process.exit(1); }

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
    const picB64 = readFileSync(PIC).toString('base64');
    let r = await forward(chat, 'sendPhoto', { caption: TLDR, parse_mode: 'HTML' },
      { photo: { data: picB64, filename: 'vip-bike-tutorial-2026-10.png', contentType: 'image/png' } });
    const photoOk = r.json?.ok === true;
    console.log(`${who} (${chat}) photo: HTTP ${r.status} ok=${photoOk} id=${r.json?.result?.message_id ?? '-'}${photoOk ? '' : ' body=' + JSON.stringify(r.json).slice(0, 200)}`);
    if (!photoOk) fails.push(`${who}:photo`);

    r = await forward(chat, 'sendDocument', { document: PDF_URL, caption: DOC_CAPTION, parse_mode: 'HTML' }, {});
    const docOk = r.json?.ok === true;
    console.log(`${who} (${chat}) doc:   HTTP ${r.status} ok=${docOk} id=${r.json?.result?.message_id ?? '-'}${docOk ? '' : ' body=' + JSON.stringify(r.json).slice(0, 200)}`);
    if (!docOk) fails.push(`${who}:doc`);
  } catch (e) {
    console.error(`${who} FAILED:`, e.message);
    fails.push(`${who}:${e.message}`);
  }
}
console.log(fails.length ? `DELIVERY INCOMPLETE: ${fails.join(', ')}` : 'DELIVERED: Paul got photo + TL;DR + PDF');
process.exit(fails.length ? 1 : 0);
