// /app/webhook-handlers/commands/testdrive-manual.ts
/**
 * /testdrive command handler — MANUAL INPUT VERSION
 * =============================================================================
 *
 * Enhanced flow (2026-07-05): inline bike selection + doc choice + private table saving.
 * After phone → doc choice (passport / license / both) → conditional steps.
 *
 * Flow:
 *   1. Bike selection (inline keyboard with callback_data)
 *   2. Phone → "+7 987 654 32 10"
 *   3. Document choice → inline keyboard (🪪 Passport / 🚗 License / 📋 Both)
 *      ├─ Passport only: name → passport → birth → address → confirm
 *      ├─ License only:  name → license → categories → confirm
 *      └─ Both:          name → passport → birth → address → license → categories → confirm
 *   4. Confirm → generate DOCX
 *
 * Skipped document fields are left blank in the contract ({{#if}} conditionals
 * in the template omit them entirely).
 */

"use server";

import { logger } from "@/lib/logger";
import { supabaseAdmin } from "@/hooks/supabase";
import { sendComplexMessage, KeyboardButton } from "../actions/sendComplexMessage";
import { notifyAdmin, sendTelegramDocument } from "@/app/actions";
import { buildFranchizeDocxFromTemplate, uploadDocxToStorage } from "@/app/franchize/lib/docx-capability";
import { privateSchema } from "@/lib/private-secrets";
import { readFileSync } from "fs";
import { join } from "path";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CURRENT_YEAR = 2026;
const STATE_EXPIRY_MINUTES = 30;
const TESTDRIVE_PRICE = 5000;

// ── Types ────────────────────────────────────────────────────────────────────

interface TestDriveContext {
  bikeId: string;
  bikeMake?: string;
  bikeModel?: string;
  customerPhone?: string;
  customerFullName?: string;
  customerSeries?: string;
  customerNumber?: string;
  customerIssueDate?: string;
  customerIssuedBy?: string;
  customerBirthDate?: string;
  customerRegistration?: string;
  // Document choice flags
  needPassport?: boolean;       // true = collect passport fields
  needLicense?: boolean;        // true = collect license fields
  // License fields
  licenseSeries?: string;
  licenseNumber?: string;
  licenseIssueDate?: string;    // null if user chose "нет прав"
  licenseExpiryDate?: string;   // auto-calc +10 years from issue
  licenseCategory?: string;
}

// ── Keyboard builders ────────────────────────────────────────────────────────

/**
 * Document choice keyboard — operator decides which identity document
 * to collect from the client. Picked value sets needPassport / needLicense.
 */
function buildDocChoiceKeyboard(): KeyboardButton[][] {
  return [
    [{ text: "🪪 Паспорт", callback_data: "td_doc_passport" }],
    [{ text: "🚗 Водительское удостоверение", callback_data: "td_doc_license" }],
    [{ text: "📋 Оба документа", callback_data: "td_doc_both" }],
    [{ text: "❌ Отменить", callback_data: "td_cancel" }],
  ];
}

function buildCategoryKeyboard(selected?: string): KeyboardButton[][] {
  return [
    [
      { text: `A ${selected === "A" ? "✅" : "⭕"}`, callback_data: "td_cat_A" },
      { text: `B ${selected === "B" ? "✅" : "⭕"}`, callback_data: "td_cat_B" },
      { text: `Нет прав ${selected === "нет" ? "✅" : "⭕"}`, callback_data: "td_cat_none" },
    ],
    [
      { text: "✓ Готово", callback_data: "td_cat_done" },
      { text: "❌ Отменить", callback_data: "td_cancel" },
    ],
  ];
}

function buildConfirmKeyboard(): KeyboardButton[][] {
  return [
    [
      { text: "✅ Всё верно", callback_data: "td_ok" },
      { text: "↩️ Начать заново", callback_data: "td_restart" },
    ],
    [{ text: "❌ Отменить", callback_data: "td_cancel" }],
  ];
}

// ── Bike resolution ──────────────────────────────────────────────────────────

async function resolveBikeById(bikeId: string): Promise<any> {
  const { data: exactMatch } = await supabaseAdmin
    .from("cars")
    .select("id, make, model, specs, type")
    .eq("id", bikeId)
    .in("type", ["bike", "ebike"])
    .maybeSingle();
  if (exactMatch) return exactMatch;

  const { data: candidates } = await supabaseAdmin
    .from("cars")
    .select("id, make, model, specs, type")
    .in("type", ["bike", "ebike"])
    .limit(100);
  if (!candidates?.length) return null;

  const norm = (v = "") => String(v).toLowerCase().replace(/[^a-zа-я0-9]+/gi, " ").trim();
  const qn = norm(bikeId);
  if (!qn) return null;

  let best: any = null, bestScore = 0;
  for (const bike of candidates) {
    const hay = [bike.id, bike.make, bike.model, bike.specs?.vin, bike.specs?.frame].map(norm).join(" ");
    if (hay.includes(qn)) { best = bike; bestScore = 1000; break; }
    const parts = qn.split(" ");
    let score = 0;
    for (const p of parts) if (p && hay.includes(p)) score += 20 + p.length;
    if (score > bestScore) { bestScore = score; best = bike; }
  }
  return bestScore > 0 ? best : null;
}

async function getAvailableBikes(): Promise<any[]> {
  const { data } = await supabaseAdmin
    .from("cars")
    .select("id, make, model, specs")
    .in("type", ["bike", "ebike"])
    .not("id", "like", "vipbike%")
    .order("make", { ascending: true })
    .limit(20);
  return (data || []);
}

