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
//   --salePrice         Sale price in rubles (sale only, HIGHEST priority — overrides bike.specs.sale_price)
//   --productColor      Override bike color in the contract (sale only). ALWAYS pass this for y-volt-style bikes that share a single DB record across multiple physical units — bike.specs.color is a generic catalog value, not the specific bike being sold.
//   --productVin        Override bike VIN / frame number in the contract (sale only). Use this when bike.specs.vin/frame is missing or "уточняется" — operator should OCR the actual frame sticker and pass the value here.
//   --dealDate          Override contract date (DD.MM.YYYY). For rent defaults to rent start date; for sale defaults to today.
//   --warrantyMonths    Warranty months (sale only, default 12)
//   --sellerAddress     Seller legal address (sale only, default "г. Нижний Новгород")
//   --lessorAddress     Lessor address (rent only)
//   --latePenalty        Late return penalty per day (rent only)
//   --latePenaltyMaxDays Late return max penalty days (rent only)
//   --subtotal          Override computed subtotal (rent only)
//   --bikeValueWords    Bike value in Russian words (rent only)
//   --stsInsteadOfDeposit  (rent only, FLAG, no value) Switch collateral mode:
//                          instead of taking a cash security deposit, take the
//                          renter's own vehicle СТС (Свидетельство о регистрации
//                          ТС) in pledge. Requires --stsJson. See
//                          /skills/rental-contract-from-photos/SKILL.md §"СТС-вместо-депозита".
//   --stsJson           (rent only) Path to СТС OCR JSON. Required when
//                          --stsInsteadOfDeposit is set. Schema:
//                          { series, number, issueDate, vehiclePlate, vehicleVin,
//                            vehicleModel, vehicleYear, ownerFullName,
//                            ownerRegistration }
//   --stsOwnerRelation  (rent only, optional) Relationship of СТС owner to
//                          renter when they differ — e.g. "жена", "отец",
//                          "доверенность". Default: "сам арендатор".
//   --stsPledgeReturnDays (rent only, optional) Working days to return СТС
//                          after bike return. Default: 3.
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
import { buildRentalContractVariables } from '../app/lib/rental-contract-vars.ts';

// Pricing: Uses shared buildRentalContractVariables for base calculation.
// Full tiered pricing calculator (3h/6h/12h tiers, multi-day discounts) lives in
// app/franchize/lib/pricing-calculator.ts but is NOT used here - the script
// calculates simple hourly/daily rates. Override with --subtotal flag if needed.

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
  // First pass: strip HTML comments so that any {{#if}}/{{else}}/{{/if}} or
  // {{var}} text used as documentation inside <!-- ... --> is NOT processed
  // as real template syntax. (Comments are not preserved in the final DOCX
  // anyway — htmlToDocxElements drops them.)
  let out = template.replace(/<!--[\s\S]*?-->/g, '');

  // Conditional blocks {{#if var}}...{{else}}...{{/if}}
  // Truthy: any non-empty string that is not "0" / "false" / "no". Numbers > 0 truthy.
  const isTruthy = (v) => {
    if (v === null || v === undefined) return false;
    if (typeof v === 'number') return v > 0;
    if (typeof v === 'boolean') return v;
    const s = String(v).trim().toLowerCase();
    if (s === '' || s === '0' || s === 'false' || s === 'no' || s === 'null' || s === 'undefined') return false;
    return true;
  };

  // Process INNERMOST blocks first: a block whose body contains NO nested
  // {{#if}} opener and NO nested {{/if}} closer. The negated lookahead
  // (?!...)(?:(?!\{\{#if\s)(?!\{\{/if\}\}).)  matches one char at a time,
  // failing fast if it sees either marker — so the body cannot contain a
  // nested conditional. The `s` (dotAll) flag lets `.` match newlines so
  // multi-line blocks (e.g. App.1's pledge clause spanning two <p> tags)
  // match correctly. This guarantees correct nesting behaviour.
  const blockRe = /\{\{#if\s+([a-zA-Z0-9_]+)\s*\}\}((?:(?!\{\{#if\s|\{\{\/if\}\}).)*?)\{\{\/if\}\}/gs;
  let guard = 0;
  while (guard++ < 100) {
    let replaced = false;
    out = out.replace(blockRe, (full, varName, body) => {
      replaced = true;
      let ifBranch = body, elseBranch = '';
      const elseIdx = body.indexOf('{{else}}');
      if (elseIdx >= 0) {
        ifBranch = body.slice(0, elseIdx);
        elseBranch = body.slice(elseIdx + '{{else}}'.length);
      }
      return isTruthy(vars[varName]) ? ifBranch : elseBranch;
    });
    if (!replaced) break;
  }

  // Final pass: simple {{var}} interpolation
  out = out.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, k) => String(vars[k] ?? ''));
  return out;
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

