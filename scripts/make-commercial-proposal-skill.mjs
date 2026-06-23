#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// make-commercial-proposal-skill.mjs — Commercial proposal generator
// ═══════════════════════════════════════════════════════════════════════════
//
// USAGE:
//   node make-commercial-proposal-skill.mjs --offerType rent --clientName "ООО Вектор" --telegramChatId 123
//   node make-commercial-proposal-skill.mjs --offerType sale --clientName "Иванов И.И." --telegramChatId 123
//
// ─── SUPPORTED CLI FLAGS ───────────────────────────────────────────────────
//   --offerType        (REQUIRED) "rent", "sale", "test-drive", "corporate", "custom"
//   --clientName       (REQUIRED) Client organization/individual name
//   --telegramChatId   Telegram chat ID for delivery (fallback: ADMIN_CHAT_ID env)
//   --userId           User ID to determine crew membership and load crew secrets
//   --crewSlug         Optional crew override (skips crew lookup)
//   --validityDays     Validity period in days (default 30)
//   --warrantyMonths   Warranty months (default 12)
//   --totalPrice       Total price in rubles (required unless pricing_table provided)
//   --offerSummary     Brief description of the offer (default: based on offerType)
//   --pricingTable     Custom pricing table HTML
//   --offerDescription  Detailed offer description
//   --specialConditions Special conditions text
//   --paymentTerms     Payment terms (default: "100% предоплата")
//   --deliveryTerms    Delivery terms (default: "в течение 5 рабочих дней")
//   --clientAddress    Client address (optional, shown in signature block)
//   --clientInn        Client INN (optional, shown in signature block)
//   --clientDetails    Additional client details (optional)
//   --clientPhone      Client phone (optional)
//   --clientEmail      Client email (optional)
//   --includeBikeCatalog  Set to "1" (default for rent/sale) or "0" to control bike catalog
//   --bikeFilter       Filter bike catalog (e.g. "electric" for e-bikes only, "gas" for ICE)
//   --saveMetadata     Set to "1" to write metadata to Supabase
//   --metadataTable    Override metadata table name (default: commercial_proposal_artifacts)
//
// ─── FLAGS THAT DO NOT EXIST (anti-hallucination) ──────────────────────────
//   --skipTelegram      DOES NOT EXIST. Telegram delivery is always built-in.
//   --outPath           DOES NOT EXIST. No local file output option.
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

// ── Offer type validation ─────────────────────────────────────────────────
const offerType = String(arg('offerType', '')).trim().toLowerCase();
const validOfferTypes = ['rent', 'sale', 'test-drive', 'corporate', 'custom'];
if (!validOfferTypes.includes(offerType)) {
  const payload = { ok: false, stage: 'offer_type', reason: 'missing_or_invalid_offerType', details: { expected: validOfferTypes.join(', '), received: offerType || '(empty)' } };
  console.error(JSON.stringify(payload, null, 2));
  process.exit(2);
}

// ── Template path ────────────────────────────────────────────────────────
const PROPOSAL_HTML_TEMPLATE_PATH = 'docs/COMMERCIAL_PROPOSAL_TEMPLATE.html';

// ── Utility functions ────────────────────────────────────────────────────

function renderTemplateWithVars(template, vars) {
  // First pass: strip HTML comments so that any {{#if}}/{{else}}/{{/if}} or
  // {{var}} text used as documentation inside <!-- ... --> is NOT processed
  // as real template syntax.
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
  // {{#if}} opener and NO nested {{/if}} closer. The `s` (dotAll) flag lets
  // `.` match newlines so multi-line blocks match correctly.
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

  // Triple-brace raw HTML: {{{var}}} — no escaping (use for HTML fragments like
  // pricing_table, bike_catalog_table, special_conditions)
  out = out.replace(/\{\{\{\s*([a-zA-Z0-9_]+)\s*\}\}\}/g, (_, k) => String(vars[k] ?? ''));

  // Final pass: simple {{var}} interpolation (escaped)
  out = out.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, k) => String(vars[k] ?? ''));
  return out;
}

function failStage(stage, reason, details = {}) {
  const payload = { ok: false, stage, reason, details };
  console.error(JSON.stringify(payload, null, 2));
  process.exit(2);
}

function formatRuDate(d) {
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
}