// ── Crew secrets loader ──────────────────────────────────────────────────────

interface CrewSecrets {
  organizationName: string;
  organizationShort: string;
  ogrnip: string;
  inn: string;
  bankAccount: string;
  bankName: string;
  bankCity: string;
  bankCorrAccount: string;
  email: string;
  legalAddress: string;
  issuerName: string;
  issuerRepresentative: string;
  phone: string;
}

async function loadCrewSecrets(crewSlug: string = "vip-bike"): Promise<CrewSecrets> {
  try {
    const { data: secretsData } = await supabaseAdmin
      .from("crew_secrets")
      .select("contract_defaults")
      .eq("crew_slug", crewSlug)
      .maybeSingle();

    let cd: Record<string, any> = {};
    if (secretsData?.contract_defaults) {
      cd = typeof secretsData.contract_defaults === "string"
        ? JSON.parse(secretsData.contract_defaults)
        : secretsData.contract_defaults;
    }

    return {
      organizationName: cd.organizationName || "Мотосалон ВипБайкЭлектро",
      organizationShort: cd.organizationShort || "ИП Воробьев Р.В.",
      ogrnip: cd.ogrnip || "326527500025145",
      inn: cd.inn || "525813643035",
      bankAccount: cd.bankAccount || "40802810942710013083",
      bankName: cd.bankName || "Волго-Вятский Банк ПАО Сбербанк",
      bankCity: cd.bankCity || "г. Нижний Новгород",
      bankCorrAccount: cd.bankCorrAccount || "30101810900000000603",
      email: cd.email || "vip_bike@mail.ru",
      legalAddress: cd.legalAddress || "г. Нижний Новгород, пл. Комсомольская 2",
      issuerName: cd.issuerName || "Воробьев Р.В.",
      issuerRepresentative: cd.issuerRepresentative || "Сидоров Илья Олегович",
      phone: cd.phone || "+7 920 078 98 88",
    };
  } catch (error) {
    logger.warn("[/testdrive] Failed to load crew_secrets, using fallbacks:", error);
    return {
      organizationName: "Мотосалон ВипБайкЭлектро",
      organizationShort: "ИП Воробьев Р.В.",
      ogrnip: "326527500025145",
      inn: "525813643035",
      bankAccount: "40802810942710013083",
      bankName: "Волго-Вятский Банк ПАО Сбербанк",
      bankCity: "г. Нижний Новгород",
      bankCorrAccount: "30101810900000000603",
      email: "vip_bike@mail.ru",
      legalAddress: "г. Нижний Новгород, пл. Комсомольская 2",
      issuerName: "Воробьев Р.В.",
      issuerRepresentative: "Сидоров Илья Олегович",
      phone: "+7 920 078 98 88",
    };
  }
}

// ── Smart parsers ────────────────────────────────────────────────────────────

function parsePassport(text: string): { series: string; number: string; issueDate: string; issuedBy: string } | null {
  const parts = text.trim().split(/\s+/);
  if (parts.length < 3) return null;

  let series = "", number = "", dateIdx = -1;
  for (let i = 0; i < parts.length; i++) {
    const cleaned = parts[i].replace(/\D/g, '');
    if (!series && cleaned.length === 4) series = cleaned;
    else if (!number && cleaned.length === 6) number = cleaned;
    else if (dateIdx === -1 && /^\d{1,2}\.\d{1,2}(\.\d{2,4})?$/.test(parts[i])) dateIdx = i;
  }

  if (!series || !number || dateIdx === -1) return null;

  let dateStr = parts[dateIdx];
  const dateParts = dateStr.split('.');
  if (dateParts.length === 2) return null;
  if (dateParts[2].length === 2) {
    const y = parseInt(dateParts[2]);
    dateParts[2] = y > 50 ? `19${y}` : `20${y}`;
    dateStr = dateParts.join('.');
  }

  const issuedBy = parts.slice(dateIdx + 1).join(' ') || "не указано";
  return { series, number, issueDate: dateStr, issuedBy };
}

/**
 * Parse Russian VU (driver's license) series + number + dates.
 * Ported from doc-manual.ts parseLicense() with testdrive's 4-strategy series parsing.
 *
 * Format: серия номер [дата_выдачи [дата_окончания]]
 *   "9976 123456 15.03"          → series=9976, num=123456, issue=15.03.2026, expiry=15.03.2036
 *   "99 76 123456 15.03.2020 15.03.2030"  → series=9976, num=123456, issue=15.03.2020, expiry=15.03.2030
 *   "99 76 123456"               → no dates → still returns series+number with null dates
 *   "99 76123456 15.03"          → Strategy 4: 2+8 split → series=9976, num=123456, issue=15.03.2026
 *
 * If only one date: it's treated as issue date, expiry = issue + 10 years.
 * Year defaults to CURRENT_YEAR if omitted.
 */
