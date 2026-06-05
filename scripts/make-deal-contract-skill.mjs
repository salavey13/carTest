#!/usr/bin/env node
/**
 * make-deal-contract-skill.mjs — Unified contract generator for BOTH rental and sale flows.
 *
 * Usage:
 *   node scripts/make-deal-contract-skill.mjs --dealType sale --bikeId <bike> --passportJson <file> [--licenseJson <file>]
 *   node scripts/make-deal-contract-skill.mjs --dealType rent --bikeId <bike> --passportJson <file> --licenseJson <file> --startDate ... --endDate ...
 *
 * --dealType  "rent" | "sale" (required, determines template and required fields)
 * --phrase    Natural language command (parsed for bikeId and schedule)
 * --bikeId    Bike ID or search query (alternative to --phrase)
 * --passportJson  Path to JSON with passport OCR results: { fullName, birthDate, series, number, issueDate, issuer, registration, phone, email }
 * --licenseJson   Path to JSON with driver license OCR results (RENT only): { series, number }
 *   For SALE, --licenseJson is optional / ignored.
 * --telegramChatId  Chat ID for document delivery
 * --startDate / --endDate  Rental period (DD.MM.YYYY, RENT only)
 * --startTime / --endTime  Rental time (HH:MM, RENT only)
 * --saveMetadata   Set to "1" to persist contract metadata in Supabase
 * --metadataTable  Table name for metadata (default: rental_contract_artifacts / sale_contract_artifacts)
 *
 * Template files:
 *   RENT: docs/RENTAL_DEAL_TEMPLATE.html  (12 sections + 4 appendices)
 *   SALE: docs/SALE_DEAL_TEMPLATE.html     (11 sections + 2 appendices)
 */

import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { htmlToDocxElements } from '../lib/htmlToDocx.mjs';

// ─── CLI Argument Helpers ─────────────────────────────────────────────

function arg(name, fallback = '') { const i = process.argv.indexOf(`--${name}`); return i>=0 ? (process.argv[i+1]||'') : fallback; }

const dealType = String(arg('dealType', 'rent')).trim().toLowerCase();
if (dealType !== 'rent' && dealType !== 'sale') {
  console.error(JSON.stringify({ ok: false, stage: 'args', reason: 'invalid_dealType', detail: `Expected "rent" or "sale", got "${dealType}"` }));
  process.exit(2);
}

const DOC_TEMPLATE_MODE = String(process.env.DEAL_DOC_TEMPLATE_MODE || 'html').trim().toLowerCase();

const RENTAL_DOC_HTML_TEMPLATE_PATH = 'docs/RENTAL_DEAL_TEMPLATE.html';
const RENTAL_DOC_BASELINE_TEMPLATE_PATH = 'docs/RENTAL_DEAL_TEMPLATE.md';
const SALE_DOC_HTML_TEMPLATE_PATH = 'docs/SALE_DEAL_TEMPLATE.html';

// ─── Template Rendering ───────────────────────────────────────────────

function renderTemplateWithVars(template, vars) {
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_,k)=> String(vars[k] ?? ''));
}

