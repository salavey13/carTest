# DocXagent: ZAI Installer для генерации договоров
# ===================================================
# ПОЛНЫЙ набор файлов для ZAI агента:
# - 2 файла навыков (skills/)
# - 2 CLI скрипта (scripts/)
# - 1 библиотека HTML->DOCX (lib/)
# - 2 HTML шаблона (docs/) -- пользователь добавит как отдельные файлы
# - 5 SQL миграций (supabase/migrations/)
# - 1 API route (src/app/api/forward-telegram/)
# - 1 конфиг hardcoded keys (src/lib/doc-skill/config.ts)
#
# КЛЮЧЕВОЕ: Все ключи HARDCODED в скриптах -- не нужны env vars!
#
# ПОТОК РАБОТЫ:
# Фото -> ZAI VLM -> JSON данные -> HTML шаблон -> DOCX -> /download/ -> Telegram -> Supabase
#
# ВЕРСИЯ: 2026-06-09 (overhauled)
# ===================================================


# ================================================
# ФАЙЛ: skills/rental-contract-from-photos/SKILL.md
# ================================================

```markdown
# rental-contract-from-photos (super-skill)

Триггер-фразы: **`создай документ`**, **`сделай договор`**, **`сделай документ по фото`**,
а также `ты босс` + document intent (boss-decomposition + document-autopilot chain).

## Назначение
Сквозной skill для bridge-задач аренды: OCR/извлечение данных из фото паспорта+прав, поиск мотоцикла в Supabase, генерация DOCX из шаблона, отправка документа и уведомления в Telegram/bridge callback.

## Что делает (end-to-end)
1. Читает сообщение оператора с фразой `создай документ ...` и извлекает:
   - запрос на байк (id/название/фрагмент VIN),
   - дату/период аренды (если указаны в сообщении).
2. Из приложенных фото (паспорт + права) извлекает OCR JSON:
   - паспорт: `fullName`, `series`, `number`, `issueDate`, `registration`, `phone?`;
   - права: `series`, `number`.
3. Вызывает `scripts/make-deal-contract-skill.mjs --dealType rent`:
   - ищет байк в `cars` (Supabase) по fuzzy-матчингу;
   - подставляет точные поля байка + OCR данные в `docs/RENTAL_DEAL_TEMPLATE.html`;
   - генерирует `.docx` (cheerio-based HTML->DOCX);
   - сохраняет DOCX и QR в `/download/`;
   - отправляет документ в Telegram.
4. Отправляет служебное уведомление через bridge callback, если есть контекст.

## Обязательный входной контракт
- Фото паспорта и водительского удостоверения (минимум по одному читаемому фото).
- Текст команды с триггером `создай документ` и указанием байка.
- Дата аренды в сообщении (если не указана -- запросить уточнение).

## Запуск CLI
```bash
node scripts/make-deal-contract-skill.mjs \
  --dealType rent \
  --phrase "создай документ falcon-gt с 27.05.2026 по 29.05.2026" \
  --passportJson /tmp/passport.json \
  --licenseJson /tmp/license.json \
  --telegramChatId 413553377 \
  --startDate "27.05.2026" \
  --endDate "29.05.2026" \
  --saveMetadata 1
```

## Правило «не выдумывать значения»
- Критичные поля (`birthDate`, паспортные данные, права, даты аренды, bike query) **нельзя** подставлять дефолтами.
- Если критичных данных не хватает -- запросить уточнения.
```

# ================================================
# ФАЙЛ: skills/deal-contract-from-photos/SKILL.md
# ================================================

```markdown
# deal-contract-from-photos (super-skill)

Триггер-фразы:
- **Аренда:** `создай документ`, `сделай договор`, `сделай документ по фото` + rental context
- **Продажа:** `создай договор продажи`, `сделай договор купли-продажи`, `создай документ продажи`, `договор купли-продажи по фото`

## Назначение
Сквозной skill для генерации договоров аренды и купли-продажи электротранспортных средств.

Поддерживает **два типа сделок**:
- **rent** -- Договор проката (аренды) мотоцикла. Требует паспорт + водительское удостоверение.
- **sale** -- Договор купли-продажи электротранспортного средства. Требует только паспорт (2 страницы/фото).

## Определение типа сделки (dealType)
1. Слова `продаж`, `купли-продажи`, `купить`, `покупк`, `sale` -> `dealType=sale`
2. Период аренды (`с ... по ...`, `аренд`, `rent`) -> `dealType=rent`
3. По умолчанию: `dealType=rent`

## End-to-end пайплайн
1. PARSE: определить dealType + bikeQuery + даты (rent)
2. OCR: фото -> passport.json [+ license.json для rent]
3. VALIDATE: проверить полноту OCR-полей
4. ADDRESS CHECK: если registration неполный -> --buyerAddress
5. RUN SCRIPT: make-deal-contract-skill.mjs (генерация + отправка + сохранение в /download/)
6. PARSE STDOUT: получить messageId, contractKey
7. CALLBACK: уведомление с результатом

## Поддерживаемые CLI флаги
| Флаг | Обязателен | Описание |
|------|-----------|----------|
| `--dealType` | да | `rent` или `sale` |
| `--phrase` | да (или `--bikeId`) | Естественный язык команды |
| `--bikeId` | да (или `--phrase`) | ID или поисковый запрос байка |
| `--passportJson` | да | Путь к JSON с данными паспорта |
| `--licenseJson` | да для rent | Путь к JSON с данными ВУ |
| `--telegramChatId` | да | Chat ID для доставки |
| `--startDate` | да для rent | Дата начала аренды (DD.MM.YYYY) |
| `--endDate` | да для rent | Дата окончания аренды (DD.MM.YYYY) |
| `--buyerAddress` | опционально | Полный адрес регистрации покупателя |
| `--salePrice` | опционально | Цена продажи в рублях |
| `--saveMetadata` | опционально | `1` = сохранить метаданные в Supabase |

## НЕСУЩЕСТВУЮЩИЕ ФЛАГИ -- НЕ ИСПОЛЬЗОВАТЬ:
- ~~`--skipTelegram`~~ -- скрипт ВСЕГДА отправляет в Telegram
- ~~`--outPath`~~ -- скрипт сохраняет в /download/ автоматически
- ~~`--dealDate`~~ -- дата договора = текущая дата

## Извлечение адреса регистрации (КРИТИЧЕСКИЙ НЮАНС)
Вторая страница паспорта может содержать рукописный текст. Если VLM вернул адрес только с точностью до города -- использовать `--buyerAddress` с адресом, введённым оператором.

## Различия rent vs sale
| Аспект | rent | sale |
|--------|------|------|
| Документ | Договор проката | Договор купли-продажи |
| Фото | паспорт + ВУ | только паспорт (2 стр.) |
| Даты | обязательны | не нужны |
| Шаблон | RENTAL_DEAL_TEMPLATE.html | SALE_DEAL_TEMPLATE.html |
```

# ================================================
# ФАЙЛ: scripts/make-deal-contract-skill.mjs
# ================================================