function parseLicense(text: string): { series: string; number: string; issueDate: string | null; expiryDate: string | null } | null {
  const parts = text.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;

  // Separate digit sequences from date-like tokens
  const digits: string[] = [];
  const dates: string[] = [];

  for (const p of parts) {
    if (/^\d{1,2}\.\d{1,2}(\.\d{2,4})?$/.test(p)) {
      // It's a date-like token
      let d = p;
      if (!d.includes('.')) continue;
      const dparts = d.split('.');
      if (dparts.length === 2) d += `.${CURRENT_YEAR}`;
      else if (dparts[2].length === 2) {
        const y = parseInt(dparts[2]);
        dparts[2] = y > 50 ? `19${y}` : `20${y}`;
        d = dparts.join('.');
      }
      dates.push(d);
    } else {
      const cleaned = p.replace(/\D/g, '');
      if (cleaned.length > 0) digits.push(cleaned);
    }
  }

  if (digits.length < 2) return null;

  let series = "", number = "";

  // Strategy 1: find a 4-digit (series) followed by a 6-digit (number)
  for (let i = 0; i < digits.length; i++) {
    if (digits[i].length === 4) {
      series = digits[i];
      for (let j = i + 1; j < digits.length; j++) {
        if (digits[j].length === 6) { number = digits[j]; break; }
      }
      if (number) break;
    }
  }

  // Strategy 2: two consecutive 2-digit tokens = series (e.g. "99 76"), then 6-digit = number
  if (!series || !number) {
    for (let i = 0; i < digits.length - 1; i++) {
      if (digits[i].length === 2 && digits[i + 1].length === 2) {
        series = digits[i] + digits[i + 1];
        for (let j = i + 2; j < digits.length; j++) {
          if (digits[j].length === 6) { number = digits[j]; break; }
        }
        if (number) break;
      }
    }
  }

  // Strategy 3: find any 4+ digit for series, any 6-digit for number
  if (!series || !number) {
    for (const d of digits) {
      if (!series && d.length >= 4) series = d.slice(0, 4);
      else if (!number && d.length === 6) number = d;
    }
  }

  // Strategy 4: "99 76123456" -> 2-char + 8-char (where 8 = 2+6 concatenated)
  if (!series || !number) {
    for (let i = 0; i < digits.length - 1; i++) {
      if (digits[i].length === 2 && digits[i + 1].length === 8) {
        series = digits[i] + digits[i + 1].slice(0, 2);
        number = digits[i + 1].slice(2);
        if (number.length === 6) break;
        series = ""; number = "";
      }
    }
  }

  if (!series || !number) return null;

  // ── Date handling (ported from doc-manual.ts) ──
  let issueDate: string | null = null;
  let expiryDate: string | null = null;

  if (dates.length === 1) {
    // Single date → issue date, expiry = +10 years
    issueDate = dates[0];
    const [dd, mm, yyyy] = issueDate.split('.');
    expiryDate = `${dd}.${mm}.${parseInt(yyyy) + 10}`;
  } else if (dates.length >= 2) {
    // Two dates → issue and expiry
    issueDate = dates[0];
    expiryDate = dates[1];
    // If both same year → auto extend (e.g., "15.03.2026 15.03.2026" → +10y)
    if (issueDate === expiryDate && issueDate.endsWith(`.${CURRENT_YEAR}`)) {
      const [dd, mm, yyyy] = issueDate.split('.');
      expiryDate = `${dd}.${mm}.${parseInt(yyyy) + 10}`;
    }
  }
  // If no dates → issueDate/expiryDate stay null (template {{#if}} hides them)

  return { series, number, issueDate, expiryDate };
}

function parseDate(text: string, requireYear = true): string | null {
  const match = text.trim().match(/^(\d{1,2})\.(\d{1,2})(\.(\d{2,4}))?$/);
  if (!match) return null;

  let [, day, month, , year] = match;
  day = day.padStart(2, '0');
  month = month.padStart(2, '0');

  if (!year) {
    if (requireYear) return null;
    year = String(CURRENT_YEAR);
  } else if (year.length === 2) {
    const y = parseInt(year);
    year = y > 50 ? `19${y}` : `20${y}`;
  }

  return `${day}.${month}.${year}`;
}

function capitalizeFullName(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map(word =>
      word
        .toLowerCase()
        .replace(/(^|-)([a-zа-яё])/gi, (_m, prefix: string, char: string) => prefix + char.toUpperCase())
    )
    .join(' ');
}

