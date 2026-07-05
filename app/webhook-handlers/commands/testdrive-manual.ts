// /app/webhook-handlers/commands/testdrive-manual.ts
/**
 * /testdrive command handler — MANUAL INPUT VERSION
 * =============================================================================
 *
 * Flow (8 steps):
 *   1. Phone → "+7 987 654 32 10"
 *   2. Full name → "Иванов Иван Иванович"
 *   3. Passport → "4509 123456 15.03.2020 ОМВД"
 *   4. Birth → "15.03.1990"
 *   5. Address → free text
 *   6. License category → inline keyboard (A / B / нет)
 *   7. Deposit → inline keyboard with default from bike.specs
 *      or custom amount → free text
 *   8. Confirm → generate contract
 */

"use server";

import { logger } from "@/lib/logger";
import { supabaseAdmin } from "@/hooks/supabase";
import { sendComplexMessage, KeyboardButton } from "../actions/sendComplexMessage";
import { notifyAdmin, sendTelegramDocument } from "@/app/actions";
import { buildFranchizeDocxFromTemplate, uploadDocxToStorage } from "@/app/franchize/lib/docx-capability";
import { createHash } from "crypto";
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
  licenseCategory?: string;
  depositOverride?: string;
}

// ── Keyboard builders ────────────────────────────────────────────────────────

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