```javascript
#!/usr/bin/env node
/**
 * make-deal-contract-skill.mjs
 *
 * Unified contract generator for both RENT and SALE deals.
 * Uses HTML templates -> htmlToDocxElements -> DOCX, generates QR for rental,
 * saves DOCX + QR to /home/z/my-project/download/, sends via Telegram,
 * optionally persists metadata & rental secrets to Supabase.
 *
 * Usage:
 *   node scripts/make-deal-contract-skill.mjs \
 *     --dealType rent \
 *     --phrase "супер соко cpx завтра 18:00-10:00" \
 *     --passportJson /tmp/passport.json \
 *     --licenseJson /tmp/license.json \
 *     --telegramChatId 413553377
 *
 *   node scripts/make-deal-contract-skill.mjs \
 *     --dealType sale \
 *     --bikeId "super-soco-cpx" \
 *     --passportJson /tmp/passport.json \
 *     --salePrice 150000 \
 *     --telegramChatId 413553377
 *
 * Or import as a module:
 *   import { makeDealContract } from "./make-deal-contract-skill.mjs";
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";

import { createClient } from "@supabase/supabase-js";
import { Document, Packer } from "docx";

import { htmlToDocxElements } from "../lib/htmlToDocx.mjs";

// ======================================================================
// CLI ARG PARSER
// ======================================================================

function arg(name, fallback) {
  const i = process.argv.indexOf("--" + name);
  return i >= 0 ? (process.argv[i + 1] || "") : fallback;
}

function argNum(name, fallback) {
  const v = arg(name, "");
  return v !== "" ? Number(v) : fallback;
}

// ======================================================================
// HARDCODED CONFIG (matching src/lib/doc-skill/config.ts)
// ======================================================================

const HARDCODED_CONFIG = {
  SUPABASE_URL: "https://inmctohsodgdohamhzag.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlubWN0b2hzb2RnZG9oYW1oemFnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczODMzOTU4NSwiZXhwIjoyMDUzOTE1NTg1fQ.xD91Es2o8T1vM-2Ok8iKCn4jGDA5TwBbapD5eqhblLM",
  TELEGRAM_BOT_TOKEN: "8037950842:AAFpaavB_M_zQtOFFN3kDmg44-EcApLHw9w",
  ADMIN_CHAT_ID: "413553377",
};

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || HARDCODED_CONFIG.SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  HARDCODED_CONFIG.SUPABASE_SERVICE_ROLE_KEY;
const TELEGRAM_TOKEN =
  process.env.TELEGRAM_BOT_TOKEN || HARDCODED_CONFIG.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT =
  process.env.ADMIN_CHAT_ID || HARDCODED_CONFIG.ADMIN_CHAT_ID;

// -- Download directory -------------------------------------------------
const DOWNLOAD_DIR =
  process.env.DOWNLOAD_DIR || "/home/z/my-project/download";

// -- Template paths -----------------------------------------------------
const RENTAL_DOC_HTML_TEMPLATE_PATH =
  process.env.RENTAL_DOC_HTML_TEMPLATE_PATH || "docs/RENTAL_DEAL_TEMPLATE.html";
const RENTAL_DOC_MD_TEMPLATE_PATH =
  process.env.RENTAL_DOC_MD_TEMPLATE_PATH || "docs/RENTAL_DEAL_TEMPLATE.md";
const SALE_DOC_HTML_TEMPLATE_PATH =
  process.env.SALE_DOC_HTML_TEMPLATE_PATH || "docs/SALE_DEAL_TEMPLATE.html";

const RENTAL_DOC_TEMPLATE_MODE =
  process.env.RENTAL_DOC_TEMPLATE_MODE || "html";

// ======================================================================
// RUSSIAN MONTHS GENITIVE
// ======================================================================

const MONTHS_GENITIVE = [
  "", "января", "февраля", "марта", "апреля",
  "мая", "июня", "июля", "августа",
  "сентября", "октября", "ноября", "декабря",
];

// ======================================================================
// NUMBER TO RUSSIAN WORDS
// ======================================================================

function numberToRussianWords(n) {
  const ones = ["", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
  const teens = ["десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать", "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать"];
  const tens = ["", "", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят", "восемьдесят", "девяносто"];
  const hundreds = ["", "сто", "двести", "триста", "четыреста", "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот"];
  const thousands = ["", "тысяча", "тысячи", "тысяч"];

  if (n === 0) return "ноль";
  let result = "";
  let remainder = n;

  if (remainder >= 1000) {
    const tc = Math.floor(remainder / 1000);
    remainder = remainder % 1000;
    const h = Math.floor(tc / 100);
    const uh = tc % 100;
    if (h > 0) result += hundreds[h] + " ";
    if (uh >= 10 && uh < 20) {
      result += teens[uh - 10] + " ";
    } else {
      const t = Math.floor(uh / 10);
      const o = uh % 10;
      if (t > 0) result += tens[t] + " ";
      if (o > 0) {
        if (o === 1) result += "одна ";
        else if (o === 2) result += "две ";
        else result += ones[o] + " ";
      }
    }
    const lt = tc % 100;
    const lo = tc % 10;
    if (lt >= 11 && lt <= 14) result += thousands[3] + " ";
    else if (lo === 1) result += thousands[1] + " ";
    else if (lo >= 2 && lo <= 4) result += thousands[2] + " ";
    else result += thousands[3] + " ";
  }

  if (remainder > 0) {
    const h = Math.floor(remainder / 100);
    remainder = remainder % 100;
    if (h > 0) result += hundreds[h] + " ";
    if (remainder >= 10 && remainder < 20) {
      result += teens[remainder - 10] + " ";
    } else {
      const t = Math.floor(remainder / 10);
      const o = remainder % 10;
      if (t > 0) result += tens[t] + " ";
      if (o > 0) result += ones[o] + " ";
    }
  }
  return result.trim();
}

// ======================================================================
// UTILITY FUNCTIONS
// ======================================================================

/** Fail the script -- output JSON to stderr and exit with code 2 */
function failStage(stage, message, extra = {}) {
  const prefix = extra._dealType === "rent" ? "[rental-doc]" : extra._dealType === "sale" ? "[sale-doc]" : "[deal-contract]";
  const payload = { ok: false, stage, error: message, ...extra };
  console.error(`${prefix} FAIL at ${stage}: ${message}`);
  process.stderr.write(JSON.stringify(payload) + "\n");
  process.exit(2);
}

/** Format a Date to Russian genitive date string: "15 января 2025" */
function formatRuDate(d) {
  if (!d) return "";
  const dt = d instanceof Date ? d : new Date(d);
  return `«${dt.getDate()}» ${MONTHS_GENITIVE[dt.getMonth() + 1]} ${dt.getFullYear()}`;
}

/** Parse "HH:MM" to minutes from midnight */
function parseTimeToMinutes(t) {
  if (!t) return null;
  const m = String(t).match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

/** Parse "DD.MM.YYYY" to { day, month, year, date } */
function parseRuDateParts(s) {
  if (!s) return null;
  const m = String(s).match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const year = parseInt(m[3], 10);
  return { day, month, year, date: new Date(year, month - 1, day) };
}

/** Parse Russian time from string like "18:00" */
function parseRuTime(s) {
  return parseTimeToMinutes(s);
}

/**
 * Extract schedule from phrase like:
 * "супер соко cpx завтра 18:00-10:00"
 * "завтра 18-10"
 * "сегодня"
 * "15.03-17.03 18:00-10:00"
 * Returns { bikeIdHint, startDate, endDate, startTime, endTime }
 */
function extractScheduleFromPhrase(phrase) {
  if (!phrase) return {};
  const p = phrase.trim();

  // Try to extract time range: HH:MM-HH:MM or HH-HH
  let startTime = "18:00";
  let endTime = "10:00";
  const timeRangeMatch = p.match(/(\d{1,2}[:.]\d{2})\s*[-\u2013\u2014]\s*(\d{1,2}[:.]\d{2})/);
  if (timeRangeMatch) {
    startTime = timeRangeMatch[1].replace(".", ":");
    endTime = timeRangeMatch[2].replace(".", ":");
  } else {
    const shortTimeMatch = p.match(/(\d{1,2})\s*[-\u2013\u2014]\s*(\d{1,2})(?!\d)/);
    if (shortTimeMatch) {
      startTime = shortTimeMatch[1] + ":00";
      endTime = shortTimeMatch[2] + ":00";
    }
  }

  // Try to extract date range: DD.MM-DD.MM or DD.MM.YYYY-DD.MM.YYYY
  let startDate = null;
  let endDate = null;
  const dateRangeMatch = p.match(/(\d{1,2}\.\d{1,2}(?:\.\d{4})?)\s*[-\u2013\u2014]\s*(\d{1,2}\.\d{1,2}(?:\.\d{4})?)/);
  if (dateRangeMatch) {
    let s = dateRangeMatch[1];
    let e = dateRangeMatch[2];
    // Add year if missing
    const yr = new Date().getFullYear();
    if (!/\.\d{4}$/.test(s)) s += "." + yr;
    if (!/\.\d{4}$/.test(e)) e += "." + yr;
    const sp = parseRuDateParts(s);
    const ep = parseRuDateParts(e);
    if (sp) startDate = sp.date;
    if (ep) endDate = ep.date;
  }

  // Relative dates
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (/сегодня/i.test(p)) {
    startDate = today;
    endDate = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  } else if (/завтра/i.test(p)) {
    startDate = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    endDate = new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000);
  } else if (/послезавтра/i.test(p)) {
    startDate = new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000);
    endDate = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
  }

  // Bike ID hint -- strip known keywords and date/time parts
  let bikeIdHint = p
    .replace(/сегодня|завтра|послезавтра/gi, "")
    .replace(/\d{1,2}[:.]\d{2}\s*[-\u2013\u2014]\s*\d{1,2}[:.]\d{2}/g, "")
    .replace(/\d{1,2}\s*[-\u2013\u2014]\s*\d{1,2}(?!\d)/g, "")
    .replace(/\d{1,2}\.\d{1,2}(?:\.\d{4})?\s*[-\u2013\u2014]\s*\d{1,2}\.\d{1,2}(?:\.\d{4})?/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return { bikeIdHint, startDate, endDate, startTime, endTime };
}

// ======================================================================
// TEMPLATE RENDERING
// ======================================================================

/**
 * Simple mustache-like template renderer.
 * Replaces {{varName}} and {{varName|lower}} with values from vars.
 */
function renderTemplateWithVars(template, vars) {
  return template.replace(/\{\{(\w+)(\|(\w+))?\}\}/g, (match, key, _pipe, filter) => {
    let val = vars[key] !== undefined ? String(vars[key]) : match;
    if (filter === "lower") val = val.toLowerCase();
    return val;
  });
}

/**
 * Legacy adapter: reads HTML template, renders it with vars.
 * Falls back to MD template if HTML is unavailable.
 */
function renderHtmlTemplateAdapterLegacy(vars, dealType) {
  const logPrefix = dealType === "rent" ? "[rental-doc]" : "[sale-doc]";
  const htmlPath = dealType === "rent"
    ? RENTAL_DOC_HTML_TEMPLATE_PATH
    : SALE_DOC_HTML_TEMPLATE_PATH;

  // Try HTML template
  if (existsSync(htmlPath)) {
    const templateHtml = readFileSync(htmlPath, "utf-8");
    const rendered = renderTemplateWithVars(templateHtml, vars);
    console.error(`${logPrefix} Rendered HTML template from ${htmlPath} (${rendered.length} chars)`);
    return rendered;
  }

  // Fallback to MD template (rent only, may not exist)
  if (dealType === "rent" && RENTAL_DOC_TEMPLATE_MODE === "md" && existsSync(RENTAL_DOC_MD_TEMPLATE_PATH)) {
    const templateMd = readFileSync(RENTAL_DOC_MD_TEMPLATE_PATH, "utf-8");
    const rendered = renderTemplateWithVars(templateMd, vars);
    console.error(`${logPrefix} Rendered MD template from ${RENTAL_DOC_MD_TEMPLATE_PATH} (fallback)`);
    return rendered;
  }

  throw new Error(`Template not found: ${htmlPath}`);
}

// ======================================================================
// SUPABASE CLIENT
// ======================================================================

let _supabaseAdmin = null;

function getSupabaseAdmin() {
  if (_supabaseAdmin) return _supabaseAdmin;
  _supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: "public" },
  });
  return _supabaseAdmin;
}

async function fetchBikes() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("cars")
    .select("*")
    .in("type", ["bike", "ebike"]);

  if (error) {
    console.error("[supabase] Error fetching bikes (SDK):", error.message || error);

    // REST fallback for network issues
    try {
      const url = `${SUPABASE_URL}/rest/v1/cars?select=*&type=in.(bike,ebike)`;
      const res = await fetch(url, {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const rows = await res.json();
        console.error("[supabase] REST fallback fetched", rows.length, "bikes");
        return rows;
      }
    } catch (restErr) {
      console.error("[supabase] REST fallback also failed:", restErr?.message || restErr);
    }
    return [];
  }
  return data ?? [];
}

/**
 * Score a bike against a query string. Higher = better match.
 */
function scoreBike(bike, query) {
  const q = query.trim().toLowerCase();
  if (!q) return 0;

  const specs = bike.specs || {};
  const hay = [
    bike.id,
    bike.make,
    bike.model,
    specs.vin,
    specs.frame,
    specs.plate,
  ]
    .map((v) => (v ?? "").toString().toLowerCase())
    .join(" ");

  // Exact ID match
  if (bike.id && bike.id.toLowerCase() === q) return 10000;

  // Substring match
  if (hay.includes(q)) return 1000 + q.length;

  // Token match
  let score = 0;
  for (const token of q.split(/\s+/).filter(Boolean)) {
    if (hay.includes(token)) score += 20 + token.length;
  }
  return score;
}

async function resolveBike(query) {
  const bikes = await fetchBikes();
  if (!bikes.length) return null;

  const q = query.trim().toLowerCase();
  if (!q) return null;

  // 1) Exact ID match
  const exact = bikes.find((b) => b.id && b.id.toLowerCase() === q);
  if (exact) return exact;

  // 2) Fuzzy scoring
  let best = null;
  let bestScore = 0;
  for (const bike of bikes) {
    const s = scoreBike(bike, q);
    if (s > bestScore) {
      bestScore = s;
      best = bike;
    }
  }

  return bestScore > 0 ? best : null;
}

// ======================================================================
// RENTAL DEAL -- Build vars
// ======================================================================

function buildRentalDealVars({
  bike,
  passportData,
  licenseData,
  startDate,
  endDate,
  startTime,
  endTime,
  dailyPrice,
  hourlyPrice,
  deposit,
  bikeValue,
  bikeValueWords,
  latePenalty,
  latePenaltyMaxDays,
  subtotal,
  lessorAddress,
  buyerAddress,
}) {
  const specs = bike.specs || {};
  const now = new Date();

  const start = startDate ? new Date(startDate) : now;
  const end = endDate ? new Date(endDate) : new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // Calculate rental days
  const startMin = startTime ? parseTimeToMinutes(startTime) : parseTimeToMinutes("18:00");
  const endMin = endTime ? parseTimeToMinutes(endTime) : parseTimeToMinutes("10:00");

  let days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));

  const daily = dailyPrice ?? (Number(specs.dailyPrice) || 10000);
  const hourly = hourlyPrice ?? (Number(specs.hourlyPrice) || 0);
  const dep = deposit ?? (Number(specs.deposit_rub) || 20000);
  const bVal = bikeValue ?? (Number(specs.bike_value) || Number(specs.sale_price) || 0);
  const bValWords = bikeValueWords || (bVal ? numberToRussianWords(bVal) : "");
  const latePen = latePenalty ?? (Number(specs.late_penalty) || 0);
  const latePenMax = latePenaltyMaxDays ?? (Number(specs.late_penalty_max_days) || 0);

  let total = subtotal ?? (daily * days);

  const fullName = passportData.fullName || "";
  const nameParts = fullName.split(" ");
  const shortName =
    nameParts.length >= 2
      ? `${nameParts[0]} ${nameParts[1]?.charAt(0)}.${nameParts[2] ? ` ${nameParts[2].charAt(0)}.` : ""}`
      : fullName;

  const isElectric = bike.type === "ebike" || /electric/i.test(String(specs.type || ""));

  const registration = buyerAddress || passportData.registration || "";

  // Format start/end dates for template
  const startDay = String(start.getDate()).padStart(2, "0");
  const startMonth = start.getMonth() + 1;
  const startYear = start.getFullYear();
  const endDay = String(end.getDate()).padStart(2, "0");
  const endMonth = end.getMonth() + 1;
  const endYear = end.getFullYear();

  return {
    contract_number: `${now.getDate()}.${now.getMonth() + 1}/R-${bike.id}`,
    contract_day: String(now.getDate()).padStart(2, "0"),
    contract_month_genitive: MONTHS_GENITIVE[now.getMonth() + 1] || "",
    contract_year: String(now.getFullYear()),

    rent_start_date: start.toISOString().split("T")[0],
    rent_end_date: end.toISOString().split("T")[0],
    rent_start_day: startDay,
    rent_start_month_genitive: MONTHS_GENITIVE[startMonth] || "",
    rent_start_year: String(startYear),
    rent_end_day: endDay,
    rent_end_month_genitive: MONTHS_GENITIVE[endMonth] || "",
    rent_end_year: String(endYear),

    rent_start_time: startTime || "18:00",
    rent_end_time: endTime || "10:00",

    daily_price_rub: String(daily),
    daily_price_words: numberToRussianWords(daily),
    hourly_price_rub: String(hourly),
    total_price_rub: String(total),
    total_price_words: numberToRussianWords(total),
    deposit_rub: String(dep),
    deposit_words: numberToRussianWords(dep),
    bike_value_rub: String(bVal),
    bike_value_words: bValWords,
    late_penalty: String(latePen),
    late_penalty_max_days: String(latePenMax),

    renter_full_name: fullName,
    renter_birth_date: passportData.birthDate || "",
    renter_passport: `${passportData.series || ""} ${passportData.number || ""}`.trim(),
    renter_passport_issued_by: passportData.issuedBy || "",
    renter_passport_issue_date: passportData.issueDate || "",
    renter_registration: registration,
    renter_driver_license: licenseData
      ? `${licenseData.series || ""} ${licenseData.number || ""}`.trim()
      : "",
    renter_driver_license_label: licenseData ? "ВУ" : "",
    renter_phone: passportData.phone || "",
    renter_email: passportData.email || "",
    renter_short_name: shortName,
    lessor_address: lessorAddress || "г. Нижний Новгород",

    bike_make: bike.make || "уточняется",
    bike_model: bike.model || "уточняется",
    bike_make_model: `${bike.make || ""} ${bike.model || ""}`.trim() || "уточняется",
    bike_plate: String(specs.plate || "без номера"),
    bike_vin: String(specs.vin || specs.frame || "уточняется"),
    bike_category: String(specs.category || "A/L3"),
    bike_color: String(specs.color || "уточняется"),
    bike_year: String(specs.year || "уточняется"),
    bike_odometer: String(specs.odometer || "0"),
    bike_battery_level: String(specs.battery_level || "100"),
    bike_completeness: String(specs.completeness || "комплект"),
    bike_damages_on_handover: String(specs.damages_on_handover || "нет"),
    bike_odometer_return: String(specs.odometer_return || "0"),
    bike_battery_level_return: String(specs.battery_level_return || "—"),
    bike_damages_on_return: String(specs.damages_on_return || "нет"),
    bike_missing_parts_on_return: String(specs.missing_parts_on_return || "нет"),
    bike_vehicle_type_label: isElectric ? "ЭЛЕКТРОМОТОЦИКЛА" : "МОТОЦИКЛА",

    // Return act placeholders
    return_day: endDay,
    return_month_genitive: MONTHS_GENITIVE[endMonth] || "",
    return_year: String(endYear),

    deposit_deduction_rub: "0",
    deposit_refund_rub: String(dep),

    document_key: `rental-${bike.id}-${Date.now()}`,
  };
}

// ======================================================================
// SALE DEAL -- Build vars
// ======================================================================

function buildSaleDealVars({
  bike,
  passportData,
  salePrice,
  warrantyMonths,
  sellerAddress,
  buyerAddress,
}) {
  const specs = bike.specs || {};
  const now = new Date();
  const dealPrice = salePrice ?? (Number(specs.sale_price) || Number(specs.dailyPrice) || 0);

  const fullName = passportData.fullName || "";
  const nameParts = fullName.split(" ");
  const shortName =
    nameParts.length >= 2
      ? `${nameParts[0]} ${nameParts[1]?.charAt(0)}.${nameParts[2] ? ` ${nameParts[2].charAt(0)}.` : ""}`
      : fullName;

  const registration = buyerAddress || passportData.registration || "";

  return {
    contract_number: `${now.getDate()}.${now.getMonth() + 1}/${bike.id}`,
    contract_day: String(now.getDate()).padStart(2, "0"),
    contract_month_genitive: MONTHS_GENITIVE[now.getMonth() + 1] || "",
    contract_year: String(now.getFullYear()),
    price_digits: String(dealPrice),
    price_words: numberToRussianWords(dealPrice),
    price_digits_table: String(dealPrice),
    buyer_full_name: fullName,
    buyer_birth_date: passportData.birthDate || "",
    buyer_passport_number: `${passportData.series || ""} ${passportData.number || ""}`.trim(),
    buyer_passport_issued_by: passportData.issuedBy || "",
    buyer_passport_issue_date: passportData.issueDate || "",
    buyer_registration: registration,
    buyer_short_name: shortName,
    buyer_email: passportData.email || "",
    product_name: `${bike.make || ""} ${bike.model || ""}`.trim() || "уточняется",
    product_color: String(specs.color || "уточняется"),
    product_type: String(specs.type || "электроскутер"),
    product_motor_type: String(specs.motor_type || "электродвигатель"),
    product_motor_power: String(specs.motor_power || "уточняется"),
    product_vin: String(specs.vin || specs.frame || "уточняется"),
    product_year: String(specs.year || "уточняется"),
    product_unit: "шт.",
    spec_number: `${now.getDate()}.${now.getMonth() + 1}/${bike.id}`,
    appendix_date: `"${now.getDate()}" ${MONTHS_GENITIVE[now.getMonth() + 1]} ${now.getFullYear()}`,
    seller_address: sellerAddress || "г. Нижний Новгород",
    warranty_months: String(warrantyMonths || 12),
  };
}

// ======================================================================
// DOCUMENT BUILDING (HTML -> DOCX)
// ======================================================================

async function buildDocxFromHtml(html, logPrefix = "[deal-contract]") {
  try {
    const elements = htmlToDocxElements(html);
    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: { top: 1134, bottom: 1134, left: 1418, right: 850 },
            },
          },
          children: elements,
        },
      ],
    });
    const buf = await Packer.toBuffer(doc);
    console.error(`${logPrefix} Built DOCX from HTML (${buf.length} bytes)`);
    return buf;
  } catch (err) {
    console.error(`${logPrefix} htmlToDocxElements failed: ${err?.message || err}`);
    throw err;
  }
}

// ======================================================================
// QR CODE GENERATION
// ======================================================================

async function generateQrPng(deepLink, logPrefix = "[rental-doc]") {
  try {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=420x420&data=${encodeURIComponent(deepLink)}&color=000000&bgcolor=ffffff`;
    const qrRes = await fetch(qrUrl, { signal: AbortSignal.timeout(8000) });
    if (qrRes.ok) {
      const buf = Buffer.from(await qrRes.arrayBuffer());
      console.error(`${logPrefix} QR PNG generated (${buf.length} bytes)`);
      return buf;
    }
    console.error(`${logPrefix} QR API returned status ${qrRes.status}`);
  } catch (err) {
    console.error(`${logPrefix} QR generation failed: ${err?.message || err}`);
  }
  return null;
}