function numberToWords(n: number): string {
  const units = ["", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
  const teens = ["десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать", "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать"];
  const tens = ["", "", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят", "восемьдесят", "девяносто"];
  const hundreds = ["", "сто", "двести", "триста", "четыреста", "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот"];

  if (n >= 1000000) return String(n);
  if (n >= 1000) {
    const th = Math.floor(n / 1000);
    const r = n % 1000;
    const lastTwo = th % 100, lastOne = th % 10;
    let w = "тысяч";
    if (lastTwo >= 11 && lastTwo <= 19) w = "тысяч";
    else if (lastOne === 1) w = "тысяча";
    else if (lastOne >= 2 && lastOne <= 4) w = "тысячи";
    return numberToWords(th) + " " + w + (r > 0 ? " " + numberToWords(r) : "");
  }
  if (n === 0) return "ноль";
  if (n < 10) return units[n];
  if (n < 20) return teens[n - 10];
  if (n < 100) {
    const t = Math.floor(n / 10), u = n % 10;
    return tens[t] + (u > 0 ? " " + units[u] : "");
  }
  if (n < 1000) {
    const h = Math.floor(n / 100), r = n % 100;
    return hundreds[h] + (r > 0 ? " " + numberToWords(r) : "");
  }
  return String(n);
}

// ── State management ─────────────────────────────────────────────────────────

async function setState(userId: string, state: string, context: TestDriveContext) {
  await supabaseAdmin.from("user_states").upsert({
    user_id: userId,
    state,
    context,
    expires_at: new Date(Date.now() + STATE_EXPIRY_MINUTES * 60 * 1000).toISOString(),
  });
}

async function getState(userId: string): Promise<{ state: string; context: TestDriveContext } | null> {
  const { data } = await supabaseAdmin
    .from("user_states")
    .select("state, context, expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
    await clearState(userId);
    return null;
  }
  return { state: data.state, context: (data.context || {}) as TestDriveContext };
}

async function clearState(userId: string) {
  await supabaseAdmin.from("user_states").delete().eq("user_id", userId);
}

// ── Summary builder ──────────────────────────────────────────────────────────

function buildSummary(context: TestDriveContext): string {
  const lines = [
    "*📋 Проверьте данные:*",
    "",
    `📱 ${context.customerPhone || "—"}`,
    `👤 ${context.customerFullName || "—"}`,
  ];

  // Show what documents were collected
  if (context.needPassport && context.customerSeries) {
    lines.push(
      `🪪 Паспорт: ${context.customerSeries} ${context.customerNumber}` +
      `${context.customerIssueDate ? ` от ${context.customerIssueDate}` : ""}`
    );
    if (context.customerBirthDate) lines.push(`📅 ${context.customerBirthDate}`);
    if (context.customerRegistration) lines.push(`🏠 ${context.customerRegistration}`);
  } else if (context.needPassport) {
    lines.push(`🪪 Паспорт: не указан`);
  }

  if (context.needLicense && context.licenseSeries) {
    let vu = `🚗 В/У: ${context.licenseSeries} № ${context.licenseNumber}`;
    if (context.licenseIssueDate) vu += ` от ${context.licenseIssueDate}`;
    if (context.licenseExpiryDate) vu += ` до ${context.licenseExpiryDate}`;
    if (context.licenseCategory) vu += ` (${context.licenseCategory})`;
    lines.push(vu);
  } else if (context.needLicense) {
    lines.push(`🚗 В/У: не указано`);
  }

  lines.push(
    "",
    "Всё верно?",
  );

  return lines.join("\n");
}

// ── Goto helpers ─────────────────────────────────────────────────────────────

async function gotoConfirm(chatId: number, userId: string, context: TestDriveContext): Promise<void> {
  const summary = buildSummary(context);
  await setState(userId, "td_confirm", context);
  await sendComplexMessage(chatId, summary, buildConfirmKeyboard(), { keyboardType: "inline", parseMode: "Markdown" });
}

// ── Contract generation ──────────────────────────────────────────────────────

async function generateContract(chatId: number, userId: string, context: TestDriveContext): Promise<boolean> {
  try {
    const bike = await resolveBikeById(context.bikeId);
    if (!bike) {
      await sendComplexMessage(chatId, "🚨 Байк не найден. Попробуйте /testdrive", [], { removeKeyboard: true });
      return false;
    }

    const crewSecrets = await loadCrewSecrets();
    const now = new Date();
    const price = TESTDRIVE_PRICE;
    const deposit = 0;  // deposit step removed per client request

    // Build short-name for signature field
    const customerShortName = (context.customerFullName || "")
      .split(' ')
      .map((n, i) => i === 0 ? n : `${n[0]}.`)
      .join(' ');

    // Condense passport fields: build the passport-number string only if we
    // actually collected it (needPassport + series present). Otherwise leave
    // empty so the template's {{#if customer_passport_number}} omits the row.
    const passportNumber = (context.needPassport && context.customerSeries)
      ? `${context.customerSeries} ${context.customerNumber || ""}`.trim()
      : "";

    const vars: Record<string, string> = {
      contract_number: `${now.getDate()}.${now.getMonth() + 1}/${bike.id}`,
      day: String(now.getDate()).padStart(2, "0"),
      month: now.toLocaleString("ru-RU", { month: "long" }),
      year: String(now.getFullYear()),
      customer_full_name: context.customerFullName || "",
      customer_short_name: customerShortName,
      customer_phone: context.customerPhone || "",
      // Passport fields (empty if not collected → {{#if}} omits them in template)
      customer_passport_number: passportNumber,
      customer_passport_issued_by: (context.needPassport && context.customerIssuedBy) ? context.customerIssuedBy : "",
      customer_passport_issue_date: (context.needPassport && context.customerIssueDate) ? context.customerIssueDate : "",
      customer_birth_date: (context.needPassport && context.customerBirthDate) ? context.customerBirthDate : "",
      customer_registration: (context.needPassport && context.customerRegistration) ? context.customerRegistration : "",
      // License fields (empty if not collected → {{#if}} omits them in template)
      license_series: (context.needLicense && context.licenseSeries) ? context.licenseSeries : "",
      license_number: (context.needLicense && context.licenseNumber) ? context.licenseNumber : "",
      license_issue_date: (context.needLicense && context.licenseIssueDate) ? context.licenseIssueDate : "",
      license_expiry_date: (context.needLicense && context.licenseExpiryDate) ? context.licenseExpiryDate : "",
      license_category: context.licenseCategory || "",
      // Bike
      bike_make: bike.make || "уточняется",
      bike_model: bike.model || "уточняется",
      bike_color: bike.specs?.color || "уточняется",
      bike_year: String(bike.specs?.year || now.getFullYear()),
      // Pricing
      price_digits: String(price),
      price_words: numberToWords(price),
      deposit_rub: String(deposit),
      // Crew
      organization_name: crewSecrets.organizationName,
      organization_short: crewSecrets.organizationShort,
      issuer_name: crewSecrets.issuerName,
      ogrnip: crewSecrets.ogrnip,
      inn: crewSecrets.inn,
      legal_address: crewSecrets.legalAddress,
      phone: crewSecrets.phone,
      email: crewSecrets.email,
      // Meta
      signature_timestamp: now.toLocaleString("ru-RU"),
      document_key: `testdrive-${bike.id}-${Date.now()}`,
    };

    // Load template
    const templatePath = join(process.cwd(), "docs", "TESTDRIVE_DEAL_TEMPLATE.html");
    let htmlTemplate: string;
    try {
      htmlTemplate = readFileSync(templatePath, "utf8");
    } catch (readErr) {
      logger.error("[/testdrive] Failed to read HTML template", templatePath, readErr);
      await sendComplexMessage(chatId, "🚨 Ошибка: шаблон договора не найден.", [], { removeKeyboard: true });
      return false;
    }

    const docFileName = `testdrive-${bike.make}-${bike.model}-${now.toISOString().split('T')[0]}.docx`
      .replace(/[^a-zA-Zа-яА-Я0-9.\-]/g, "-")
      .replace(/-+/g, "-");

    // Generate DOCX
    const docResult = await buildFranchizeDocxFromTemplate({
      integrationScope: "telegram-testdrive",
      uploadedBy: String(userId),
      documentKey: vars.document_key,
      fileName: docFileName,
      template: htmlTemplate,
      variables: vars,
      flowType: "mixed",
      templateMode: "html",
    });

    const docxBuf = Buffer.from(docResult.bytes);
    const docSha256 = docResult.sha256;

    // Upload to storage (non-fatal)
    let docStoragePath: string | null = null;
    try {
      const uploadResult = await uploadDocxToStorage({
        crewSlug: "vip-bike",
        contractKey: vars.document_key,
        buffer: docxBuf,
        metadata: {
          source: "telegram-testdrive",
          bike_id: bike.id,
          client: context.customerFullName || "",
        },
      });
      docStoragePath = uploadResult.storagePath;
      logger.info("[/testdrive] DOCX uploaded to storage:", docStoragePath);
    } catch (uploadErr) {
      logger.warn("[/testdrive] Storage upload failed (non-fatal):", uploadErr);
    }

    // Send DOCX via Telegram
    try {
      await sendTelegramDocument(String(chatId), docxBuf, docFileName);
      logger.info("[/testdrive] DOCX sent via sendTelegramDocument");
    } catch (e) {
      logger.error("[/testdrive] sendTelegramDocument failed:", e);
    }

    // Build confirmation message showing what was collected
    const docList: string[] = [];
    if (context.needPassport && context.customerSeries) docList.push("🪪 паспорт");
    if (context.needLicense && context.licenseSeries) docList.push("🚗 В/У");
    const docStr = docList.length > 0 ? docList.join(" + ") : "без документов";

    // Send confirmation
    await sendComplexMessage(
      chatId,
      `✅ *Договор тест-драйва готов!*\n\n` +
      `🛵 ${bike.make} ${bike.model}\n` +
      `👤 ${context.customerFullName}\n` +
      `📱 ${context.customerPhone || "—"}\n` +
      `📄 ${docStr}\n` +
      `💰 ${price.toLocaleString("ru-RU")} ₽`,
      [[{ text: "🚀 Открыть", url: process.env.TELEGRAM_BOT_LINK || "https://t.me/oneBikePlsBot/app" }]],
      { removeKeyboard: true, parseMode: "Markdown" },
    );

    // Notify admin
    await notifyAdmin(
      `🛵 Тест-драйв (ввод с кнопок)\n` +
      `User: ${userId}\n` +
      `Bike: ${bike.make} ${bike.model}\n` +
      `Client: ${context.customerFullName}\n` +
      `Phone: ${context.customerPhone || "—"}\n` +
      `Docs: ${docStr}`,
    );

    // ── Save to private tables (like /doc and /subrent do) ──
    // 1. user_rental_secrets — for 1-click reuse
    try {
      const { error: secretsError } = await privateSchema()
        .from("user_rental_secrets")
        .insert({
          chat_id: String(userId),
          crew_slug: "vip-bike",
          doc_sha256: docSha256,
          renter_full_name: context.customerFullName || null,
          renter_passport: (context.needPassport && context.customerSeries)
            ? `${context.customerSeries} ${context.customerNumber || ""}`.trim() : null,
          renter_passport_issue_date: context.customerIssueDate || null,
          renter_passport_issued_by: context.customerIssuedBy || null,
          renter_registration: context.customerRegistration || null,
          renter_driver_license: (context.needLicense && context.licenseSeries)
            ? `${context.licenseSeries} ${context.licenseNumber || ""}`.trim() : null,
          renter_birth_date: context.customerBirthDate || null,
          renter_phone: context.customerPhone || null,
          source_doc_key: vars.document_key,
          verification_status: "verified",
          template_version: 1,
        });
      if (secretsError) {
        logger.error("[/testdrive] Failed to save user_rental_secrets:", secretsError);
      }
    } catch (secretsErr) {
      logger.warn("[/testdrive] user_rental_secrets save failed (non-fatal):", secretsErr);
    }

    // 2. rental_contract_artifacts (private schema) — dedup by renter+bike
    try {
      const { data: existingRental } = await privateSchema()
        .from("rental_contract_artifacts")
        .select("id, storage_path")
        .eq("renter_full_name", context.customerFullName || "")
        .eq("requested_bike_id", bike.id)
        .maybeSingle();

      const passportNumber = (context.needPassport && context.customerSeries)
        ? `${context.customerSeries} ${context.customerNumber || ""}`.trim()
        : null;

      const driverLicense = (context.needLicense && context.licenseSeries)
        ? `${context.licenseSeries} ${context.licenseNumber || ""}`.trim()
        : null;

      if (existingRental) {
        logger.info("[/testdrive] Duplicate artifact detected (same renter+bike), skipping. id:", existingRental.id);
        if (!existingRental.storage_path && docStoragePath) {
          await privateSchema().from("rental_contract_artifacts").update({ storage_path: docStoragePath }).eq("id", existingRental.id);
        }
      } else {
        const { error: rentError } = await privateSchema()
          .from("rental_contract_artifacts")
          .insert({
            contract_key: vars.document_key,
            storage_path: docStoragePath,
            original_sha256: docSha256,
            requested_bike_id: bike.id,
            resolved_bike_id: bike.id,
            telegram_chat_id: String(userId),
            telegram_message_id: null,
            renter_full_name: context.customerFullName || null,
            renter_passport: passportNumber,
            renter_passport_issued_by: context.customerIssuedBy || null,
            renter_passport_issue_date: context.customerIssueDate || null,
            renter_registration: context.customerRegistration || null,
            renter_driver_license: driverLicense,
            renter_birth_date: context.customerBirthDate || null,
            license_categories: context.licenseCategory || null,
            total_sum: price,
            template_version: 1,
          });
        if (rentError) {
          logger.error("[/testdrive] Failed to save rental_contract_artifacts:", rentError);
        }
      }
    } catch (dbErr) {
      logger.warn("[/testdrive] rental_contract_artifacts save failed (non-fatal):", dbErr);
    }

    // 3. Also upsert to franchize_intents for the dashboard pipeline
    try {
      const leadUserId = context.customerPhone || String(userId);
      await supabaseAdmin.from("franchize_intents").upsert({
        slug: "vip-bike",
        bike_id: bike.id,
        intent_type: "test_drive",
        stage: "contract_generated",
        source_route: "/testdrive",
        contact_channel: "telegram_bot",
        urgency_score: 85,
        telegram_user_id: leadUserId,
        metadata: {
          name: context.customerFullName,
          phone: context.customerPhone || null,
          bikeTitle: `${bike.make} ${bike.model}`,
          dealType: "test_drive",
          operatorId: String(userId),
          hasPassport: !!(context.needPassport && context.customerSeries),
          hasLicense: !!(context.needLicense && context.licenseSeries),
        },
      }, { onConflict: "slug,bike_id,telegram_user_id,intent_type" });
    } catch (leadErr) {
      logger.warn("[/testdrive] Failed to create lead:", leadErr);
    }

    // Send email notification
    try {
      const smtpHost = process.env.SMTP_HOST || process.env.SMTP_YANDEX_HOST;
      const smtpPort = Number(process.env.SMTP_PORT || process.env.SMTP_YANDEX_PORT || 465);
      const smtpUser = process.env.SMTP_USER || process.env.SMTP_YANDEX_USER;
      const smtpPass = process.env.SMTP_PASS || process.env.SMTP_YANDEX_PASS;
      const emailFrom = process.env.EMAIL_FROM || smtpUser;
      const emailTo = process.env.EMAIL_DEFAULT_TO || crewSecrets.email || "vip_bike@mail.ru";

      if (smtpHost && smtpUser && smtpPass) {
        const nodemailer = require("nodemailer");
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: { user: smtpUser, pass: smtpPass },
        });

        await transporter.sendMail({
          from: emailFrom,
          to: emailTo,
          subject: `Договор тест-драйва — ${bike.make} ${bike.model}`,
          text: [
            `Договор тест-драйва №${vars.document_key}`,
            ``,
            `Байк: ${bike.make} ${bike.model}`,
            `Клиент: ${context.customerFullName || "—"}`,
            `Телефон: ${context.customerPhone || "—"}`,
            `Документы: ${docStr}`,
            ``,
            `Договор сгенерирован в Telegram-боте.`,
            `Документ во вложении.`,
          ].join("\n"),
          attachments: [{
            filename: docFileName,
            content: docxBuf,
            contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          }],
        });
        logger.info(`[/testdrive] Email with DOCX sent to ${emailTo}`);
      }
    } catch (emailErr) {
      logger.warn("[/testdrive] Email send failed (non-fatal):", emailErr);
    }

    return true;
  } catch (error) {
    logger.error("[/testdrive] Generate failed", error);
    await sendComplexMessage(chatId, "🚨 Ошибка. Попробуйте ещё раз.", [], { removeKeyboard: true });
    return false;
  }
}

