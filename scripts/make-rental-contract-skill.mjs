#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { Document, Packer, Paragraph, TextRun } from 'docx';

function arg(name, fallback = '') { const i = process.argv.indexOf(`--${name}`); return i>=0 ? (process.argv[i+1]||'') : fallback; }

const RENTAL_DOC_TEMPLATE_MODE = String(process.env.RENTAL_DOC_TEMPLATE_MODE || 'md').trim().toLowerCase();
const RENTAL_DOC_BASELINE_TEMPLATE_PATH = 'docs/RENTAL_DEAL_TEMPLATE.md';
const RENTAL_DOC_HTML_TEMPLATE_PATH = 'docs/RENTAL_DEAL_TEMPLATE.html';

function renderTemplateWithVars(template, vars) {
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_,k)=> String(vars[k] ?? ''));
}

function renderHtmlTemplateAdapter(htmlTemplate, vars) {
  const renderedHtml = renderTemplateWithVars(htmlTemplate, vars);
  const text = renderedHtml
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*\/p\s*>/gi, '\n\n')
    .replace(/<\s*\/tr\s*>/gi, '\n')
    .replace(/<\s*\/t[dh]\s*>/gi, '\t')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&laquo;/g, '«')
    .replace(/&raquo;/g, '»')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&amp;/g, '&')
    .trim();

  if (!text) {
    throw new Error('HTML adapter produced empty output');
  }

  return text;
}

function failStage(stage, reason, details = {}) {
  const payload = { ok: false, stage, reason, details };
  console.error(JSON.stringify(payload, null, 2));
  process.exit(2);
}

function formatRuDate(d) {
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
}

function parseRuTime(raw) {
  const m = String(raw).match(/(\d{1,2})(?:[:.]?(\d{2}))?/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2] || '00');
  if (hh > 23 || mm > 59) return null;
  return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
}

function extractScheduleFromPhrase(rawPhrase) {
  const text = String(rawPhrase || '').toLowerCase();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);

  const start = text.match(/с\s*(сегодня|завтра|\d{1,2}\.\d{1,2}(?:\.\d{2,4})?)\s*(?:в)?\s*(\d{1,2}(?:[:.]\d{2})?)/i);
  const end = text.match(/до\s*(завтра|сегодня|\d{1,2}\.\d{1,2}(?:\.\d{2,4})?)\s*(?:до|в)?\s*(\d{1,2}(?:[:.]\d{2})?)/i);

  const parseDateToken = (token) => {
    const t = String(token || '').toLowerCase();
    if (t === 'сегодня') return formatRuDate(today);
    if (t === 'завтра') return formatRuDate(tomorrow);
    const parts = t.split('.').map(v=>v.trim()).filter(Boolean);
    if (parts.length < 2) return null;
    let [d,m,y] = parts;
    if (!y) y = String(today.getFullYear());
    if (y.length === 2) y = `20${y}`;
    return `${d.padStart(2,'0')}.${m.padStart(2,'0')}.${y}`;
  };

  return {
    startDate: start ? parseDateToken(start[1]) : null,
    startTime: start ? parseRuTime(start[2]) : null,
    endDate: end ? parseDateToken(end[1]) : null,
    endTime: end ? parseRuTime(end[2]) : null,
  };
}

const phrase = arg('phrase');
const bikePhraseRaw = (phrase.match(/(?:сделай\s+договор(?:\s+по\s+фото)?|создай\s+документ(?:\s+по\s+фото)?)\s+(.+)$/i)?.[1] || arg('bikeId')).trim();
const bikeId = bikePhraseRaw.split(/\s+с\s+(?:сегодня|завтра|\d{1,2}\.\d{1,2}(?:\.\d{2,4})?)/i)[0].trim();
if (!bikeId) failStage('bike_resolve', 'missing_bike_query', { expected: 'Use --phrase "создай документ <bike_id>" (or "сделай договор <bike_id>") or --bikeId <bike_id>' });

