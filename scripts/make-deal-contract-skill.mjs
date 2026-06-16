#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// make-deal-contract-skill.mjs — Unified contract generator for RENT & SALE
// ═══════════════════════════════════════════════════════════════════════════
//
// USAGE:
//   node make-deal-contract-skill.mjs --dealType rent  --phrase "..." --passportJson ./p.json --licenseJson ./l.json --telegramChatId 123
//   node make-deal-contract-skill.mjs --dealType sale  --phrase "..." --passportJson ./p.json --price 390000 --telegramChatId 123
//
// ─── SUPPORTED CLI FLAGS ───────────────────────────────────────────────────
//   --dealType          (REQUIRED) "rent" or "sale"
//   --phrase            Trigger phrase (contains bike id + schedule for rent)
//   --bikeId            Alternative bike identifier (if phrase not used)
//   --passportJson      Path to passport OCR JSON (REQUIRED for both)
//   --licenseJson       Path to driver-license OCR JSON (REQUIRED for rent, NOT for sale)
//   --buyerAddress      Manual override for buyer registration address.
//                       USE WHEN: VLM/OCR yields only city-level precision for the
//                       registration field on passport page 2 (cursive handwriting).
//                       The calling agent should ask the operator to type the full
//                       address and pass it here. If provided, it overrides
//                       passportJson.registration.
//   --telegramChatId    Telegram chat ID for delivery (fallback: ADMIN_CHAT_ID env)
//   --userId            User ID to determine crew membership and load crew secrets
//   --crewSlug          Optional crew override (skips crew lookup, default: vip-bike)
//   --startDate         Rent start date DD.MM.YYYY (rent only)
//   --endDate           Rent end date DD.MM.YYYY (rent only)
//   --startTime         Rent start time HH:MM (rent only, default 18:00)
//   --endTime           Rent end time HH:MM (rent only, default 10:00)
//   --dailyPrice        Override daily rental price (rent only)
//   --hourlyPrice       Override hourly rental price (rent only)
//   --deposit           Override deposit amount (rent only)
//   --bikeValue         Override bike value for loss compensation (rent only)
//   --salePrice         Sale price in rubles (sale only, fallback when bike.specs has no sale_price/price_rub)
//   --warrantyMonths    Warranty months (sale only, default 12)
//   --sellerAddress     Seller legal address (sale only, default "г. Нижний Новгород")
//   --lessorAddress     Lessor address (rent only)
//   --latePenalty        Late return penalty per day (rent only)
//   --latePenaltyMaxDays Late return max penalty days (rent only)
//   --subtotal          Override computed subtotal (rent only)
//   --bikeValueWords    Bike value in Russian words (rent only)
//   --saveMetadata      Set to "1" to write metadata to Supabase
//   --metadataTable     Override metadata table name
//
// ─── FLAGS THAT DO NOT EXIST (anti-hallucination) ──────────────────────────
//   --skipTelegram      DOES NOT EXIST. Telegram delivery is always built-in.
//   --outPath           DOES NOT EXIST. No local file output option.
//   --dealDate          DOES NOT EXIST. Contract date = now().
//   --local             DOES NOT EXIST. Script always delivers via Telegram.
//
// ═══════════════════════════════════════════════════════════════════════════

import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { htmlToDocxElements } from '../lib/htmlToDocx.mjs';

// ── CLI helpers ──────────────────────────────────────────────────────────
function arg(name, fallback = '') { const i = process.argv.indexOf(`--${name}`); return i>=0 ? (process.argv[i+1]||'') : fallback; }
function hasFlag(name) { return process.argv.includes(`--${name}`); }

// ── Deal type validation ────────────────────────────────────────────────
const dealType = String(arg('dealType', '')).trim().toLowerCase();
if (dealType !== 'rent' && dealType !== 'sale') {
  const payload = { ok: false, stage: 'deal_type', reason: 'missing_or_invalid_dealType', details: { expected: '"rent" or "sale"', received: dealType || '(empty)' } };
  console.error(JSON.stringify(payload, null, 2));
  process.exit(2);
}

// ── Template paths ───────────────────────────────────────────────────────
const RENTAL_DOC_HTML_TEMPLATE_PATH = 'docs/RENTAL_DEAL_TEMPLATE.html';
const RENTAL_DOC_MD_TEMPLATE_PATH   = 'docs/RENTAL_DEAL_TEMPLATE.md';
const SALE_DOC_HTML_TEMPLATE_PATH   = 'docs/SALE_DEAL_TEMPLATE.html';