function buildDepositChoiceKeyboard(depositAmount: string, bike?: any): KeyboardButton[][] {
  const amount = Number(depositAmount) || 20000;
  const formatted = amount.toLocaleString("ru-RU");
  const bikeLabel = bike ? ` (${bike.make} ${bike.model})` : "";
  return [
    [{ text: `✅ Депозит ${formatted} ₽${bikeLabel}`, callback_data: "td_dep_confirm" }],
    [{ text: "✏️ Своя сумма", callback_data: "td_dep_custom" }],
    [{ text: "❌ Отменить", callback_data: "td_cancel" }],
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

// ── Bike resolution (shared with doc-manual) ────────────────────────────────

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

// ── Smart parsers (shared with doc-manual) ──────────────────────────────────

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
  if (dateParts.length === 2) return null; // year required
  if (dateParts[2].length === 2) {
    const y = parseInt(dateParts[2]);
    dateParts[2] = y > 50 ? `19${y}` : `20${y}`;
    dateStr = dateParts.join('.');
  }

  const issuedBy = parts.slice(dateIdx + 1).join(' ') || "не указано";
  return { series, number, issueDate: dateStr, issuedBy };
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

  if (n >= 1000000) { /* not expected for test-drive price but keep */ return String(n); }
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
    `👤 ${context.customerFullName}`,
    `🪪 ${context.customerSeries} ${context.customerNumber} от ${context.customerIssueDate}`,
    `📅 ${context.customerBirthDate}`,
    `🏠 ${context.customerRegistration}`,
    `🚗 Категория: ${context.licenseCategory || "—"}`,
    `💰 Депозит: ${Number(context.depositOverride || "20000").toLocaleString("ru-RU")} ₽`,
    "",
    "Всё верно?",
  ];
  return lines.join("\n");
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
    const deposit = Number(context.depositOverride) || Number(bike.specs?.deposit_rub) || 20000;

    // Build template variables
    const customerShortName = (context.customerFullName || "")
      .split(' ')
      .map((n, i) => i === 0 ? n : `${n[0]}.`)
      .join(' ');

    const vars: Record<string, string> = {
      contract_number: `${now.getDate()}.${now.getMonth() + 1}/${bike.id}`,
      day: String(now.getDate()).padStart(2, "0"),
      month: now.toLocaleString("ru-RU", { month: "long" }),
      year: String(now.getFullYear()),
      customer_full_name: context.customerFullName || "",
      customer_short_name: customerShortName,
      customer_phone: context.customerPhone || "",
      customer_passport_number: `${context.customerSeries || ""} ${context.customerNumber || ""}`.trim(),
      customer_passport_issued_by: context.customerIssuedBy || "",
      customer_passport_issue_date: context.customerIssueDate || "",
      customer_birth_date: context.customerBirthDate || "",
      customer_registration: context.customerRegistration || "",
      bike_make: bike.make || "уточняется",
      bike_model: bike.model || "уточняется",
      bike_color: bike.specs?.color || "уточняется",
      bike_year: String(bike.specs?.year || now.getFullYear()),
      license_category: context.licenseCategory || "—",
      price_digits: String(price || 5000),
      price_words: numberToWords(price || 5000),
      deposit_rub: String(deposit),
      organization_name: crewSecrets.organizationName,
      organization_short: crewSecrets.organizationShort,
      issuer_name: crewSecrets.issuerName,
      ogrnip: crewSecrets.ogrnip,
      inn: crewSecrets.inn,
      legal_address: crewSecrets.legalAddress,
      phone: crewSecrets.phone,
      email: crewSecrets.email,
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
      flowType: "test_drive",
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

    // Send confirmation
    await sendComplexMessage(
      chatId,
      `✅ *Договор тест-драйва готов!*\n\n` +
      `🛵 ${bike.make} ${bike.model}\n` +
      `👤 ${context.customerFullName}\n` +
      `📱 ${context.customerPhone || "—"}\n` +
      `💰 ${price.toLocaleString("ru-RU")} ₽ + депозит ${deposit.toLocaleString("ru-RU")} ₽`,
      [[{ text: "🚀 Открыть", url: process.env.TELEGRAM_BOT_LINK || "https://t.me/oneBikePlsBot/app" }]],
      { removeKeyboard: true, parseMode: "Markdown" },
    );

    // Notify admin
    await notifyAdmin(
      `🛵 Тест-драйв (ввод с кнопок)\n` +
      `User: ${userId}\n` +
      `Bike: ${bike.make} ${bike.model}\n` +
      `Client: ${context.customerFullName}\n` +
      `Phone: ${context.customerPhone || "—"}`,
    );

    // ── Create/update lead in franchize_intents ──
    const leadUserId = context.customerPhone || String(userId);
    try {
      // Ensure user exists in users table
      await supabaseAdmin.from("users").upsert({
        user_id: leadUserId,
        full_name: context.customerFullName || null,
        metadata: {
          source: "test_drive",
          phone: context.customerPhone || null,
          bikeId: bike.id,
          bikeTitle: `${bike.make} ${bike.model}`,
          updatedAt: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

      // Record intent
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

  if (state === "td_bike") {
    const bike = await resolveBikeById(text.trim());
    if (!bike) {
      await sendComplexMessage(chatId, "🚲 Не найден. Попробуйте:", [], { keyboardType: "reply" });
      return true;
    }
    context.bikeId = bike.id;
    context.bikeMake = bike.make;
    context.bikeModel = bike.model;
    await setState(userId, "td_phone", context);
    await sendComplexMessage(chatId, `🏍 ${bike.make} ${bike.model}`, [], { removeKeyboard: true });
    await sendComplexMessage(chatId, "*Тест-драйв — телефон клиента*", [], { parseMode: "Markdown", removeKeyboard: true });
    return true;
  }

  if (state === "td_phone") {
    const cleaned = text.replace(/[^\d+]/g, "");
    if (cleaned.length < 10) {
      await sendComplexMessage(chatId, "❌ Неверный формат. Введите номер телефона.", [], { removeKeyboard: true });
      return true;
    }
    context.customerPhone = cleaned;
    await setState(userId, "td_name", context);
    await sendComplexMessage(chatId, `✅ ${cleaned}\n\n*ФИО*`, [], { parseMode: "Markdown", removeKeyboard: true });
    return true;
  }

  if (state === "td_name") {
    context.customerFullName = capitalizeFullName(text);
    await setState(userId, "td_passport", context);
    await sendComplexMessage(
      chatId,
      `✅ ${text}\n\n*Паспорт*\n\n4509 123456 15.03.2020 ОМВД по Н.Новгороду`,
      [],
      { removeKeyboard: true, parseMode: "Markdown" },
    );
    return true;
  }

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

  if (state === "td_birth") {
    const d = parseDate(text, true);
    if (!d) {
      await sendComplexMessage(chatId, "❌ Формат: 15.03.1990", [], { removeKeyboard: true });
      return true;
    }
    context.customerBirthDate = d;
    await setState(userId, "td_address", context);
    await sendComplexMessage(chatId, `✅ ${d}\n\n*Адрес регистрации*`, [], { removeKeyboard: true, parseMode: "Markdown" });
    return true;
  }

  if (state === "td_address") {
    context.customerRegistration = text.trim();
    await setState(userId, "td_category", context);
    await sendComplexMessage(
      chatId,
      "✅\n\n*Категория ВУ*\n\nКакая категория открыта у клиента?",
      buildCategoryKeyboard(),
      { keyboardType: "inline", parseMode: "Markdown" },
    );
    return true;
  }

  if (state === "td_category") {
    // User typed instead of pressing button — re-prompt
    await sendComplexMessage(chatId, "*Категория ВУ*", buildCategoryKeyboard(), { keyboardType: "inline", parseMode: "Markdown" });
    return true;
  }

  if (state === "td_deposit_custom") {
    const amount = text.replace(/\D/g, '');
    if (!amount || parseInt(amount) < 1000) {
      await sendComplexMessage(chatId, "❌ Введите сумму депозита (руб), минимум 1000", [], { removeKeyboard: true });
      return true;
    }
    context.depositOverride = amount;
    const summary = buildSummary(context);
    await setState(userId, "td_confirm", context);
    await sendComplexMessage(chatId, summary, buildConfirmKeyboard(), { keyboardType: "inline", parseMode: "Markdown" });
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

  // Answer callback query
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

  // ── State handlers ──

  if (callbackData.startsWith("td_cat_")) {
    const cat = callbackData.replace("td_cat_", "");
    if (cat === "A" || cat === "B" || cat === "none") {
      const label = cat === "none" ? "нет" : cat;
      context.licenseCategory = label;
      await setState(userId, "td_category", context);
      await sendComplexMessage(chatId, `🏷 ${label}`, buildCategoryKeyboard(label), { keyboardType: "inline" });
    } else if (cat === "done") {
      // Advance to deposit choice
      if (!context.licenseCategory) {
        // Force selection
        await sendComplexMessage(chatId, "Выберите категорию:", buildCategoryKeyboard(), { keyboardType: "inline" });
        return true;
      }
      await gotoDeposit(chatId, userId, context);
    }
    return true;
  }

  if (state === "td_deposit_choice") {
    if (callbackData === "td_dep_confirm") {
      // Use default deposit from bike
      const bike = await resolveBikeById(context.bikeId);
      const defaultDeposit = String(bike?.specs?.deposit_rub || "20000");
      context.depositOverride = defaultDeposit;
      const summary = buildSummary(context);
      await setState(userId, "td_confirm", context);
      await sendComplexMessage(chatId, summary, buildConfirmKeyboard(), { keyboardType: "inline", parseMode: "Markdown" });
      return true;
    }
    if (callbackData === "td_dep_custom") {
      await setState(userId, "td_deposit_custom", context);
      await sendComplexMessage(chatId, "✏️ Введите сумму депозита (руб):", [], { removeKeyboard: true });
      return true;
    }
  }

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

async function gotoDeposit(chatId: number, userId: string, context: TestDriveContext): Promise<void> {
  const bike = await resolveBikeById(context.bikeId);
  const depositAmount = String(bike?.specs?.deposit_rub || "20000");
  await setState(userId, "td_deposit_choice", context);
  const formatted = Number(depositAmount).toLocaleString("ru-RU");
  await sendComplexMessage(
    chatId,
    `*Депозит / обеспечительный платёж*\n\n` +
    `Байк: ${bike ? `${bike.make} ${bike.model}` : context.bikeId}\n` +
    `Депозит из карточки ТС: *${formatted} ₽*\n\n` +
    `Выберите вариант:`,
    buildDepositChoiceKeyboard(depositAmount, bike),
    { keyboardType: "inline", parseMode: "Markdown" },
  );
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

  const parts = text.trim().split(/\s+/);
  const bikeArg = parts.slice(1).join(" ").trim();

  if (bikeArg) {
    const bike = await resolveBikeById(bikeArg);
    if (!bike) {
      await sendComplexMessage(chatId, `🚲 "${bikeArg}" не найден.`, [], { removeKeyboard: true });
      return;
    }
    const context: TestDriveContext = {
      bikeId: bike.id,
      bikeMake: bike.make,
      bikeModel: bike.model,
    };
    await setState(userIdStr, "td_phone", context);
    await sendComplexMessage(chatId, `🏍 ${bike.make} ${bike.model}`, [], { removeKeyboard: true });
    await sendComplexMessage(chatId, "*Тест-драйв — телефон клиента*", [], { parseMode: "Markdown", removeKeyboard: true });
    return;
  }

  // No bike arg — show bike selection
  const bikes = await getAvailableBikes();
  if (!bikes.length) {
    await sendComplexMessage(chatId, "🚲 Нет байков.", [], { removeKeyboard: true });
    return;
  }

  const buttons: KeyboardButton[][] = bikes.map(b => {
    const tier = b.specs?.access_tier;
    const emoji = tier === "pro" ? "🔴" : tier === "mid" ? "🟡" : tier === "entry" ? "🟢" : "⚪";
    return [{ text: `${emoji} ${b.make} ${b.model}` }];
  });

  await setState(userIdStr, "td_bike", { bikeId: "" });
  await sendComplexMessage(
    chatId,
    "🛵 *Тест-драйв — выберите байк*",
    buttons,
    { keyboardType: "reply", parseMode: "Markdown" },
  );
}
