// iter15 retro-fix: kawasaki rental e4791134 (order-mtbnsf97-zukmfy)
// 1. rentals: total 12000 + metadata (deposit 20000 card/tbank, split, equipment+gift note, odometer hint 7977)
// 2. private.rental_contract_artifacts: backfill row linked to the rental (original docx from storage)
// 3. rentals.metadata.doc_sha256/document_key ← original doc identity (page download + QR)
// 4. upload signed preview docx to storage
// 5. send signed preview to salavey13 via deployed forward-telegram API
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });
const PRIV = { headers: { 'Accept-Profile': 'private', 'Content-Profile': 'private' } };

const RENTAL_ID = 'e4791134-de27-4ca0-a782-9408137599dc';
const ORIG_KEY = 'rental-kawasaki-ex650k-1787843586484';
const ORIG_PATH = `vip-bike/${ORIG_KEY}.docx`;
const PREVIEW_LOCAL = '/home/z/my-project/download/rental-kawasaki-ex650k-2026-08-27-signed-preview.docx';
const PREVIEW_PATH = 'vip-bike/rental-kawasaki-ex650k-signed-preview.docx';
const USER_CHAT = '413553377'; // salavey13

// ── 1. Download original docx, compute sha256 ──────────────────────────────
const { data: origBlob, error: dlErr } = await sb.storage.from('rental-contracts').download(ORIG_PATH);
if (dlErr || !origBlob) { console.error('download original failed:', dlErr?.message); process.exit(1); }
const origBuf = Buffer.from(await origBlob.arrayBuffer());
const origSha = createHash('sha256').update(origBuf).digest('hex');
console.log('original docx:', origBuf.length, 'bytes, sha256', origSha.slice(0, 12));

// ── 2. Fetch current rental row ─────────────────────────────────────────────
const { data: rent } = await sb.from('rentals').select('metadata,total_cost').eq('rental_id', RENTAL_ID).single();
if (!rent) { console.error('rental not found'); process.exit(1); }
const md = rent.metadata || {};

// ── 3. Backfill artifact row (idempotent) ───────────────────────────────────
const existing = await fetch(`${SB_URL}/rest/v1/rental_contract_artifacts?rental_id=eq.${RENTAL_ID}&select=id`, {
  headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Accept-Profile': 'private' },
}).then(r => r.json());
if (Array.isArray(existing) && existing.length) {
  console.log('artifact already exists:', existing[0].id);
} else {
  const insertRes = await fetch(`${SB_URL}/rest/v1/rental_contract_artifacts`, {
    method: 'POST',
    headers: {
      apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
      'Accept-Profile': 'private', 'Content-Profile': 'private',
      'Content-Type': 'application/json', Prefer: 'return=representation',
    },
    body: JSON.stringify({
      contract_key: ORIG_KEY,
      crew_slug: 'vip-bike',
      rental_id: RENTAL_ID,
      storage_path: ORIG_PATH,
      original_sha256: origSha,
      requested_bike_id: null,
      resolved_bike_id: 'kawasaki-ex650k',
      telegram_chat_id: '1062465800',
      telegram_message_id: null,
      renter_full_name: 'Андрей Жиляев',
      renter_phone: '+79144626758',
      renter_passport: '7617 962766',
      renter_passport_issued_by: 'МП УФМС РОССИИ ПО ЗАБАЙКАЛЬСКОМУ КРАЮ В НЕРЧИНСКОМ РАЙОНЕ',
      renter_passport_issue_date: '04.10.2017',
      renter_registration: 'Забайкальский край, г. Нерчинск, ул. Красноармейская, д. 88, кв. 43',
      renter_driver_license: '9922 119493',
      renter_birth_date: '03.09.1997',
      license_categories: 'А, В',
      rent_start_date: '2026-08-27',
      rent_end_date: '2026-08-28',
      daily_price: '10000',
      deposit_rub: '20000',
      total_sum: '12000',
      template_version: 1,
    }),
  });
  const body = await insertRes.text();
  console.log('artifact insert:', insertRes.status, body.slice(0, 1200));
}

// ── 4. Update rentals row (idempotent merge) ────────────────────────────────
const historyEntry = { at: new Date().toISOString(), by: USER_CHAT, status: 'iter15_retrofix', message: 'Депозит 20 000 ₽ (карта Т-Банк), итого 12 000 ₽ (шлем ×2), куртка и перчатки — в подарок' };
const newMeta = {
  ...md,
  total_cost_override: 12000,
  price_overridden: true,
  price_override_amount: 12000,
  deposit_amount: 20000,
  deposit_rub: 20000,
  deposit_method: 'card',
  payment_split: { bank: 10000, cash: 0, card_destination: 'tbank' },
  deposit_notes: '20 000 ₽ картой (Т-Банк)',
  equipment: { bag: false, net: false, boots: false, gloves: 1, jacket: true, charger: 1, helmets: 2, backpack: false },
  equipment_gift_note: 'Куртка и перчатки — в подарок',
  last_known_odometer: 7977,
  odometer_before_hint: 7977,
  doc_sha256: origSha,
  document_key: ORIG_KEY,
  retrofix_note: 'iter15: deposit 500→20000 (was crew reservation hold, not deposit), total 10000→12000 (2 helmets), gift note added, odometer hint 7977 from specs, artifact backfilled',
  history: [...(Array.isArray(md.history) ? md.history : []), historyEntry],
};
const { error: updErr } = await sb.from('rentals').update({
  total_cost: 12000,
  metadata: newMeta,
}).eq('rental_id', RENTAL_ID);
console.log('rental update:', updErr ? 'ERR ' + updErr.message : 'ok (total_cost=12000, meta merged)');

// ── 5. Upload signed preview docx ───────────────────────────────────────────
const previewBuf = readFileSync(PREVIEW_LOCAL);
const { error: upErr } = await sb.storage.from('rental-contracts').upload(PREVIEW_PATH, previewBuf, {
  contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  upsert: true,
});
console.log('preview upload:', upErr ? 'ERR ' + upErr.message : `ok → ${PREVIEW_PATH}`);

// ── 6. Send preview to the user via deployed forward-telegram ───────────────
const SITE = process.env.FORWARD_SITE || 'https://rental.vip-bike.ru';
try {
  const resp = await fetch(`${SITE}/api/forward-telegram`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://nnvolt.ru' },
    body: JSON.stringify({
      chat_id: USER_CHAT,
      method: 'sendDocument',
      payload: {
        caption:
          '🧾 Kawasaki EX650K — договор с ПЭП (тестовый предпросмотр)\n' +
          '• Итого: 12 000 ₽ (байк 10 000 + шлем ×2 — 2 000)\n' +
          '• Куртка и перчатки — в подарок 🎁\n' +
          '• Депозит: 20 000 ₽ (карта, Т-Банк)\n' +
          '• ПЭП: подписано (Telegram ID 1062465800)\n' +
          'Аренда: https://t.me/oneBikePlsBot/app?startapp=rental_e4791134-de27-4ca0-a782-9408137599dc',
        parse_mode: 'HTML',
      },
      files: {
        document: {
          data: previewBuf.toString('base64'),
          filename: 'rental-kawasaki-ex650k-2026-08-27-signed-preview.docx',
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        },
      },
    }),
  });
  const txt = await resp.text();
  console.log('tg send:', resp.status, txt.slice(0, 300));
} catch (e) {
  console.log('tg send failed (non-fatal, file is in download/):', e.message);
}