const passportJson = JSON.parse(readFileSync(arg('passportJson'),'utf8'));
const licenseJson = JSON.parse(readFileSync(arg('licenseJson'),'utf8'));
const telegramChatId = arg('telegramChatId', process.env.ADMIN_CHAT_ID || '');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const supabaseRestSelect = (from, to) => {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !serviceKey) {
    throw new Error('Supabase env is missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  const url = `${baseUrl}/rest/v1/cars?select=id,make,model,specs,type&type=in.(bike,ebike)&offset=${from}&limit=${to - from + 1}`;
  const curl = spawnSync('curl', ['-sS', url, '-H', `apikey: ${serviceKey}`, '-H', `Authorization: Bearer ${serviceKey}`], {
    encoding: 'utf8',
  });

  if (curl.status !== 0) {
    throw new Error(`Supabase REST fallback failed: ${curl.stderr || curl.stdout}`);
  }

  return JSON.parse(curl.stdout || '[]');
};


const norm = (v='') => String(v).toLowerCase().replace(/[^a-zа-я0-9]+/gi,' ').trim();
const scoreBike = (q, bike) => {
  const hay = [bike.id, bike.make, bike.model, bike.specs?.vin, bike.specs?.frame].map(norm).join(' ');
  const qn = norm(q);
  if (!qn) return 0;
  if (hay.includes(qn)) return 1000 + qn.length;
  const parts = qn.split(' ').filter(Boolean);
  let score = 0;
  for (const p of parts) if (hay.includes(p)) score += 20 + p.length;
  // fuzzy subsequence bonus for compact ids like falcon gt / falcon-gt-2025
  const compactHay = hay.replace(/\s+/g, '');
  const compactQ = qn.replace(/\s+/g, '');
  let i = 0;
  for (const ch of compactQ) { const j = compactHay.indexOf(ch, i); if (j >= 0) { score += 1; i = j + 1; } }
  return score;
};

const fetchAllBikeCandidates = async () => {
  const pageSize = 1000;
  let from = 0;
  const all = [];

  while (true) {
    const to = from + pageSize - 1;
    let data = null;
    let error = null;

    try {
      const response = await supabase
        .from('cars')
        .select('id,make,model,specs,type')
        .in('type', ['bike', 'ebike'])
        .range(from, to);
      data = response.data;
      error = response.error;
    } catch (networkError) {
      data = supabaseRestSelect(from, to);
    }

    if (error) {
      const errorText = String(error?.message || error);
      if (/fetch failed/i.test(errorText)) {
        data = supabaseRestSelect(from, to);
      } else {
        throw error;
      }
    }
    if (!data?.length) break;

    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return all;
};

const bikes = await fetchAllBikeCandidates();
if (!bikes.length) failStage('bike_resolve', 'bike_catalog_empty', { table: 'cars', filter: 'type in (bike, ebike)' });
const ranked = bikes.map(b => ({ bike: b, score: scoreBike(bikeId, b) })).sort((a,b)=>b.score-a.score);
const top = ranked[0];
if (!top || top.score <= 0) failStage('bike_resolve', 'bike_not_found', { bikeQuery: bikeId });
const bike = top.bike;

const mdTemplate = readFileSync(RENTAL_DOC_BASELINE_TEMPLATE_PATH, 'utf8');
const now = new Date();
const phraseSchedule = extractScheduleFromPhrase(phrase);
const startDate = arg('startDate', phraseSchedule.startDate || '');
const endDate = arg('endDate', phraseSchedule.endDate || '');
const renterFullName = String(passportJson.fullName || '').trim();
const renterBirthDate = String(passportJson.birthDate || '').trim();
const renterPassportSeries = String(passportJson.series || '').trim();
const renterPassportNumber = String(passportJson.number || '').trim();
const renterLicenseSeries = String(licenseJson.series || '').trim();
const renterLicenseNumber = String(licenseJson.number || '').trim();

if (!renterFullName) failStage('renter_parse', 'missing_full_name');
if (!renterBirthDate) failStage('renter_parse', 'missing_birth_date');
if (!renterPassportSeries || !renterPassportNumber) failStage('renter_parse', 'missing_passport_data');
if (!renterLicenseSeries || !renterLicenseNumber) failStage('renter_parse', 'missing_driver_license_data');
if (!startDate || !endDate) failStage('rental_dates', 'missing_rental_dates', { hint: 'Pass --startDate/--endDate or include explicit dates in phrase.' });

const vars = {
  contract_number: `${now.getDate()}.${now.getMonth()+1}/${bike.id}`,
  day: String(now.getDate()).padStart(2,'0'),
  month: now.toLocaleString('ru-RU',{month:'long'}),
  month_num: String(now.getMonth()+1).padStart(2,'0'),
  year: String(now.getFullYear()),
  renter_full_name: renterFullName,
  renter_birth_date: renterBirthDate,
  renter_phone: passportJson.phone || '',
  renter_driver_license: `${renterLicenseSeries} ${renterLicenseNumber}`.trim(),
  renter_passport: `${renterPassportSeries} ${renterPassportNumber}`.trim(),
  bike_make_model: `${bike.make||''} ${bike.model||''}`.trim(),
  bike_make: bike.make || 'уточняется',
  bike_model: bike.model || 'уточняется',
  bike_plate: bike.specs?.plate || 'уточняется',
  bike_vin: bike.specs?.vin || bike.specs?.frame || bike.specs?.vin_number || 'уточняется',
  bike_category: bike.specs?.category || bike.specs?.tp_category || 'A/L3',
  bike_color: bike.specs?.color || 'уточняется',
  bike_year: bike.specs?.year || bike.specs?.production_year || 'уточняется',
  bike_engine_cc: bike.specs?.engine_cc || bike.specs?.displacement_cc || '0',
  bike_power_hp: bike.specs?.power_hp || bike.specs?.max_power_hp || '0',
  rent_start_time: arg('startTime', phraseSchedule.startTime || '18:00'), rent_start_date: startDate,
  rent_end_time: arg('endTime', phraseSchedule.endTime || '10:00'), rent_end_date: endDate,
  daily_price_rub: arg('dailyPrice','10000'), subtotal_rub: arg('subtotal','20000'), deposit_rub: arg('deposit','20000'),
  included_mileage:'200', overage_rate:'35', included_km_per_day:'200', extra_km_fee_rub:'35', late_return_penalty_rub:'10000', late_return_penalty_max_days:'90', bike_value_rub:'850000', bike_value_words:'Восемьсот пятьдесят тысяч',
  return_address:'г. Нижний Новгород, пл. Комсомольская 2', issuer_name:'Воробьев Р.В.', issuer_signatory:'Менеджер Мотосалона', issuer_representative:'ИП Воробьев Р.В.', signature_timestamp: now.toLocaleString('ru-RU'), signature_fingerprint:'offline-skill', renter_signature:'согласие через Telegram', bike_mileage: String(bike.specs?.mileage||''), equipment:'ключ(и) 1 шт.; шлем 1', damage_notes_at_delivery:'от даты начала аренды', damage_notes_at_return:'от даты возврата тс', battery_level_start:'100 %', battery_level_end:'____ %', media_links:'телефон', renter_passport_issue_date: passportJson.issueDate || '', renter_registration: passportJson.registration || '', damage_price_list:'мотоцикл в сборе / царапина на пластике / прочее по расчету', document_key:`rental-${bike.id}-${Date.now()}`
};
let rendered;
if (RENTAL_DOC_TEMPLATE_MODE === 'html') {
  try {
    const htmlTemplate = readFileSync(RENTAL_DOC_HTML_TEMPLATE_PATH, 'utf8');
    rendered = renderHtmlTemplateAdapter(htmlTemplate, vars);
  } catch (error) {
    console.warn(`[rental-doc] html render failed, fallback to md: ${String(error?.message || error)}`);
    rendered = renderTemplateWithVars(mdTemplate, vars);
  }
} else {
  rendered = renderTemplateWithVars(mdTemplate, vars);
}

const doc = new Document({sections:[{children: rendered.split('\n').map(line=>new Paragraph({children:[new TextRun(line)]}))}]});
const buf = await Packer.toBuffer(doc);
const originalSha256 = createHash('sha256').update(buf).digest('hex');

const token = process.env.TELEGRAM_BOT_TOKEN;
const telegramUrl = `https://api.telegram.org/bot${token}/sendDocument`;
let json;
try {
  const form = new FormData();
  form.append('chat_id', telegramChatId);
  form.append('document', new Blob([buf], {type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}), `rental-contract-${bikeId}.docx`);
  const res = await fetch(telegramUrl, {method:'POST', body: form});
  json = await res.json();
} catch (networkError) {
  const tmpFile = `/tmp/rental-contract-${Date.now()}.docx`;
  await import('node:fs/promises').then(fs => fs.writeFile(tmpFile, buf));
  const curl = spawnSync('curl', ['-sS', '-X', 'POST', telegramUrl, '-F', `chat_id=${telegramChatId}`, '-F', `document=@${tmpFile}`], { encoding: 'utf8' });
  if (curl.status !== 0) throw new Error(`Telegram curl send failed: ${curl.stderr || curl.stdout}`);
  json = JSON.parse(curl.stdout || '{}');
}
if (!json.ok) failStage('telegram_delivery', 'telegram_send_failed', { telegram: json });

const result = {ok:true, requestedBikeId: bikeId, resolvedBikeId: bike.id, chatId: telegramChatId, messageId: json.result?.message_id, contractKey: vars.document_key};
const saveMetadata = arg('saveMetadata', '0') !== '0';
const metadataTable = arg('metadataTable', 'rental_contract_artifacts');
if (saveMetadata) {
  const payload = {
    contract_key: vars.document_key,
    requested_bike_id: bikeId,
    resolved_bike_id: bike.id,
    telegram_chat_id: telegramChatId,
    telegram_message_id: json.result?.message_id || null,
    renter_full_name: renterFullName,
    rent_start_date: startDate,
    rent_end_date: endDate,
    original_sha256: originalSha256,
  };
  const writeRes = await supabase.from(metadataTable).insert(payload).select('contract_key').limit(1);
  if (writeRes.error) failStage('metadata_write', 'metadata_write_failed', { table: metadataTable, error: writeRes.error.message });
  const verifyRes = await supabase.from(metadataTable).select('contract_key').eq('contract_key', vars.document_key).maybeSingle();
  if (verifyRes.error || !verifyRes.data?.contract_key) {
    failStage('metadata_verify', 'read_after_write_verification_failed', { table: metadataTable, contractKey: vars.document_key, error: verifyRes.error?.message || null });
  }
  result.metadataVerified = true;
  result.metadataTable = metadataTable;
}

console.log(JSON.stringify(result, null, 2));