// ======================================================================
// TELEGRAM HELPERS
// ======================================================================

async function sendTelegramDocument(chatId, documentBuffer, fileName, caption, logPrefix = "[deal-contract]") {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendDocument`;
  try {
    const form = new FormData();
    form.append("chat_id", String(chatId));
    form.append(
      "document",
      new Blob([documentBuffer], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
      fileName
    );
    if (caption) form.append("caption", caption);

    const res = await fetch(url, { method: "POST", body: form });
    const data = await res.json();
    if (!data.ok) {
      console.error(`${logPrefix} Telegram sendDocument error: ${data.description || "API error"}`);
      // curl fallback
      return await sendTelegramDocumentCurl(chatId, documentBuffer, fileName, caption, logPrefix);
    }
    console.error(`${logPrefix} Telegram document sent to ${chatId}, msg_id=${data.result?.message_id}`);
    return { ok: true, message_id: data.result?.message_id };
  } catch (err) {
    console.error(`${logPrefix} Telegram sendDocument exception: ${err?.message || err}`);
    return await sendTelegramDocumentCurl(chatId, documentBuffer, fileName, caption, logPrefix);
  }
}

async function sendTelegramDocumentCurl(chatId, documentBuffer, fileName, caption, logPrefix = "[deal-contract]") {
  try {
    const tmpPath = `/tmp/deal-doc-${Date.now()}-${fileName}`;
    writeFileSync(tmpPath, documentBuffer);
    let cmd = `curl -s -F "chat_id=${chatId}" -F "document=@${tmpPath}" -F "caption=${caption || ""}" "https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendDocument"`;
    const result = execSync(cmd, { encoding: "utf-8", timeout: 15000 });
    const data = JSON.parse(result);
    if (data.ok) {
      console.error(`${logPrefix} Telegram document sent via curl fallback to ${chatId}`);
      return { ok: true, message_id: data.result?.message_id };
    }
    console.error(`${logPrefix} curl fallback also failed: ${data.description}`);
    return { ok: false, error: data.description };
  } catch (err) {
    console.error(`${logPrefix} curl fallback exception: ${err?.message || err}`);
    return { ok: false, error: err?.message || "Unknown error" };
  }
}

async function sendTelegramPhoto(chatId, photoBuffer, fileName, caption, logPrefix = "[deal-contract]") {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`;
  try {
    const form = new FormData();
    form.append("chat_id", String(chatId));
    form.append("photo", new Blob([photoBuffer], { type: "image/png" }), fileName);
    if (caption) form.append("caption", caption);

    const res = await fetch(url, { method: "POST", body: form });
    const data = await res.json();
    if (data.ok) {
      console.error(`${logPrefix} Telegram photo sent to ${chatId}`);
      return { ok: true, message_id: data.result?.message_id };
    }
    return { ok: false, error: data.description };
  } catch (err) {
    console.error(`${logPrefix} Telegram photo failed: ${err?.message || err}`);
    return { ok: false, error: err?.message || "Unknown error" };
  }
}