/**
 * Legacy fallback: strip HTML tags and decode entities → plain text.
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

// ─── Date / Time Helpers ──────────────────────────────────────────────

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

// ─── Number-to-Russian-Words (simplified, for price in words) ─────────

const ONES = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
const ONES_F = ['', 'одна', 'две', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
const TEENS = ['десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать'];
const TENS = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто'];
const HUNDREDS = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот'];
const THOUSANDS = ['', 'тысяча', 'тысячи', 'тысяч'];
const MILLIONS = ['', 'миллион', 'миллиона', 'миллионов'];

function pluralForm(n, forms) {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return forms[3] || forms[2] || forms[1];
  if (last > 1 && last < 5) return forms[2] || forms[1];
  if (last === 1) return forms[1];
  return forms[3] || forms[2] || forms[1];
}

function numberToWordsTriplet(n, isThousand) {
  if (n === 0) return '';
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const t = Math.floor(rest / 10);
  const o = rest % 10;
  const parts = [];
  if (h) parts.push(HUNDREDS[h]);
  if (t === 1) {
    parts.push(TEENS[o]);
  } else {
    if (t > 1) parts.push(TENS[t]);
    if (o) {
      if (isThousand && (o === 1 || o === 2)) {
        parts.push(ONES_F[o]);
      } else {
        parts.push(ONES[o]);
      }
    }
  }
  return parts.join(' ');
}

function numberToRussianWords(n) {
  if (n === 0) return 'ноль';
  const abs = Math.abs(n);
  const millions = Math.floor(abs / 1000000);
  const thousands = Math.floor((abs % 1000000) / 1000);
  const remainder = abs % 1000;

  const parts = [];
  if (millions) {
    parts.push(numberToWordsTriplet(millions, false));
    parts.push(pluralForm(millions, MILLIONS));
  }
  if (thousands) {
    parts.push(numberToWordsTriplet(thousands, true));
    parts.push(pluralForm(thousands, THOUSANDS));
  }
  if (remainder) {
    parts.push(numberToWordsTriplet(remainder, false));
  }

  return parts.join(' ');
}

/**
 * Format price for contract: "390 000" → "Триста девяносто тысяч"
 * Returns an object with { rub, words, kopecks }
 */
function formatPriceForContract(priceNum) {
  if (!priceNum || priceNum <= 0) {
    return { rub: 'по запросу', words: '', kopecks: '00', unit: '', total: '' };
  }
  const rubWhole = Math.floor(priceNum);
  const kop = Math.round((priceNum - rubWhole) * 100);
  const formatted = rubWhole.toLocaleString('ru-RU');
  const words = numberToRussianWords(rubWhole);
  // Capitalize first letter
  const wordsCapitalized = words ? words.charAt(0).toUpperCase() + words.slice(1) : '';

  return {
    rub: formatted,
    words: wordsCapitalized,
    kopecks: String(kop).padStart(2, '0'),
    unit: `${formatted},00`,
    total: `${formatted},00`,
  };
}

// ─── Parse CLI Inputs ─────────────────────────────────────────────────

const phrase = arg('phrase');
const bikePhraseRaw = (phrase.match(/(?:сделай\s+договор(?:\s+по\s+фото)?|создай\s+документ(?:\s+по\s+фото)?|создай\s+договор(?:\s+по\s+фото)?)\s+(.+)$/i)?.[1] || arg('bikeId')).trim();
const bikeId = bikePhraseRaw.split(/\s+с\s+(?:сегодня|завтра|\d{1,2}\.\d{1,2}(?:\.\d{2,4})?)/i)[0].trim();
if (!bikeId) failStage('bike_resolve', 'missing_bike_query', { expected: 'Use --phrase "создай документ <bike_id>" or --bikeId <bike_id>' });

const passportJson = JSON.parse(readFileSync(arg('passportJson'),'utf8'));
// licenseJson is required for rent, optional for sale
const licenseJsonPath = arg('licenseJson', '');
let licenseJson = { series: '', number: '' };
if (licenseJsonPath) {
  try { licenseJson = JSON.parse(readFileSync(licenseJsonPath,'utf8')); } catch { /* ignore */ }
}
const telegramChatId = arg('telegramChatId', process.env.ADMIN_CHAT_ID || '');

// ─── Supabase Setup ───────────────────────────────────────────────────

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const supabaseRestSelect = (from, to) => {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !serviceKey) throw new Error('Supabase env is missing');
  const url = `${baseUrl}/rest/v1/cars?select=id,make,model,specs,type&type=in.(bike,ebike)&offset=${from}&limit=${to - from + 1}`;
  const curl = spawnSync('curl', ['-sS', url, '-H', `apikey: ${serviceKey}`, '-H', `Authorization: Bearer ${serviceKey}`], { encoding: 'utf8' });
  if (curl.status !== 0) throw new Error(`Supabase REST fallback failed: ${curl.stderr || curl.stdout}`);
  return JSON.parse(curl.stdout || '[]');
};