// ── Text handler ─────────────────────────────────────────────────────────────

export async function handleTestDriveText(userId: string, chatId: number, text: string): Promise<boolean> {
  const tdState = await getState(userId);
  if (!tdState) return false;

  const { state, context } = tdState;

  // ── Phone ──
  if (state === "td_phone") {
    const cleaned = text.replace(/[^\d+]/g, "");
    if (cleaned.length < 10) {
      await sendComplexMessage(chatId, "❌ Неверный формат.\n\nПример: `+7 987 654 32 10`", [], { removeKeyboard: true, parseMode: "Markdown" });
      return true;
    }
    context.customerPhone = cleaned;
    await setState(userId, "td_doc_choice", context);
    await sendComplexMessage(
      chatId,
      `✅ ${cleaned}\n\n*Какой документ вводим?*\n\nМожно ввести паспорт ИЛИ водительское удостоверение (достаточно одного).`,
      buildDocChoiceKeyboard(),
      { keyboardType: "inline", parseMode: "Markdown" },
    );
    return true;
  }

  // ── Doc choice (text fallback — re-prompt with keyboard) ──
  if (state === "td_doc_choice") {
    await sendComplexMessage(
      chatId,
      "*Какой документ вводим?*\n\nВыберите на клавиатуре:",
      buildDocChoiceKeyboard(),
      { keyboardType: "inline", parseMode: "Markdown" },
    );
    return true;
  }

  // ── Full name ──
  if (state === "td_name") {
    context.customerFullName = capitalizeFullName(text);
    if (context.needPassport) {
      await setState(userId, "td_passport", context);
      await sendComplexMessage(
        chatId,
        `✅ ${text}\n\n*Паспорт*\n\n4509 123456 15.03.2020 ОМВД по Н.Новгороду`,
        [],
        { removeKeyboard: true, parseMode: "Markdown" },
      );
    } else {
      // License-only path — skip passport, go straight to license input
      await setState(userId, "td_license", context);
      await sendComplexMessage(
        chatId,
        `✅ ${text}\n\n*Водительское удостоверение*\n\nФормат: серия номер [дата_выдачи] [дата_окончания]\n\nПримеры:\n• 99 76 123456 15.03 (срок auto +10 лет)\n• 99 76 123456 (без дат)`,
        [],
        { removeKeyboard: true, parseMode: "Markdown" },
      );
    }
    return true;
  }

  // ── Passport ──
  if (state === "td_passport") {
    const p = parsePassport(text);
    if (!p) {
      await sendComplexMessage(chatId, "❌ Формат: 4509 123456 15.03.2020 ОМВД", [], { removeKeyboard: true });
      return true;
    }
    context.customerSeries = p.series;
    context.customerNumber = p.number;
    context.customerIssueDate = p.issueDate;
    context.customerIssuedBy = p.issuedBy;
    await setState(userId, "td_birth", context);
    await sendComplexMessage(
      chatId,
      `✅ Паспорт ${p.series} ${p.number} от ${p.issueDate}\n\n*Дата рождения*\n\n15.03.1990`,
      [],
      { removeKeyboard: true, parseMode: "Markdown" },
    );
    return true;
  }

  // ── Birth date ──
  if (state === "td_birth") {
    const d = parseDate(text, true);
    if (!d) {
      await sendComplexMessage(chatId, "❌ Формат: 15.03.1990", [], { removeKeyboard: true });
      return true;
    }
    context.customerBirthDate = d;
    await setState(userId, "td_address", context);
    await sendComplexMessage(chatId, `✅ ${d}\n\n*Адрес регистрации*\n\nПример: г. Нижний Новгород, ул. Ленина, д. 1, кв. 1`, [], { removeKeyboard: true, parseMode: "Markdown" });
    return true;
  }

  // ── Address ──
  if (state === "td_address") {
    context.customerRegistration = text.trim();
    // After passport path: if license also needed → go to license; else → confirm
    if (context.needLicense) {
      await setState(userId, "td_license", context);
      await sendComplexMessage(
        chatId,
        `✅\n\n*Водительское удостоверение*\n\nФормат: серия номер [дата_выдачи] [дата_окончания]\n\nПримеры:\n• 99 76 123456 15.03 (срок auto +10 лет)\n• 99 76 123456 (без дат)`,
        [],
        { removeKeyboard: true, parseMode: "Markdown" },
      );
    } else {
      await gotoConfirm(chatId, userId, context);
    }
    return true;
  }

  // ── License input ──
  if (state === "td_license") {
    const l = parseLicense(text);
    if (!l) {
      await sendComplexMessage(
        chatId,
        `❌ Не удалось распознать. Формат: серия номер [дата_выдачи] [дата_окончания]\n\nПримеры:\n• 99 76 123456 15.03 (срок auto +10 лет)\n• 9976 123456 15.03.2020 15.03.2030\n• 99 76 123456 (без дат)`,
        [],
        { removeKeyboard: true, parseMode: "Markdown" },
      );
      return true;
    }
    context.licenseSeries = l.series;
    context.licenseNumber = l.number;
    context.licenseIssueDate = l.issueDate;
    context.licenseExpiryDate = l.expiryDate;
    // After license → ask for categories
    await setState(userId, "td_category", context);
    const dateStr = l.issueDate
      ? ` от ${l.issueDate}${l.expiryDate ? ` до ${l.expiryDate}` : ""}`
      : "";
    await sendComplexMessage(
      chatId,
      `✅ В/У ${l.series} № ${l.number}${dateStr}\n\n*Категория ВУ*`,
      buildCategoryKeyboard(),
      { keyboardType: "inline", parseMode: "Markdown" },
    );
    return true;
  }

  // ── Category (text fallback — re-prompt with keyboard) ──
  if (state === "td_category") {
    await sendComplexMessage(chatId, "*Категория ВУ*", buildCategoryKeyboard(), { keyboardType: "inline", parseMode: "Markdown" });
    return true;
  }

  return false;
}