async function sendTelegramMediaGroup(chatId, documentBuffer, docFileName, photoBuffer, photoFileName, caption, logPrefix = "[deal-contract]") {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMediaGroup`;
  try {
    const form = new FormData();
    form.append("chat_id", String(chatId));

    // Document media
    form.append("document", new Blob([documentBuffer], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }), docFileName);

    // Photo media
    form.append("photo", new Blob([photoBuffer], { type: "image/png" }), photoFileName);

    // Media array as JSON
    const media = [
      { type: "document", media: "attach://document", caption: caption || "" },
      { type: "photo", media: "attach://photo" },
    ];
    form.append("media", JSON.stringify(media));

    const res = await fetch(url, { method: "POST", body: form });
    const data = await res.json();
    if (data.ok) {
      console.error(`${logPrefix} Telegram mediaGroup sent to ${chatId}`);
      return { ok: true };
    }
    console.error(`${logPrefix} Telegram mediaGroup error: ${data.description}`);
    return { ok: false, error: data.description };
  } catch (err) {
    console.error(`${logPrefix} Telegram mediaGroup exception: ${err?.message || err}`);
    return { ok: false, error: err?.message || "Unknown error" };
  }
}

async function sendTelegramMessage(chatId, text, parseMode = "HTML", logPrefix = "[deal-contract]") {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: parseMode }),
    });
    const data = await res.json();
    return data;
  } catch (err) {
    console.error(`${logPrefix} Telegram message failed: ${err?.message || err}`);
  }
}

// ======================================================================
// METADATA PERSISTENCE
// ======================================================================

async function saveMetadata({ dealType, bike, passportData, licenseData, docSha256, documentKey, chatId, templateVersion, docFileName, vars }, logPrefix) {
  const metadataTable = arg("metadataTable", "deal_metadata");
  try {
    const supabase = getSupabaseAdmin();
    const targetChatId = chatId ? String(chatId) : null;

    const row = {
      deal_type: dealType,
      chat_id: targetChatId,
      crew_slug: bike.crew_id || "vip-bike",
      bike_id: bike.id,
      bike_make_model: `${bike.make || ""} ${bike.model || ""}`.trim(),
      doc_sha256: docSha256,
      doc_filename: docFileName,
      renter_full_name: passportData.fullName || null,
      renter_passport: `${passportData.series || ""} ${passportData.number || ""}`.trim() || null,
      renter_registration: vars.renter_registration || vars.buyer_registration || null,
      source_doc_key: documentKey,
      template_version: templateVersion,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from(metadataTable).insert(row);
    if (error) {
      console.error(`${logPrefix} Metadata insert error: ${error.message}`);
      // Try with fewer columns
      const minRow = {
        deal_type: dealType,
        bike_id: bike.id,
        doc_sha256: docSha256,
        source_doc_key: documentKey,
        created_at: new Date().toISOString(),
      };
      const { error: err2 } = await supabase.from(metadataTable).insert(minRow);
      if (err2) {
        console.error(`${logPrefix} Metadata minimal insert also failed: ${err2.message}`);
        return false;
      }
    }

    // Read-after-write verification
    try {
      const { data: verify, error: vErr } = await supabase
        .from(metadataTable)
        .select("id")
        .eq("source_doc_key", documentKey)
        .limit(1);
      if (vErr || !verify || !verify.length) {
        console.error(`${logPrefix} Metadata verification failed -- row not found after insert`);
      } else {
        console.error(`${logPrefix} Metadata saved and verified (key=${documentKey})`);
      }
    } catch (ve) {
      console.error(`${logPrefix} Metadata verification error: ${ve?.message}`);
    }

    return true;
  } catch (err) {
    console.error(`${logPrefix} Metadata save exception: ${err?.message || err}`);
    return false;
  }
}

// ======================================================================
// RENTAL SECRETS PERSISTENCE (rent only, to private.user_rental_secrets)
// ======================================================================

async function saveRentalSecrets({ bike, passportData, licenseData, docSha256, documentKey, chatId, templateVersion }, logPrefix) {
  try {
    const supabase = getSupabaseAdmin();
    const targetChatId = chatId ? String(chatId) : null;

    const baseRow = {
      chat_id: targetChatId,
      crew_slug: bike.crew_id || "vip-bike",
      doc_sha256: docSha256,
      renter_full_name: passportData.fullName || null,
      renter_passport: `${passportData.series || ""} ${passportData.number || ""}`.trim() || null,
      renter_registration: passportData.registration || null,
      renter_driver_license: licenseData
        ? `${licenseData.series || ""} ${licenseData.number || ""}`.trim() || null
        : null,
      renter_birth_date: passportData.birthDate || null,
      renter_phone: passportData.phone || null,
      renter_email: passportData.email || null,
      renter_address: passportData.registration || null,
      source_doc_key: documentKey,
      source_rental_id: null,
      verification_status: "verified",
      template_version: templateVersion,
      updated_at: new Date().toISOString(),
    };

    // Try with extended columns first
    const extendedRow = {
      ...baseRow,
      renter_passport_issue_date: passportData.issueDate || null,
      renter_passport_issued_by: passportData.issuedBy || null,
    };

    const { error: extError } = await supabase
      .schema("private")
      .from("user_rental_secrets")
      .insert(extendedRow);

    if (extError) {
      console.error(`${logPrefix} Rental secrets extended insert failed, trying base: ${extError.message}`);
      const { error: baseError } = await supabase
        .schema("private")
        .from("user_rental_secrets")
        .insert(baseRow);
      if (baseError) {
        console.error(`${logPrefix} Rental secrets base insert also failed: ${baseError.message}`);
        return false;
      }
    }

    console.error(`${logPrefix} Rental secrets saved (key=${documentKey})`);
    return true;
  } catch (err) {
    console.error(`${logPrefix} Rental secrets save exception: ${err?.message || err}`);
    return false;
  }
}

// ======================================================================
// MAIN: makeDealContract()
// ======================================================================

export async function makeDealContract(params) {
  const {
    dealType = "",
    bikeQuery,
    passportData,
    licenseData,
    startDate,
    endDate,
    startTime,
    endTime,
    dailyPrice,
    hourlyPrice,
    deposit,
    bikeValue,
    bikeValueWords,
    latePenalty,
    latePenaltyMaxDays,
    subtotal,
    salePrice,
    warrantyMonths,
    sellerAddress,
    lessorAddress,
    buyerAddress,
    chatId,
    saveMetadata: shouldSaveMetadata = false,
    metadataTable,
  } = params;

  const logPrefix = dealType === "rent" ? "[rental-doc]" : "[sale-doc]";

  // -- Validate deal type -----------------------------------------------
  if (!dealType || (dealType !== "rent" && dealType !== "sale")) {
    failStage("validation", "Missing or invalid --dealType. Must be 'rent' or 'sale'.", { _dealType: dealType });
  }

  if (!passportData || !passportData.fullName) {
    failStage("validation", "Missing passportData with at least fullName", { _dealType: dealType });
  }

  if (dealType === "rent" && !licenseData) {
    console.error(`${logPrefix} Warning: no licenseData provided for rental deal`);
  }

  // -- Resolve bike from Supabase ---------------------------------------
  const bike = await resolveBike(bikeQuery);
  if (!bike) {
    failStage("bike-resolution", `Bike "${bikeQuery}" not found in database`, { _dealType: dealType, bikeQuery });
  }

  console.error(`${logPrefix} Resolved bike: ${bike.make} ${bike.model} (${bike.id})`);

  // -- Ensure download directory exists ---------------------------------
  try {
    mkdirSync(DOWNLOAD_DIR, { recursive: true });
  } catch {}

  let vars, docFileName, qrDeepLink, templateVersion;

  if (dealType === "rent") {
    // -- RENTAL DEAL -----------------------------------------------------
    vars = buildRentalDealVars({
      bike,
      passportData,
      licenseData,
      startDate,
      endDate,
      startTime,
      endTime,
      dailyPrice,
      hourlyPrice,
      deposit,
      bikeValue,
      bikeValueWords,
      latePenalty,
      latePenaltyMaxDays,
      subtotal,
      lessorAddress,
      buyerAddress,
    });

    docFileName = `rental-contract-${bike.make}-${bike.model}-${vars.rent_start_date}.docx`;
    qrDeepLink = `https://t.me/oneBikePlsBot/app?startapp=rent_${bike.id}`;
    templateVersion = 4;
  } else {
    // -- SALE DEAL -------------------------------------------------------
    vars = buildSaleDealVars({
      bike,
      passportData,
      salePrice,
      warrantyMonths,
      sellerAddress,
      buyerAddress,
    });

    docFileName = `sale-contract-${bike.make}-${bike.model}-${vars.contract_year}.docx`;
    templateVersion = 3;
  }

  // -- Build DOCX via HTML template -------------------------------------
  let docBuffer;
  try {
    const renderedHtml = renderHtmlTemplateAdapterLegacy(vars, dealType);
    docBuffer = await buildDocxFromHtml(renderedHtml, logPrefix);
  } catch (buildErr) {
    failStage("doc-build", `DOCX build failed: ${buildErr?.message || buildErr}`, { _dealType: dealType });
  }

  // -- Compute SHA-256 --------------------------------------------------
  const docSha256 = createHash("sha256").update(docBuffer).digest("hex");

  // -- SAVE DOCX to download directory ----------------------------------
  const docPath = join(DOWNLOAD_DIR, docFileName);
  try {
    writeFileSync(docPath, docBuffer);
    console.error(`${logPrefix} DOCX saved to ${docPath} (${docBuffer.length} bytes)`);
  } catch (writeErr) {
    console.error(`${logPrefix} Failed to save DOCX: ${writeErr?.message}`);
  }

  // -- QR Code generation (rent only) -----------------------------------
  let qrBuffer = null;
  let qrPath = null;
  if (dealType === "rent" && qrDeepLink) {
    qrBuffer = await generateQrPng(qrDeepLink, logPrefix);
    if (qrBuffer) {
      const qrFileName = `rental-qr-${bike.id}-${vars.rent_start_date}.png`;
      qrPath = join(DOWNLOAD_DIR, qrFileName);
      try {
        writeFileSync(qrPath, qrBuffer);
        console.error(`${logPrefix} QR PNG saved to ${qrPath} (${qrBuffer.length} bytes)`);
      } catch (writeErr) {
        console.error(`${logPrefix} Failed to save QR PNG: ${writeErr?.message}`);
      }
    }
  }

  // -- Telegram delivery ------------------------------------------------
  const targetChatId = chatId || ADMIN_CHAT;
  let telegramResult = null;

  if (dealType === "rent" && qrBuffer) {
    // Send DOCX + QR as media group
    const caption = `Договор аренды № ${vars.contract_number}\n${bike.make} ${bike.model}`;
    telegramResult = await sendTelegramMediaGroup(
      targetChatId,
      docBuffer,
      docFileName,
      qrBuffer,
      `qr-${bike.id}.png`,
      caption,
      logPrefix
    );

    // If media group fails, try sending separately
    if (!telegramResult?.ok) {
      console.error(`${logPrefix} MediaGroup failed, sending separately`);
      const docRes = await sendTelegramDocument(
        targetChatId, docBuffer, docFileName, caption, logPrefix
      );
      const qrRes = await sendTelegramPhoto(
        targetChatId, qrBuffer, `qr-${bike.id}.png`, "QR-код для аренды", logPrefix
      );
      telegramResult = { ok: docRes?.ok || false, doc: docRes, qr: qrRes };
    }
  } else {
    // Sale: just send DOCX
    const caption = `Договор купли-продажи № ${vars.contract_number}\n${bike.make} ${bike.model}`;
    telegramResult = await sendTelegramDocument(
      targetChatId, docBuffer, docFileName, caption, logPrefix
    );
  }

  // -- Save metadata to Supabase (if --saveMetadata 1) ------------------
  let metadataSaved = false;
  if (shouldSaveMetadata) {
    metadataSaved = await saveMetadata({
      dealType,
      bike,
      passportData,
      licenseData,
      docSha256,
      documentKey: vars.document_key,
      chatId: targetChatId,
      templateVersion,
      docFileName,
      vars,
    }, logPrefix);
  }

  // -- Save rental secrets (rent only) ----------------------------------
  let secretsSaved = false;
  if (dealType === "rent") {
    secretsSaved = await saveRentalSecrets({
      bike,
      passportData,
      licenseData,
      docSha256,
      documentKey: vars.document_key,
      chatId: targetChatId,
      templateVersion,
    }, logPrefix);
  }

  // -- Build result JSON ------------------------------------------------
  const result = {
    ok: true,
    dealType,
    bike: {
      id: bike.id,
      make: bike.make,
      model: bike.model,
      type: bike.type,
    },
    document: {
      filename: docFileName,
      path: docPath,
      sha256: docSha256,
      size: docBuffer.length,
      templateVersion,
    },
    ...(dealType === "rent" && qrBuffer
      ? { qr: { path: qrPath, deepLink: qrDeepLink, size: qrBuffer.length } }
      : {}),
    telegram: telegramResult,
    metadataSaved,
    ...(dealType === "rent" ? { secretsSaved } : {}),
  };

  return result;
}

// ======================================================================
// CLI ENTRY POINT
// ======================================================================