// ─── Bike Search ──────────────────────────────────────────────────────

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
      const response = await supabase.from('cars').select('id,make,model,specs,type').in('type', ['bike', 'ebike']).range(from, to);
      data = response.data;
      error = response.error;
    } catch (networkError) {
      data = supabaseRestSelect(from, to);
    }
    if (error) {
      const errorText = String(error?.message || error);
      if (/fetch failed/i.test(errorText)) { data = supabaseRestSelect(from, to); } else { throw error; }
    }
    if (!data?.length) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
};

const bikes = await fetchAllBikeCandidates();
if (!bikes.length) failStage('bike_resolve', 'bike_catalog_empty', { table: 'cars' });
const ranked = bikes.map(b => ({ bike: b, score: scoreBike(bikeId, b) })).sort((a,b)=>b.score-a.score);
const top = ranked[0];
if (!top || top.score <= 0) failStage('bike_resolve', 'bike_not_found', { bikeQuery: bikeId });
const bike = top.bike;

// ─── Determine Bike Type: electric vs ICE ─────────────────────────────

const isElectric = bike.type === 'ebike'
  || /electric/i.test(String(bike.specs?.type || ''))
  || /электро|electric|e-bike|ebike/i.test(String(bike.specs?.fuel_type || ''))
  || (bike.specs?.power_kw && Number(bike.specs.power_kw) > 0 && !bike.specs?.engine_cc)
  || (bike.specs?.battery && !bike.specs?.engine_cc);

// Vehicle type labels for template
const vehicle_type_accusative = isElectric ? 'электрическое транспортное средство' : 'мотоцикл';
const vehicle_type_genitive  = isElectric ? 'электротранспортного средства' : 'мотоцикла';

// Engine spec lines
const power_kw  = bike.specs?.power_kw || bike.specs?.nominal_power_kw || '';
const power_hp  = bike.specs?.power_hp || bike.specs?.max_power_hp || '';
const engine_cc = bike.specs?.engine_cc || bike.specs?.displacement_cc || '';
const maxSpeed  = bike.specs?.max_speed || bike.specs?.top_speed_kmh || '';
const battery   = bike.specs?.battery || bike.specs?.battery_type_capacity || '';

let bike_engine_spec_line_1, bike_engine_spec_line_2, bike_engine_spec_line_3;
if (isElectric) {
  bike_engine_spec_line_1 = power_kw  ? `Мотор электро ${power_kw} кВат` : '';
  bike_engine_spec_line_2 = maxSpeed  ? `Макс. скорость ${maxSpeed} км/ч` : '';
  bike_engine_spec_line_3 = battery   ? `Аккумулятор ${battery}` : '';
} else {
  const ccPart  = engine_cc ? `Рабочий объем ${engine_cc} куб. см` : '';
  const hpPart  = power_hp  ? `Мощность ${power_hp} л.с.` : '';
  bike_engine_spec_line_1 = [ccPart, hpPart].filter(Boolean).join(', ') || '';
  bike_engine_spec_line_2 = maxSpeed ? `Макс. скорость ${maxSpeed} км/ч` : '';
  bike_engine_spec_line_3 = '';
}

// ─── Parse Renter/Buyer Info from Passport ────────────────────────────

const fullName = String(passportJson.fullName || '').trim();
const birthDate = String(passportJson.birthDate || '').trim();
const passportSeries = String(passportJson.series || '').trim();
const passportNumber = String(passportJson.number || '').trim();
const passportIssuer = String(passportJson.issuer || passportJson.issuedBy || '').trim();
const passportIssueDate = String(passportJson.issueDate || '').trim();
const registration = String(passportJson.registration || '').trim();
const phone = String(passportJson.phone || '').trim();
const email = String(passportJson.email || '').trim();