// ── Callback handler ─────────────────────────────────────────────────────────

export async function handleTestDriveCallback(
  userId: string,
  chatId: number,
  callbackData: string,
  callbackQueryId?: string,
): Promise<boolean> {
  const tdState = await getState(userId);
  if (!tdState) return false;

  const { state, context } = tdState;

  // Answer callback query to stop loading animation
  if (callbackQueryId) {
    try {
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery?callback_query_id=${callbackQueryId}`, { method: "POST" });
    } catch (e) {
      logger.warn("[/testdrive] Failed to answer callback query:", e);
    }
  }

  // ── Global actions ──

  if (callbackData === "td_cancel") {
    await sendComplexMessage(chatId, "❌ Отменено. /testdrive для начала.", [], { removeKeyboard: true });
    await clearState(userId);
    return true;
  }

  if (callbackData === "td_restart") {
    await clearState(userId);
    await testDriveCommand(chatId, parseInt(userId), undefined, "/testdrive");
    return true;
  }

  // ── Bike selection (state: td_bike) ──

  if (state === "td_bike" && callbackData.startsWith("td_bike_")) {
    const bikeId = callbackData.replace("td_bike_", "");
    const bike = await resolveBikeById(bikeId);
    if (!bike) {
      await sendComplexMessage(chatId, "🚲 Байк не найден. Попробуйте снова /testdrive", [], { removeKeyboard: true });
      await clearState(userId);
      return true;
    }
    context.bikeId = bike.id;
    context.bikeMake = bike.make;
    context.bikeModel = bike.model;
    await setState(userId, "td_phone", context);
    await sendComplexMessage(chatId, `🏍 ${bike.make} ${bike.model}`, [], { removeKeyboard: true });
    await sendComplexMessage(chatId, "*Телефон клиента*\nПример: `+7 987 654 32 10`", [], { parseMode: "Markdown", removeKeyboard: true });
    return true;
  }

  // ── Document choice (state: td_doc_choice) ──

  if (state === "td_doc_choice" && callbackData === "td_doc_passport") {
    context.needPassport = true;
    context.needLicense = false;
    await setState(userId, "td_name", context);
    await sendComplexMessage(chatId, "✅ Паспорт\n\n*ФИО*\n\nПример: `Иванов Иван Иванович`", [], { removeKeyboard: true, parseMode: "Markdown" });
    return true;
  }

  if (state === "td_doc_choice" && callbackData === "td_doc_license") {
    context.needPassport = false;
    context.needLicense = true;
    await setState(userId, "td_name", context);
    await sendComplexMessage(chatId, "✅ В/У\n\n*ФИО*\n\nПример: `Иванов Иван Иванович`", [], { removeKeyboard: true, parseMode: "Markdown" });
    return true;
  }

  if (state === "td_doc_choice" && callbackData === "td_doc_both") {
    context.needPassport = true;
    context.needLicense = true;
    await setState(userId, "td_name", context);
    await sendComplexMessage(chatId, "✅ Оба документа\n\n*ФИО*\n\nПример: `Иванов Иван Иванович`", [], { removeKeyboard: true, parseMode: "Markdown" });
    return true;
  }

  // ── License category selection (state: td_category) ──

  if (state === "td_category" && callbackData.startsWith("td_cat_")) {
    const cat = callbackData.replace("td_cat_", "");
    if (cat === "A" || cat === "B" || cat === "none") {
      const label = cat === "none" ? "нет" : cat;
      context.licenseCategory = label;
      await setState(userId, "td_category", context);
      await sendComplexMessage(chatId, `🏷 ${label}`, buildCategoryKeyboard(label), { keyboardType: "inline" });
    } else if (cat === "done") {
      if (!context.licenseCategory) {
        await sendComplexMessage(chatId, "Выберите категорию:", buildCategoryKeyboard(), { keyboardType: "inline" });
        return true;
      }
      // Done → advance to confirm
      await gotoConfirm(chatId, userId, context);
    }
    return true;
  }

  // ── Confirm ──

  if (state === "td_confirm" && callbackData === "td_ok") {
    await sendComplexMessage(chatId, "⏳ Генерирую договор...", [], { removeKeyboard: true });
    const success = await generateContract(chatId, userId, context);
    if (success) {
      await clearState(userId);
    }
    return true;
  }

  return false;
}

// ── Entry point ─────────────────────────────────────────────────────────────

export async function testDriveCommand(
  chatId: number,
  userId: number,
  username: string | undefined,
  text: string,
) {
  const userIdStr = String(userId);
  logger.info(`[/testdrive] ${userIdStr}: ${text}`);

  // Show inline bike selection
  const bikes = await getAvailableBikes();
  if (!bikes.length) {
    await sendComplexMessage(chatId, "🚲 Нет байков.", [], { removeKeyboard: true });
    return;
  }

  const buttons: KeyboardButton[][] = bikes.map(b => {
    const tier = b.specs?.access_tier;
    const emoji = tier === "pro" ? "🔴" : tier === "mid" ? "🟡" : tier === "entry" ? "🟢" : "⚪";
    return [{ text: `${emoji} ${b.make} ${b.model}`, callback_data: `td_bike_${b.id}` }];
  });
  buttons.push([{ text: "❌ Отменить", callback_data: "td_cancel" }]);

  await setState(userIdStr, "td_bike", { bikeId: "" });
  await sendComplexMessage(
    chatId,
    "🛵 *Тест-драйв — выберите байк*",
    buttons,
    { keyboardType: "inline", parseMode: "Markdown" },
  );
}