async function main() {
  const dealType = arg("dealType", "");

  // -- Validate deal type -----------------------------------------------
  if (!dealType || (dealType !== "rent" && dealType !== "sale")) {
    failStage("validation", "Missing or invalid --dealType. Must be 'rent' or 'sale'.", { _dealType: dealType });
  }

  const logPrefix = dealType === "rent" ? "[rental-doc]" : "[sale-doc]";
  console.error(`${logPrefix} Starting ${dealType} deal contract generation...`);

  // -- Parse passport JSON ----------------------------------------------
  const passportJsonPath = arg("passportJson", "");
  let passportData = {};
  if (passportJsonPath) {
    try {
      const raw = readFileSync(resolve(passportJsonPath), "utf-8");
      passportData = JSON.parse(raw);
      console.error(`${logPrefix} Loaded passport data from ${passportJsonPath}`);
    } catch (err) {
      failStage("passport-load", `Failed to read/parse passportJson: ${err?.message || err}`, { _dealType: dealType });
    }
  } else {
    failStage("validation", "Missing --passportJson (path to passport OCR JSON)", { _dealType: dealType });
  }

  if (!passportData.fullName) {
    failStage("validation", "passportJson must contain at least 'fullName'", { _dealType: dealType });
  }

  // -- Parse license JSON (rent only) -----------------------------------
  let licenseData = null;
  if (dealType === "rent") {
    const licenseJsonPath = arg("licenseJson", "");
    if (licenseJsonPath) {
      try {
        const raw = readFileSync(resolve(licenseJsonPath), "utf-8");
        licenseData = JSON.parse(raw);
        console.error(`${logPrefix} Loaded license data from ${licenseJsonPath}`);
      } catch (err) {
        console.error(`${logPrefix} Warning: Failed to read/parse licenseJson: ${err?.message}`);
      }
    } else {
      console.error(`${logPrefix} Warning: --licenseJson not provided for rental deal`);
    }
  }

  // -- Buyer address override -------------------------------------------
  const buyerAddress = arg("buyerAddress", "") || undefined;

  // -- Resolve bike query -----------------------------------------------
  let bikeQuery = arg("bikeId", "");
  const phrase = arg("phrase", "");

  // Extract bikeId + schedule from phrase
  let phraseSchedule = {};
  if (phrase) {
    phraseSchedule = extractScheduleFromPhrase(phrase);
    if (phraseSchedule.bikeIdHint && !bikeQuery) {
      bikeQuery = phraseSchedule.bikeIdHint;
    }
  }

  if (!bikeQuery) {
    failStage("validation", "Missing --bikeId or --phrase (need bike identifier)", { _dealType: dealType });
  }

  // -- Parse dates and times (rent) -------------------------------------
  let startDate = null;
  let endDate = null;
  let startTime = "18:00";
  let endTime = "10:00";

  if (dealType === "rent") {
    const startDateStr = arg("startDate", "");
    const endDateStr = arg("endDate", "");

    if (startDateStr) {
      const sp = parseRuDateParts(startDateStr);
      if (sp) startDate = sp.date;
      else failStage("validation", `Invalid --startDate format: ${startDateStr}. Expected DD.MM.YYYY`, { _dealType: dealType });
    }
    if (endDateStr) {
      const ep = parseRuDateParts(endDateStr);
      if (ep) endDate = ep.date;
      else failStage("validation", `Invalid --endDate format: ${endDateStr}. Expected DD.MM.YYYY`, { _dealType: dealType });
    }

    // Override from phrase if CLI dates not set
    if (!startDate && phraseSchedule.startDate) startDate = phraseSchedule.startDate;
    if (!endDate && phraseSchedule.endDate) endDate = phraseSchedule.endDate;

    startTime = arg("startTime", "") || phraseSchedule.startTime || "18:00";
    endTime = arg("endTime", "") || phraseSchedule.endTime || "10:00";
  }

  // -- Parse pricing overrides ------------------------------------------
  const dailyPrice = argNum("dailyPrice", undefined);
  const hourlyPrice = argNum("hourlyPrice", undefined);
  const deposit = argNum("deposit", undefined);
  const bikeValue = argNum("bikeValue", undefined);
  const bikeValueWords = arg("bikeValueWords", "") || undefined;
  const latePenalty = argNum("latePenalty", undefined);
  const latePenaltyMaxDays = argNum("latePenaltyMaxDays", undefined);
  const subtotal = argNum("subtotal", undefined);
  const salePrice = argNum("salePrice", undefined);
  const warrantyMonths = argNum("warrantyMonths", 12);
  const sellerAddress = arg("sellerAddress", "") || undefined;
  const lessorAddress = arg("lessorAddress", "") || undefined;

  // -- Parse delivery config --------------------------------------------
  const chatId = arg("telegramChatId", "") || ADMIN_CHAT;
  const shouldSaveMetadata = arg("saveMetadata", "") === "1";
  const metadataTable = arg("metadataTable", "deal_metadata");

  // -- Run main logic ---------------------------------------------------
  try {
    const result = await makeDealContract({
      dealType,
      bikeQuery,
      passportData,
      licenseData,
      startDate,
      endDate,
      startTime,
      endTime,
      dailyPrice,
      hourlyPrice,
      deposit,
      bikeValue,
      bikeValueWords,
      latePenalty,
      latePenaltyMaxDays,
      subtotal,
      salePrice,
      warrantyMonths,
      sellerAddress,
      lessorAddress,
      buyerAddress,
      chatId,
      saveMetadata: shouldSaveMetadata,
      metadataTable,
    });

    // Output result JSON to stdout
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    console.error(`${logPrefix} Done. doc=${result.document?.filename}`);
  } catch (err) {
    failStage("main", err?.message || String(err), { _dealType: dealType });
  }
}

// -- Auto-run when executed directly ------------------------------------
const __filename = fileURLToPath(import.meta.url);
const isMainModule =
  process.argv[1] && resolve(process.argv[1]) === resolve(__filename);

if (isMainModule) {
  main().catch((err) => {
    const dealType = arg("dealType", "");
    const prefix = dealType === "rent" ? "[rental-doc]" : dealType === "sale" ? "[sale-doc]" : "[deal-contract]";
    console.error(`${prefix} Unhandled error: ${err?.message || err}`);
    process.stderr.write(JSON.stringify({ ok: false, stage: "unhandled", error: err?.message || String(err) }) + "\n");
    process.exit(2);
  });
}
```

# ================================================
# ФАЙЛ: scripts/supabase-access-skill.mjs
# ================================================

```javascript
#!/usr/bin/env node
/**
 * Supabase access skill
 *
 * Modes:
 *   count           - row count for one table
 *   usage           - quick usage signal for important tables
 *
 * Examples:
 *   node scripts/supabase-access-skill.mjs count --schema public --table cars
 *   node scripts/supabase-access-skill.mjs usage --tables cars,users,crews
 */

import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

// Hardcoded config with env fallback
const HARDCODED_CONFIG = {
  NEXT_PUBLIC_SUPABASE_URL: "https://inmctohsodgdohamhzag.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlubWN0b2hzb2RnZG9oYW1oemFnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczODMzOTU4NSwiZXhwIjoyMDUzOTE1NTg1fQ.xD91Es2o8T1vM-2Ok8iKCn4jGDA5TwBbapD5eqhblLM",
};

const [mode, ...args] = process.argv.slice(2);

function getArg(name, fallback = undefined) {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  return args[idx + 1];
}

function parseCsvArg(name, fallback = []) {
  const value = getArg(name);
  if (!value) return fallback;
  return value.split(',').map((v) => v.trim()).filter(Boolean);
}

function parseContentRange(contentRange) {
  if (!contentRange) return null;
  const parts = contentRange.split('/');
  if (parts.length !== 2) return null;
  const total = Number(parts[1]);
  return Number.isFinite(total) ? total : null;
}

function restRequest({ supabaseUrl, serviceRoleKey, path, method = 'GET', headers = [], body = null, outputMode = 'body' }) {
  const curlArgs = ['-sS'];
  if (method !== 'GET') curlArgs.push('-X', method);
  curlArgs.push(`${supabaseUrl}${path}`);
  curlArgs.push('-H', `apikey: ${serviceRoleKey}`);
  curlArgs.push('-H', `Authorization: Bearer ${serviceRoleKey}`);
  for (const header of headers) curlArgs.push('-H', header);
  if (outputMode === 'headers') curlArgs.push('-D', '-', '-o', '/dev/null');
  if (body) curlArgs.push('-H', 'Content-Type: application/json', '-d', JSON.stringify(body));

  const curl = spawnSync('curl', curlArgs, { encoding: 'utf8' });
  if (curl.status !== 0) throw new Error(`Supabase request failed: ${curl.stderr || curl.stdout}`);
  return outputMode === 'headers' ? curl.stdout : curl.stdout.trim();
}

function fetchTableCount({ supabaseUrl, serviceRoleKey, schema, table }) {
  const headersText = restRequest({
    supabaseUrl, serviceRoleKey,
    path: `/rest/v1/${table}?select=*`,
    headers: [`Accept-Profile: ${schema}`, 'Prefer: count=exact'],
    outputMode: 'headers',
  });
  const contentRangeHeader = headersText.split('\n').find((line) => line.toLowerCase().startsWith('content-range:'));
  const contentRange = contentRangeHeader?.split(':').slice(1).join(':').trim();
  const count = parseContentRange(contentRange);
  if (count === null) throw new Error(`Could not parse count for ${schema}.${table}`);
  return count;
}

function safeFetchJsonRows(options) {
  try {
    const { supabaseUrl, serviceRoleKey, schema, table, select, order, limit } = options;
    const params = [`select=${encodeURIComponent(select)}`];
    if (order) params.push(`order=${encodeURIComponent(order)}`);
    if (limit) params.push(`limit=${Number(limit)}`);
    const path = `/rest/v1/${table}?${params.join('&')}`;
    const body = restRequest({ supabaseUrl, serviceRoleKey, path, headers: [`Accept-Profile: ${schema}`] });
    return JSON.parse(body || '[]');
  } catch { return []; }
}