if (!fullName) failStage('renter_parse', 'missing_full_name');
if (!birthDate) failStage('renter_parse', 'missing_birth_date');
if (!passportSeries || !passportNumber) failStage('renter_parse', 'missing_passport_data');

// For rent: driver license is required
const licenseSeries = String(licenseJson.series || '').trim();
const licenseNumber = String(licenseJson.number || '').trim();
if (dealType === 'rent' && (!licenseSeries || !licenseNumber)) {
  failStage('renter_parse', 'missing_driver_license_data', { hint: 'Driver license is required for rental contracts' });
}

// Short name for signatures (last name + initials)
const nameParts = fullName.split(/\s+/);
const shortName = nameParts.length >= 2
  ? `${nameParts[0]} ${nameParts[1].charAt(0)}.${nameParts.length >= 3 ? nameParts[2].charAt(0) + '.' : ''}`
  : fullName;

// ─── Sale-Specific: Price & Formatting ────────────────────────────────

// Sale price: prefer specs.sale_price, then specs.price_rub, then arg fallback
const salePriceNum = Number(bike.specs?.sale_price) > 0 ? Number(bike.specs.sale_price)
  : Number(bike.specs?.price_rub) > 0 ? Number(bike.specs.price_rub)
  : Number(arg('salePrice', '0'));

if (dealType === 'sale' && salePriceNum <= 0) {
  failStage('sale_price', 'missing_sale_price', { hint: 'Bike has no sale_price / price_rub in specs. Pass --salePrice <number>.' });
}

const salePrice = formatPriceForContract(salePriceNum);

// ─── Rent-Specific: Dates & Pricing ───────────────────────────────────

const now = new Date();
const phraseSchedule = extractScheduleFromPhrase(phrase);
const startDate = arg('startDate', phraseSchedule.startDate || '');
const endDate = arg('endDate', phraseSchedule.endDate || '');
const startTimeArg = arg('startTime', phraseSchedule.startTime || '18:00');
const endTimeArg   = arg('endTime', phraseSchedule.endTime || '10:00');

if (dealType === 'rent' && (!startDate || !endDate)) {
  failStage('rental_dates', 'missing_rental_dates', { hint: 'Pass --startDate/--endDate or include explicit dates in phrase.' });
}

// Calculate rental duration and pricing (rent only)
let rentalHours = 0;
let rentalDays = 1;
let isHourlyRental = false;
let subtotalRounded = 0;
let bikeDailyPrice = '0';
let bikeHourlyPrice = '0';
let bikeDeposit = '0';
let bikeValueRub = '0';

if (dealType === 'rent') {
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
  if (startDP && endDP) {
    const startMin = new Date(startDP.y, startDP.mo, startDP.d, 0, 0, 0).getTime() / 60000 + parseTimeToMinutes(startTimeArg);
    const endMin   = new Date(endDP.y, endDP.mo, endDP.d, 0, 0, 0).getTime() / 60000 + parseTimeToMinutes(endTimeArg);
    rentalHours = Math.max(0, Math.round((endMin - startMin) / 60 * 10) / 10);
  }
  rentalDays = rentalHours > 0 ? Math.max(1, Math.ceil(rentalHours / 24)) : 1;
  isHourlyRental = rentalHours > 0 && rentalHours < 24;

  bikeDailyPrice = Number(bike.specs?.dailyPrice) > 0 ? String(bike.specs.dailyPrice)
    : Number(bike.specs?.rent_weekday) > 0 ? String(bike.specs.rent_weekday)
    : arg('dailyPrice', '10000');
  bikeHourlyPrice = Number(bike.specs?.price_per_hour) > 0 ? String(bike.specs.price_per_hour)
    : arg('hourlyPrice', String(Math.round(Number(bikeDailyPrice) / 8)));
  bikeDeposit = Number(bike.specs?.deposit_rub) > 0 ? String(bike.specs.deposit_rub) : arg('deposit', '20000');
  bikeValueRub = Number(bike.specs?.sale_price) > 0 ? String(bike.specs.sale_price)
    : Number(bike.specs?.price_rub) > 0 ? String(bike.specs.price_rub)
    : arg('bikeValue', '850000');

  let subtotal;
  if (isHourlyRental) {
    subtotal = Number(bikeHourlyPrice) * rentalHours;
  } else {
    subtotal = Number(bikeDailyPrice) * rentalDays;
  }
  subtotalRounded = Math.round(subtotal);
}