// ── СТС pledge (rent only, opt-in) ───────────────────────────────────────
// When --stsInsteadOfDeposit is set, the renter pledges the СТС of their own
// vehicle instead of paying a cash security deposit. The СТС OCR JSON must
// contain: series, number, ownerFullName, vehiclePlate (other fields optional).
let stsJson = null;
const stsPledgeEnabled = dealType === 'rent' && hasFlag('stsInsteadOfDeposit');
if (stsPledgeEnabled) {
  const stsPath = arg('stsJson');
  if (!stsPath) failStage('sts_parse', 'missing_stsJson', { hint: '--stsInsteadOfDeposit requires --stsJson <path> with СТС OCR JSON' });
  try {
    stsJson = JSON.parse(readFileSync(stsPath, 'utf8'));
  } catch (e) {
    failStage('sts_parse', 'sts_json_invalid', { hint: 'Could not parse --stsJson as JSON', error: String(e?.message || e) });
  }
  const stsSeries  = String(stsJson.series || '').trim();
  const stsNumber  = String(stsJson.number || '').trim();
  const stsOwner   = String(stsJson.ownerFullName || '').trim();
  const stsPlate   = String(stsJson.vehiclePlate || '').trim();
  if (!stsSeries || !stsNumber) failStage('sts_parse', 'missing_sts_series_number', { hint: 'sts.json must contain series and number (e.g. {"series":"77","number":"12345678"})' });
  if (!stsOwner)   failStage('sts_parse', 'missing_sts_owner');
  if (!stsPlate)   failStage('sts_parse', 'missing_sts_vehicle_plate');
  console.error(`[deal-contract] СТС pledge mode ENABLED: series=${stsSeries} number=${stsNumber} plate=${stsPlate} owner=${stsOwner}`);
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
// Separate client pointing at the PRIVATE schema (for metadata tables)
const supabasePrivate = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { db: { schema: 'private' } }
);

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

  // Calculate rental duration for subtotal
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

  // Pricing for subtotal calculation — operator overrides have HIGHEST priority
  const dailyPriceArg = Number(arg('dailyPrice', '0'));
  const hourlyPriceArg = Number(arg('hourlyPrice', '0'));
  const depositArg = Number(arg('deposit', '0'));

  const bikeDailyPrice = dailyPriceArg > 0 ? dailyPriceArg
    : Number(bike.specs?.dailyPrice) > 0 ? Number(bike.specs.dailyPrice)
    : Number(bike.specs?.rent_weekday) > 0 ? Number(bike.specs.rent_weekday)
    : Number(arg('dailyPrice', '10000'));
  const bikeHourlyPrice = hourlyPriceArg > 0 ? hourlyPriceArg
    : Number(bike.specs?.price_per_hour) > 0 ? Number(bike.specs.price_per_hour)
    : Number(arg('hourlyPrice', String(Math.round(bikeDailyPrice / 8))));

  let subtotal;
  if (isHourlyRental) {
    subtotal = bikeHourlyPrice * rentalHours;
  } else {
    subtotal = bikeDailyPrice * rentalDays;
  }
  const subtotalRounded = Math.round(subtotal);

  // ── СТС pledge vars (rent only) ─────────────────────────────────────────
  const stsPledgeReturnDays = Number(arg('stsPledgeReturnDays', '3')) || 3;
  const stsOwnerRelation = arg('stsOwnerRelation', 'сам арендатор');
  // If СТС owner differs from renter, require explicit relation disclosure
  if (stsPledgeEnabled && stsJson) {
    const stsOwnerNorm = String(stsJson.ownerFullName || '').trim().toLowerCase();
    const renterNorm   = String(passportJson.fullName || '').trim().toLowerCase();
    if (stsOwnerNorm && renterNorm && stsOwnerNorm !== renterNorm
        && stsOwnerRelation === 'сам арендатор') {
      failStage('sts_parse', 'sts_owner_mismatch', {
        hint: 'СТС owner differs from renter. Pass --stsOwnerRelation to disclose the relationship (e.g. "жена", "отец", "доверенность").',
        stsOwner: stsJson.ownerFullName,
        renter: passportJson.fullName,
      });
    }
  }

  // Build crew secrets object matching RentalCrewSecrets type
  const crewSecrets = {
    legalAddress: crewLegalAddress,
    returnAddress: crewReturnAddress,
    issuerName: crewIssuerName,
    signatoryRole: crewSignatoryRole,
    organizationRepresentative: crewIssuerRepresentative,
    organizationName: crewOrgName,
    organizationShort: crewOrgShort,
    ogrnip: crewOgrnip,
    inn: crewInn,
    bankAccount: crewBankAccount,
    bankName: crewBankName,
    bankCity: crewBankCity,
    bankCorrAccount: crewBankCorrAccount,
    email: crewEmail,
    contractDefaults,
  };

  // Use shared builder for rental contracts
  vars = buildRentalContractVariables({
    renter: {
      fullName: renterFullName,
      birthDate: renterBirthDate,
      phone: passportJson.phone || '',
      email: passportJson.email || '',
      passportSeries: renterPassportSeries,
      passportNumber: renterPassportNumber,
      passportIssueDate: passportJson.issueDate,
      passportIssuedBy: passportJson.issuedBy,
      registration: buyerRegistration,
      address: buyerRegistration,
      driverLicenseSeries: renterLicenseSeries,
      driverLicenseNumber: renterLicenseNumber,
    },
    bike: {
      id: bike.id,
      make: bike.make,
      model: bike.model,
      type: bike.type,
      specs: bike.specs,
    },
    period: {
      startDate,
      startTime: startTimeArg,
      endDate,
      endTime: endTimeArg,
      dailyPrice: Number(arg('dailyPrice')) || undefined,
      hourlyPrice: Number(arg('hourlyPrice')) || undefined,
      depositOverride: Number(arg('deposit')) || undefined,
    },
    crewSecrets,
    stsPledge: {
      used: stsPledgeEnabled,
      series: stsJson?.series,
      number: stsJson?.number,
      issueDate: stsJson?.issueDate,
      vehiclePlate: stsJson?.vehiclePlate,
      vehicleVin: stsJson?.vehicleVin,
      vehicleModel: stsJson?.vehicleModel,
      vehicleYear: stsJson?.vehicleYear,
      ownerFullName: stsJson?.ownerFullName,
      ownerRegistration: stsJson?.ownerRegistration,
      ownerRelation: stsOwnerRelation,
      pledgeReturnDays: stsPledgeReturnDays,
    },
    meta: {
      signatureTimestamp: now.toLocaleString('ru-RU'),
      signatureFingerprint: 'offline-skill',
      renterSignature: 'согласие через Telegram',
      documentKey: `rental-${bike.id}-${Date.now()}`,
    },
  });

  // Override subtotal with calculated value
  vars.subtotal_rub = arg('subtotal', String(subtotalRounded));

  // Add organization_representative (ИП Воробьев Р.В. — nominative) so the template
  // can use it instead of organization_short (ИП Воробьева Р.В. — genitive) where needed.
  vars.organization_representative = crewOrgRepresentative;
  vars.organization_name = crewOrgName;
  vars.organization_short = crewOrgShort;

  // Override contract date to use rent start date (or --dealDate) instead of today.
  // This affects {{day}}, {{month_num}}, {{year}}, {{contract_number}} placeholders in the template.
  if (dealDateArg) {
    const dm = dealDateArg.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
    if (dm) {
      let dy = dm[3]; if (dy.length === 2) dy = `20${dy}`;
      const dd = new Date(Number(dy), Number(dm[2]) - 1, Number(dm[1]));
      vars.day = String(dd.getDate()).padStart(2, '0');
      vars.month_num = String(dd.getMonth() + 1).padStart(2, '0');
      vars.year = String(dd.getFullYear());
      vars.contract_number = `${dd.getDate()}.${dd.getMonth() + 1}/${bike.id}`;
    }
  } else if (startDate) {
    const dp = parseRuDateParts(startDate);
    if (dp) {
      const dd = new Date(dp.y, dp.mo, dp.d);
      vars.day = String(dd.getDate()).padStart(2, '0');
      vars.month_num = String(dd.getMonth() + 1).padStart(2, '0');
      vars.year = String(dd.getFullYear());
      vars.contract_number = `${dd.getDate()}.${dd.getMonth() + 1}/${bike.id}`;
    }
  }

  // Override pricing vars — operator's CLI flags have HIGHEST priority.
  // buildRentalContractVariables may have populated these from bike.specs,
  // but if the operator passed --hourlyPrice / --dailyPrice / --deposit, those win.
  if (hourlyPriceArg > 0) vars.hourly_price_rub = String(hourlyPriceArg);
  if (dailyPriceArg > 0)  vars.daily_price_rub  = String(dailyPriceArg);
  if (depositArg > 0)     vars.deposit_rub      = String(depositArg);

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
  // Sale price — --salePrice has HIGHEST priority (operator override),
  // then bike.specs.sale_price, then bike.specs.price_rub
  const salePriceArg = Number(arg('salePrice', '0'));
  const salePriceRaw = salePriceArg > 0 ? salePriceArg
    : Number(bike.specs?.sale_price) > 0 ? Number(bike.specs.sale_price)
    : Number(bike.specs?.price_rub) > 0 ? Number(bike.specs.price_rub)
    : 0;
  if (!salePriceRaw || salePriceRaw <= 0) failStage('sale_price', 'missing_sale_price', { hint: 'Pass --salePrice <rubles> or ensure bike.specs.sale_price / price_rub is set' });

  const priceDigits = formatPriceDigits(salePriceRaw);
  const priceWords = numberToRussianWords(salePriceRaw);
  const priceDigitsTable = formatPriceDigits(salePriceRaw);

  // Product mapping from bike data
  // Product name — drop 'bike'/'ebike' (that's the type, not a brand)
  const rawMake = String(bike.make || '').trim();
  const isMakeType = ['bike', 'ebike', 'bicycle', 'мотоцикл', 'электро'].includes(rawMake.toLowerCase());
  const makeForName = isMakeType ? '' : rawMake;
  const product_name = `Мотоцикл ${makeForName} ${bike.model || ''}`.replace(/\s+/g, ' ').trim();

  // Product color — --productColor overrides bike.specs.color
  const productColorArg = String(arg('productColor', '')).trim();
  const product_color = productColorArg || bike.specs?.color || 'уточняется';

  // Product VIN / Frame No — --productVin overrides bike.specs.vin/frame/vin_number
  const productVinArg = String(arg('productVin', '')).trim();
  const product_vin = productVinArg || bike.specs?.vin || bike.specs?.frame || bike.specs?.vin_number || 'уточняется';
  const product_type = bike.specs?.subtype || bike.specs?.bike_type || (isElectric ? 'Электро' : 'Эндуро');
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
  // For rent contracts: contract date = rent start date (when the deal actually begins).
  // For sale contracts: contract date = today (the moment of signing).
  // Operator can override with --dealDate DD.MM.YYYY
  const dealDateArg = arg('dealDate', '');
  let dealDate = now;
  if (dealDateArg) {
    const dm = dealDateArg.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
    if (dm) {
      let dy = dm[3]; if (dy.length === 2) dy = `20${dy}`;
      dealDate = new Date(Number(dy), Number(dm[2]) - 1, Number(dm[1]));
    }
  } else if (dealType === 'rent' && startDate) {
    const dp = parseRuDateParts(startDate);
    // parseRuDateParts returns mo as 0-indexed (Number(month) - 1), so use directly
    if (dp) dealDate = new Date(dp.y, dp.mo, dp.d);
  }

  const specNumber = `${dealDate.getDate()}.${dealDate.getMonth()+1}/${bike.id}`;
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
    contract_number: `${dealDate.getDate()}.${dealDate.getMonth()+1}/${bike.id}`,
    contract_day: String(dealDate.getDate()),
    contract_month_genitive: MONTH_GENITIVE[dealDate.getMonth() + 1],
    contract_year: String(dealDate.getFullYear()),
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
    document_key: `sale-${bike.id}-${Date.now()}`,
    // Crew secrets for seller details
    organization_name: crewOrgName,
    organization_short: crewOrgShort,
    organization_representative: crewOrgRepresentative,
    legal_address: crewLegalAddress,
    ogrnip: crewOgrnip,
    inn: crewInn,
    bank_account: crewBankAccount,
    bank_name: crewBankName,
    bank_city: crewBankCity,
    bank_corr_account: crewBankCorrAccount,
    email: crewEmail
  };

  // Filename
  const safeName = s => String(s || '').replace(/[^a-zA-Zа-яА-Я0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  docFileName = `sale-contract-${safeName(bike.make)}-${safeName(bike.model)}-${formatRuDate(now)}.docx`;
}

// ── Build Document ──────────────────────────────────────────────────────
let doc;

if (dealType === 'rent') {
  // RENT: HTML primary + MD fallback
  let mdTemplate = '';
  try {
    mdTemplate = readFileSync(RENTAL_DOC_MD_TEMPLATE_PATH, 'utf8');
  } catch (mdReadErr) {
    // MD template is optional — we only need it as a fallback if HTML fails
  }

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

  // ── Save DOCX to disk (always, for fallback / audit) ────────────────────
const buf = await Packer.toBuffer(doc);
const originalSha256 = createHash('sha256').update(buf).digest('hex');
  const fsPromises = await import('node:fs/promises');
  const downloadDir = '/home/z/my-project/download';
  try { await fsPromises.mkdir(downloadDir, { recursive: true }); } catch (_) {}
  const localDocPath = `${downloadDir}/${docFileName}`;
  await fsPromises.writeFile(localDocPath, buf);
  console.error(`[deal-contract] DOCX saved to disk: ${localDocPath}`);

// ── Telegram delivery (built-in, always) ─────────────────────────────────
const token = process.env.TELEGRAM_BOT_TOKEN;
const telegramUrl = `https://api.telegram.org/bot${token}/sendDocument`;
let json;
let usedFallback = false;
try {
  const form = new FormData();
  form.append('chat_id', telegramChatId);
  form.append('document', new Blob([buf], {type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}), docFileName);
  const res = await fetch(telegramUrl, {method:'POST', body: form});
  json = await res.json();
} catch (networkError) {
  json = { ok: false, error_code: 'network', description: String(networkError?.message || networkError) };
}

// ── Fallback: forward-telegram API on Vercel ──────────────────────────────
// Triggered when:
//   - Direct Telegram call failed (401 Unauthorized / network error / rate limit)
//   - TELEGRAM_BOT_TOKEN is missing/empty
//
// The forward-telegram API expects a JSON body:
//   { chat_id, method: "sendDocument", payload: { caption, parse_mode },
//     files: { document: { data: <base64>, filename, contentType } } }
// And requires Origin: https://v0-car-test.vercel.app header.
if (!json.ok) {
  console.error(`[deal-contract] Direct Telegram delivery failed (code=${json.error_code}). Trying forward-telegram fallback...`);
  const forwardUrl = process.env.FORWARD_TELEGRAM_URL || 'https://v0-car-test.vercel.app/api/forward-telegram';
  const docB64 = buf.toString('base64');
  const fwdBody = {
    chat_id: telegramChatId,
    method: 'sendDocument',
    payload: {
      caption: `Договор ${dealType === 'sale' ? 'купли-продажи' : 'аренды'} ${bike.id} — ${docFileName}`,
      parse_mode: 'HTML',
    },
    files: {
      document: {
        data: docB64,
        filename: docFileName,
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      },
    },
  };
  try {
    const fwdRes = await fetch(forwardUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://v0-car-test.vercel.app',
      },
      body: JSON.stringify(fwdBody),
    });
    const fwdText = await fwdRes.text();
    let fwdJson;
    try { fwdJson = JSON.parse(fwdText); } catch (_) { fwdJson = { ok: false, raw: fwdText }; }
    if (fwdRes.ok && fwdJson.ok) {
      json = { ok: true, result: { message_id: fwdJson.result?.message_id || fwdJson.message_id || 0 } };
      usedFallback = true;
      console.error(`[deal-contract] ✓ forward-telegram fallback OK (message_id=${json.result.message_id})`);
    } else {
      console.error(`[deal-contract] forward-telegram fallback FAILED: HTTP ${fwdRes.status} — ${fwdText.slice(0, 400)}`);
    }
  } catch (fwdErr) {
    console.error(`[deal-contract] forward-telegram fallback EXCEPTION: ${fwdErr?.message || fwdErr}`);
  }
}