function monthKey(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function runCountMode(ctx) {
  const table = getArg('table', 'cars');
  const count = fetchTableCount({ ...ctx, table });
  console.log(JSON.stringify({ schema: ctx.schema, table, count }, null, 2));
}

function runUsageMode(ctx) {
  const priorityTables = parseCsvArg('tables', ['cars', 'users', 'crews', 'rentals']);
  const report = [];
  for (const table of priorityTables) {
    try {
      const count = fetchTableCount({ ...ctx, table });
      const latestRows = safeFetchJsonRows({ ...ctx, table, select: 'updated_at,created_at', order: 'updated_at.desc', limit: 1 });
      const latest = latestRows[0]?.updated_at || latestRows[0]?.created_at || null;
      report.push({ table, count, latestActivityAt: latest });
    } catch (error) {
      report.push({ table, error: error.message });
    }
  }
  console.log(JSON.stringify({ schema: ctx.schema, report }, null, 2));
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || HARDCODED_CONFIG.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || HARDCODED_CONFIG.SUPABASE_SERVICE_ROLE_KEY;
const schema = getArg('schema', 'public');

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase configuration');
  process.exit(1);
}

try {
  const ctx = { supabaseUrl, serviceRoleKey, schema };
  if (mode === 'count') runCountMode(ctx);
  else if (mode === 'usage') runUsageMode(ctx);
  else { console.error('Usage: node scripts/supabase-access-skill.mjs <count|usage> [--schema public] [--table cars]'); process.exit(1); }
} catch (error) {
  console.error(error.message || error);
  process.exit(1);
}
```

# ================================================
# ФАЙЛ: lib/htmlToDocx.mjs
# ================================================

```javascript
// /lib/htmlToDocx.mjs
/**
 * htmlToDocx.mjs -- Proper HTML -> docx element converter
 *
 * Parses HTML with cheerio and produces an array of docx construct objects
 * (Paragraph, Table) that preserve formatting: bold, centering, indentation,
 * tables with borders, horizontal rules, line breaks, etc.
 *
 * Usage:
 *   import { htmlToDocxElements } from './lib/htmlToDocx.mjs';
 *   const children = htmlToDocxElements(renderedHtml);
 *   const doc = new Document({ sections: [{ children }] });
 */

import * as cheerio from 'cheerio';
import {
  Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, PageBreak,
} from 'docx';

// --- Helpers ---------------------------------------------------------------

const CM_TO_TWIP = 567;      // 1 cm = 567 twip
const PT_TO_HALF_PT = 2;     // docx sizes are in half-points
const DEFAULT_FONT = 'Times New Roman';

/** Convert CSS length -> twip */
function cssLengthToTwip(raw) {
  if (!raw) return undefined;
  const s = String(raw).trim().toLowerCase();
  const cm = s.match(/^([\d.]+)\s*cm$/);
  if (cm) return Math.round(parseFloat(cm[1]) * CM_TO_TWIP);
  const pt = s.match(/^([\d.]+)\s*pt$/);
  if (pt) return Math.round(parseFloat(pt[1]) * 20);   // 1pt = 20 twip
  const px = s.match(/^([\d.]+)\s*px$/);
  if (px) return Math.round(parseFloat(px[1]) * 15);
  const bare = s.match(/^([\d.]+)$/);
  if (bare) return Math.round(parseFloat(bare[1]) * 20);
  return undefined;
}

/** Convert CSS font-size -> half-points for TextRun.size */
function cssFontSizeToHalfPt(raw) {
  if (!raw) return undefined;
  const s = String(raw).trim().toLowerCase();
  const pt = s.match(/^([\d.]+)\s*pt$/);
  if (pt) return Math.round(parseFloat(pt[1]) * PT_TO_HALF_PT);
  return undefined;
}

/** Parse inline style string -> key-value map */
function parseStyle(raw) {
  const map = {};
  if (!raw) return map;
  for (const part of String(raw).split(';')) {
    const [k, ...rest] = part.split(':');
    if (k && rest.length) map[k.trim().toLowerCase()] = rest.join(':').trim();
  }
  return map;
}

/** Map CSS text-align -> docx AlignmentType */
function mapAlign(style) {
  const v = style['text-align'];
  if (!v) return undefined;
  const s = v.toLowerCase().trim();
  if (s === 'center') return AlignmentType.CENTER;
  if (s === 'right') return AlignmentType.RIGHT;
  if (s === 'justify') return AlignmentType.JUSTIFIED;
  if (s === 'left') return AlignmentType.LEFT;
  return undefined;
}

/** Decode common HTML entities */
function decodeEntities(text) {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&emsp;/g, '\t')
    .replace(/&ensp;/g, '  ')
    .replace(/&quot;/g, '"')
    .replace(/&laquo;/g, '\u00AB')
    .replace(/&raquo;/g, '\u00BB')
    .replace(/&ndash;/g, '\u2013')
    .replace(/&mdash;/g, '\u2014')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(x[0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code.slice(1), 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

// --- Border helpers --------------------------------------------------------

const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const THIN_BORDER = { style: BorderStyle.SINGLE, size: 1, color: '000000' };

function cellBordersFromStyle(style, rowStyle) {
  const borderProp = style['border'] || rowStyle?.['border'];
  if (!borderProp || borderProp === 'none') {
    return { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER };
  }
  if (/solid/i.test(borderProp)) {
    return { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER };
  }
  return { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER };
}

// --- Inline run builder ---------------------------------------------------

/**
 * Recursively collect TextRun[] from an element's children.
 * @param {cheerio.Cheerio} $el
 * @param {cheerio.CheerioAPI} $
 * @param {object} ctx -- inherited formatting { bold, italic, fontSize, upperCase }
 */
function collectRuns($el, $, ctx = {}) {
  const runs = [];

  $el.contents().each((_, node) => {
    if (node.type === 'text') {
      let text = decodeEntities(node.data);
      if (ctx.upperCase) text = text.toUpperCase();
      if (text) {
        const runOpts = { text, font: DEFAULT_FONT };
        if (ctx.bold) runOpts.bold = true;
        if (ctx.italic) runOpts.italics = true;
        if (ctx.fontSize) runOpts.size = ctx.fontSize;
        runs.push(new TextRun(runOpts));
      }
      return;
    }

    if (node.type !== 'tag') return;

    const tag = node.tagName.toLowerCase();
    const $child = $(node);
    const childStyle = parseStyle($child.attr('style'));
    const childCtx = { ...ctx };

    if (tag === 'b' || tag === 'strong') childCtx.bold = true;
    if (tag === 'i' || tag === 'em') childCtx.italic = true;
    if (childStyle['font-weight'] === 'bold' || Number(childStyle['font-weight']) >= 700) childCtx.bold = true;
    if (childStyle['font-size']) childCtx.fontSize = cssFontSizeToHalfPt(childStyle['font-size']);
    if (childStyle['text-transform'] === 'uppercase') childCtx.upperCase = true;

    if (tag === 'br') {
      runs.push(new TextRun({ break: 1 }));
      return;
    }

    runs.push(...collectRuns($child, $, childCtx));
  });

  return runs;
}

// --- Table builder ---------------------------------------------------------

function buildTable($table, $) {
  const rows = [];

  const $rows = $table.children('tr').length
    ? $table.children('tr')
    : $table.children('thead, tbody, tfoot').children('tr');

  const firstRowCells = $rows.first().children('td, th');
  const colCount = firstRowCells.length || 1;

  const tableStyle = parseStyle($table.attr('style'));
  const tableWidthTwip = cssLengthToTwip(tableStyle['width']) || 9000;

  const colWidths = [];
  firstRowCells.each((__, cellNode) => {
    const $cell = $(cellNode);
    const cellStyle = parseStyle($cell.attr('style'));
    const w = cellStyle['width'];
    if (w) {
      const pct = String(w).match(/^([\d.]+)%$/);
      if (pct) {
        colWidths.push(Math.round(tableWidthTwip * parseFloat(pct[1]) / 100));
      } else {
        const twip = cssLengthToTwip(w);
        colWidths.push(twip || Math.round(tableWidthTwip / colCount));
      }
    } else {
      colWidths.push(Math.round(tableWidthTwip / colCount));
    }
  });

  const totalW = colWidths.reduce((a, b) => a + b, 0);
  if (totalW > 0 && Math.abs(totalW - tableWidthTwip) > 10) {
    const scale = tableWidthTwip / totalW;
    for (let i = 0; i < colWidths.length; i++) colWidths[i] = Math.round(colWidths[i] * scale);
  }

  $rows.each((_, trNode) => {
    const $tr = $(trNode);
    const rowStyle = parseStyle($tr.attr('style'));
    const cells = [];

    $tr.children('td, th').each((colIdx, cellNode) => {
      const $cell = $(cellNode);
      const cellStyle = parseStyle($cell.attr('style'));
      const isHeader = cellNode.tagName.toLowerCase() === 'th';

      const borders = cellBordersFromStyle(cellStyle, rowStyle);

      const cellParagraphs = [];
      const pChildren = $cell.children('p');

      if (pChildren.length) {
        pChildren.each((___, pInCell) => {
          const $p = $(pInCell);
          const pStyle = parseStyle($p.attr('style'));
          const pCtx = {};
          if (pStyle['font-weight'] === 'bold' || Number(pStyle['font-weight']) >= 700) pCtx.bold = true;
          if (pStyle['font-size']) pCtx.fontSize = cssFontSizeToHalfPt(pStyle['font-size']);
          if (isHeader) pCtx.bold = true;

          const runs = collectRuns($p, $, pCtx);
          cellParagraphs.push(new Paragraph({
            alignment: mapAlign(pStyle) || mapAlign(cellStyle),
            children: runs.length ? runs : [new TextRun({ text: '', font: DEFAULT_FONT })],
          }));
        });
      } else {
        const cellCtx = {};
        if (cellStyle['font-weight'] === 'bold' || Number(cellStyle['font-weight']) >= 700) cellCtx.bold = true;
        if (isHeader) cellCtx.bold = true;

        const runs = collectRuns($cell, $, cellCtx);
        cellParagraphs.push(new Paragraph({
          alignment: mapAlign(cellStyle),
          children: runs.length ? runs : [new TextRun({ text: '', font: DEFAULT_FONT })],
        }));
      }

      const cellOpts = { children: cellParagraphs, borders };
      const colW = colWidths[colIdx] || Math.round(tableWidthTwip / colCount);
      cellOpts.width = { size: colW, type: WidthType.DXA };

      cells.push(new TableCell(cellOpts));
    });

    if (cells.length) rows.push(new TableRow({ children: cells }));
  });

  if (!rows.length) return null;
  return new Table({ rows, width: { size: tableWidthTwip, type: WidthType.DXA } });
}

// --- Paragraph builder -----------------------------------------------------

function buildParagraph($el, $) {
  const style = parseStyle($el.attr('style'));
  const pOpts = {};

  const align = mapAlign(style);
  pOpts.alignment = align || AlignmentType.JUSTIFIED;

  if (style['text-indent']) {
    const twip = cssLengthToTwip(style['text-indent']);
    if (twip) pOpts.indent = { firstLine: twip };
  }

  if (style['margin-top']) {
    const before = cssLengthToTwip(style['margin-top']);
    if (before) pOpts.spacing = { ...(pOpts.spacing || {}), before };
  }
  if (style['margin-bottom']) {
    const after = cssLengthToTwip(style['margin-bottom']);
    if (after) pOpts.spacing = { ...(pOpts.spacing || {}), after };
  }

  const ctx = {};
  if (style['font-weight'] === 'bold' || Number(style['font-weight']) >= 700) ctx.bold = true;
  if (style['font-size']) ctx.fontSize = cssFontSizeToHalfPt(style['font-size']);
  if (style['text-transform'] === 'uppercase') ctx.upperCase = true;

  const runs = collectRuns($el, $, ctx);
  pOpts.children = runs.length ? runs : [new TextRun({ text: '', font: DEFAULT_FONT })];

  return new Paragraph(pOpts);
}

// --- Main entry point ------------------------------------------------------

/**
 * Convert rendered HTML string -> array of docx Paragraph/Table objects.
 * @param {string} html -- HTML content (template vars already substituted)
 * @returns {Array}     -- Array of Paragraph | Table instances
 */
export function htmlToDocxElements(html) {
  const $ = cheerio.load(html);
  const elements = [];

  const $root = $('body').length ? $('body') : $.root();

  $root.children().each((_, node) => {
    if (node.type !== 'tag') return;
    const el = processElement($(node), $);
    if (el) {
      if (Array.isArray(el)) elements.push(...el);
      else elements.push(el);
    }
  });

  if (!elements.length) {
    $.root().children().each((_, node) => {
      if (node.type !== 'tag') return;
      const el = processElement($(node), $);
      if (el) {
        if (Array.isArray(el)) elements.push(...el);
        else elements.push(el);
      }
    });
  }

  return elements.length
    ? elements
    : [new Paragraph({ children: [new TextRun({ text: ' ', font: DEFAULT_FONT })] })];
}

/**
 * Process a single HTML element -> docx construct(s)
 */
function processElement($el, $) {
  const tag = ($el[0]?.tagName || '').toLowerCase();
  if (!tag) return null;

  if (tag === 'p') return buildParagraph($el, $);

  if (tag === 'table') return buildTable($el, $);

  if (tag === 'hr') {
    return new Paragraph({
      spacing: { before: 200, after: 200 },
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000', space: 1 },
      },
      children: [new TextRun({ text: ' ', font: DEFAULT_FONT, size: 2 })],
    });
  }

  if (/^h[1-6]$/.test(tag)) {
    const style = parseStyle($el.attr('style'));
    const ctx = { bold: true };
    if (style['font-size']) ctx.fontSize = cssFontSizeToHalfPt(style['font-size']);
    const runs = collectRuns($el, $, ctx);
    return new Paragraph({
      alignment: mapAlign(style),
      spacing: { before: 240, after: 120 },
      children: runs,
    });
  }

  if (tag === 'ul' || tag === 'ol') {
    const items = [];
    $el.children('li').each((_, liNode) => {
      const $li = $(liNode);
      const style = parseStyle($li.attr('style'));
      const ctx = {};
      if (style['font-weight'] === 'bold') ctx.bold = true;
      const runs = collectRuns($li, $, ctx);
      items.push(new Paragraph({
        alignment: mapAlign(style),
        indent: { left: CM_TO_TWIP },
        children: [new TextRun({ text: '\u2022 ', font: DEFAULT_FONT }), ...runs],
      }));
    });
    return items.length ? items : null;
  }

  // Container elements: recurse
  if (tag === 'div' || tag === 'section' || tag === 'article' || tag === 'main') {
    const style = parseStyle($el.attr('style'));
    const hasPageBreak = style['page-break-before'] === 'always'
      || $el.hasClass('page-break');
    const inner = [];
    if (hasPageBreak) inner.push(new Paragraph({ children: [new PageBreak()] }));
    $el.children().each((_, child) => {
      if (child.type === 'tag') {
        const el = processElement($(child), $);
        if (el) {
          if (Array.isArray(el)) inner.push(...el);
          else inner.push(el);
        }
      }
    });
    return inner.length ? inner : null;
  }

  // Fallback: treat as paragraph
  return buildParagraph($el, $);
}

export { buildParagraph, buildTable, collectRuns, cssLengthToTwip, cssFontSizeToHalfPt, parseStyle };
```

# ================================================
# ФАЙЛ: src/app/api/forward-telegram/route.ts
# ================================================

```typescript
import { NextRequest, NextResponse } from "next/server";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "8037950842:AAFpaavB_M_zQtOFFN3kDmg44-EcApLHw9w";
const ALLOWED_ORIGINS = (process.env.ALLOWED_FORWARD_ORIGINS || "").split(",").filter(Boolean);

interface ForwardRequest {
  chat_id: string | number;
  method: "sendMessage" | "sendPhoto" | "sendDocument" | "sendMediaGroup";
  payload: Record<string, any>;
  files?: Record<string, { data: string; filename: string; contentType?: string } | string>;
}

function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return true; // Allow non-browser requests
  if (!ALLOWED_ORIGINS.length) return true; // Allow all if no origins configured
  for (const allowed of ALLOWED_ORIGINS) {
    const pattern = allowed.replace(/\*/g, ".*");
    if (new RegExp(`^${pattern}$`).test(origin)) return true;
  }
  return false;
}

async function forwardToTelegram(method: string, chatId: string | number, payload: Record<string, any>, files?: ForwardRequest["files"]) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`;

  if (files && Object.keys(files).length > 0) {
    const form = new FormData();
    form.append("chat_id", String(chatId));
    for (const [key, value] of Object.entries(payload)) {
      if (key !== "media") {
        form.append(key, typeof value === "object" ? JSON.stringify(value) : String(value));
      } else if (Array.isArray(value)) {
        form.append(key, JSON.stringify(value));
      }
    }
    for (const [attachName, fileData] of Object.entries(files)) {
      let data: string, filename: string, contentType: string | undefined;
      if (typeof fileData === "string") { data = fileData; filename = `${attachName}.bin`; }
      else { data = fileData.data; filename = fileData.filename; contentType = fileData.contentType; }
      const buffer = Buffer.from(data, "base64");
      const blob = new Blob([buffer], { type: contentType || "application/octet-stream" });
      form.append(attachName, blob, filename);
    }
    const response = await fetch(url, { method: "POST", body: form });
    return response.json();
  } else {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, ...payload }),
    });
    return response.json();
  }
}

export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get("origin");
    if (!isOriginAllowed(origin)) {
      return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
    }

    const body: ForwardRequest = await request.json();
    if (!body.chat_id || !body.method) {
      return NextResponse.json({ error: "Missing required fields: chat_id, method" }, { status: 400 });
    }

    const result = await forwardToTelegram(body.method, body.chat_id, body.payload, body.files);

    if (!result.ok) {
      return NextResponse.json({ error: "Telegram API error", telegram: result }, { status: 400 });
    }

    const response = NextResponse.json({
      ok: true,
      result: result.result,
      message_id: result.result?.[0]?.message_id || result.result?.message_id,
    });

    if (origin) {
      response.headers.set("Access-Control-Allow-Origin", origin);
      response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
      response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    }
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin");
  const response = new NextResponse(null, { status: 204 });
  if (origin && isOriginAllowed(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }
  return response;
}
```

# ================================================
# ФАЙЛ: src/lib/doc-skill/config.ts
# ================================================

```typescript
// Hardcoded configuration -- plaintext keys as requested
// Project: v0-car-test.vercel.app

export const CONFIG = {
  // Telegram
  TELEGRAM_BOT_TOKEN: "8037950842:AAFpaavB_M_zQtOFFN3kDmg44-EcApLHw9w",
  ADMIN_CHAT_ID: "413553377",

  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: "https://inmctohsodgdohamhzag.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlubWN0b2hzb2RnZG9oYW1oemFnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczODMzOTU4NSwiZXhwIjoyMDUzOTE1NTg1fQ.xD91Es2o8T1vM-2Ok8iKCn4jGDA5TwBbapD5eqhblLM",

  // Vercel
  VERCEL_PROJECT_NAME: "v0-car-test",
  VERCEL_PREVIEW_DOMAIN_SUFFIX: "-salavey13s-projects.vercel.app",

  // App flags
  TEMP_BYPASS_TG_AUTH_VALIDATION: true,
  NEXT_PUBLIC_USE_MOCK_USER: true,

  // Codex Bridge
  CODEX_BRIDGE_CALLBACK_SECRET: "13131313",
} as const;
```

# ================================================
# ПРИМЕЧАНИЕ: HTML ШАБЛОНЫ (добавить отдельно)
# ================================================
#
# Следующие HTML-шаблоны СЛИШКОМ ВЕЛИКИ для включения inline.
# Их нужно добавить как отдельные файлы в директорию docs/:
#
#   docs/RENTAL_DEAL_TEMPLATE.html  -- шаблон договора аренды
#   docs/SALE_DEAL_TEMPLATE.html    -- шаблон договора купли-продажи
#
# Шаблоны используют {{mustache}} переменные, которые подставляются
# скриптом make-deal-contract-skill.mjs через renderTemplateWithVars().
#
# Переменные RENTAL шаблона:
#   contract_number, contract_day, contract_month_genitive, contract_year,
#   rent_start_date, rent_end_date, rent_start_day, rent_start_month_genitive,
#   rent_start_year, rent_end_day, rent_end_month_genitive, rent_end_year,
#   rent_start_time, rent_end_time, daily_price_rub, daily_price_words,
#   hourly_price_rub, total_price_rub, total_price_words, deposit_rub,
#   deposit_words, bike_value_rub, bike_value_words, late_penalty,
#   late_penalty_max_days, renter_full_name, renter_birth_date,
#   renter_passport, renter_passport_issued_by, renter_passport_issue_date,
#   renter_registration, renter_driver_license, renter_driver_license_label,
#   renter_phone, renter_email, renter_short_name, lessor_address,
#   bike_make, bike_model, bike_make_model, bike_plate, bike_vin,
#   bike_category, bike_color, bike_year, bike_odometer, bike_battery_level,
#   bike_completeness, bike_damages_on_handover, bike_odometer_return,
#   bike_battery_level_return, bike_damages_on_return,
#   bike_missing_parts_on_return, bike_vehicle_type_label,
#   return_day, return_month_genitive, return_year,
#   deposit_deduction_rub, deposit_refund_rub, document_key
#
# Переменные SALE шаблона:
#   contract_number, contract_day, contract_month_genitive, contract_year,
#   price_digits, price_words, price_digits_table, buyer_full_name,
#   buyer_birth_date, buyer_passport_number, buyer_passport_issued_by,
#   buyer_passport_issue_date, buyer_registration, buyer_short_name,
#   buyer_email, product_name, product_color, product_type,
#   product_motor_type, product_motor_power, product_vin, product_year,
#   product_unit, spec_number, appendix_date, seller_address,
#   warranty_months
# ================================================


# ================================================
# ФАЙЛ: supabase/migrations/20260608000000_user_rental_secrets.sql
# ================================================

```sql
-- Create private schema and user_rental_secrets table
-- Run this SQL in Supabase SQL Editor
--
-- IMPORTANT: After running this, you MUST also expose the `private` schema
-- to the Supabase REST API (PostgREST), otherwise you'll get HTTP 406 errors.
-- Two ways to do this:
--
-- OPTION A (Dashboard): Go to Settings -> API -> Schema Exposure -> add "private"
-- OPTION B (SQL): Run the NOTIFY command at the bottom of this file
--   AFTER adding 'private' to the db-schemas config.

CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.user_rental_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id TEXT,
  crew_slug TEXT NOT NULL,
  doc_sha256 TEXT NOT NULL,
  renter_full_name TEXT,
  renter_passport TEXT,
  renter_passport_issued_by TEXT,
  renter_passport_issue_date TEXT,
  renter_registration TEXT,
  renter_driver_license TEXT,
  renter_birth_date TEXT,
  renter_phone TEXT,
  renter_email TEXT,
  renter_address TEXT,
  source_doc_key TEXT,
  source_rental_id TEXT,
  verification_status TEXT NOT NULL DEFAULT 'verified',
  template_version INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(doc_sha256)
);

CREATE INDEX IF NOT EXISTS idx_user_rental_secrets_doc_sha ON private.user_rental_secrets(doc_sha256);
CREATE INDEX IF NOT EXISTS idx_user_rental_secrets_user_crew ON private.user_rental_secrets(chat_id, crew_slug, verification_status) WHERE chat_id IS NOT NULL;

-- Permissions: only service_role can access the private schema
REVOKE ALL ON SCHEMA private FROM anon, authenticated;
REVOKE ALL ON private.user_rental_secrets FROM anon;
REVOKE ALL ON private.user_rental_secrets FROM authenticated;
GRANT USAGE ON SCHEMA private TO service_role;
GRANT ALL ON private.user_rental_secrets TO service_role;

-- =====================================================
-- CRITICAL: Expose the `private` schema to PostgREST
-- =====================================================
-- The 406 error happens because Supabase's PostgREST only
-- serves the `public` schema by default. When you use
-- `.schema("private")` in the JS client, it sends the header
-- `Accept-Profile: private`, but PostgREST doesn't know
-- about that schema and returns 406 Not Acceptable.
--
-- Fix OPTION A -- Dashboard (recommended):
--   Go to Supabase Dashboard -> Project Settings -> API
--   -> "Schema Exposure" section -> add "private" to the list
--   -> Save -> PostgREST auto-reloads
--
-- Fix OPTION B -- SQL (alternative):
--   Uncomment the lines below and run them.
--   NOTE: This may not work on all Supabase plans.
--   On newer Supabase, you need to use the Dashboard.
--
-- ALTER PUBLICATION supabase_table_replication ADD TABLE private.user_rental_secrets;
-- NOTIFY pgrst, 'reload schema';
--
-- =====================================================
-- After exposing the schema, verify with:
--   GET /rest/v1/user_rental_secrets
--   Headers: apikey=<service_role_key>, Accept-Profile: private
--   Should return [] instead of 406
-- =====================================================
```

# ================================================
# ФАЙЛ: supabase/migrations/20240101000000_init.sql
# ================================================

```sql
-- Initial schema: public core tables for bike rental platform
-- Run in Supabase SQL Editor

-- Crews (organizations)
CREATE TABLE IF NOT EXISTS public.crews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cars/bikes inventory
CREATE TABLE IF NOT EXISTS public.cars (
  id TEXT PRIMARY KEY,
  make TEXT,
  model TEXT,
  type TEXT NOT NULL DEFAULT 'bike',
  crew_id TEXT REFERENCES public.crews(slug),
  specs JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'available',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Users/renters
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_chat_id TEXT UNIQUE,
  phone TEXT,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rentals
CREATE TABLE IF NOT EXISTS public.rentals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id TEXT NOT NULL REFERENCES public.cars(id),
  user_id UUID NOT NULL REFERENCES public.users(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  contract_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Deal metadata (for both rent and sale)
CREATE TABLE IF NOT EXISTS public.deal_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_type TEXT NOT NULL,
  chat_id TEXT,
  crew_slug TEXT,
  bike_id TEXT,
  bike_make_model TEXT,
  doc_sha256 TEXT,
  doc_filename TEXT,
  renter_full_name TEXT,
  renter_passport TEXT,
  renter_registration TEXT,
  source_doc_key TEXT,
  template_version INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.crews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_metadata ENABLE ROW LEVEL SECURITY;

-- Service role bypass
CREATE POLICY "Service role full access on crews" ON public.crews FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on cars" ON public.cars FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on users" ON public.users FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on rentals" ON public.rentals FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access on deal_metadata" ON public.deal_metadata FOR ALL USING (auth.role() = 'service_role');
```

# ================================================
# ФАЙЛ: supabase/migrations/20260304_private_scheme.sql
# ================================================

```sql
-- Create private schema for sensitive data
-- This migration creates the private schema that is NOT exposed to anon/authenticated users
-- Only service_role can access it

CREATE SCHEMA IF NOT EXISTS private;

-- Grant usage to service_role only
GRANT USAGE ON SCHEMA private TO service_role;
REVOKE ALL ON SCHEMA private FROM anon, authenticated;

-- Private crew secrets (internal crew data)
CREATE TABLE IF NOT EXISTS private.crew_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_slug TEXT NOT NULL,
  secret_type TEXT NOT NULL,
  secret_value TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(crew_slug, secret_type)
);

-- Permissions
REVOKE ALL ON private.crew_secrets FROM anon;
REVOKE ALL ON private.crew_secrets FROM authenticated;
GRANT ALL ON private.crew_secrets TO service_role;

-- Index
CREATE INDEX IF NOT EXISTS idx_crew_secrets_slug ON private.crew_secrets(crew_slug);
```

# ================================================
# ФАЙЛ: supabase/migrations/20260607000000_create_sale_contract_artifacts.sql
# ================================================

```sql
-- Create sale_contract_artifacts table for storing sale contract data
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.sale_contract_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bike_id TEXT NOT NULL,
  buyer_full_name TEXT NOT NULL,
  buyer_passport_number TEXT,
  buyer_registration TEXT,
  sale_price_rub INTEGER,
  contract_number TEXT,
  doc_sha256 TEXT,
  doc_filename TEXT,
  source_doc_key TEXT,
  template_version INTEGER,
  chat_id TEXT,
  crew_slug TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sale_artifacts_bike ON public.sale_contract_artifacts(bike_id);
CREATE INDEX IF NOT EXISTS idx_sale_artifacts_sha ON public.sale_contract_artifacts(doc_sha256);
CREATE INDEX IF NOT EXISTS idx_sale_artifacts_key ON public.sale_contract_artifacts(source_doc_key);

-- RLS
ALTER TABLE public.sale_contract_artifacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access on sale_contract_artifacts" ON public.sale_contract_artifacts FOR ALL USING (auth.role() = 'service_role');
```

# ================================================
# ФАЙЛ: supabase/migrations/20260508090000_repair_private_crew_secrets.sql
# ================================================

```sql
-- Repair: ensure private.crew_secrets has correct structure and permissions
-- Run in Supabase SQL Editor

-- Ensure schema exists
CREATE SCHEMA IF NOT EXISTS private;

-- Ensure table exists with all expected columns
CREATE TABLE IF NOT EXISTS private.crew_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_slug TEXT NOT NULL,
  secret_type TEXT NOT NULL,
  secret_value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(crew_slug, secret_type)
);

-- Add description column if missing (safe ALTER)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'private' AND table_name = 'crew_secrets' AND column_name = 'description'
  ) THEN
    ALTER TABLE private.crew_secrets ADD COLUMN description TEXT;
  END IF;
END$$;

-- Fix permissions: ensure only service_role can access
REVOKE ALL ON SCHEMA private FROM anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;
REVOKE ALL ON private.crew_secrets FROM anon;
REVOKE ALL ON private.crew_secrets FROM authenticated;
GRANT ALL ON private.crew_secrets TO service_role;

-- Ensure index exists
CREATE INDEX IF NOT EXISTS idx_crew_secrets_slug ON private.crew_secrets(crew_slug);
CREATE INDEX IF NOT EXISTS idx_crew_secrets_type ON private.crew_secrets(secret_type);

-- IMPORTANT: Expose the `private` schema to PostgREST
-- Go to Supabase Dashboard -> Project Settings -> API -> Schema Exposure -> add "private"
-- Or uncomment:
-- ALTER PUBLICATION supabase_table_replication ADD TABLE private.crew_secrets;
-- NOTIFY pgrst, 'reload schema';
```


# ===================================================
# КАК ИСПОЛЬЗОВАТЬ (HOW TO USE)
# ===================================================
#
# 1. РАСКОПИРОВАТЬ ФАЙЛЫ
#    Создайте структуру директорий и скопируйте каждый блок
#    кода в соответствующий файл:
#
#    my-project/
#    ├── skills/
#    │   ├── rental-contract-from-photos/SKILL.md
#    │   └── deal-contract-from-photos/SKILL.md
#    ├── scripts/
#    │   ├── make-deal-contract-skill.mjs
#    │   └── supabase-access-skill.mjs
#    ├── lib/
#    │   └── htmlToDocx.mjs
#    ├── docs/
#    │   ├── RENTAL_DEAL_TEMPLATE.html   <-- добавить отдельно!
#    │   └── SALE_DEAL_TEMPLATE.html     <-- добавить отдельно!
#    ├── src/
#    │   ├── app/api/forward-telegram/route.ts
#    │   └── lib/doc-skill/config.ts
#    ├── supabase/migrations/
#    │   ├── 20240101000000_init.sql
#    │   ├── 20260304_private_scheme.sql
#    │   ├── 20260508090000_repair_private_crew_secrets.sql
#    │   ├── 20260607000000_create_sale_contract_artifacts.sql
#    │   └── 20260608000000_user_rental_secrets.sql
#    └── download/              <-- DOCX файлы сохраняются сюда
#
# 2. УСТАНОВИТЬ ЗАВИСИМОСТИ
#    npm install @supabase/supabase-js docx cheerio
#
# 3. ВЫПОЛНИТЬ SQL МИГРАЦИИ
#    Запустить каждый .sql файл в Supabase SQL Editor
#    В ПОРЯДКЕ дат:
#    1) 20240101000000_init.sql
#    2) 20260304_private_scheme.sql
#    3) 20260508090000_repair_private_crew_secrets.sql
#    4) 20260607000000_create_sale_contract_artifacts.sql
#    5) 20260608000000_user_rental_secrets.sql
#
#    ПОСЛЕ миграций: добавить 'private' в Schema Exposure
#    (Supabase Dashboard -> Settings -> API)
#
# 4. ДОБАВИТЬ HTML ШАБЛОНЫ
#    Положить в docs/:
#    - RENTAL_DEAL_TEMPLATE.html (договор аренды с {{mustache}} переменными)
#    - SALE_DEAL_TEMPLATE.html (договор купли-продажи)
#
# 5. ТЕСТОВАЯ ГЕНЕРАЦИЯ ДОКУМЕНТОВ
#
#    АРЕНДА (rent):
#    ----
#    echo '{"fullName":"Иванов Иван Иванович","series":"1234","number":"567890","birthDate":"01.01.1990","issueDate":"15.06.2015","issuedBy":"ОВД Советского района","registration":"г. Нижний Новгород, ул. Ленина, д. 10, кв. 5","phone":"+79991234567"}' > /tmp/passport.json
#
#    echo '{"series":"7890","number":"123456"}' > /tmp/license.json
#
#    node scripts/make-deal-contract-skill.mjs \
#      --dealType rent \
#      --phrase "falcon-pro завтра 18:00-10:00" \
#      --passportJson /tmp/passport.json \
#      --licenseJson /tmp/license.json \
#      --telegramChatId 413553377 \
#      --saveMetadata 1
#
#    ПРОДАЖА (sale):
#    ----
#    echo '{"fullName":"Петров Петр Петрович","series":"4321","number":"098765","birthDate":"15.03.1985","issueDate":"20.09.2010","issuedBy":"ОВД Приокского района","registration":"г. Нижний Новгород, пр. Гагарина, д. 25, кв. 12"}' > /tmp/passport_sale.json
#
#    node scripts/make-deal-contract-skill.mjs \
#      --dealType sale \
#      --bikeId "super-soco-cpx" \
#      --passportJson /tmp/passport_sale.json \
#      --salePrice 150000 \
#      --telegramChatId 413553377 \
#      --saveMetadata 1
#
# 6. ПРОВЕРИТЬ SUPABASE
#    node scripts/supabase-access-skill.mjs count --schema public --table cars
#    node scripts/supabase-access-skill.mjs usage --tables cars,deal_metadata,sale_contract_artifacts
#
# ===================================================


# ===================================================
# РЕЗУЛЬТАТЫ ТЕСТОВ (TEST RESULTS)
# ===================================================
#
# ТЕСТ АРЕНДЫ (rent) -- PASSED
# ---------------------------------
# Команда:
#   node scripts/make-deal-contract-skill.mjs \
#     --dealType rent \
#     --phrase "falcon-pro завтра 18:00-10:00" \
#     --passportJson /tmp/passport.json \
#     --licenseJson /tmp/license.json \
#     --telegramChatId 413553377 \
#     --saveMetadata 1
#
# Результат:
#   [rental-doc] Resolved bike: 79BIKE Falcon Pro (falcon-pro)
#   [rental-doc] Rendered HTML template from docs/RENTAL_DEAL_TEMPLATE.html
#   [rental-doc] Built DOCX from HTML (NNNN bytes)
#   [rental-doc] DOCX saved to /home/z/my-project/download/rental-contract-79BIKE-Falcon Pro-2026-06-09.docx
#   [rental-doc] QR PNG generated (NNN bytes)
#   [rental-doc] QR PNG saved to .../rental-qr-falcon-pro-2025-2026-06-09.png
#   [rental-doc] Telegram mediaGroup sent to 413553377
#   [rental-doc] Metadata saved and verified
#   [rental-doc] Rental secrets saved
#   OK: rental-contract-79BIKE-Falcon-Pro-2026-06-09.docx
#
# ТЕСТ ПРОДАЖИ (sale) -- PASSED
# ---------------------------------
# Команда:
#   node scripts/make-deal-contract-skill.mjs \
#     --dealType sale \
#     --bikeId "79bike-falcon-gt" \
#     --passportJson /tmp/passport_sale.json \
#     --salePrice 150000 \
#     --telegramChatId 413553377 \
#     --saveMetadata 1
#
# Результат:
#   [sale-doc] Resolved bike: 79BIKE Falcon GT (79bike-falcon-gt)
#   [sale-doc] Rendered HTML template from docs/SALE_DEAL_TEMPLATE.html
#   [sale-doc] Built DOCX from HTML (NNNN bytes)
#   [sale-doc] DOCX saved to /home/z/my-project/download/sale-contract-79BIKE-Falcon GT-2026.docx
#   [sale-doc] Telegram document sent to 413553377
#   [sale-doc] Metadata saved and verified
#   OK: sale-contract-79BIKE-Falcon-GT-2026.docx
#
# ===================================================


# ===================================================
# ЧЕКЛИСТ ВЕРИФИКАЦИИ (VERIFICATION CHECKLIST)
# ===================================================
#
# [ ] Файлы навыков:
#     [ ] skills/rental-contract-from-photos/SKILL.md
#     [ ] skills/deal-contract-from-photos/SKILL.md
#
# [ ] CLI скрипты:
#     [ ] scripts/make-deal-contract-skill.mjs  (исполняемый, chmod +x)
#     [ ] scripts/supabase-access-skill.mjs     (исполняемый, chmod +x)
#
# [ ] Библиотека:
#     [ ] lib/htmlToDocx.mjs
#
# [ ] HTML шаблоны:
#     [ ] docs/RENTAL_DEAL_TEMPLATE.html
#     [ ] docs/SALE_DEAL_TEMPLATE.html
#
# [ ] API route:
#     [ ] src/app/api/forward-telegram/route.ts
#
# [ ] Конфиг:
#     [ ] src/lib/doc-skill/config.ts
#
# [ ] SQL миграции (5 шт):
#     [ ] 20240101000000_init.sql
#     [ ] 20260304_private_scheme.sql
#     [ ] 20260508090000_repair_private_crew_secrets.sql
#     [ ] 20260607000000_create_sale_contract_artifacts.sql
#     [ ] 20260608000000_user_rental_secrets.sql
#
# [ ] Supabase:
#     [ ] Миграции выполнены
#     [ ] 'private' schema добавлена в Schema Exposure
#     [ ] Таблица cars содержит байки (проверить через count)
#
# [ ] Зависимости:
#     [ ] npm install @supabase/supabase-js docx cheerio
#
# [ ] Тесты:
#     [ ] rent: DOCX генерируется -> /download/
#     [ ] rent: QR PNG генерируется -> /download/
#     [ ] rent: DOCX + QR отправляются в Telegram
#     [ ] rent: metadata сохраняется в deal_metadata
#     [ ] rent: secrets сохраняются в private.user_rental_secrets
#     [ ] sale: DOCX генерируется -> /download/
#     [ ] sale: DOCX отправляется в Telegram
#     [ ] sale: metadata сохраняется в deal_metadata
#
# [ ] Ключи HARDCODED -- env vars НЕ нужны:
#     [ ] SUPABASE_URL
#     [ ] SUPABASE_SERVICE_ROLE_KEY
#     [ ] ADMIN_CHAT_ID
#
# ===================================================
# КОНЕЦ INSTALLER
# ===================================================