// ─── Build Template Variables ─────────────────────────────────────────

const commonVars = {
  contract_number: `${now.getDate()}.${now.getMonth()+1}/${bike.id}`,
  day: String(now.getDate()).padStart(2,'0'),
  month: now.toLocaleString('ru-RU',{month:'long'}),
  month_num: String(now.getMonth()+1).padStart(2,'0'),
  year: String(now.getFullYear()),
  // Bike info
  bike_make: bike.make || 'уточняется',
  bike_model: bike.model || 'уточняется',
  bike_vin: bike.specs?.vin || bike.specs?.frame || bike.specs?.vin_number || '_____________________',
  bike_category: bike.specs?.category || bike.specs?.tp_category || 'A/L3',
  bike_color: bike.specs?.color || 'уточняется',
  bike_year: bike.specs?.year || bike.specs?.production_year || 'уточняется',
  bike_subtype: bike.specs?.bike_subtype || bike.specs?.type || 'уточняется',
  bike_plate: bike.specs?.plate || 'уточняется',
  bike_engine_spec_line_1,
  bike_engine_spec_line_2,
  bike_engine_spec_line_3,
  // Vehicle type labels
  vehicle_type_accusative,
  vehicle_type_genitive,
  // Seller info (hardcoded — matches both templates)
  seller_address: arg('sellerAddress', '603132, Нижегородская обл, г. Нижний Новгород, ул. Молитовская, 6/1-42'),
  lessor_address: arg('lessorAddress', 'г. Нижний Новгород'),
};

const saleVars = {
  ...commonVars,
  // Buyer info (from passport only — no license needed)
  buyer_full_name: fullName,
  buyer_short_name: shortName,
  buyer_birth_date: birthDate,
  buyer_passport: `${passportSeries} ${passportNumber}`.trim(),
  buyer_passport_issuer: passportIssuer || '_____________________',
  buyer_passport_issue_date: passportIssueDate || '_____________________',
  buyer_registration: registration || '_____________________',
  buyer_phone: phone || '_____________________',
  buyer_email: email || '_____________________',
  // Sale price
  sale_price_rub: salePrice.rub,
  sale_price_words: salePrice.words || '_____________________',
  sale_price_kopecks: salePrice.kopecks,
  sale_price_unit: salePrice.unit,
  sale_price_total: salePrice.total,
  // Warranty
  warranty_months: String(bike.specs?.warranty_months || arg('warrantyMonths', '6')),
  // Document key
  document_key: `sale-${bike.id}-${Date.now()}`,
};