const RENTAL_DOC_TEMPLATE_MODE = String(process.env.RENTAL_DOC_TEMPLATE_MODE || 'html').trim().toLowerCase();

// ── Utility functions ────────────────────────────────────────────────────

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

// ── Number to Russian words ──────────────────────────────────────────────
// Full implementation for sale price in words (and rent bike_value_words)

const ONES_M = ['','один','два','три','четыре','пять','шесть','семь','восемь','девять'];
const ONES_F = ['','одна','две','три','четыре','пять','шесть','семь','восемь','девять'];
const TEENS  = ['десять','одиннадцать','двенадцать','тринадцать','четырнадцать','пятнадцать','шестнадцать','семнадцать','восемнадцать','девятнадцать'];
const TENS   = ['','','двадцать','тридцать','сорок','пятьдесят','шестьдесят','семьдесят','восемьдесят','девяносто'];
const HUNDREDS = ['','сто','двести','триста','четыреста','пятьсот','шестьсот','семьсот','восемьсот','девятьсот'];
const SCALE = [
  { m: '',        f: '',        one: '',   few: '',     many: '' },
  { m: 'тысяча',  f: 'тысяча',  one: 'тысяча',  few: 'тысячи',  many: 'тысяч' },
  { m: 'миллион', f: 'миллион', one: 'миллион', few: 'миллиона', many: 'миллионов' },
  { m: 'миллиард',f: 'миллиард',one: 'миллиард',few: 'миллиарда',many: 'миллиардов' },
];

function tripleToWords(n, genderF) {
  if (n === 0) return '';
  const h = Math.floor(n / 100);
  const rem = n % 100;
  const t = Math.floor(rem / 10);
  const o = rem % 10;
  const parts = [];
  if (h > 0) parts.push(HUNDREDS[h]);
  if (rem >= 10 && rem < 20) {
    parts.push(TEENS[rem - 10]);
  } else {
    if (t > 0) parts.push(TENS[t]);
    if (o > 0) {
      parts.push(genderF ? ONES_F[o] : ONES_M[o]);
    }
  }
  return parts.join(' ');
}

function pluralScale(n, scale) {
  if (!scale.one) return '';
  const abs = Math.abs(n);
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod100 >= 11 && mod100 <= 14) return scale.many;
  if (mod10 === 1) return scale.one;
  if (mod10 >= 2 && mod10 <= 4) return scale.few;
  return scale.many;
}

function numberToRussianWords(num) {
  if (num === 0) return 'ноль';
  const isNeg = num < 0;
  let n = Math.abs(Math.floor(num));
  const parts = [];
  let scaleIdx = 0;
  while (n > 0) {
    const triple = n % 1000;
    if (triple > 0) {
      const genderF = scaleIdx === 1; // thousands use feminine
      const words = tripleToWords(triple, genderF);
      const suffix = pluralScale(triple, SCALE[scaleIdx]);
      const chunk = [words, suffix].filter(Boolean).join(' ');
      parts.unshift(chunk);
    }
    n = Math.floor(n / 1000);
    scaleIdx++;
  }
  const result = parts.join(' ');
  // Capitalize first letter
  return (isNeg ? 'минус ' : '') + result.charAt(0).toUpperCase() + result.slice(1);
}

