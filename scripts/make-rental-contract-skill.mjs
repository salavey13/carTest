#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { htmlToDocxElements } from '../lib/htmlToDocx.mjs';

function arg(name, fallback = '') { const i = process.argv.indexOf(`--${name}`); return i>=0 ? (process.argv[i+1]||'') : fallback; }

const RENTAL_DOC_TEMPLATE_MODE = String(process.env.RENTAL_DOC_TEMPLATE_MODE || 'md').trim().toLowerCase();
const RENTAL_DOC_BASELINE_TEMPLATE_PATH = 'docs/RENTAL_DEAL_TEMPLATE.md';
const RENTAL_DOC_HTML_TEMPLATE_PATH = 'docs/RENTAL_DEAL_TEMPLATE.html';
const RENTAL_TEMPLATE_VERSION_PATH = 'lib/rental-template-version.ts';

function readCurrentRentalTemplateVersion() {
  try {
    const source = readFileSync(RENTAL_TEMPLATE_VERSION_PATH, 'utf8');
    const match = source.match(/CURRENT_RENTAL_TEMPLATE_VERSION\s*=\s*(\d+)/);
    return match ? Number(match[1]) : 1;
  } catch {
    return 1;
  }
}

const CURRENT_RENTAL_TEMPLATE_VERSION = readCurrentRentalTemplateVersion();

function renderTemplateWithVars(template, vars) {
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_,k)=> String(vars[k] ?? ''));
}

/**
 * Legacy fallback: strip HTML tags and decode entities → plain text.
 * Used when the cheerio-based HTML→DOCX pipeline fails.
 */
function renderHtmlTemplateAdapterLegacy(htmlTemplate, vars) {
  const renderedHtml = renderTemplateWithVars(htmlTemplate, vars);
  return renderedHtml
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*\/p\s*>/gi, '\n\n')
    .replace(/<\s*\/div\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&laquo;/g, '\u00AB')
    .replace(/&raquo;/g, '\u00BB')
    .replace(/&ndash;/g, '\u2013')
    .replace(/&mdash;/g, '\u2014')
    .replace(/&amp;/g, '&')
    .trim();
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

  const url = `${baseUrl}/rest/v1/cars?select=id,make,model,specs,type,crew_id&type=in.(bike,ebike)&offset=${from}&limit=${to - from + 1}`;
  const curl = spawnSync('curl', ['-sS', url, '-H', `apikey: ${serviceKey}`, '-H', `Authorization: Bearer ${serviceKey}`], {
    encoding: 'utf8',
  });

  if (curl.status !== 0) {
    throw new Error(`Supabase REST fallback failed: ${curl.stderr || curl.stdout}`);
  }

  return JSON.parse(curl.stdout || '[]');
};

function supabaseRestRequest(pathAndQuery, { method = 'GET', body = null, prefer = '' } = {}) {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !serviceKey) {
    throw new Error('Supabase env is missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  const args = [
    '-sS',
    '-X', method,
    `${baseUrl}/rest/v1/${pathAndQuery}`,
    '-H', `apikey: ${serviceKey}`,
    '-H', `Authorization: Bearer ${serviceKey}`,
    '-H', 'Content-Type: application/json',
  ];
  if (prefer) args.push('-H', `Prefer: ${prefer}`);
  if (body) args.push('--data', JSON.stringify(body));

  const curl = spawnSync('curl', args, { encoding: 'utf8' });
  if (curl.status !== 0) {
    throw new Error(`Supabase REST request failed: ${curl.stderr || curl.stdout}`);
  }

  return JSON.parse(curl.stdout || '[]');
}

async function insertMetadataWithFallback(table, payload) {
  try {
    const response = await supabase.from(table).insert(payload).select('contract_key').limit(1);
    if (!response.error) return response;
    if (!/fetch failed/i.test(String(response.error?.message || response.error))) return response;
  } catch (error) {
    if (!/fetch failed/i.test(String(error?.message || error))) throw error;
  }

  const data = supabaseRestRequest(`${encodeURIComponent(table)}?select=contract_key`, {
    method: 'POST',
    body: payload,
    prefer: 'return=representation',
  });
  return { data, error: null };
}