// ── Russian month genitive ───────────────────────────────────────────────
const MONTH_GENITIVE = [
  '', 'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

// ── Number to Russian words ────────────────────────────────────────────────
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
    if (o > 0) parts.push(genderF ? ONES_F[o] : ONES_M[o]);
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
      const genderF = scaleIdx === 1;
      const words = tripleToWords(triple, genderF);
      const suffix = pluralScale(triple, SCALE[scaleIdx]);
      const chunk = [words, suffix].filter(Boolean).join(' ');
      parts.unshift(chunk);
    }
    n = Math.floor(n / 1000);
    scaleIdx++;
  }
  const result = parts.join(' ');
  return (isNeg ? 'минус ' : '') + result.charAt(0).toUpperCase() + result.slice(1);
}

// ── Format number with space separator ───────────────────────────────────
function formatPriceDigits(num) {
  return String(num).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

// ── Offer type labels ─────────────────────────────────────────────────────
const OFFER_TYPE_LABELS = {
  'rent': 'Услуги проката мототехники',
  'sale': 'Продажа мототехники',
  'test-drive': 'Тест-драйв мототехники',
  'corporate': 'Корпоративное сотрудничество',
  'custom': 'Индивидуальные условия'
};

const DEFAULT_OFFER_SUMMARIES = {
  'rent': 'организации проката мототехники (электромотоциклы и мотоциклы различных классов)',
  'sale': 'продажи электромотоциклов и мототехники',
  'test-drive': 'предоставления услуги тест-драйва мототехники',
  'corporate': 'долгосрочного корпоративного сотрудничества в сфере мотопроката',
  'custom': 'предоставления услуг по индивидуальному запросу'
};

// ── Required arguments ───────────────────────────────────────────────────
const clientName = arg('clientName', '');
if (!clientName) failStage('client_parse', 'missing_client_name', { hint: '--clientName is required' });

const telegramChatId = arg('telegramChatId', process.env.ADMIN_CHAT_ID || '');
if (!telegramChatId) failStage('telegram_parse', 'missing_telegramChatId', { hint: '--telegramChatId or ADMIN_CHAT_ID env is required' });

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
      }
    } catch (error) {
      console.warn(`[proposal] Crew lookup failed for userId ${userId}: ${error.message}`);
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
  }
} catch (error) {
  console.warn(`[proposal] Failed to load crew_secrets for ${crewSlug}: ${error.message}`);
}

// Extract contract defaults with fallbacks
const contractDefaults = crewSecrets.contractDefaults || {};
const orgName = contractDefaults.organizationName || 'Мотосалон ВипБайкЭлектро';
const orgShort = contractDefaults.organizationShort || 'ИП Воробьева Р.В.';
const orgRepresentative = contractDefaults.organizationRepresentative || 'ИП Воробьев Р.В.';
const ogrnip = contractDefaults.ogrnip || '326527500025145';
const inn = contractDefaults.inn || '525813643035';
const bankAccount = contractDefaults.bankAccount || '40802810942710013083';
const bankName = contractDefaults.bankName || 'Волго-Вятский Банк ПАО Сбербанк';
const bankCity = contractDefaults.bankCity || 'г. Нижний Новгород';
const bankCorrAccount = contractDefaults.bankCorrAccount || '30101810900000000603';
const email = contractDefaults.email || 'vip_bike@mail.ru';
const legalAddress = contractDefaults.legalAddress || 'г. Нижний Новгород, пл. Комсомольская 2';
const phone = contractDefaults.phone || '+7 9200-789-888';

// Extract city from legal address (defaults to Нижний Новгород)
const city = legalAddress.split(',')[0]?.trim() || 'Нижний Новгород';

// ── Bike catalog fetch (rent / sale offers) ───────────────────────────────
// For rent/sale offers we fetch bikes from `cars` table and render a pricing
// table. Skipped for test-drive / corporate / custom unless --includeBikeCatalog=1.
const includeBikeCatalogExplicit = arg('includeBikeCatalog', '');
const bikeFilter = arg('bikeFilter', '').trim().toLowerCase();
const wantBikeCatalog = includeBikeCatalogExplicit === '1'
  ? true
  : includeBikeCatalogExplicit === '0'
    ? false
    : (offerType === 'rent' || offerType === 'sale');