const rentVars = {
  ...commonVars,
  // Renter info
  renter_full_name: fullName,
  renter_birth_date: birthDate,
  renter_phone: phone || '',
  renter_email: email || '',
  renter_driver_license: `${licenseSeries} ${licenseNumber}`.trim(),
  renter_passport: `${passportSeries} ${passportNumber}`.trim(),
  renter_passport_issue_date: passportIssueDate || '',
  renter_passport_issuer: passportIssuer || '',
  renter_registration: registration || '',
  // Rental dates
  rent_start_time: startTimeArg,
  rent_start_date: startDate,
  rent_end_time: endTimeArg,
  rent_end_date: endDate,
  // Rental pricing
  hourly_price_rub: bikeHourlyPrice,
  daily_price_rub: bikeDailyPrice,
  subtotal_rub: arg('subtotal', String(subtotalRounded)),
  deposit_rub: bikeDeposit,
  included_mileage:'200', overage_rate:'35', included_km_per_day:'200', extra_km_fee_rub:'35',
  late_return_penalty_rub: arg('latePenalty','10000'),
  late_return_penalty_max_days: arg('latePenaltyMaxDays','90'),
  bike_value_rub: bikeValueRub,
  bike_value_words: arg('bikeValueWords',''),
  return_address: 'г. Нижний Новгород, пл. Комсомольская 2',
  issuer_name: 'Воробьев Р.В.',
  issuer_signatory: 'Менеджер Мотосалона',
  issuer_representative: 'ИП Воробьев Р.В.',
  signature_timestamp: now.toLocaleString('ru-RU'),
  signature_fingerprint: 'offline-skill',
  renter_signature: 'согласие через Telegram',
  bike_mileage: String(bike.specs?.mileage||''),
  equipment: 'ключ(и) 1 шт.; шлем 1',
  damage_notes_at_delivery: 'от даты начала аренды',
  damage_notes_at_return: 'от даты возврата тс',
  battery_level_start: '100 %',
  battery_level_end: '____ %',
  media_links: 'телефон',
  damage_price_list: 'мотоцикл в сборе / царапина на пластике / прочее по расчету',
  document_key: `rental-${bike.id}-${Date.now()}`,
};

const vars = dealType === 'sale' ? saleVars : rentVars;

// ─── Select Template ──────────────────────────────────────────────────

const htmlTemplatePath = dealType === 'sale' ? SALE_DOC_HTML_TEMPLATE_PATH : RENTAL_DOC_HTML_TEMPLATE_PATH;
const mdTemplatePath = RENTAL_DOC_BASELINE_TEMPLATE_PATH; // MD fallback only exists for rent

let htmlTemplate = null;
try {
  htmlTemplate = readFileSync(htmlTemplatePath, 'utf8');
} catch (readError) {
  console.warn(`[deal-doc] html template read failed (${htmlTemplatePath}): ${String(readError?.message || readError)}`);
}

let mdTemplate = '';
try {
  mdTemplate = readFileSync(mdTemplatePath, 'utf8');
} catch {
  // MD template may not exist for sale — that's ok
}

// ─── Build Document ───────────────────────────────────────────────────

let doc;

if (DOC_TEMPLATE_MODE === 'html' && htmlTemplate) {
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
    console.error(`[deal-doc] ${dealType} HTML→DOCX: proper cheerio-based conversion`);
  } catch (error) {
    console.warn(`[deal-doc] html→docx failed, trying legacy adapter: ${String(error?.message || error)}`);
    try {
      const text = renderHtmlTemplateAdapterLegacy(htmlTemplate, vars);
      doc = new Document({sections:[{children: text.split('\n').map(line=>new Paragraph({children:[new TextRun({ text: line, font: 'Times New Roman' })]}))}]});
    } catch (e2) {
      if (mdTemplate) {
        console.warn(`[deal-doc] legacy adapter also failed, falling back to md: ${String(e2?.message || e2)}`);
        const rendered = renderTemplateWithVars(mdTemplate, vars);
        doc = new Document({sections:[{children: rendered.split('\n').map(line=>new Paragraph({children:[new TextRun({ text: line, font: 'Times New Roman' })]}))}]});
      } else {
        failStage('doc_build', 'all_template_modes_failed', { error: String(e2?.message || e2) });
      }
    }
  }
} else if (mdTemplate) {
  const rendered = renderTemplateWithVars(mdTemplate, vars);
  doc = new Document({sections:[{children: rendered.split('\n').map(line=>new Paragraph({children:[new TextRun({ text: line, font: 'Times New Roman' })]}))}]});
} else {
  failStage('doc_build', 'no_template_available', { dealType, htmlPath: htmlTemplatePath, mdPath: mdTemplatePath });
}

const buf = await Packer.toBuffer(doc);
const originalSha256 = createHash('sha256').update(buf).digest('hex');