// ── Russian month genitive ───────────────────────────────────────────────
const MONTH_GENITIVE = [
  '', 'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

// ── Format number with space separator ───────────────────────────────────
function formatPriceDigits(num) {
  return String(num).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

// ── Phrase parsing (rent + sale triggers) ────────────────────────────────
const phrase = arg('phrase');

// Rent triggers: "создай документ", "сделай договор"
// Sale triggers: "создай договор продажи", "сделай договор купли-продажи"
const bikePhraseRaw = (
  phrase.match(/(?:сделай\s+договор\s+(?:купли-продажи\s+)?|создай\s+(?:договор\s+продажи|документ)(?:\s+по\s+фото)?\s*)(.+)$/i)?.[1]
  || arg('bikeId')
).trim();

// Extract bike id — strip schedule portion if present
const bikeId = bikePhraseRaw.split(/\s+с\s+(?:сегодня|завтра|\d{1,2}\.\d{1,2}(?:\.\d{2,4})?)/i)[0].trim();
if (!bikeId) failStage('bike_resolve', 'missing_bike_query', { expected: 'Use --phrase "создай документ <bike_id>" or --phrase "создай договор продажи <bike_id>" or --bikeId <bike_id>' });

// ── Load passport OCR ────────────────────────────────────────────────────
const passportJson = JSON.parse(readFileSync(arg('passportJson'),'utf8'));

// License only required for rent
let licenseJson = null;
if (dealType === 'rent') {
  const licensePath = arg('licenseJson');
  if (!licensePath) failStage('license_parse', 'missing_licenseJson', { hint: '--licenseJson is required for rent deals' });
  licenseJson = JSON.parse(readFileSync(licensePath,'utf8'));
}

// ── Buyer address: manual override for cursive handwriting ──────────────
const buyerAddressOverride = arg('buyerAddress', '');
const buyerRegistration = buyerAddressOverride || String(passportJson.registration || '').trim();
if (buyerAddressOverride) {
  console.error(`[deal-contract] Using --buyerAddress override for registration (cursive handwriting workaround)`);
} else if (!buyerRegistration) {
  console.error(`[deal-contract] WARNING: registration address is empty. If OCR yielded only city-level precision due to cursive handwriting on passport page 2, ask the operator to type the address manually and pass it via --buyerAddress`);
}

const telegramChatId = arg('telegramChatId', process.env.ADMIN_CHAT_ID || '');

// ── Supabase client ──────────────────────────────────────────────────────
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// ── Crew membership detection and secrets loading ─────────────────────────
let crewSlug = arg('crewSlug', '').trim();
let crewSecrets = { contractDefaults: {} };

if (!crewSlug) {
  const userId = arg('userId', '').trim();
  if (userId) {
    try {
      const { data: memberData } = await supabase
        .from('crew_members')
        .select('crews(slug)')
        .eq('user_id', userId)
        .eq('membership_status', 'active')
        .maybeSingle();

      if (memberData?.crews?.slug) {
        crewSlug = memberData.crews.slug;
        console.error(`[deal-contract] Found crew: ${crewSlug} for userId: ${userId}`);
      }
    } catch (error) {
      console.warn(`[deal-contract] Crew lookup failed for userId ${userId}: ${error.message}`);
    }
  }
}

// Fallback to vip-bike if no crew found
if (!crewSlug) crewSlug = 'vip-bike';

// Load crew secrets
try {
  const { data: secretsData } = await supabase
    .from('crew_secrets')
    .select('contract_defaults')
    .eq('crew_slug', crewSlug)
    .maybeSingle();

  if (secretsData?.contract_defaults) {
    if (typeof secretsData.contract_defaults === 'string') {
      crewSecrets.contractDefaults = JSON.parse(secretsData.contract_defaults);
    } else {
      crewSecrets.contractDefaults = secretsData.contract_defaults;
    }
    console.error(`[deal-contract] Loaded crew_secrets for ${crewSlug}`);
  }
} catch (error) {
  console.warn(`[deal-contract] Failed to load crew_secrets for ${crewSlug}: ${error.message}`);
}

// Extract contract defaults with fallbacks
const contractDefaults = crewSecrets.contractDefaults || {};
const crewOrgName = contractDefaults.organizationName || 'Мотосалон ВипБайкЭлектро';
const crewOrgShort = contractDefaults.organizationShort || 'ИП Воробьева Р.В.';
const crewOrgRepresentative = contractDefaults.organizationRepresentative || 'ИП Воробьев Р.В.';
const crewOgrnip = contractDefaults.ogrnip || '326527500025145';
const crewInn = contractDefaults.inn || '525813643035';
const crewBankAccount = contractDefaults.bankAccount || '40802810942710013083';
const crewBankName = contractDefaults.bankName || 'Волго-Вятский Банк ПАО Сбербанк';
const crewBankCity = contractDefaults.bankCity || 'г. Нижний Новгород';
const crewBankCorrAccount = contractDefaults.bankCorrAccount || '30101810900000000603';
const crewEmail = contractDefaults.email || 'vip_bike@mail.ru';
const crewLegalAddress = contractDefaults.legalAddress || 'г. Нижний Новгород, пл. Комсомольская 2';
const crewIssuerName = contractDefaults.issuerName || 'Воробьев Р.В.';
const crewIssuerRepresentative = contractDefaults.issuerRepresentative || 'Сидоров Илья Олегович';
const crewReturnAddress = contractDefaults.returnAddress || 'Н. Н. пл. Комсомольская 2';
const crewSignatoryRole = contractDefaults.signatoryRole || 'Менеджер Мотосалона';

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

// ── Bike resolution ──────────────────────────────────────────────────────
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

// ── Bike type detection (shared) ────────────────────────────────────────
const isElectric = bike.type === 'ebike'
  || /electric/i.test(String(bike.specs?.type || ''))
  || /электро|electric|e-bike|ebike/i.test(String(bike.specs?.fuel_type || ''))
  || (bike.specs?.power_kw && Number(bike.specs.power_kw) > 0 && !bike.specs?.engine_cc)
  || (bike.specs?.battery && !bike.specs?.engine_cc);

const power_kw  = bike.specs?.power_kw || bike.specs?.nominal_power_kw || '';
const power_hp  = bike.specs?.power_hp || bike.specs?.max_power_hp || '';
const engine_cc = bike.specs?.engine_cc || bike.specs?.displacement_cc || '';
const maxSpeed  = bike.specs?.max_speed || bike.specs?.top_speed_kmh || '';
const battery   = bike.specs?.battery || bike.specs?.battery_type_capacity || '';

// ── Build template variables ─────────────────────────────────────────────
const now = new Date();
const phraseSchedule = extractScheduleFromPhrase(phrase);

let vars = {};
let docFileName = '';

// Declare rental summary vars at outer scope so result-building can see them
let isHourlyRental = false;
let rentalHours = 0;
let rentalDays = 1;

if (dealType === 'rent') {
  // ══════════════════════════════════════════════════════════════════════
  // RENT FLOW
  // ══════════════════════════════════════════════════════════════════════

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

  // Vehicle type labels for template
  const bike_vehicle_type_label   = isElectric ? 'ЭЛЕКТРОМОТОЦИКЛА' : 'МОТОЦИКЛА';
  const bike_vehicle_type_accusative = isElectric ? 'электромотоцикл' : 'мотоцикл';
  const bike_vehicle_type_genitive  = isElectric ? 'электромотоцикла' : 'мотоцикла';

  // Engine spec lines
  let bike_engine_spec_line_1, bike_engine_spec_line_2, bike_engine_spec_line_3;
  if (isElectric) {
    bike_engine_spec_line_1 = power_kw  ? `мощность двигателя (номинальная) ${power_kw} кВт` : '';
    bike_engine_spec_line_2 = maxSpeed  ? `максимальная конструктивная скорость ${maxSpeed} км/ч` : '';
    bike_engine_spec_line_3 = battery   ? `аккумулятор: тип/ёмкость ${battery}` : '';
  } else {
    const ccPart  = engine_cc ? `рабочий объем ${engine_cc} куб. см` : '';
    const hpPart  = power_hp  ? `мощность ${power_hp} л.с.` : '';
    bike_engine_spec_line_1 = [ccPart, hpPart].filter(Boolean).join(', ') || '';
    bike_engine_spec_line_2 = maxSpeed ? `максимальная конструктивная скорость ${maxSpeed} км/ч` : '';
    bike_engine_spec_line_3 = '';
  }

  // Calculate rental duration and pricing
  const startTimeArg = arg('startTime', phraseSchedule.startTime || '18:00');
  const endTimeArg   = arg('endTime', phraseSchedule.endTime || '10:00');

  const startDP = parseRuDateParts(startDate);
  const endDP   = parseRuDateParts(endDate);
  rentalHours = 0;
  if (startDP && endDP) {
    const startMin = new Date(startDP.y, startDP.mo, startDP.d, 0, 0, 0).getTime() / 60000 + parseTimeToMinutes(startTimeArg);
    const endMin   = new Date(endDP.y, endDP.mo, endDP.d, 0, 0, 0).getTime() / 60000 + parseTimeToMinutes(endTimeArg);
    rentalHours = Math.max(0, Math.round((endMin - startMin) / 60 * 10) / 10);
  }
  rentalDays = rentalHours > 0 ? Math.max(1, Math.ceil(rentalHours / 24)) : 1;
  isHourlyRental = rentalHours > 0 && rentalHours < 24;

  // Pricing
  const bikeDailyPrice = Number(bike.specs?.dailyPrice) > 0 ? String(bike.specs.dailyPrice)
    : Number(bike.specs?.rent_weekday) > 0 ? String(bike.specs.rent_weekday)
    : arg('dailyPrice', '10000');
  const bikeHourlyPrice = Number(bike.specs?.price_per_hour) > 0 ? String(bike.specs.price_per_hour)
    : arg('hourlyPrice', String(Math.round(Number(bikeDailyPrice) / 8)));
  const bikeDeposit = Number(bike.specs?.deposit_rub) > 0 ? String(bike.specs.deposit_rub) : arg('deposit', '20000');
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

  vars = {
    contract_number: `${now.getDate()}.${now.getMonth()+1}/${bike.id}`,
    day: String(now.getDate()).padStart(2,'0'),
    month: now.toLocaleString('ru-RU',{month:'long'}),
    month_num: String(now.getMonth()+1).padStart(2,'0'),
    year: String(now.getFullYear()),
    renter_full_name: renterFullName,
    renter_birth_date: renterBirthDate,
    renter_phone: passportJson.phone || '',
    renter_email: passportJson.email || '',
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
    bike_vehicle_type_label,
    bike_vehicle_type_accusative,
    bike_vehicle_type_genitive,
    bike_engine_spec_line_1,
    bike_engine_spec_line_2,
    bike_engine_spec_line_3,
    rent_start_time: startTimeArg, rent_start_date: startDate,
    rent_end_time: endTimeArg, rent_end_date: endDate,
    hourly_price_rub: bikeHourlyPrice,
    daily_price_rub: bikeDailyPrice,
    subtotal_rub: arg('subtotal', String(subtotalRounded)),
    deposit_rub: bikeDeposit,
    included_mileage:'200', overage_rate:'35', included_km_per_day:'200', extra_km_fee_rub:'35',
    late_return_penalty_rub: arg('latePenalty','10000'),
    late_return_penalty_max_days: arg('latePenaltyMaxDays','90'),
    bike_value_rub: bikeValueRub,
    bike_value_words: arg('bikeValueWords',''),
    return_address: arg('returnAddress', crewReturnAddress),
    lessor_address: arg('lessorAddress', crewLegalAddress),
    issuer_name: crewIssuerName,
    issuer_signatory: crewSignatoryRole,
    issuer_representative: crewOrgRepresentative,
    organization_name: crewOrgName,
    organization_short: crewOrgShort,
    ogrnip: crewOgrnip,
    inn: crewInn,
    bank_account: crewBankAccount,
    bank_name: crewBankName,
    bank_city: crewBankCity,
    bank_corr_account: crewBankCorrAccount,
    email: crewEmail,
    legal_address: crewLegalAddress,
    signature_timestamp: now.toLocaleString('ru-RU'), signature_fingerprint:'offline-skill', renter_signature:'согласие через Telegram',
    bike_mileage: String(bike.specs?.mileage||''),
    equipment:'ключ(и) 1 шт.; шлем 1',
    damage_notes_at_delivery:'от даты начала аренды', damage_notes_at_return:'от даты возврата тс',
    battery_level_start:'100 %', battery_level_end:'____ %',
    media_links:'телефон',
    renter_passport_issue_date: passportJson.issueDate || '', renter_registration: buyerRegistration,
    damage_price_list:'мотоцикл в сборе / царапина на пластике / прочее по расчету',
    document_key:`rental-${bike.id}-${Date.now()}`
  };

  // Filename
  const safeName = s => String(s || '').replace(/[^a-zA-Zа-яА-Я0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  docFileName = `rental-contract-${safeName(bike.make)}-${safeName(bike.model)}-${startDate}.docx`;

} else {
  // ══════════════════════════════════════════════════════════════════════
  // SALE FLOW
  // ══════════════════════════════════════════════════════════════════════

  const buyerFullName = String(passportJson.fullName || '').trim();
  const buyerBirthDate = String(passportJson.birthDate || '').trim();
  const buyerPassportSeries = String(passportJson.series || '').trim();
  const buyerPassportNumber = String(passportJson.number || '').trim();
  const buyerPassportIssuedBy = String(passportJson.issuedBy || '').trim();
  const buyerPassportIssueDate = String(passportJson.issueDate || '').trim();
  const buyerEmail = String(passportJson.email || '').trim();

  if (!buyerFullName) failStage('buyer_parse', 'missing_full_name');
  if (!buyerBirthDate) failStage('buyer_parse', 'missing_birth_date');
  if (!buyerPassportSeries || !buyerPassportNumber) failStage('buyer_parse', 'missing_passport_data');
  if (!buyerRegistration) failStage('buyer_parse', 'missing_registration', { hint: 'Registration address is empty. If OCR failed on cursive passport page 2, pass --buyerAddress manually.' });

  // Sale price
  const salePriceRaw = Number(bike.specs?.sale_price) > 0 ? Number(bike.specs.sale_price)
    : Number(bike.specs?.price_rub) > 0 ? Number(bike.specs.price_rub)
    : Number(arg('salePrice', '0'));
  if (!salePriceRaw || salePriceRaw <= 0) failStage('sale_price', 'missing_sale_price', { hint: 'Pass --salePrice <rubles> or ensure bike.specs.sale_price / price_rub is set' });

  const priceDigits = formatPriceDigits(salePriceRaw);
  const priceWords = numberToRussianWords(salePriceRaw);
  const priceDigitsTable = formatPriceDigits(salePriceRaw);

  // Product mapping from bike data
  const product_name = `Мотоцикл ${bike.make || ''} ${bike.model || ''}`.replace(/\s+/g, ' ').trim();
  const product_color = bike.specs?.color || 'уточняется';
  const product_type = bike.specs?.subtype || bike.specs?.bike_type || (isElectric ? 'Электро' : 'Эндуро');
  const product_vin = bike.specs?.vin || bike.specs?.frame || bike.specs?.vin_number || 'уточняется';
  const product_year = bike.specs?.year || bike.specs?.production_year || 'уточняется';
  const product_unit = 'шт.';

  // Motor type and power
  let product_motor_type, product_motor_power;
  if (isElectric) {
    product_motor_type = 'Центральный мотор, цепь';
    product_motor_power = power_kw ? `Мотор электро ${power_kw} кВат` : 'Мотор электро';
  } else {
    const ccPart = engine_cc ? `${engine_cc} куб. см` : '';
    const hpPart = power_hp ? `${power_hp} л.с.` : '';
    product_motor_type = [ccPart, hpPart].filter(Boolean).join(', ') || 'ДВС';
    product_motor_power = '';
  }

  // Seller address
  const sellerAddress = arg('sellerAddress', 'г. Нижний Новгород, пл. Комсомольская 2');

  // Warranty
  const warrantyMonths = arg('warrantyMonths', '12');

  // Spec number and appendix date
  const specNumber = `${now.getDate()}.${now.getMonth()+1}/${bike.id}`;
  const appendixDate = formatRuDate(now);

  // Short name: initials + surname (e.g. "Иванов И.И.")
  const nameParts = buyerFullName.split(/\s+/);
  let buyerShortName = buyerFullName;
  if (nameParts.length >= 3) {
    buyerShortName = `${nameParts[0]} ${nameParts[1].charAt(0)}.${nameParts[2].charAt(0)}.`;
  } else if (nameParts.length === 2) {
    buyerShortName = `${nameParts[0]} ${nameParts[1].charAt(0)}.`;
  }

  vars = {
    contract_number: `${now.getDate()}.${now.getMonth()+1}/${bike.id}`,
    contract_day: String(now.getDate()),
    contract_month_genitive: MONTH_GENITIVE[now.getMonth() + 1],
    contract_year: String(now.getFullYear()),
    buyer_full_name: buyerFullName,
    buyer_short_name: buyerShortName,
    buyer_birth_date: buyerBirthDate,
    buyer_passport_number: `${buyerPassportSeries} ${buyerPassportNumber}`.trim(),
    buyer_passport_issued_by: buyerPassportIssuedBy,
    buyer_passport_issue_date: buyerPassportIssueDate,
    buyer_registration: buyerRegistration,
    buyer_email: buyerEmail,
    seller_address: sellerAddress,
    price_digits: priceDigits,
    price_words: priceWords,
    price_digits_table: priceDigitsTable,
    product_name,
    product_color,
    product_type,
    product_motor_type,
    product_motor_power,
    product_vin,
    product_year,
    product_unit,
    spec_number: specNumber,
    appendix_date: appendixDate,
    warranty_months: warrantyMonths,
    document_key: `sale-${bike.id}-${Date.now()}`
  };

  // Filename
  const safeName = s => String(s || '').replace(/[^a-zA-Zа-яА-Я0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  docFileName = `sale-contract-${safeName(bike.make)}-${safeName(bike.model)}-${formatRuDate(now)}.docx`;
}

// ── Build Document ──────────────────────────────────────────────────────
let doc;

if (dealType === 'rent') {
  // RENT: HTML primary + MD fallback
  const mdTemplate = readFileSync(RENTAL_DOC_MD_TEMPLATE_PATH, 'utf8');

  if (RENTAL_DOC_TEMPLATE_MODE === 'html') {
    let htmlTemplate;
    try {
      htmlTemplate = readFileSync(RENTAL_DOC_HTML_TEMPLATE_PATH, 'utf8');
    } catch (readError) {
      console.warn(`[rental-doc] html template read failed, fallback to md: ${String(readError?.message || readError)}`);
    }

    if (!htmlTemplate) {
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
        console.warn(`[rental-doc] html\u2192docx failed, trying legacy adapter: ${String(error?.message || error)}`);
        try {
          const text = renderHtmlTemplateAdapterLegacy(htmlTemplate, vars);
          doc = new Document({sections:[{children: text.split('\n').map(line=>new Paragraph({children:[new TextRun({ text: line, font: 'Times New Roman' })]}))}]});
        } catch (e2) {
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

} else {
  // SALE: HTML only (no MD fallback)
  let htmlTemplate;
  try {
    htmlTemplate = readFileSync(SALE_DOC_HTML_TEMPLATE_PATH, 'utf8');
  } catch (readError) {
    failStage('template_read', 'sale_html_template_missing', { path: SALE_DOC_HTML_TEMPLATE_PATH, error: String(readError?.message || readError) });
  }

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
    console.error('[sale-doc] HTML\u2192DOCX: proper cheerio-based conversion (formatting preserved)');
  } catch (error) {
    console.warn(`[sale-doc] html\u2192docx failed, trying legacy adapter: ${String(error?.message || error)}`);
    try {
      const text = renderHtmlTemplateAdapterLegacy(htmlTemplate, vars);
      doc = new Document({sections:[{children: text.split('\n').map(line=>new Paragraph({children:[new TextRun({ text: line, font: 'Times New Roman' })]}))}]});
    } catch (e2) {
      failStage('doc_generation', 'sale_doc_generation_failed', { htmlError: String(error?.message || error), legacyError: String(e2?.message || e2) });
    }
  }
}

const buf = await Packer.toBuffer(doc);
const originalSha256 = createHash('sha256').update(buf).digest('hex');

// ── Telegram delivery (built-in, always) ─────────────────────────────────
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

// ── Result ───────────────────────────────────────────────────────────────
const result = {
  ok: true,
  dealType,
  requestedBikeId: bikeId,
  resolvedBikeId: bike.id,
  chatId: telegramChatId,
  messageId: json.result?.message_id,
  contractKey: vars.document_key,
  docFileName,
  isElectric,
  originalSha256,
  crewSlug,
};

if (dealType === 'rent') {
  result.templateMode = RENTAL_DOC_TEMPLATE_MODE;
  result.isHourlyRental = isHourlyRental;
  result.rentalHours = rentalHours;
  result.rentalDays = rentalDays;
  result.subtotal = vars.subtotal_rub;
} else {
  result.priceDigits = vars.price_digits;
  result.priceWords = vars.price_words;
  result.warrantyMonths = vars.warranty_months;
}

// ── Metadata persistence ────────────────────────────────────────────────
const saveMetadata = arg('saveMetadata', '0') !== '0';
const defaultMetadataTable = dealType === 'rent' ? 'rental_contract_artifacts' : 'sale_contract_artifacts';
const metadataTable = arg('metadataTable', defaultMetadataTable);

if (saveMetadata) {
  const payload = {
    contract_key: vars.document_key,
    requested_bike_id: bikeId,
    resolved_bike_id: bike.id,
    telegram_chat_id: telegramChatId,
    telegram_message_id: json.result?.message_id || null,
    original_sha256: originalSha256,
  };

  if (dealType === 'rent') {
    payload.renter_full_name = vars.renter_full_name;
    payload.rent_start_date = vars.rent_start_date;
    payload.rent_end_date = vars.rent_end_date;
  } else {
    payload.buyer_full_name = vars.buyer_full_name;
    payload.sale_price = vars.price_digits;
  }

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