let bikeCatalogRows = [];
let bikeCatalogTable = '';

if (wantBikeCatalog) {
  try {
    // Get crew_id for filtering bikes
    let crewIdFilter = null;
    try {
      const { data: crewData } = await supabase
        .from('crews')
        .select('id')
        .eq('slug', crewSlug)
        .maybeSingle();
      if (crewData?.id) {
        crewIdFilter = crewData.id;
        console.error(`[proposal] Filtering bikes by crew_id: ${crewIdFilter} (${crewSlug})`);
      }
    } catch (crewErr) {
      console.warn(`[proposal] Failed to fetch crew_id, showing all bikes: ${crewErr?.message || crewErr}`);
    }

    const pageSize = 1000;
    let from = 0;
    const all = [];
    while (true) {
      const to = from + pageSize - 1;
      let query = supabase
        .from('cars')
        .select('id, make, model, type, specs')
        .in('type', ['bike', 'ebike']);
      // Filter by crew_id if available
      if (crewIdFilter) {
        query = query.eq('crew_id', crewIdFilter);
      }
      const { data, error } = await query.range(from, to);
      if (error) throw error;
      if (!data?.length) break;
      all.push(...data);
      if (data.length < pageSize) break;
      from += pageSize;
    }

    // Apply filter
    bikeCatalogRows = all.filter(b => {
      if (!bikeFilter) return true;
      const isElectric = b.type === 'ebike'
        || /electric/i.test(String(b.specs?.type || ''))
        || /электро|electric/i.test(String(b.specs?.fuel_type || ''))
        || (b.specs?.power_kw && Number(b.specs.power_kw) > 0 && !b.specs?.engine_cc);
      if (bikeFilter === 'electric') return isElectric;
      if (bikeFilter === 'gas' || bikeFilter === 'ice') return !isElectric;
      // Generic: match against id/make/model
      const hay = `${b.id} ${b.make} ${b.model}`.toLowerCase();
      return hay.includes(bikeFilter);
    });

    // Build catalog table
    if (bikeCatalogRows.length > 0) {
      const rowsHtml = bikeCatalogRows.map(b => {
        const isElectric = b.type === 'ebike'
          || /electric/i.test(String(b.specs?.type || ''))
          || (b.specs?.power_kw && Number(b.specs.power_kw) > 0 && !b.specs?.engine_cc);
        const priceRent = b.specs?.dailyPrice || b.specs?.rent_weekday || '';
        const priceSale = b.specs?.sale_price || b.specs?.price_rub || '';
        const priceCell = offerType === 'sale'
          ? (priceSale ? `${formatPriceDigits(Number(priceSale))}` : '—')
          : (priceRent ? `${formatPriceDigits(Number(priceRent))} ₽/сут` : '—');
        const powerCell = isElectric
          ? (b.specs?.power_kw ? `${b.specs.power_kw} кВт` : '—')
          : (b.specs?.engine_cc ? `${b.specs.engine_cc} см³` : '—');
        const tierCell = b.specs?.access_tier || '';
        const tierEmoji = tierCell === 'pro' ? '🔴' : tierCell === 'mid' ? '🟡' : tierCell === 'entry' ? '🟢' : '⚪';
        return `<tr>
<td style="border: 1px solid #000; padding: 6pt;">${tierEmoji} ${b.make || ''} ${b.model || ''}</td>
<td style="border: 1px solid #000; padding: 6pt; text-align: center;">${isElectric ? 'Электро' : 'ДВС'}</td>
<td style="border: 1px solid #000; padding: 6pt; text-align: center;">${powerCell}</td>
<td style="border: 1px solid #000; padding: 6pt; text-align: right;">${priceCell}</td>
<td style="border: 1px solid #000; padding: 6pt; text-align: center;">${b.specs?.deposit_rub ? formatPriceDigits(Number(b.specs.deposit_rub)) : '—'}</td>
</tr>`;
      }).join('\n');
      bikeCatalogTable = `<table style="width: 100%; border-collapse: collapse; margin: 12pt 0;">
<tr style="background-color: #f0f0f0;">
<th style="border: 1px solid #000; padding: 6pt; text-align: left;">Марка / модель</th>
<th style="border: 1px solid #000; padding: 6pt;">Тип</th>
<th style="border: 1px solid #000; padding: 6pt;">Двигатель</th>
<th style="border: 1px solid #000; padding: 6pt; text-align: right;">Цена${offerType === 'sale' ? '' : ' (аренда)'}</th>
<th style="border: 1px solid #000; padding: 6pt;">Депозит</th>
</tr>
${rowsHtml}
</table>`;
    }
    console.error(`[proposal] Loaded ${bikeCatalogRows.length} bikes from catalog (filter=${bikeFilter || 'none'})`);
  } catch (e) {
    console.warn(`[proposal] Bike catalog fetch failed: ${String(e?.message || e)}`);
  }
}