if (!json.ok) {
  // Don't hard-fail anymore — we still have the DOCX on disk.
  // Surface a soft warning so the agent can deliver the file another way.
  console.error(`[deal-contract] WARNING: Telegram delivery failed (direct + fallback). DOCX is still on disk at ${localDocPath}`);
  json = { ok: true, result: { message_id: null }, _warning: 'telegram_delivery_failed_file_saved', _localPath: localDocPath };
}

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
  usedFallback,
  localDocPath,
};

if (dealType === 'rent') {
  result.templateMode = RENTAL_DOC_TEMPLATE_MODE;
  result.isHourlyRental = isHourlyRental;
  result.rentalHours = rentalHours;
  result.rentalDays = rentalDays;
  result.subtotal = vars.subtotal_rub;
  if (stsPledgeEnabled) {
    result.stsPledgeUsed = true;
    result.stsSeries = vars.sts_series;
    result.stsNumber = vars.sts_number;
    result.stsVehiclePlate = vars.sts_vehicle_plate;
    result.stsOwnerFullName = vars.sts_owner_full_name;
    result.stsOwnerRelation = vars.sts_owner_relation;
    result.stsPledgeReturnDays = vars.sts_pledge_return_days;
    result.depositAmountSkipped = vars.sts_deposit_amount_skipped;
  } else {
    result.stsPledgeUsed = false;
  }
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
    // Pricing fields for dashboard (daily_price_rub, deposit_rub, total_sum from contract builder)
    payload.daily_price = vars.daily_price_rub;
    payload.deposit_rub = vars.deposit_rub;
    payload.total_sum = vars.subtotal_rub;
    // СТС pledge metadata (columns added by migration 20260617000000_rental_sts_pledge.sql)
    payload.sts_pledge_used = stsPledgeEnabled;
    if (stsPledgeEnabled) {
      payload.sts_series             = vars.sts_series;
      payload.sts_number             = vars.sts_number;
      payload.sts_issue_date         = vars.sts_issue_date;
      payload.sts_vehicle_plate      = vars.sts_vehicle_plate;
      payload.sts_vehicle_vin        = vars.sts_vehicle_vin;
      payload.sts_vehicle_model      = vars.sts_vehicle_model;
      payload.sts_vehicle_year       = vars.sts_vehicle_year;
      payload.sts_owner_full_name    = vars.sts_owner_full_name;
      payload.sts_owner_registration = vars.sts_owner_registration;
      payload.sts_owner_relation     = vars.sts_owner_relation;
      payload.sts_pledge_return_days = Number(stsPledgeReturnDays);
      payload.deposit_amount_skipped = vars.sts_deposit_amount_skipped;
    }
  } else {
    payload.buyer_full_name = vars.buyer_full_name;
    payload.sale_price = vars.price_digits;
  }

  const writeRes = await supabasePrivate.from(metadataTable).insert(payload).select('contract_key').limit(1);
  if (writeRes.error) {
    console.error('[deal-contract] SUPABASE ERROR FULL:', JSON.stringify(writeRes.error, null, 2));
    console.error('[deal-contract] PAYLOAD WAS:', JSON.stringify(payload, null, 2));
    failStage('metadata_write', 'metadata_write_failed', { table: metadataTable, error: writeRes.error.message, code: writeRes.error.code, hint: writeRes.error.hint, details: writeRes.error.details });
  }
  const verifyRes = await supabasePrivate.from(metadataTable).select('contract_key').eq('contract_key', vars.document_key).maybeSingle();
  if (verifyRes.error || !verifyRes.data?.contract_key) {
    failStage('metadata_verify', 'read_after_write_verification_failed', { table: metadataTable, contractKey: vars.document_key, error: verifyRes.error?.message || null });
  }
  result.metadataVerified = true;
  result.metadataTable = metadataTable;
}

console.log(JSON.stringify(result, null, 2));