async function verifyMetadataWithFallback(table, contractKey) {
  try {
    const response = await supabase.from(table).select('contract_key').eq('contract_key', contractKey).maybeSingle();
    if (!response.error) return response;
    if (!/fetch failed/i.test(String(response.error?.message || response.error))) return response;
  } catch (error) {
    if (!/fetch failed/i.test(String(error?.message || error))) throw error;
  }

  const query = `${encodeURIComponent(table)}?select=contract_key&contract_key=eq.${encodeURIComponent(contractKey)}&limit=1`;
  const data = supabaseRestRequest(query);
  return { data: data?.[0] || null, error: null };
}


const norm = (v='') => String(v).toLowerCase().replace(/[^a-zа-я0-9]+/gi,' ').trim();
const scoreBike = (q, bike) => {
  const hay = [bike.id, bike.make, bike.model, bike.specs?.vin, bike.specs?.frame].map(norm).join(' ');
  const qn = norm(q);
  if (!qn) return 0;
  if (hay.includes(qn)) return 1000 + qn.length;
  const parts = qn.split(' ').filter(Boolean);
  let score = 0;
  for (const p of parts) if (hay.includes(p)) score += 20 + p.length;
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
        .select('id,make,model,specs,type,crew_id')
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
let resolvedCrewSlug = arg('crewSlug', '');
if (!resolvedCrewSlug && bike.crew_id) {
  const { data: crewSlugRow, error: crewSlugError } = await supabase
    .from('crews')
    .select('slug')
    .eq('id', bike.crew_id)
    .maybeSingle();
  if (crewSlugError) {
    console.warn(`[make-rental-contract-skill] failed to resolve crew slug: ${crewSlugError.message}`);
  }
  resolvedCrewSlug = String(crewSlugRow?.slug || '').trim();
}

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

// ── Determine bike type: electric vs ICE ────────────────────────────
const isElectric = bike.type === 'ebike'
  || /electric/i.test(String(bike.specs?.type || ''))
  || /электро|electric|e-bike|ebike/i.test(String(bike.specs?.fuel_type || ''))
  || (bike.specs?.power_kw && Number(bike.specs.power_kw) > 0 && !bike.specs?.engine_cc)
  || (bike.specs?.battery && !bike.specs?.engine_cc);

// Vehicle type labels for template
const bike_vehicle_type_label   = isElectric ? 'ЭЛЕКТРОМОТОЦИКЛА' : 'МОТОЦИКЛА';
const bike_vehicle_type_accusative = isElectric ? 'электромотоцикл' : 'мотоцикл';
const bike_vehicle_type_genitive  = isElectric ? 'электромотоцикла' : 'мотоцикла';

// Engine spec lines: 3 lines, content depends on ICE vs electro
// For electro: power_kw, max_speed, battery
// For ICE: engine_cc + power_hp, max_speed, (blank — no battery)
const power_kw  = bike.specs?.power_kw || bike.specs?.nominal_power_kw || '';
const power_hp  = bike.specs?.power_hp || bike.specs?.max_power_hp || '';
const engine_cc = bike.specs?.engine_cc || bike.specs?.displacement_cc || '';
const maxSpeed  = bike.specs?.max_speed || bike.specs?.top_speed_kmh || '';
const battery   = bike.specs?.battery || bike.specs?.battery_type_capacity || '';

let bike_engine_spec_line_1, bike_engine_spec_line_2, bike_engine_spec_line_3;
if (isElectric) {
  bike_engine_spec_line_1 = power_kw  ? `мощность двигателя (номинальная) ${power_kw} кВт` : '';
  bike_engine_spec_line_2 = maxSpeed  ? `максимальная конструктивная скорость ${maxSpeed} км/ч` : '';
  bike_engine_spec_line_3 = battery   ? `аккумулятор: тип/ёмкость ${battery}` : '';
} else {
  // ICE: show engine displacement + power in HP on line 1, max speed on line 2, blank line 3
  const ccPart  = engine_cc ? `рабочий объем ${engine_cc} куб. см` : '';
  const hpPart  = power_hp  ? `мощность ${power_hp} л.с.` : '';
  bike_engine_spec_line_1 = [ccPart, hpPart].filter(Boolean).join(', ') || '';
  bike_engine_spec_line_2 = maxSpeed ? `максимальная конструктивная скорость ${maxSpeed} км/ч` : '';
  bike_engine_spec_line_3 = ''; // No battery for ICE
}

// ── Calculate rental duration and pricing ───────────────────────────
const startTimeArg = arg('startTime', phraseSchedule.startTime || '18:00');
const endTimeArg   = arg('endTime', phraseSchedule.endTime || '10:00');

// Parse dates to compute duration
function parseRuDateParts(dateStr) {
  const m = String(dateStr).match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return null;
  return { d: Number(m[1]), mo: Number(m[2])-1, y: Number(m[3]) };
}
function parseTimeToMinutes(timeStr) {
  const m = String(timeStr).match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

const startDP = parseRuDateParts(startDate);
const endDP   = parseRuDateParts(endDate);
let rentalHours = 0;
if (startDP && endDP) {
  const startMin = new Date(startDP.y, startDP.mo, startDP.d, 0, 0, 0).getTime() / 60000 + parseTimeToMinutes(startTimeArg);
  const endMin   = new Date(endDP.y, endDP.mo, endDP.d, 0, 0, 0).getTime() / 60000 + parseTimeToMinutes(endTimeArg);
  rentalHours = Math.max(0, Math.round((endMin - startMin) / 60 * 10) / 10); // round to 0.1h
}
const rentalDays = rentalHours > 0 ? Math.max(1, Math.ceil(rentalHours / 24)) : 1;
const isHourlyRental = rentalHours > 0 && rentalHours < 24;

// Pricing: explicit operator-provided CLI values win over catalog defaults.
// NOTE: price_rub is SALE price, NOT daily rental price. Use dailyPrice / rent_weekday for rental.
const explicitDailyPrice = arg('dailyPrice', '');
const explicitHourlyPrice = arg('hourlyPrice', '');
const explicitDeposit = arg('deposit', '');
const bikeDailyPrice = Number(explicitDailyPrice) > 0 ? explicitDailyPrice
  : Number(bike.specs?.dailyPrice) > 0 ? String(bike.specs.dailyPrice)
  : Number(bike.specs?.rent_weekday) > 0 ? String(bike.specs.rent_weekday)
  : '10000';
const bikeHourlyPrice = Number(explicitHourlyPrice) > 0 ? explicitHourlyPrice
  : Number(bike.specs?.price_per_hour) > 0 ? String(bike.specs.price_per_hour)
  : String(Math.round(Number(bikeDailyPrice) / 8));
const bikeDeposit = Number(explicitDeposit) > 0 ? explicitDeposit
  : Number(bike.specs?.deposit_rub) > 0 ? String(bike.specs.deposit_rub)
  : '20000';
// Bike value for loss/total-loss compensation = sale price or market price
const bikeValueRub = Number(bike.specs?.sale_price) > 0 ? String(bike.specs.sale_price)
  : Number(bike.specs?.price_rub) > 0 ? String(bike.specs.price_rub)
  : arg('bikeValue', '850000');

let subtotal;
if (isHourlyRental) {
  subtotal = Number(bikeHourlyPrice) * rentalHours;
} else {
  subtotal = Number(bikeDailyPrice) * rentalDays;
}
const subtotalRounded = Math.round(subtotal);

const vars = {
  contract_number: `${now.getDate()}.${now.getMonth()+1}/${bike.id}`,
  day: String(now.getDate()).padStart(2,'0'),
  month: now.toLocaleString('ru-RU',{month:'long'}),
  month_num: String(now.getMonth()+1).padStart(2,'0'),
  year: String(now.getFullYear()),
  renter_full_name: renterFullName,
  renter_birth_date: renterBirthDate,
  renter_phone: passportJson.phone || '',
  renter_email: passportJson.email || '',
  renter_address: passportJson.address || passportJson.registration || '',
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
  bike_engine_cc: engine_cc || '0',
  bike_power_hp: power_hp || '0',
  bike_power_kw: power_kw || '0',
  bike_max_speed: maxSpeed || 'уточняется',
  bike_battery: battery || (isElectric ? 'уточняется' : ''),
  // Dynamic vehicle type labels
  bike_vehicle_type_label,
  bike_vehicle_type_accusative,
  bike_vehicle_type_genitive,
  // Dynamic engine spec lines (3 lines, ICE vs electro)
  bike_engine_spec_line_1,
  bike_engine_spec_line_2,
  bike_engine_spec_line_3,
  rent_start_time: startTimeArg, rent_start_date: startDate,
  rent_end_time: endTimeArg, rent_end_date: endDate,
  // Pricing: hourly + daily + computed subtotal
  hourly_price_rub: bikeHourlyPrice,
  daily_price_rub: bikeDailyPrice,
  subtotal_rub: arg('subtotal', String(subtotalRounded)),
  deposit_rub: bikeDeposit,
  included_mileage:'200', overage_rate:'35', included_km_per_day:'200', extra_km_fee_rub:'35',
  late_return_penalty_rub: arg('latePenalty','10000'),
  late_return_penalty_max_days: arg('latePenaltyMaxDays','90'),
  bike_value_rub: bikeValueRub,
  bike_value_words: arg('bikeValueWords',''),
  return_address:'г. Нижний Новгород, пл. Комсомольская 2',
  lessor_address: arg('lessorAddress','г. Нижний Новгород'),
  issuer_name:'Воробьев Р.В.', issuer_signatory:'Менеджер Мотосалона', issuer_representative:'ИП Воробьев Р.В.',
  signature_timestamp: now.toLocaleString('ru-RU'), signature_fingerprint:'offline-skill', renter_signature:'согласие через Telegram',
  bike_mileage: String(bike.specs?.mileage||''),
  equipment:'ключ(и) 1 шт.; шлем 1',
  damage_notes_at_delivery:'от даты начала аренды', damage_notes_at_return:'от даты возврата тс',
  battery_level_start:'100 %', battery_level_end:'____ %',
  media_links:'телефон',
  renter_passport_issue_date: passportJson.issueDate || '', renter_registration: passportJson.registration || '',
  damage_price_list:'мотоцикл в сборе / царапина на пластике / прочее по расчету',
  document_key:`rental-${bike.id}-${Date.now()}`
};

// ── Build Document ──────────────────────────────────────────────────
let doc;

if (RENTAL_DOC_TEMPLATE_MODE === 'html') {
  let htmlTemplate;
  try {
    htmlTemplate = readFileSync(RENTAL_DOC_HTML_TEMPLATE_PATH, 'utf8');
  } catch (readError) {
    console.warn(`[rental-doc] html template read failed, fallback to md: ${String(readError?.message || readError)}`);
  }

  if (!htmlTemplate) {
    // Template file missing → MD fallback
    const rendered = renderTemplateWithVars(mdTemplate, vars);
    doc = new Document({sections:[{children: rendered.split('\n').map(line=>new Paragraph({children:[new TextRun({ text: line, font: 'Times New Roman' })]}))}]});
  } else {
    try {
      const renderedHtml = renderTemplateWithVars(htmlTemplate, vars);
      const children = htmlToDocxElements(renderedHtml);
      doc = new Document({
        sections: [{
          properties: {
            page: {
              margin: {
                top: 1134,    // 2 cm
                right: 1134,
                bottom: 1134,
                left: 1701,   // 3 cm (Russian GOST)
              },
            },
          },
          children,
        }],
      });
      console.error('[rental-doc] HTML\u2192DOCX: proper cheerio-based conversion (formatting preserved)');
    } catch (error) {
      // Fallback 1: legacy tag-stripping adapter (better than raw MD)
      console.warn(`[rental-doc] html\u2192docx failed, trying legacy adapter: ${String(error?.message || error)}`);
      try {
        const text = renderHtmlTemplateAdapterLegacy(htmlTemplate, vars);
        doc = new Document({sections:[{children: text.split('\n').map(line=>new Paragraph({children:[new TextRun({ text: line, font: 'Times New Roman' })]}))}]});
      } catch (e2) {
        // Fallback 2: raw MD template
        console.warn(`[rental-doc] legacy adapter also failed, falling back to md: ${String(e2?.message || e2)}`);
        const rendered = renderTemplateWithVars(mdTemplate, vars);
        doc = new Document({sections:[{children: rendered.split('\n').map(line=>new Paragraph({children:[new TextRun({ text: line, font: 'Times New Roman' })]}))}]});
      }
    }
  }
} else {
  // MD mode: plain text → simple paragraphs
  const rendered = renderTemplateWithVars(mdTemplate, vars);
  doc = new Document({sections:[{children: rendered.split('\n').map(line=>new Paragraph({children:[new TextRun({ text: line, font: 'Times New Roman' })]}))}]});
}

const buf = await Packer.toBuffer(doc);
const originalSha256 = createHash('sha256').update(buf).digest('hex');

// Build descriptive filename: rental-contract-Make-Model-DD.MM.YYYY.docx
const safeName = s => String(s || '').replace(/[^a-zA-Zа-яА-Я0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
const docFileName = `rental-contract-${safeName(bike.make)}-${safeName(bike.model)}-${startDate}.docx`;

// ── Generate QR Code PNG ─────────────────────────────────────
const qrDeepLink = `https://t.me/oneBikePlsBot/app?startapp=rent_${bike.id}_${originalSha256}`;
const qrPngUrl = `https://api.qrserver.com/v1/create-qr-code/?size=420x420&data=${encodeURIComponent(qrDeepLink)}&color=000000&bgcolor=ffffff&margin=1`;

let qrPngBuffer = null;
try {
  const qrRes = await fetch(qrPngUrl, { signal: AbortSignal.timeout(8000) });
  if (qrRes.ok) {
    qrPngBuffer = Buffer.from(await qrRes.arrayBuffer());
  }
} catch (qrErr) {
  console.warn('[rental-doc] QR generation failed, sending DOCX only:', qrErr?.message || qrErr);
}

// ── Send DOCX + QR via Telegram ──────────────────────────────
const token = process.env.TELEGRAM_BOT_TOKEN;
let json;

if (qrPngBuffer) {
  // Send DOCX + QR as a media group (album)
  const mediaGroupUrl = `https://api.telegram.org/bot${token}/sendMediaGroup`;
  const form = new FormData();
  form.append('chat_id', telegramChatId);

  // Media group items: [{type:"document", media:"attach://docx"}, {type:"photo", media:"attach://qr", caption:"..."}]
  const mediaItems = [
    { type: 'document', media: 'attach://docx', parse_mode: 'HTML' },
    { type: 'photo', media: 'attach://qr', caption: `📲 <b>QR для быстрой повторной аренды</b>\nНаведите камеру — данные заполнятся автоматически.\n\n🔗 ${qrDeepLink}`, parse_mode: 'HTML' },
  ];
  form.append('media', JSON.stringify(mediaItems));
  form.append('docx', new Blob([buf], {type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}), docFileName);
  form.append('qr', new Blob([qrPngBuffer], {type:'image/png'}), `qr-${bike.id}.png`);

  try {
    const res = await fetch(mediaGroupUrl, {method:'POST', body: form});
    const bodyText = await res.text();
    try {
      const results = JSON.parse(bodyText || '{}');
      if (!results.ok) throw new Error(results.description || 'sendMediaGroup failed');
      json = { ok: true, result: results.result?.[0] }; // first item = the document
    } catch (parseError) {
      // Media group sent but response parse failed — don't retry
      console.warn('[rental-doc] sendMediaGroup response parse issue, but message likely sent');
      json = { ok: true, result: { message_id: null } };
    }
  } catch (sendError) {
    // Fallback: send DOCX alone
    console.warn('[rental-doc] sendMediaGroup failed, falling back to sendDocument:', sendError?.message);
    qrPngBuffer = null; // Force fallback path
  }
}

if (!qrPngBuffer) {
  // Fallback: original sendDocument logic
  const telegramUrl = `https://api.telegram.org/bot${token}/sendDocument`;
  try {
    const form = new FormData();
    form.append('chat_id', telegramChatId);
    form.append('document', new Blob([buf], {type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}), docFileName);
    const res = await fetch(telegramUrl, {method:'POST', body: form});
    const bodyText = await res.text();
    try {
      json = JSON.parse(bodyText || '{}');
    } catch (parseError) {
      failStage('telegram_delivery', 'telegram_response_parse_failed_after_send', {
        status: res.status,
        bodyPreview: bodyText.slice(0, 500),
        error: String(parseError?.message || parseError),
      });
    }
  } catch (networkError) {
    const tmpFile = `/tmp/rental-contract-${Date.now()}.docx`;
    await import('node:fs/promises').then(fs => fs.writeFile(tmpFile, buf));
    const curl = spawnSync('curl', ['-sS', '-X', 'POST', telegramUrl, '-F', `chat_id=${telegramChatId}`, '-F', `document=@${tmpFile}`], { encoding: 'utf8' });
    if (curl.status !== 0) throw new Error(`Telegram curl send failed: ${curl.stderr || curl.stdout}`);
    try {
      json = JSON.parse(curl.stdout || '{}');
    } catch (parseError) {
      failStage('telegram_delivery', 'telegram_curl_response_parse_failed', {
        bodyPreview: String(curl.stdout || '').slice(0, 500),
        error: String(parseError?.message || parseError),
      });
    }
  }
}
if (!json.ok) failStage('telegram_delivery', 'telegram_send_failed', { telegram: json });

const result = {ok:true, requestedBikeId: bikeId, resolvedBikeId: bike.id, chatId: telegramChatId, messageId: json.result?.message_id, contractKey: vars.document_key, templateMode: RENTAL_DOC_TEMPLATE_MODE, docFileName, isElectric, isHourlyRental, rentalHours, rentalDays, subtotal: vars.subtotal_rub};
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
  const writeRes = await insertMetadataWithFallback(metadataTable, payload);
  if (writeRes.error) failStage('metadata_write', 'metadata_write_failed', { table: metadataTable, error: writeRes.error.message });
  const verifyRes = await verifyMetadataWithFallback(metadataTable, vars.document_key);
  if (verifyRes.error || !verifyRes.data?.contract_key) {
    failStage('metadata_verify', 'read_after_write_verification_failed', { table: metadataTable, contractKey: vars.document_key, error: verifyRes.error?.message || null });
  }
  result.metadataVerified = true;
  result.metadataTable = metadataTable;
}

const rentalSecretsPayload = {
  chat_id: telegramChatId,
  crew_slug: resolvedCrewSlug,
  doc_sha256: originalSha256,
  renter_full_name: vars.renter_full_name,
  renter_passport: vars.renter_passport,
  renter_driver_license: vars.renter_driver_license,
  renter_birth_date: vars.renter_birth_date,
  renter_phone: vars.renter_phone,
  renter_email: vars.renter_email,
  renter_address: vars.renter_address || null,
  source_doc_key: vars.document_key,
  source_rental_id: null,
  verification_status: 'verified',
  template_version: CURRENT_RENTAL_TEMPLATE_VERSION,
};

try {
  const { saveUserRentalSecrets } = await import('../app/lib/user-rental-secrets.ts');
  const saved = await saveUserRentalSecrets(rentalSecretsPayload);
  if (!saved) throw new Error('saveUserRentalSecrets returned null');
  result.rentalSecretsSaved = true;
} catch (err) {
  try {
    const { error: fallbackError } = await supabase
      .schema('private')
      .from('user_rental_secrets')
      .insert({ ...rentalSecretsPayload, updated_at: new Date().toISOString() });
    if (fallbackError) throw fallbackError;
    result.rentalSecretsSaved = true;
    result.rentalSecretsSaveFallback = true;
  } catch (fallbackErr) {
    console.error('[make-rental-contract-skill] failed to save rental secrets:', fallbackErr?.message || fallbackErr, 'primary:', err?.message || err);
    result.rentalSecretsSaved = false;
  }
}

console.log(JSON.stringify(result, null, 2));