// ── Build template variables ─────────────────────────────────────────────
const now = new Date();
const validityDays = Number(arg('validityDays', '30'));
const validityDate = new Date(now);
validityDate.setDate(now.getDate() + validityDays);

const totalPriceRaw = Number(arg('totalPrice', '0'));
const totalPriceDigits = formatPriceDigits(totalPriceRaw);
const totalPriceWords = totalPriceRaw > 0 ? numberToRussianWords(totalPriceRaw) : 'Договариваются дополнительно';

// Offer type specific defaults
const offerTypeLabel = OFFER_TYPE_LABELS[offerType] || OFFER_TYPE_LABELS.custom;
const offerSummary = arg('offerSummary', DEFAULT_OFFER_SUMMARIES[offerType] || DEFAULT_OFFER_SUMMARIES.custom);

// Pricing table - can be provided or auto-generated
let pricingTable = arg('pricingTable', '');
if (!pricingTable && totalPriceRaw > 0) {
  pricingTable = `<table style="width: 100%; border: 1px solid #000; margin: 12pt 0; border-collapse: collapse;">
<tr style="background-color: #f0f0f0;">
<th style="border: 1px solid #000; padding: 8pt; text-align: left;">Наименование услуги</th>
<th style="border: 1px solid #000; padding: 8pt; text-align: center;">Ед. изм.</th>
<th style="border: 1px solid #000; padding: 8pt; text-align: right;">Цена, руб.</th>
</tr>
<tr>
<td style="border: 1px solid #000; padding: 8pt;">${offerTypeLabel}</td>
<td style="border: 1px solid #000; padding: 8pt; text-align: center;">комплект</td>
<td style="border: 1px solid #000; padding: 8pt; text-align: right;">${totalPriceDigits}</td>
</tr>
</table>`;
} else if (!pricingTable) {
  pricingTable = '<p style="text-indent: 1.25cm;">Стоимость услуг определяется договором при заключении.</p>';
}

const vars = {
  proposal_number: `${now.getDate()}.${now.getMonth()+1}/${now.getFullYear()}`,
  day: String(now.getDate()).padStart(2,'0'),
  month_genitive: MONTH_GENITIVE[now.getMonth() + 1],
  year: String(now.getFullYear()),
  validity_day: String(validityDate.getDate()),
  validity_month_genitive: MONTH_GENITIVE[validityDate.getMonth() + 1],
  validity_year: String(validityDate.getFullYear()),
  validity_days: String(validityDays),

  organization_name: orgName,
  organization_short: orgShort,
  organization_representative: orgRepresentative,
  ogrnip,
  inn,
  bank_account: bankAccount,
  bank_name: bankName,
  bank_city: bankCity,
  bank_corr_account: bankCorrAccount,
  email,
  legal_address: legalAddress,
  phone,
  city,

  client_name: clientName,
  client_address: arg('clientAddress', 'уточняется при заключении договора'),
  client_inn: arg('clientInn', ''),
  client_details: arg('clientDetails', ''),
  client_phone: arg('clientPhone', ''),
  client_email: arg('clientEmail', ''),
  offer_type_label: offerTypeLabel,
  offer_summary: offerSummary,
  offer_description: arg('offerDescription', `Услуги по ${offerSummary} оказываются в соответствии с условиями настоящего коммерческого предложения.`),
  pricing_table: pricingTable,
  total_price_digits: totalPriceDigits,
  total_price_words: totalPriceWords,
  payment_terms: arg('paymentTerms', '100% предоплата'),
  delivery_terms: arg('deliveryTerms', 'в течение 5 рабочих дней с даты оплаты'),
  warranty_months: arg('warrantyMonths', '12'),
  special_conditions: arg('specialConditions', 'Особые условия отсутствуют.'),

  document_key: `proposal-${crewSlug}-${Date.now()}`,

  // ── Per-offerType flags for {{#if}} conditionals in template ──────────────
  offer_type_is_rent: offerType === 'rent' ? '1' : '',
  offer_type_is_sale: offerType === 'sale' ? '1' : '',
  offer_type_is_test_drive: offerType === 'test-drive' ? '1' : '',
  offer_type_is_corporate: offerType === 'corporate' ? '1' : '',
  offer_type_is_custom: offerType === 'custom' ? '1' : '',

  // ── Bike catalog table (raw HTML, rendered via {{{bike_catalog_table}}}) ──
  // Empty when catalog fetch was skipped or returned no rows — the
  // {{#if bike_catalog_table}} block in the template then hides the whole
  // §2.1 section.
  bike_catalog_table: bikeCatalogTable,
};