// Build descriptive filename
const safeName = s => String(s || '').replace(/[^a-zA-Zа-яА-Я0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
const docFileName = dealType === 'sale'
  ? `sale-contract-${safeName(bike.make)}-${safeName(bike.model)}-${formatRuDate(now)}.docx`
  : `rental-contract-${safeName(bike.make)}-${safeName(bike.model)}-${startDate}.docx`;

// ─── Send via Telegram ────────────────────────────────────────────────

const token = process.env.TELEGRAM_BOT_TOKEN;
const telegramUrl = `https://api.telegram.org/bot${token}/sendDocument`;
let json;
try {
  const form = new FormData();
  form.append('chat_id', telegramChatId);
  form.append('document', new Blob([buf], {type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}), docFileName);
  const res = await fetch(telegramUrl, {method:'POST', body: form});
  json = await res.json();
} catch (networkError) {
  const tmpFile = `/tmp/${dealType}-contract-${Date.now()}.docx`;
  await import('node:fs/promises').then(fs => fs.writeFile(tmpFile, buf));
  const curl = spawnSync('curl', ['-sS', '-X', 'POST', telegramUrl, '-F', `chat_id=${telegramChatId}`, '-F', `document=@${tmpFile}`], { encoding: 'utf8' });
  if (curl.status !== 0) throw new Error(`Telegram curl send failed: ${curl.stderr || curl.stdout}`);
  json = JSON.parse(curl.stdout || '{}');
}
if (!json.ok) failStage('telegram_delivery', 'telegram_send_failed', { telegram: json });

// ─── Result ───────────────────────────────────────────────────────────

const result = {
  ok: true,
  dealType,
  requestedBikeId: bikeId,
  resolvedBikeId: bike.id,
  chatId: telegramChatId,
  messageId: json.result?.message_id,
  contractKey: vars.document_key,
  templateMode: DOC_TEMPLATE_MODE,
  docFileName,
  isElectric,
};

if (dealType === 'rent') {
  Object.assign(result, { isHourlyRental, rentalHours, rentalDays, subtotal: vars.subtotal_rub });
} else {
  Object.assign(result, { salePrice: salePriceNum, buyerFullName: fullName });
}

// ─── Save Metadata (optional) ─────────────────────────────────────────

const saveMetadata = arg('saveMetadata', '0') !== '0';
const metadataTable = arg('metadataTable', dealType === 'sale' ? 'sale_contract_artifacts' : 'rental_contract_artifacts');

if (saveMetadata) {
  const payload = {
    contract_key: vars.document_key,
    deal_type: dealType,
    requested_bike_id: bikeId,
    resolved_bike_id: bike.id,
    telegram_chat_id: telegramChatId,
    telegram_message_id: json.result?.message_id || null,
    buyer_full_name: dealType === 'sale' ? fullName : undefined,
    renter_full_name: dealType === 'rent' ? fullName : undefined,
    rent_start_date: dealType === 'rent' ? startDate : undefined,
    rent_end_date: dealType === 'rent' ? endDate : undefined,
    sale_price: dealType === 'sale' ? salePriceNum : undefined,
    original_sha256: originalSha256,
  };
  // Remove undefined keys
  Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

  const writeRes = await supabase.from(metadataTable).insert(payload).select('contract_key').limit(1);
  if (writeRes.error) failStage('metadata_write', 'metadata_write_failed', { table: metadataTable, error: writeRes.error.message });
  const verifyRes = await supabase.from(metadataTable).select('contract_key').eq('contract_key', vars.document_key).maybeSingle();
  if (verifyRes.error || !verifyRes.data?.contract_key) {
    failStage('metadata_verify', 'read_after_write_verification_failed', { table: metadataTable, contractKey: vars.document_key });
  }
  result.metadataVerified = true;
  result.metadataTable = metadataTable;
}

console.log(JSON.stringify(result, null, 2));
