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
//   --saveMetadata     Set to "1" to write metadata to Supabase
//   --metadataTable    Override metadata table name
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
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_,k)=> String(vars[k] ?? ''));
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

  client_name: clientName,
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

  document_key: `proposal-${crewSlug}-${Date.now()}`
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
  const tmpFile = `/tmp/proposal-${Date.now()}.docx`;
  await import('node:fs/promises').then(fs => fs.writeFile(tmpFile, buf));
  const curl = spawnSync('curl', ['-sS', '-X', 'POST', telegramUrl, '-F', `chat_id=${telegramChatId}`, '-F', `document=@${tmpFile}`], { encoding: 'utf8' });
  if (curl.status !== 0) throw new Error(`Telegram curl send failed: ${curl.stderr || curl.stdout}`);
  json = JSON.parse(curl.stdout || '{}');
}
if (!json.ok) failStage('telegram_delivery', 'telegram_send_failed', { telegram: json });

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
    telegram_chat_id: telegramChatId,
    telegram_message_id: json.result?.message_id || null,
    original_sha256: originalSha256,
    validity_days: validityDays,
    total_price: totalPriceRaw > 0 ? totalPriceRaw : null,
  };

  const writeRes = await supabase.from(metadataTable).insert(payload).select('proposal_key').limit(1);
  if (writeRes.error) failStage('metadata_write', 'metadata_write_failed', { table: metadataTable, error: writeRes.error.message });
  result.metadataVerified = true;
  result.metadataTable = metadataTable;
}

console.log(JSON.stringify(result, null, 2));