// Filename
const safeName = s => String(s || '').replace(/[^a-zA-Zа-яА-Я0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
const docFileName = `commercial-proposal-${offerType}-${safeName(clientName)}-${formatRuDate(now)}.docx`;

// ── Build Document ──────────────────────────────────────────────────────
let doc;

try {
  let htmlTemplate;
  try {
    htmlTemplate = readFileSync(PROPOSAL_HTML_TEMPLATE_PATH, 'utf8');
  } catch (readError) {
    failStage('template_read', 'proposal_html_template_missing', { path: PROPOSAL_HTML_TEMPLATE_PATH, error: String(readError?.message || readError) });
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
    console.error('[proposal-doc] HTML→DOCX: proper cheerio-based conversion (formatting preserved)');
  } catch (error) {
    console.warn(`[proposal-doc] html→docx failed: ${String(error?.message || error)}`);
    failStage('doc_generation', 'proposal_doc_generation_failed', { htmlError: String(error?.message || error) });
  }
} catch (error) {
  failStage('doc_build', 'proposal_doc_build_failed', { error: String(error?.message || error) });
}

const buf = await Packer.toBuffer(doc);
const originalSha256 = createHash('sha256').update(buf).digest('hex');

// ── QR code for "1-click accept" ──────────────────────────────────────────
// Deep-link format mirrors the rental flow's QR pattern:
//   https://t.me/<botUsername>/app?startapp=proposal_<proposalKey>_<sha256>
// When client scans, Telegram opens the bot's WebApp with the proposal key
// pre-filled, enabling 1-tap accept.
const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'oneBikePlsBot';
const qrDeepLink = `https://t.me/${botUsername}/app?startapp=proposal_${vars.document_key}_${originalSha256}`;
const qrPngUrl = `https://api.qrserver.com/v1/create-qr-code/?size=420x420&data=${encodeURIComponent(qrDeepLink)}&color=000000&bgcolor=ffffff&margin=1`;

let qrPngBuffer = null;
try {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  const qrRes = await fetch(qrPngUrl, { signal: controller.signal });
  clearTimeout(timeoutId);
  if (qrRes.ok) qrPngBuffer = Buffer.from(await qrRes.arrayBuffer());
} catch (qrErr) {
  console.warn('[proposal-doc] QR generation failed, sending DOCX only:', qrErr?.message || qrErr);
}

// ── Telegram delivery (built-in, always) ─────────────────────────────────
const token = process.env.TELEGRAM_BOT_TOKEN;
let json;
let docSent = false;

if (qrPngBuffer) {
  // Try sending DOCX + QR as a media group (album)
  try {
    const form = new FormData();
    form.append('chat_id', telegramChatId);
    form.append('media', JSON.stringify([
      { type: 'document', media: 'attach://docx' },
      { type: 'photo', media: 'attach://qr', caption: `📲 <b>QR для акцепта КП</b>\nНаведите камеру — откроется бот с предзаполненными данными.\n\n🔗 ${qrDeepLink}`, parse_mode: 'HTML' },
    ]));
    form.append('docx', new Blob([buf], {type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}), docFileName);
    form.append('qr', new Blob([qrPngBuffer], {type:'image/png'}), `qr-proposal.png`);

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMediaGroup`, {method:'POST', body: form});
    json = await res.json();
    if (json?.ok) {
      docSent = true;
      console.error('[proposal-doc] DOCX + QR sent as media group');
    } else {
      console.warn('[proposal-doc] sendMediaGroup failed:', json?.description);
    }
  } catch (e) {
    console.warn('[proposal-doc] sendMediaGroup exception:', e?.message || e);
  }
}

if (!docSent) {
  // Fallback: send DOCX alone via sendDocument
  const telegramUrl = `https://api.telegram.org/bot${token}/sendDocument`;
  const caption = `КП: ${offerTypeLabel}\nКлиент: ${clientName}\n\n🔗 Акцепт: ${qrDeepLink}`;
  try {
    const form = new FormData();
    form.append('chat_id', telegramChatId);
    form.append('caption', caption);
    form.append('document', new Blob([buf], {type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}), docFileName);
    const res = await fetch(telegramUrl, {method:'POST', body: form});
    json = await res.json();
    if (json?.ok) docSent = true;
  } catch (networkError) {
    const tmpFile = `/tmp/proposal-${Date.now()}.docx`;
    await import('node:fs/promises').then(fs => fs.writeFile(tmpFile, buf));
    const curl = spawnSync('curl', ['-sS', '-X', 'POST', telegramUrl, '-F', `chat_id=${telegramChatId}`, '-F', `caption=${caption}`, '-F', `document=@${tmpFile}`], { encoding: 'utf8' });
    if (curl.status !== 0) throw new Error(`Telegram curl send failed: ${curl.stderr || curl.stdout}`);
    json = JSON.parse(curl.stdout || '{}');
    if (json?.ok) docSent = true;
  }
}

if (!docSent || !json?.ok) failStage('telegram_delivery', 'telegram_send_failed', { telegram: json });

// ── Result ───────────────────────────────────────────────────────────────
const result = {
  ok: true,
  offerType,
  clientName,
  crewSlug,
  chatId: telegramChatId,
  messageId: json.result?.message_id,
  proposalKey: vars.document_key,
  docFileName,
  originalSha256,
  validityDays,
  totalPrice: totalPriceRaw > 0 ? { digits: totalPriceDigits, words: totalPriceWords } : null,
  bikeCatalogIncluded: bikeCatalogRows.length > 0,
  bikeCatalogCount: bikeCatalogRows.length,
  bikeFilter: bikeFilter || null,
  qrDeepLink,
  qrIncluded: !!qrPngBuffer,
};

// ── Metadata persistence ────────────────────────────────────────────────
const saveMetadata = arg('saveMetadata', '0') !== '0';
const metadataTable = arg('metadataTable', 'commercial_proposal_artifacts');

if (saveMetadata) {
  const payload = {
    proposal_key: vars.document_key,
    crew_slug: crewSlug,
    client_name: clientName,
    offer_type: offerType,
    client_inn: arg('clientInn', '') || null,
    client_phone: arg('clientPhone', '') || null,
    client_email: arg('clientEmail', '') || null,
    telegram_chat_id: telegramChatId,
    telegram_message_id: json.result?.message_id || null,
    original_sha256: originalSha256,
    validity_days: validityDays,
    total_price: totalPriceRaw > 0 ? totalPriceRaw : null,
    bike_filter: bikeFilter || null,
    bike_catalog_count: bikeCatalogRows.length,
    template_version: 1,
  };

  // Use schema-qualified path for the private table
  const writeRes = await supabase
    .schema('private')
    .from(metadataTable)
    .insert(payload)
    .select('proposal_key')
    .limit(1);
  if (writeRes.error) failStage('metadata_write', 'metadata_write_failed', { table: metadataTable, error: writeRes.error.message });

  // Read-after-write verification
  const verifyRes = await supabase
    .schema('private')
    .from(metadataTable)
    .select('proposal_key')
    .eq('proposal_key', vars.document_key)
    .maybeSingle();
  if (verifyRes.error || !verifyRes.data?.proposal_key) {
    failStage('metadata_verify', 'read_after_write_verification_failed', { table: metadataTable, proposalKey: vars.document_key, error: verifyRes.error?.message || null });
  }
  result.metadataVerified = true;
  result.metadataTable = metadataTable;
}

console.log(JSON.stringify(result, null, 2));
