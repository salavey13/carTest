// /app/webhook-handlers/commands/subrent-manual.ts
/**
 * /subrent command handler - Bike owner subrental agreement
 * =============================================================================
 *
 * Flow for park to rent bike from owner for commercial subrenting:
 *   1. Bike → select from catalog or enter new
 *   2. Owner full name
 *   3. Owner passport
 *   4. Owner birth date
 *   5. Owner registration address
 *   6. Owner phone
 *   7. Owner email (optional)
 *   8. Owner percentage (default 50%)
 *   9. Minimum daily price (default 9000)
 *   10. Hourly prices (3h/6h/12h defaults)
 *   11. Contract start date/time
 *   12. Contract duration (default to Nov 22 seasonal)
 *   13. Confirm
 *   → Generate subrental agreement
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
import { privateSchema } from "@/lib/private-secrets";
import nodemailer from "nodemailer";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CURRENT_YEAR = 2026;
const STATE_EXPIRY_MINUTES = 30;

// ── Constants ───────────────────────────────────────────────────────────────────

const DEFAULT_OWNER_PERCENTAGE = 50;
const DEFAULT_MIN_DAILY_PRICE = 9000;
const DEFAULT_HOURLY_PRICES = { "3h": 6000, "6h": 7000, "12h": 8000 };
const DEFAULT_SEASONAL_PRICES = { weekday: 14000, weekend: 16000 };
const DEFAULT_REGULAR_DEPOSIT = 10000;
const DEFAULT_NEW_CLIENT_DEPOSIT = 20000;
const DEFAULT_KM_ALLOWANCE = 200;
const DEFAULT_EXTRA_KM_FEE = 30;
const DEFAULT_DOWNTIME_COMPENSATION = 4000;
const DEFAULT_REPORTING_DAYS = 2;
const DEFAULT_LATE_PENALTY_PERCENT = 0.2;

// ── Keyboard builders ─────────────────────────────────────────────────────────────

function buildBikeKeyboard(bikes: any[]): KeyboardButton[][] {
  const rows: KeyboardButton[][] = [];

  for (const bike of bikes.slice(0, 10)) {
    rows.push([{
      text: `${bike.make} ${bike.model}`,
      callback_data: `bike_${bike.id}`,
    }]);
  }

  rows.push([{ text: "✏️ Новый мотоцикл", callback_data: "bike_new" }]);
  rows.push([{ text: "❌ Отменить", callback_data: "cancel" }]);

  return rows;
}

function buildPercentageKeyboard(selected: number): KeyboardButton[][] {
  const percentages = [30, 40, 50, 60, 70];
  const rows: KeyboardButton[][] = [];

  const row: KeyboardButton[] = [];
  for (const pct of percentages) {
    row.push({
      text: `${pct}% ${pct === selected ? "✅" : "⭕"}`,
      callback_data: `pct_${pct}`,
    });
  }
  rows.push(row);

  rows.push([
    { text: "✏️ Свой процент", callback_data: "pct_custom" },
    { text: "⏭ Пропустить", callback_data: "pct_skip" },
  ]);
  rows.push([{ text: "❌ Отменить", callback_data: "cancel" }]);

  return rows;
}

function buildPriceKeyboard(defaultPrice: number, selected?: number): KeyboardButton[][] {
  const prices = [
    Math.round(defaultPrice * 0.8),
    defaultPrice,
    Math.round(defaultPrice * 1.2),
  ];

  const rows: KeyboardButton[][] = [];
  const row: KeyboardButton[] = [];

  for (const price of prices) {
    row.push({
      text: `${price.toLocaleString("ru-RU")} ₽ ${price === selected ? "✅" : ""}`,
      callback_data: `price_${price}`,
    });
  }
  rows.push(row);

  rows.push([
    { text: "✏️ Своя цена", callback_data: "price_custom" },
  ]);
  rows.push([{ text: "❌ Отменить", callback_data: "cancel" }]);

  return rows;
}

function buildDurationKeyboard(): KeyboardButton[][] {
  const now = new Date();
  const endOfSeason = new Date(now.getFullYear(), 10, 22); // Nov 22

  return [
    [{ text: `📅 До 22 ноября (${endOfSeason.toLocaleDateString("ru-RU")})`, callback_data: "dur_season" }],
    [{ text: "📅 3 месяца", callback_data: "dur_3m" }],
    [{ text: "📅 6 месяцев", callback_data: "dur_6m" }],
    [{ text: "📅 1 год", callback_data: "dur_1y" }],
    [{ text: "✏️ Свой срок", callback_data: "dur_custom" }],
    [{ text: "❌ Отменить", callback_data: "cancel" }],
  ];
}

function buildStartKeyboard(): KeyboardButton[][] {
  const now = new Date();
  const currentHour = now.getHours();

  const rows: KeyboardButton[][] = [];

  if (currentHour < 20) {
    rows.push([
      { text: `📅 Сегодня ${currentHour + 1}:00`, callback_data: "s_today_next" },
    ]);
  }

  rows.push([
    { text: `📅 Завтра 10:00`, callback_data: "s_tomorrow_1000" },
    { text: `📅 Завтра 19:00`, callback_data: "s_tomorrow_1900" },
  ]);
  rows.push([
    { text: "✏️ Свое время", callback_data: "s_custom" },
  ]);

  return rows;
}

function buildConfirmKeyboard(): KeyboardButton[][] {
  return [
    [{ text: "✅ Подтвердить", callback_data: "ok" }],
    [{ text: "↩️ Изменить", callback_data: "edit" }],
    [{ text: "❌ Отменить", callback_data: "cancel" }],
  ];
}

function buildYesNoKeyboard(): KeyboardButton[][] {
  return [
    [
      { text: "✅ Да", callback_data: "yes" },
      { text: "❌ Нет", callback_data: "no" },
    ],
    [{ text: "❌ Отменить", callback_data: "cancel" }],
  ];
}

// ── State type ───────────────────────────────────────────────────────────────────

interface SubrentFlowContext {
  step: string;

  // Bike data
  bikeId?: string;
  bikeMake?: string;
  bikeModel?: string;
  bikeVin?: string;
  bikePlate?: string;
  bikeYear?: string;
  bikeValue?: string;
  bikeRegistrationCert?: string;
  bikeInsurancePolicy?: string;

  // Owner data
  ownerFullName?: string;
  ownerBirthDate?: string;
  ownerPassportSeries?: string;
  ownerPassportNumber?: string;
  ownerPassportIssuedBy?: string;
  ownerPassportIssueDate?: string;
  ownerRegistration?: string;
  ownerPhone?: string;
  ownerEmail?: string;

  // Payment terms
  ownerPercentage?: number;
  minDailyPrice?: number;
  hourly3hPrice?: number;
  hourly6hPrice?: number;
  hourly12hPrice?: number;
  weekdayPrice?: number;
  weekendPrice?: number;

  // Contract terms
  contractStartDate?: string;
  contractStartTime?: string;
  contractEndDate?: string;
  contractEndTime?: string;
  returnAddress?: string;

  // Metadata
  crewId?: string;
  telegramChatId?: string;
  contractNumber?: string;
}

// ── Helper functions ─────────────────────────────────────────────────────────────

/**
 * Capitalize each word in a full name (ФИО) for proper document formatting.
 * Mirrors the same function in doc-manual.ts — kept duplicated rather than
 * shared because both modules are independent server-only files that don't
 * import from each other, and the function is tiny.
 *
 *   "иванов иван иванович" → "Иванов Иван Иванович"
 *   "оруджов-салавеев"      → "Оруджов-Салавеев"
 */
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
  // Filter out test/internal bikes whose id starts with "vipbike"
  const { data } = await supabaseAdmin
    .from("cars")
    .select("id, make, model, specs")
    .in("type", ["bike", "ebike"])
    .not("id", "like", "vipbike%")
    .order("make", { ascending: true })
    .limit(20);
  return (data || []);
}

function parsePassport(text: string): { series: string; number: string; issueDate: string; issuedBy: string } | null {
  // Normalize: replace common separators (dash, slash, comma) with space
  // so "4509-123456" becomes "4509 123456" instead of collapsing to 10 digits.
  const normalized = text.trim().replace(/[-–—,;/]+/g, ' ');
  const parts = normalized.split(/\s+/);
  if (parts.length < 3) return null;

  let series = "", number = "", dateIdx = -1;
  for (let i = 0; i < parts.length; i++) {
    const cleaned = parts[i].replace(/\D/g, '');
    // FIX: handle combined 10-digit format like "4509123456"
    // when user typed "4509-123456" and normalize didn't split it
    if (cleaned.length === 10 && !series && !number) {
      series = cleaned.slice(0, 4);
      number = cleaned.slice(4);
    } else if (!series && cleaned.length === 4) series = cleaned;
    else if (!number && cleaned.length === 6) number = cleaned;
    else if (dateIdx === -1 && /^\d{1,2}\.\d{1,2}(\.\d{2,4})?$/.test(parts[i])) dateIdx = i;
  }

  if (!series || !number || dateIdx === -1) return null;

  let dateStr = parts[dateIdx];
  const parts2 = dateStr.split('.');
  if (parts2.length === 2) {
    return null; // Year required for passport
  }
  if (parts2[2].length === 2) {
    const y = parseInt(parts2[2]);
    parts2[2] = y > 50 ? `19${y}` : `20${y}`;
    dateStr = parts2.join('.');
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

function parseStartDate(text: string): { date: string; time: string } | null {
  const t = text.trim().toLowerCase();
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const formatDate = (d: Date) => `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;

  if (t.includes("сегодня")) {
    const timeMatch = t.match(/(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      return { date: formatDate(today), time: `${timeMatch[1].padStart(2,'0')}:${timeMatch[2]}` };
    }
    const hourMatch = t.match(/\d{1,2}/);
    if (hourMatch) {
      return { date: formatDate(today), time: `${hourMatch[0].padStart(2,'0')}:00` };
    }
    return { date: formatDate(today), time: "19:00" };
  }

  if (t.includes("завтра")) {
    const timeMatch = t.match(/(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      return { date: formatDate(tomorrow), time: `${timeMatch[1].padStart(2,'0')}:${timeMatch[2]}` };
    }
    const hourMatch = t.match(/\d{1,2}/);
    if (hourMatch) {
      return { date: formatDate(tomorrow), time: `${hourMatch[0].padStart(2,'0')}:00` };
    }
    return { date: formatDate(tomorrow), time: "19:00" };
  }

  const dateMatch = t.match(/^(\d{1,2})\.(\d{1,2})(\.(\d{2,4}))?/);
  if (dateMatch) {
    let [, day, month, , year] = dateMatch;
    day = day.padStart(2, '0');
    month = month.padStart(2, '0');

    if (!year) year = String(CURRENT_YEAR);
    else if (year.length === 2) {
      const y = parseInt(year);
      year = y > 50 ? `19${y}` : `20${y}`;
    }

    const timeMatch = t.match(/(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      return { date: `${day}.${month}.${year}`, time: `${timeMatch[1].padStart(2,'0')}:${timeMatch[2]}` };
    }
    return { date: `${day}.${month}.${year}`, time: "19:00" };
  }

  return null;
}

function calculateEndDate(startDate: string, startTime: string, duration: string): { date: string; time: string } {
  const [day, month, year] = startDate.split('.').map(Number);
  const [hour, minute] = startTime.split(':').map(Number);

  const start = new Date(year, month - 1, day, hour, minute);

  if (duration === "dur_season") {
    // Nov 22 of current year
    const endSeason = new Date(start.getFullYear(), 10, 22, 19, 0);
    if (start > endSeason) {
      // If already past Nov 22, go to next year
      endSeason.setFullYear(endSeason.getFullYear() + 1);
    }
    return {
      date: `${String(endSeason.getDate()).padStart(2,'0')}.${String(endSeason.getMonth() + 1).padStart(2,'0')}.${endSeason.getFullYear()}`,
      time: "19:00",
    };
  }

  let months = 0;
  if (duration === "dur_3m") months = 3;
  else if (duration === "dur_6m") months = 6;
  else if (duration === "dur_1y") months = 12;

  const end = new Date(start);
  end.setMonth(end.getMonth() + months);
  end.setHours(19, 0, 0, 0);

  return {
    date: `${String(end.getDate()).padStart(2,'0')}.${String(end.getMonth() + 1).padStart(2,'0')}.${end.getFullYear()}`,
    time: "19:00",
  };
}

function numberToRussianWords(num: number): string {
  const ones = ["", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
  const teens = ["десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать", "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать"];
  const tens = ["", "", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят", "восемьдесят", "девяносто"];
  const hundreds = ["", "сто", "двести", "триста", "четыреста", "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот"];
  const thousands = ["", "тысяча", "тысячи", "тысяч"];

  if (num === 0) return "ноль";

  let words: string[] = [];
  let n = num;

  // Thousands
  if (n >= 1000) {
    const t = Math.floor(n / 1000);
    if (t === 1) words.push("одна тысяча");
    else if (t === 2) words.push("две тысячи");
    else if (t < 5) words.push(`${ones[t]} тысячи`);
    else words.push(`${ones[t]} тысяч`);
    n %= 1000;
  }

  // Hundreds
  if (n >= 100) {
    words.push(hundreds[Math.floor(n / 100)]);
    n %= 100;
  }

  // Tens and ones
  if (n >= 20) {
    words.push(tens[Math.floor(n / 10)]);
    n %= 10;
  }
  if (n >= 10) {
    words.push(teens[n - 10]);
    n = 0;
  }
  if (n > 0) {
    words.push(ones[n]);
  }

  return words.join(" ") || String(num);
}

// ── State management ─────────────────────────────────────────────────────────────

async function getState(userId: string): Promise<SubrentFlowContext | null> {
  const { data } = await supabaseAdmin
    .from("user_states")
    .select("state, context, created_at")
    .eq("user_id", userId)
    .like("state", "subrent_%")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  const age = Date.now() - new Date(data.created_at).getTime();
  if (age > STATE_EXPIRY_MINUTES * 60 * 1000) {
    await supabaseAdmin.from("user_states").delete().eq("user_id", userId).like("state", "subrent_%");
    return null;
  }

  return data.context as SubrentFlowContext;
}

async function saveState(userId: string, context: SubrentFlowContext): Promise<void> {
  const stateName = `subrent_${context.step}`;

  // FIX: onConflict ensures only ONE row per user_id, preventing duplicate
  // rows that would cause getState() and routing (command-handler.ts) to fail
  // with maybeSingle() on multiple matches.
  // FIX: explicitly set expires_at — the column is NOT NULL; without it the
  // upsert fails silently (DEFAULT 15 min from table DDL is used, but on UPDATE
  // via onConflict the old expires_at persists → state drops after 15 min of
  // first save, not activity). Match doc-manual's 30-minute TTL.
  await supabaseAdmin.from("user_states").upsert({
    user_id: userId,
    state: stateName,
    context,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + STATE_EXPIRY_MINUTES * 60 * 1000).toISOString(),
  }, {
    onConflict: "user_id",
    ignoreDuplicates: false,
  });
}

async function clearState(userId: string): Promise<void> {
  await supabaseAdmin.from("user_states").delete().eq("user_id", userId).like("state", "subrent_%");
}

// ── Main handler ─────────────────────────────────────────────────────────────────

export async function handleSubrentManualCommand(params: {
  userId: string;
  userName?: string;
  text?: string;
  callbackData?: string;
  messageId?: number;
  callbackQueryId?: string;
  crewId?: string;
}): Promise<void> {
  const { userId, userName, text, callbackData, messageId, callbackQueryId, crewId } = params;

  if (!TELEGRAM_BOT_TOKEN) {
    logger.error("[subrent-manual] TELEGRAM_BOT_TOKEN not set");
    return;
  }

  try {
    // ── FIX: Detect /subrent re-invocation and start fresh ──
    // When the user types /subrent again while already in a flow,
    // clear the old state and restart. Without this, the command text
    // "/subrent" would be processed as user input for the current step
    // (e.g. parsed as bike data), causing confusing errors.
    const isCommandInvocation = text?.trim().toLowerCase().startsWith("/subrent");
    if (isCommandInvocation) {
      await clearState(userId);
      // Fall through to the "no context" block below which starts a fresh flow
    }

    const context = isCommandInvocation ? null : await getState(userId);

    // Start new flow
    if (!context) {
      const bikes = await getAvailableBikes();

      await sendComplexMessage({
        botToken: TELEGRAM_BOT_TOKEN,
        chatId: userId,
        text: `🏍 *Субаренда мотоцикла в парк* (1/7)\n\nВыберите мотоцикл, который собственник передаёт в аренду вашему парку:`,
        parseMode: "Markdown",
        replyMarkup: JSON.stringify({ inline_keyboard: buildBikeKeyboard(bikes) }),
      });

      await saveState(userId, {
        step: "bike",
        crewId,
        telegramChatId: userId,
      });
      return;
    }

    // Handle callback
    if (callbackData) {
      await handleCallback(context, callbackData, userId, messageId ?? 0, callbackQueryId);
      return;
    }

    // Handle text input
    if (text) {
      await handleTextInput(context, text, userId, messageId ?? 0);
      return;
    }

  } catch (error) {
    logger.error("[subrent-manual] Error:", error);
    await sendComplexMessage({
      botToken: TELEGRAM_BOT_TOKEN,
      chatId: userId,
      text: "❌ Произошла ошибка. Попробуйте /subrent заново.",
    });
    await clearState(userId);
  }
}

async function handleCallback(context: SubrentFlowContext, callbackData: string, userId: string, messageId: number, callbackQueryId?: string): Promise<void> {
  // Answer callback query to dismiss loading spinner on the button
  if (callbackQueryId) {
    try {
      await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery?callback_query_id=${callbackQueryId}`,
        { method: "POST" },
      );
    } catch (e) {
      logger.warn("[subrent] answerCallbackQuery failed:", e);
    }
  }

  const parts = callbackData.split("_");
  const action = parts[0];
  const value = parts.slice(1).join("_"); // Capture everything after first underscore

  switch (action) {
    case "cancel":
      await clearState(userId);
      await sendComplexMessage({
        botToken: TELEGRAM_BOT_TOKEN,
        chatId: userId,
        text: "❌ Операция отменена.",
      });
      break;

    case "bike":
      if (value === "new") {
        const isEditMode = context.step === "edit_bike";
        await sendComplexMessage({
          botToken: TELEGRAM_BOT_TOKEN,
          chatId: userId,
          text: `📝 ${isEditMode ? "Изменить" : "Субаренда мотоцикла в парк (2/7)"} данные мотоцикла:\n\n*Марка Модель*\n_Yamaha R7_\n\n*VIN*\n_JYA2... (17 символов)_\n\n*Гос. номер*\n_А123БВ777_\n\n*Год*\n_2023_\n\n*Стоимость (₽)*\n_500000_\n\n📋 Каждое поле с новой строки:`,
          parseMode: "Markdown",
        });
        context.step = isEditMode ? "edit_bike_new" : "bike_new";
        await saveState(userId, context);
      } else {
        const bike = await resolveBikeById(value);
        if (bike) {
          context.bikeId = bike.id;
          context.bikeMake = bike.make;
          context.bikeModel = bike.model;

          // FIX: edit_bike — after selecting a new bike, go back to confirmation
          if (context.step === "edit_bike") {
            await showConfirmation(context, userId);
          } else {
            await sendComplexMessage({
              botToken: TELEGRAM_BOT_TOKEN,
              chatId: userId,
              text: `✅ *Субаренда мотоцикла в парк* (3/7)\n\nВыбран: *${bike.make} ${bike.model}*\n\n👤 Введите ФИО собственника (полностью):`,
              parseMode: "Markdown",
            });
            context.step = "owner_name";
            await saveState(userId, context);
          }
        }
      }
      break;

    case "pct":
      if (value === "custom") {
        await sendComplexMessage({
          botToken: TELEGRAM_BOT_TOKEN,
          chatId: userId,
          text: "📊 Введите процент собственника (число от 1 до 99):",
        });
        context.step = "owner_pct_custom";
        await saveState(userId, context);
      } else if (value === "skip") {
        context.ownerPercentage = DEFAULT_OWNER_PERCENTAGE;
        await promptNextStep(context, userId);
      } else {
        context.ownerPercentage = parseInt(value);
        await promptNextStep(context, userId);
      }
      break;

    case "price":
      if (value === "custom") {
        await sendComplexMessage({
          botToken: TELEGRAM_BOT_TOKEN,
          chatId: userId,
          text: "💰 Введите минимальную суточную стоимость аренды:",
        });
        context.step = "price_custom";
        await saveState(userId, context);
      } else {
        context.minDailyPrice = parseInt(value);
        await promptNextStep(context, userId);
      }
      break;

    case "hourly":
      if (value === "skip") {
        context.hourly3hPrice = DEFAULT_HOURLY_PRICES["3h"];
        context.hourly6hPrice = DEFAULT_HOURLY_PRICES["6h"];
        context.hourly12hPrice = DEFAULT_HOURLY_PRICES["12h"];
        await promptNextStep(context, userId);
      } else {
        await sendComplexMessage({
          botToken: TELEGRAM_BOT_TOKEN,
          chatId: userId,
          text: `⏰ Введите почасовые тарифы через пробел (3ч 6ч 12ч):`,
        });
        context.step = "hourly_custom";
        await saveState(userId, context);
      }
      break;

    case "seasonal":
      if (value === "skip") {
        context.weekdayPrice = DEFAULT_SEASONAL_PRICES.weekday;
        context.weekendPrice = DEFAULT_SEASONAL_PRICES.weekend;
        await promptNextStep(context, userId);
      } else {
        await sendComplexMessage({
          botToken: TELEGRAM_BOT_TOKEN,
          chatId: userId,
          text: "📈 Введите будничный и выходной тариф через пробел:",
        });
        context.step = "seasonal_custom";
        await saveState(userId, context);
      }
      break;

    case "s":
      if (value === "custom") {
        await sendComplexMessage({
          botToken: TELEGRAM_BOT_TOKEN,
          chatId: userId,
          text: "📅 Введите дату и время начала договора (ДД.ММ.ГГГГ ЧЧ:ММ):",
        });
        context.step = "start_custom";
        await saveState(userId, context);
      } else {
        const start = parseStartDate(value === "today_next" ? "сегодня " + String(new Date().getHours() + 1).padStart(2, '0') + ":00" : value === "tomorrow_1000" ? "завтра 10:00" : value === "tomorrow_1900" ? "завтра 19:00" : "завтра " + value.replace("tomorrow_", "").replace(/(\d{2})(\d{2})/, "$1:$2"));

        if (start) {
          context.contractStartDate = start.date;
          context.contractStartTime = start.time;

          await sendComplexMessage({
            botToken: TELEGRAM_BOT_TOKEN,
            chatId: userId,
            text: `📅 Начало: ${start.date} ${start.time}\n\nВыберите длительность договора:`,
            replyMarkup: JSON.stringify({ inline_keyboard: buildDurationKeyboard() }),
          });

          context.step = "duration";
          await saveState(userId, context);
        }
      }
      break;

    case "dur":
      if (!context.contractStartDate || !context.contractStartTime) {
        await sendComplexMessage({
          botToken: TELEGRAM_BOT_TOKEN,
          chatId: userId,
          text: "❌ Ошибка: дата начала не указана. Попробуйте /subrent заново.",
        });
        await clearState(userId);
        break;
      }

      // FIX: "dur_custom" — user wants to type their own duration
      if (value === "custom") {
        await sendComplexMessage({
          botToken: TELEGRAM_BOT_TOKEN,
          chatId: userId,
          text: "📅 Введите длительность договора в днях (например: 30, 60, 90):",
        });
        context.step = "duration_custom";
        await saveState(userId, context);
        break;
      }

      const endDate = calculateEndDate(context.contractStartDate, context.contractStartTime, callbackData);
      context.contractEndDate = endDate.date;
      context.contractEndTime = endDate.time;

      await showConfirmation(context, userId);
      break;

    case "ok":
      await generateAndSendContract(context, userId);
      await clearState(userId);
      break;

    case "edit":
      if (!value || value === "") {
        // Show edit menu
        await sendComplexMessage({
          botToken: TELEGRAM_BOT_TOKEN,
          chatId: userId,
          text: `🔄 Какой параметр изменить?`,
          replyMarkup: JSON.stringify({
            inline_keyboard: [
              [{ text: `👤 Собственник`, callback_data: "edit_owner" }],
              [{ text: `🏍 Мотоцикл`, callback_data: "edit_bike" }],
              [{ text: `💰 Оплата`, callback_data: "edit_payment" }],
              [{ text: `📅 Даты`, callback_data: "edit_dates" }],
              [{ text: `❌ Отменить`, callback_data: "cancel" }],
            ],
          }),
        });
        context.step = "edit_menu";
        await saveState(userId, context);
      } else if (value === "owner") {
        await sendComplexMessage({
          botToken: TELEGRAM_BOT_TOKEN,
          chatId: userId,
          text: `👤 Текущий ФИО: ${context.ownerFullName}\n\nВведите новое ФИО:`,
        });
        context.step = "edit_owner_name";
        await saveState(userId, context);
      } else if (value === "bike") {
        // FIX: edit_bike was causing default case to kill state.
        // For now, redirect to bike selection while keeping other data.
        const bikes = await getAvailableBikes();
        // Clear old bike data so user can re-enter
        context.bikeId = undefined;
        context.bikeMake = undefined;
        context.bikeModel = undefined;
        context.bikeVin = undefined;
        context.bikePlate = undefined;
        context.bikeYear = undefined;
        context.bikeValue = undefined;
        await sendComplexMessage({
          botToken: TELEGRAM_BOT_TOKEN,
          chatId: userId,
          text: "🏍 Выберите новый мотоцикл или нажмите '✏️ Новый мотоцикл':",
          replyMarkup: JSON.stringify({ inline_keyboard: buildBikeKeyboard(bikes) }),
        });
        context.step = "edit_bike";
        await saveState(userId, context);
      } else if (value === "payment") {
        await sendComplexMessage({
          botToken: TELEGRAM_BOT_TOKEN,
          chatId: userId,
          text: `💰 Текущий процент: ${context.ownerPercentage}%\n\nВведите новый процент:`,
        });
        context.step = "edit_owner_pct";
        await saveState(userId, context);
      } else if (value === "dates") {
        await sendComplexMessage({
          botToken: TELEGRAM_BOT_TOKEN,
          chatId: userId,
          text: `📅 Введите новую дату начала (ДД.ММ.ГГГГ ЧЧ:ММ):`,
        });
        context.step = "edit_start";
        await saveState(userId, context);
      }
      break;

    case "yes":
    case "no":
      // Handle yes/no prompts
      if (context.step === "ask_email") {
        if (action === "yes") {
          await sendComplexMessage({
            botToken: TELEGRAM_BOT_TOKEN,
            chatId: userId,
            text: "📧 Введите email собственника:",
          });
          context.step = "owner_email";
          await saveState(userId, context);
        } else {
          context.ownerEmail = undefined;
          await promptNextStep(context, userId);
        }
      }
      break;

    default:
      await sendComplexMessage({
        botToken: TELEGRAM_BOT_TOKEN,
        chatId: userId,
        text: "❌ Неизвестная команда. Попробуйте /subrent заново.",
      });
      await clearState(userId);
  }
}

async function handleTextInput(context: SubrentFlowContext, text: string, userId: string, messageId: number): Promise<void> {
  switch (context.step) {
    case "bike_new":
    case "edit_bike_new":
      const bikeLines = text.split('\n').map(l => l.trim());
      const isEditBike = context.step === "edit_bike_new";
      if (bikeLines.length >= 2) {
        context.bikeMake = bikeLines[0];
        context.bikeModel = bikeLines[1] || "";
        context.bikeVin = bikeLines[2] || "";
        context.bikePlate = bikeLines[3] || "";
        context.bikeYear = bikeLines[4] || "";
        context.bikeValue = bikeLines[5] || "";
      }

      // Validate required fields
      if (!context.bikeMake || !context.bikeModel) {
        await sendComplexMessage({
          botToken: TELEGRAM_BOT_TOKEN,
          chatId: userId,
          text: "❌ Марка и модель обязательны. Попробуйте еще раз:",
        });
        return;
      }

      if (isEditBike) {
        await showConfirmation(context, userId);
      } else {
        await sendComplexMessage({
          botToken: TELEGRAM_BOT_TOKEN,
          chatId: userId,
          text: `✅ Мотоцикл добавлен\n\n👤 Введите ФИО собственника (полностью):`,
        });
        context.step = "owner_name";
        await saveState(userId, context);
      }
      break;

    case "owner_name":
      context.ownerFullName = capitalizeFullName(text);
      await sendComplexMessage({
        botToken: TELEGRAM_BOT_TOKEN,
        chatId: userId,
        text: `📄 *Субаренда мотоцикла в парк* (4/7)\n\nВведите паспортные данные:\n\n*Серия Номер*\n_4509 123456_\n\n*Дата выдачи*\n_15.03.2020_\n\n*Кем выдано*\n_ОМВД по Н.Новгороду_\n\n📋 Пример в одну строку:\n_4509 123456 15.03.2020 ОМВД по Н.Новгороду_`,
        parseMode: "Markdown",
      });
      context.step = "owner_passport";
      await saveState(userId, context);
      break;

    case "owner_passport":
      const passport = parsePassport(text);
      if (passport) {
        context.ownerPassportSeries = passport.series;
        context.ownerPassportNumber = passport.number;
        context.ownerPassportIssueDate = passport.issueDate;
        context.ownerPassportIssuedBy = passport.issuedBy;

        await sendComplexMessage({
          botToken: TELEGRAM_BOT_TOKEN,
          chatId: userId,
          text: `📅 *Субаренда мотоцикла в парк* (5/7)\n\nВведите дату рождения собственника:\n\n*ДД.ММ.ГГГГ*\n_01.01.1990_`,
          parseMode: "Markdown",
        });
        context.step = "owner_birth";
        await saveState(userId, context);
      } else {
        await sendComplexMessage({
          botToken: TELEGRAM_BOT_TOKEN,
          chatId: userId,
          text: "❌ Неверный формат паспорта. Попробуйте еще раз:",
        });
      }
      break;

    case "owner_birth":
      const birthDate = parseDate(text, true);
      if (birthDate) {
        context.ownerBirthDate = birthDate;
        await sendComplexMessage({
          botToken: TELEGRAM_BOT_TOKEN,
          chatId: userId,
          text: `🏠 *Субаренда мотоцикла в парк* (6/7)\n\nВведите адрес регистрации собственника:\n\n_г. Нижний Новгород, ул. Примерная, д. 1, кв. 1_`,
          parseMode: "Markdown",
        });
        context.step = "owner_address";
        await saveState(userId, context);
      } else {
        await sendComplexMessage({
          botToken: TELEGRAM_BOT_TOKEN,
          chatId: userId,
          text: "❌ Неверный формат даты. Используйте ДД.ММ.ГГГГ (например: 01.01.1990)",
        });
      }
      break;

    case "owner_address":
      context.ownerRegistration = text;
      await sendComplexMessage({
        botToken: TELEGRAM_BOT_TOKEN,
        chatId: userId,
        text: `📱 *Субаренда мотоцикла в парк* (7/7)\n\nВведите телефон собственника:\n\n_+7 (999) 123-45-67_`,
        parseMode: "Markdown",
      });
      context.step = "owner_phone";
      await saveState(userId, context);
      break;

    case "owner_phone":
      context.ownerPhone = text;
      await sendComplexMessage({
        botToken: TELEGRAM_BOT_TOKEN,
        chatId: userId,
        text: "У собственника есть email?",
        replyMarkup: JSON.stringify({ inline_keyboard: buildYesNoKeyboard() }),
      });
      context.step = "ask_email";
      await saveState(userId, context);
      break;

    case "owner_email":
      context.ownerEmail = text;
      await promptNextStep(context, userId);
      break;

    case "owner_pct_custom":
      const pct = parseInt(text);
      if (!isNaN(pct) && pct > 0 && pct < 100) {
        context.ownerPercentage = pct;
        // FIX: Set step to "payment" before calling promptNextStep so it
        // transitions to "price" (user completed the payment/percentage step).
        context.step = "payment";
        await promptNextStep(context, userId);
      } else {
        await sendComplexMessage({
          botToken: TELEGRAM_BOT_TOKEN,
          chatId: userId,
          text: "❌ Введите число от 1 до 99:",
        });
      }
      break;

    case "price_custom":
      const price = parseInt(text.replace(/\D/g, ''));
      if (!isNaN(price) && price > 0) {
        context.minDailyPrice = price;
        await sendComplexMessage({
          botToken: TELEGRAM_BOT_TOKEN,
          chatId: userId,
          text: "⏰ Введите почасовые тарифы через пробел (3ч 6ч 12ч) или нажмите 'Пропустить':",
          replyMarkup: JSON.stringify({ inline_keyboard: [[{ text: "⏭ Пропустить", callback_data: "hourly_skip" }]] }),
        });
        context.step = "hourly";
        await saveState(userId, context);
      } else {
        await sendComplexMessage({
          botToken: TELEGRAM_BOT_TOKEN,
          chatId: userId,
          text: "❌ Введите корректную сумму:",
        });
      }
      break;

    case "hourly":
    case "hourly_custom":
      const hourly = text.split(/\s+/).map(n => parseInt(n.replace(/\D/g, '')));
      if (hourly.length >= 3 && hourly.every(n => !isNaN(n) && n > 0)) {
        [context.hourly3hPrice, context.hourly6hPrice, context.hourly12hPrice] = hourly;

        await sendComplexMessage({
          botToken: TELEGRAM_BOT_TOKEN,
          chatId: userId,
          text: "📈 Введите сезонные тарифы (будни выходные) или нажмите 'Пропустить':",
          replyMarkup: JSON.stringify({ inline_keyboard: [[{ text: "⏭ Пропустить", callback_data: "seasonal_skip" }]] }),
        });
        context.step = "seasonal";
        await saveState(userId, context);
      } else {
        await sendComplexMessage({
          botToken: TELEGRAM_BOT_TOKEN,
          chatId: userId,
          text: "❌ Введите 3 числа через пробел:",
        });
      }
      break;

    case "seasonal":
    case "seasonal_custom":
      const seasonal = text.split(/\s+/).map(n => parseInt(n.replace(/\D/g, '')));
      if (seasonal.length >= 2 && seasonal.every(n => !isNaN(n) && n > 0)) {
        [context.weekdayPrice, context.weekendPrice] = seasonal;

        await sendComplexMessage({
          botToken: TELEGRAM_BOT_TOKEN,
          chatId: userId,
          text: "📅 Введите дату и время начала договора:",
          replyMarkup: JSON.stringify({ inline_keyboard: buildStartKeyboard() }),
        });
        context.step = "start";
        await saveState(userId, context);
      } else {
        await sendComplexMessage({
          botToken: TELEGRAM_BOT_TOKEN,
          chatId: userId,
          text: "❌ Введите 2 числа через пробел (будни выходные):",
        });
      }
      break;

    case "start_custom":
      const start = parseStartDate(text);
      if (start) {
        context.contractStartDate = start.date;
        context.contractStartTime = start.time;

        await sendComplexMessage({
          botToken: TELEGRAM_BOT_TOKEN,
          chatId: userId,
          text: "Выберите длительность договора:",
          replyMarkup: JSON.stringify({ inline_keyboard: buildDurationKeyboard() }),
        });
        context.step = "duration";
        await saveState(userId, context);
      } else {
        await sendComplexMessage({
          botToken: TELEGRAM_BOT_TOKEN,
          chatId: userId,
          text: "❌ Неверный формат. Используйте ДД.ММ.ГГГГ ЧЧ:ММ",
        });
      }
      break;

    case "edit_owner_name":
      context.ownerFullName = capitalizeFullName(text);
      await showConfirmation(context, userId);
      break;

    case "edit_owner_pct":
      const editPct = parseInt(text);
      if (!isNaN(editPct) && editPct > 0 && editPct < 100) {
        context.ownerPercentage = editPct;
        await showConfirmation(context, userId);
      } else {
        await sendComplexMessage({
          botToken: TELEGRAM_BOT_TOKEN,
          chatId: userId,
          text: "❌ Введите число от 1 до 99:",
        });
      }
      break;

    case "edit_start":
      const editStart = parseStartDate(text);
      if (editStart) {
        context.contractStartDate = editStart.date;
        context.contractStartTime = editStart.time;

        await sendComplexMessage({
          botToken: TELEGRAM_BOT_TOKEN,
          chatId: userId,
          text: "Выберите длительность:",
          replyMarkup: JSON.stringify({ inline_keyboard: buildDurationKeyboard() }),
        });
        context.step = "edit_duration";
        await saveState(userId, context);
      } else {
        await sendComplexMessage({
          botToken: TELEGRAM_BOT_TOKEN,
          chatId: userId,
          text: "❌ Неверный формат. Используйте ДД.ММ.ГГГГ ЧЧ:ММ",
        });
      }
      break;

    case "duration_custom":
      const durationDays = parseInt(text.replace(/\D/g, ''));
      if (!isNaN(durationDays) && durationDays > 0 && durationDays < 3650) {
        if (!context.contractStartDate || !context.contractStartTime) {
          await sendComplexMessage({
            botToken: TELEGRAM_BOT_TOKEN,
            chatId: userId,
            text: "❌ Ошибка: дата начала не указана. Попробуйте /subrent заново.",
          });
          await clearState(userId);
          break;
        }
        const [sd, sm, sy] = context.contractStartDate.split('.').map(Number);
        const [sh, smin] = context.contractStartTime.split(':').map(Number);
        const startDt = new Date(sy, sm - 1, sd, sh, smin);
        const endDt = new Date(startDt);
        endDt.setDate(endDt.getDate() + durationDays);
        endDt.setHours(19, 0, 0, 0);
        context.contractEndDate = `${String(endDt.getDate()).padStart(2,'0')}.${String(endDt.getMonth()+1).padStart(2,'0')}.${endDt.getFullYear()}`;
        context.contractEndTime = "19:00";
        await showConfirmation(context, userId);
      } else {
        await sendComplexMessage({
          botToken: TELEGRAM_BOT_TOKEN,
          chatId: userId,
          text: "❌ Введите число дней от 1 до 3650 (например: 30):",
        });
      }
      break;

    default:
      // FIX: Gracefully handle common edge cases instead of destroying state.
      const lowerText = text.trim().toLowerCase();

      // Cancel detection — user wants to abort gracefully
      if (lowerText === "cancel" || lowerText === "отмена" || lowerText === "назад" || lowerText === "стоп") {
        await clearState(userId);
        await sendComplexMessage({
          botToken: TELEGRAM_BOT_TOKEN,
          chatId: userId,
          text: "❌ Операция отменена.",
        });
        return;
      }

      // "bike" / "edit_bike" step expects a callback selection — user typed instead of clicking
      if (context.step === "bike" || context.step === "edit_bike") {
        await sendComplexMessage({
          botToken: TELEGRAM_BOT_TOKEN,
          chatId: userId,
          text: "ℹ️ Выберите мотоцикл из списка или нажмите '✏️ Новый мотоцикл'. Если нужного байка нет, нажмите '✏️ Новый мотоцикл' и введите данные вручную.",
        });
        return;
      }

      // "duration" / "edit_duration" step expects button — user typed instead
      if (context.step === "duration" || context.step === "edit_duration") {
        await sendComplexMessage({
          botToken: TELEGRAM_BOT_TOKEN,
          chatId: userId,
          text: "ℹ️ Выберите длительность договора из кнопок ниже:",
          replyMarkup: JSON.stringify({ inline_keyboard: buildDurationKeyboard() }),
        });
        return;
      }

      // "confirm" step — user typed instead of clicking a button
      if (context.step === "confirm") {
        if (lowerText === "ok" || lowerText === "да" || lowerText === "yes" || lowerText === "подтверждаю") {
          await generateAndSendContract(context, userId);
          await clearState(userId);
          return;
        }
        if (lowerText === "изменить" || lowerText === "edit" || lowerText === "меняй") {
          await sendComplexMessage({
            botToken: TELEGRAM_BOT_TOKEN,
            chatId: userId,
            text: `🔄 Какой параметр изменить?`,
            replyMarkup: JSON.stringify({
              inline_keyboard: [
                [{ text: `👤 Собственник`, callback_data: "edit_owner" }],
                [{ text: `🏍 Мотоцикл`, callback_data: "edit_bike" }],
                [{ text: `💰 Оплата`, callback_data: "edit_payment" }],
                [{ text: `📅 Даты`, callback_data: "edit_dates" }],
                [{ text: `❌ Отменить`, callback_data: "cancel" }],
              ],
            }),
          });
          context.step = "edit_menu";
          await saveState(userId, context);
          return;
        }
        await sendComplexMessage({
          botToken: TELEGRAM_BOT_TOKEN,
          chatId: userId,
          text: "ℹ️ Нажмите '✅ Подтвердить' для генерации договора, '↩️ Изменить' для правки, или '❌ Отменить'.",
          replyMarkup: JSON.stringify({ inline_keyboard: buildConfirmKeyboard() }),
        });
        return;
      }

      // "ask_email" step expects yes/no — user typed instead of clicking
      if (context.step === "ask_email") {
        if (lowerText.includes("да") || lowerText.includes("yes") || lowerText.includes("есть")) {
          await sendComplexMessage({
            botToken: TELEGRAM_BOT_TOKEN,
            chatId: userId,
            text: "📧 Введите email собственника:",
          });
          context.step = "owner_email";
          await saveState(userId, context);
          return;
        }
        if (lowerText.includes("нет") || lowerText.includes("no") || lowerText.includes("нема")) {
          context.ownerEmail = undefined;
          context.step = "ask_email";
          await promptNextStep(context, userId);
          return;
        }
        await sendComplexMessage({
          botToken: TELEGRAM_BOT_TOKEN,
          chatId: userId,
          text: "ℹ️ Нажмите '✅ Да' или '❌ Нет' на кнопках ниже:",
          replyMarkup: JSON.stringify({ inline_keyboard: buildYesNoKeyboard() }),
        });
        return;
      }

      // "payment" step expects percentage selection — user typed instead of clicking
      if (context.step === "payment") {
        const typedPct = parseInt(text.replace(/\D/g, ''));
        if (!isNaN(typedPct) && typedPct > 0 && typedPct < 100) {
          context.ownerPercentage = typedPct;
          context.step = "payment";
          await promptNextStep(context, userId);
          return;
        }
        await sendComplexMessage({
          botToken: TELEGRAM_BOT_TOKEN,
          chatId: userId,
          text: `ℹ️ Выберите процент из кнопок или нажмите '✏️ Свой процент':`,
          replyMarkup: JSON.stringify({ inline_keyboard: buildPercentageKeyboard(DEFAULT_OWNER_PERCENTAGE) }),
        });
        return;
      }

      // "price" step expects selection — user typed instead of clicking
      if (context.step === "price") {
        const typedPrice = parseInt(text.replace(/\D/g, ''));
        if (!isNaN(typedPrice) && typedPrice > 0) {
          context.minDailyPrice = typedPrice;
          context.step = "price";
          await promptNextStep(context, userId);
          return;
        }
        await sendComplexMessage({
          botToken: TELEGRAM_BOT_TOKEN,
          chatId: userId,
          text: `ℹ️ Выберите цену из кнопок или нажмите '✏️ Своя цена':`,
          replyMarkup: JSON.stringify({ inline_keyboard: buildPriceKeyboard(DEFAULT_MIN_DAILY_PRICE) }),
        });
        return;
      }

      // "start" step expects callback — user typed instead of clicking
      if (context.step === "start") {
        const start = parseStartDate(text);
        if (start) {
          context.contractStartDate = start.date;
          context.contractStartTime = start.time;
          await sendComplexMessage({
            botToken: TELEGRAM_BOT_TOKEN,
            chatId: userId,
            text: `📅 Начало: ${start.date} ${start.time}\n\nВыберите длительность договора:`,
            replyMarkup: JSON.stringify({ inline_keyboard: buildDurationKeyboard() }),
          });
          context.step = "duration";
          await saveState(userId, context);
          return;
        }
      }

      // "hourly" step — user typed instead of pressing 'skip'
      if (context.step === "hourly") {
        const hourlyVals = text.split(/\s+/).map(n => parseInt(n.replace(/\D/g, '')));
        if (hourlyVals.length >= 3 && hourlyVals.every(n => !isNaN(n) && n > 0)) {
          [context.hourly3hPrice, context.hourly6hPrice, context.hourly12hPrice] = hourlyVals;
          context.step = "hourly";
          await promptNextStep(context, userId);
          return;
        }
        await sendComplexMessage({
          botToken: TELEGRAM_BOT_TOKEN,
          chatId: userId,
          text: "❌ Введите 3 числа через пробел (например: 6000 7000 8000) или нажмите 'Пропустить':",
          replyMarkup: JSON.stringify({ inline_keyboard: [[{ text: "⏭ Пропустить", callback_data: "hourly_skip" }]] }),
        });
        return;
      }

      // "seasonal" step — user typed instead of pressing 'skip'
      if (context.step === "seasonal") {
        const seasonalVals = text.split(/\s+/).map(n => parseInt(n.replace(/\D/g, '')));
        if (seasonalVals.length >= 2 && seasonalVals.every(n => !isNaN(n) && n > 0)) {
          [context.weekdayPrice, context.weekendPrice] = seasonalVals;
          context.step = "seasonal";
          await promptNextStep(context, userId);
          return;
        }
        await sendComplexMessage({
          botToken: TELEGRAM_BOT_TOKEN,
          chatId: userId,
          text: "❌ Введите 2 числа через пробел (будни выходные) или нажмите 'Пропустить':",
          replyMarkup: JSON.stringify({ inline_keyboard: [[{ text: "⏭ Пропустить", callback_data: "seasonal_skip" }]] }),
        });
        return;
      }

      await sendComplexMessage({
        botToken: TELEGRAM_BOT_TOKEN,
        chatId: userId,
        text: "❌ Неизвестное состояние. Попробуйте /subrent заново.",
      });
      await clearState(userId);
  }
}

async function promptNextStep(context: SubrentFlowContext, userId: string): Promise<void> {
  // Full sequential step map. Every step the user can be ON maps to the NEXT
  // step to show. Missing steps like "owner_pct_custom" or "price_custom" are
  // text-input variants that should set context.step to their parent before
  // calling promptNextStep.
  const stepTransitions: Record<string, string> = {
    ask_email: "payment",
    owner_email: "payment",
    payment: "price",
    price: "hourly",
    hourly: "seasonal",
    seasonal: "start",
    start: "duration",
    duration: "confirm",
  };

  // If current step has an edit variant (e.g. edit_owner_name → owner_name),
  // transition from the edit step back to main flow.
  let currentStep = context.step;
  const isEditStep = currentStep.startsWith("edit_");
  if (isEditStep) {
    // Strip "edit_" prefix to get the base step (e.g. edit_owner_name → owner_name)
    // but "edit_menu" and "edit_duration" need special handling.
    if (currentStep === "edit_menu") {
      // Stay on edit menu — already showing options, nothing to advance
      return;
    }
    if (currentStep === "edit_duration") {
      // After editing duration, show confirmation
      await showConfirmation(context, userId);
      return;
    }
    // For edit_owner_name, edit_owner_pct, edit_start — already handled
    // by their own cases which call showConfirmation directly.
    return;
  }

  const next = stepTransitions[currentStep];

  if (!next) {
    logger.warn("[subrent] promptNextStep: no transition from", { currentStep });
    return;
  }

  switch (next) {
    case "payment":
      await sendComplexMessage({
        botToken: TELEGRAM_BOT_TOKEN,
        chatId: userId,
        text: `💰 Процент собственника (${DEFAULT_OWNER_PERCENTAGE}%):`,
        replyMarkup: JSON.stringify({ inline_keyboard: buildPercentageKeyboard(DEFAULT_OWNER_PERCENTAGE) }),
      });
      break;

    case "price":
      await sendComplexMessage({
        botToken: TELEGRAM_BOT_TOKEN,
        chatId: userId,
        text: `💰 Минимальная суточная стоимость (${DEFAULT_MIN_DAILY_PRICE} ₽):`,
        replyMarkup: JSON.stringify({ inline_keyboard: buildPriceKeyboard(DEFAULT_MIN_DAILY_PRICE) }),
      });
      break;

    case "hourly":
      await sendComplexMessage({
        botToken: TELEGRAM_BOT_TOKEN,
        chatId: userId,
        text: "⏰ Введите почасовые тарифы через пробел (3ч 6ч 12ч) или нажмите 'Пропустить':",
        replyMarkup: JSON.stringify({ inline_keyboard: [[{ text: "⏭ Пропустить", callback_data: "hourly_skip" }]] }),
      });
      break;

    case "seasonal":
      await sendComplexMessage({
        botToken: TELEGRAM_BOT_TOKEN,
        chatId: userId,
        text: "📈 Введите сезонные тарифы (будни выходные) или нажмите 'Пропустить':",
        replyMarkup: JSON.stringify({ inline_keyboard: [[{ text: "⏭ Пропустить", callback_data: "seasonal_skip" }]] }),
      });
      break;

    case "start":
      await sendComplexMessage({
        botToken: TELEGRAM_BOT_TOKEN,
        chatId: userId,
        text: "📅 Введите дату и время начала договора:",
        replyMarkup: JSON.stringify({ inline_keyboard: buildStartKeyboard() }),
      });
      break;

    case "duration":
      if (!context.contractStartDate || !context.contractStartTime) {
        logger.warn("[subrent] promptNextStep: start date missing, showing start prompt again");
        await sendComplexMessage({
          botToken: TELEGRAM_BOT_TOKEN,
          chatId: userId,
          text: "📅 Сначала укажите дату начала:",
          replyMarkup: JSON.stringify({ inline_keyboard: buildStartKeyboard() }),
        });
        context.step = "start";
        await saveState(userId, context);
        return;
      }
      await sendComplexMessage({
        botToken: TELEGRAM_BOT_TOKEN,
        chatId: userId,
        text: "📅 Выберите длительность договора:",
        replyMarkup: JSON.stringify({ inline_keyboard: buildDurationKeyboard() }),
      });
      break;

    case "confirm":
      await showConfirmation(context, userId);
      return; // showConfirmation already saves state
  }

  context.step = next;
  await saveState(userId, context);
}

async function showConfirmation(context: SubrentFlowContext, userId: string): Promise<void> {
  const summary = `
📋 *Проверка данных договора субаренды*

🏍 *Мотоцикл:* ${context.bikeMake} ${context.bikeModel}
${context.bikeVin ? `VIN: ${context.bikeVin}` : ""}
${context.bikePlate ? `Гос. номер: ${context.bikePlate}` : ""}

👤 *Собственник:* ${context.ownerFullName}
Паспорт: ${context.ownerPassportSeries} ${context.ownerPassportNumber}
День рождения: ${context.ownerBirthDate}
Телефон: ${context.ownerPhone}
${context.ownerEmail ? `Email: ${context.ownerEmail}` : ""}

💰 *Условия:*
Процент собственника: ${context.ownerPercentage}%
Мин. суточная цена: ${context.minDailyPrice?.toLocaleString("ru-RU")} ₽
${context.hourly3hPrice ? `Почасово: 3ч=${context.hourly3hPrice}₽ 6ч=${context.hourly6hPrice}₽ 12ч=${context.hourly12hPrice}₽` : ""}
${context.weekdayPrice ? `Сезон: будни=${context.weekdayPrice}₽ выходные=${context.weekendPrice}₽` : ""}

📅 *Период:*
Начало: ${context.contractStartDate} ${context.contractStartTime}
Конец: ${context.contractEndDate} ${context.contractEndTime}
`;

  await sendComplexMessage({
    botToken: TELEGRAM_BOT_TOKEN,
    chatId: userId,
    text: summary,
    parseMode: "Markdown",
    replyMarkup: JSON.stringify({ inline_keyboard: buildConfirmKeyboard() }),
  });

  context.step = "confirm";
  await saveState(userId, context);
}

async function generateAndSendContract(context: SubrentFlowContext, userId: string): Promise<void> {
  try {
    // Validate required fields
    if (!context.contractStartDate || !context.contractStartTime) {
      throw new Error("Missing contract start date or time");
    }

    // Load crew secrets
    const crewId = context.crewId || "default";
    const { data: crewSecrets } = await privateSchema()
      .from("crew_secrets")
      .select("*")
      .eq("crew_slug", crewId)
      .maybeSingle();

    // Generate contract number
    const contractNumber = context.contractNumber || Math.floor(Math.random() * 9000) + 1000;
    const now = new Date();

    // Parse dates
    const [day, month, year] = context.contractStartDate.split('.');
    const [startHour, startMin] = context.contractStartTime.split(':');

    // Build template variables
    // Typed as Record<string, string | number> to satisfy the
    // TemplateVariables contract in docx-capability.ts. All optional
    // context fields get || "" fallbacks so undefined never leaks into
    // the template (where it would render as literal "undefined").
    const variables: Record<string, string | number> = {
      // Contract metadata
      contract_number: String(contractNumber),
      day: day.padStart(2, '0'),
      month_num: month.padStart(2, '0'),
      year: year,

      // Park/crew details
      organization_name: crewSecrets?.organization_name || "Мотосалон ВипБайкЭлектро",
      organization_short: crewSecrets?.organization_short || "ИП Воробьев Р.В.",
      organization_representative: crewSecrets?.organization_representative || "",
      legal_address: crewSecrets?.legal_address || "Комсомольская пл. д.2",
      ogrnip: crewSecrets?.ogrnip || "326527500025145",
      inn: crewSecrets?.inn || "525813643035",
      bank_account: crewSecrets?.bank_account || "40802810942710013083",
      bank_name: crewSecrets?.bank_name || "Волго-Вятский Банк ПАО Сбербанк",
      bank_city: crewSecrets?.bank_city || "г. Нижний Новгород",
      bank_corr_account: crewSecrets?.bank_corr_account || "30101810900000000603",
      email: crewSecrets?.email || "",

      // Owner details
      owner_full_name: context.ownerFullName || "",
      owner_birth_date: context.ownerBirthDate || "",
      owner_passport_series: context.ownerPassportSeries || "",
      owner_passport_number: context.ownerPassportNumber || "",
      owner_passport_issued_by: context.ownerPassportIssuedBy || "",
      owner_passport_issue_date: context.ownerPassportIssueDate || "",
      owner_registration: context.ownerRegistration || "",
      owner_phone: context.ownerPhone || "",
      owner_email: context.ownerEmail || "",

      // Bike details
      bike_make: context.bikeMake || "",
      bike_model: context.bikeModel || "",
      bike_vin: context.bikeVin || "",
      bike_plate: context.bikePlate || "",
      bike_year: context.bikeYear || "",
      bike_value_rub: context.bikeValue || "",
      bike_registration_cert: context.bikeRegistrationCert || "",
      bike_insurance_policy: context.bikeInsurancePolicy || "",

      // Payment terms
      owner_percentage: String(context.ownerPercentage || DEFAULT_OWNER_PERCENTAGE),
      owner_percentage_text: numberToRussianWords(context.ownerPercentage || DEFAULT_OWNER_PERCENTAGE),
      min_daily_price_rub: String(context.minDailyPrice || DEFAULT_MIN_DAILY_PRICE),
      min_daily_price_text: numberToRussianWords(context.minDailyPrice || DEFAULT_MIN_DAILY_PRICE),
      hourly_3h_price_rub: String(context.hourly3hPrice || DEFAULT_HOURLY_PRICES["3h"]),
      hourly_6h_price_rub: String(context.hourly6hPrice || DEFAULT_HOURLY_PRICES["6h"]),
      hourly_12h_price_rub: String(context.hourly12hPrice || DEFAULT_HOURLY_PRICES["12h"]),
      weekday_daily_price_rub: String(context.weekdayPrice || DEFAULT_SEASONAL_PRICES.weekday),
      weekend_daily_price_rub: String(context.weekendPrice || DEFAULT_SEASONAL_PRICES.weekend),
      reporting_period: "неделя",
      payment_deadline_days: String(DEFAULT_REPORTING_DAYS),
      payment_deadline_days_text: "двух",
      late_penalty_percent: String(DEFAULT_LATE_PENALTY_PERCENT),

      // Contract duration
      contract_start_date: context.contractStartDate || "",
      contract_start_time: context.contractStartTime || "",
      contract_end_date: context.contractEndDate || "",
      contract_end_time: context.contractEndTime || "",

      // Deposits and terms
      regular_client_deposit_rub: String(DEFAULT_REGULAR_DEPOSIT),
      regular_client_deposit_text: numberToRussianWords(DEFAULT_REGULAR_DEPOSIT),
      new_client_deposit_rub: String(DEFAULT_NEW_CLIENT_DEPOSIT),
      new_client_deposit_text: numberToRussianWords(DEFAULT_NEW_CLIENT_DEPOSIT),
      daily_km_allowance: String(DEFAULT_KM_ALLOWANCE),
      extra_km_fee_rub: String(DEFAULT_EXTRA_KM_FEE),
      downtime_compensation_daily_rub: String(DEFAULT_DOWNTIME_COMPENSATION),
      downtime_compensation_daily_text: numberToRussianWords(DEFAULT_DOWNTIME_COMPENSATION),

      // Return address (from crew secrets or default)
      return_address: crewSecrets?.return_address || "г. Нижний Новгород, ул. Генкиной 39 А/16 кв 17",

      // Territory
      insurance_territory: crewSecrets?.insurance_territory || "Нижегородской области",
    };

    // Load template
    const templatePath = join(process.cwd(), "docs", "SUBRENTAL_DEAL_TEMPLATE.html");
    const template = readFileSync(templatePath, "utf-8");

    // Generate DOCX
    const docFileName = `subrental-${context.bikeMake}-${context.bikeModel}-${now.toISOString().split("T")[0]}.docx`
      .replace(/[^a-zA-Zа-яА-Я0-9.\-]/g, "-")
      .replace(/-+/g, "-");

    const result = await buildFranchizeDocxFromTemplate({
      integrationScope: "subrent-manual",
      uploadedBy: userId,
      documentKey: `subrent-${contractNumber}-${Date.now()}`,
      fileName: docFileName,
      template: template,
      variables,
      flowType: "subrental",
      templateMode: "html",
    });

    // Send document
    const docBuffer = result.bytes;
    const fileHash = result.sha256 || createHash("sha256").update(docBuffer).digest("hex");

    // --- Upload DOCX to Supabase Storage (rental-contracts bucket) ---
    let storagePath: string | null = null;
    try {
      const contractKey = `subrent-${contractNumber}-${Date.now()}`;
      const uploadResult = await uploadDocxToStorage({
        crewSlug: "vip-bike",
        contractKey,
        buffer: Buffer.from(docBuffer),
        metadata: { source: "subrent-telegram", owner: context.ownerFullName || "" },
      });
      storagePath = uploadResult.storagePath;
      logger.info("[subrent] DOCX uploaded to storage:", storagePath);
    } catch (uploadErr) {
      logger.warn("[subrent] Storage upload failed (non-fatal):", uploadErr);
    }

        // Send document via Telegram (positional args)
    await sendTelegramDocument(String(userId), docBuffer, docFileName);
    
    // Send caption as separate message
    await sendComplexMessage({
      botToken: TELEGRAM_BOT_TOKEN,
      chatId: userId,
      text: `📄 Договор субаренды №${contractNumber}

${context.bikeMake} ${context.bikeModel}
Собственник: ${context.ownerFullName}`,
    });
    // Notify admin
    await notifyAdmin(`📄 Новый договор субаренды\n\nБайк: ${context.bikeMake} ${context.bikeModel}\nСобственник: ${context.ownerFullName}\nПроцент: ${context.ownerPercentage}%`);

    // --- Generate QR code for quick access ---
    let qrPngBuffer = null;
    try {
      const qrDeepLink = `https://t.me/oneBikePlsBot/app?startapp=subrent_${contractNumber}_${fileHash.slice(0, 12)}`;
      const qrPngUrl = `https://api.qrserver.com/v1/create-qr-code/?size=420x420&data=${encodeURIComponent(qrDeepLink)}&color=000000&bgcolor=ffffff`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const qrRes = await fetch(qrPngUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (qrRes.ok) qrPngBuffer = Buffer.from(await qrRes.arrayBuffer());
    } catch (qrErr) {
      logger.warn("[subrent] QR generation failed:", qrErr);
    }

    if (qrPngBuffer) {
      try {
        const formData = new FormData();
        formData.append("chat_id", String(userId));
        formData.append("photo", new Blob([qrPngBuffer], { type: "image/png" }), "qr.png");
        formData.append("caption", `📲 QR для быстрого доступа к договору субаренды №${contractNumber}`);
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, { method: "POST", body: formData });
      } catch (qrSendErr) {
        logger.warn("[subrent] QR send failed:", qrSendErr);
      }
    }

    // --- Save to subrent_contract_artifacts (private schema) ---
    // CRITICAL: schema uses owner_* columns (NOT renter_*), see migration 20260624000000
    try {
      // Dedup by semantic key: same owner + same bike + same start date = duplicate (retry)
      const { data: existingSubrent } = await privateSchema()
        .from("subrent_contract_artifacts")
        .select("id, storage_path")
        .eq("owner_full_name", context.ownerFullName || "")
        .eq("bike_make", context.bikeMake || "")
        .eq("bike_model", context.bikeModel || "")
        .eq("contract_start_date", context.contractStartDate || "")
        .maybeSingle();

      if (existingSubrent) {
        logger.info("[subrent] Duplicate detected (same owner+bike+date), skipping. existing id:", existingSubrent.id);
        if (!existingSubrent.storage_path && storagePath) {
          await privateSchema().from("subrent_contract_artifacts").update({ storage_path: storagePath }).eq("id", existingSubrent.id);
          logger.info("[subrent] Backfilled storage_path on existing artifact");
        }
      } else {
        await privateSchema().from("subrent_contract_artifacts").insert({
          contract_key: `subrent-${contractNumber}-${Date.now()}`,
          storage_path: storagePath,
          original_sha256: fileHash,
          telegram_chat_id: String(userId),
          owner_full_name: context.ownerFullName || null,
          owner_passport_series: context.ownerPassportSeries || null,
          owner_passport_number: context.ownerPassportNumber || null,
          owner_passport_issued_by: context.ownerPassportIssuedBy || null,
          owner_passport_issue_date: context.ownerPassportIssueDate || null,
          owner_birth_date: context.ownerBirthDate || null,
          owner_registration: context.ownerRegistration || null,
          owner_phone: context.ownerPhone || null,
          owner_email: context.ownerEmail || null,
          bike_make: context.bikeMake || null,
          bike_model: context.bikeModel || null,
          bike_vin: context.bikeVin || null,
          bike_plate: context.bikePlate || null,
          bike_year: context.bikeYear || null,
          bike_value_rub: context.bikeValue || null,
          owner_percentage: String(context.ownerPercentage || DEFAULT_OWNER_PERCENTAGE),
          min_daily_price_rub: String(context.minDailyPrice || DEFAULT_MIN_DAILY_PRICE),
          hourly_3h_price_rub: String(context.hourly3hPrice || DEFAULT_HOURLY_PRICES["3h"]),
          hourly_6h_price_rub: String(context.hourly6hPrice || DEFAULT_HOURLY_PRICES["6h"]),
          hourly_12h_price_rub: String(context.hourly12hPrice || DEFAULT_HOURLY_PRICES["12h"]),
          weekday_daily_price_rub: String(context.weekdayPrice || DEFAULT_SEASONAL_PRICES.weekday),
          weekend_daily_price_rub: String(context.weekendPrice || DEFAULT_SEASONAL_PRICES.weekend),
          contract_start_date: context.contractStartDate || null,
          contract_start_time: context.contractStartTime || null,
          contract_end_date: context.contractEndDate || null,
          contract_end_time: context.contractEndTime || null,
          crew_id: context.crewId || null,
          template_version: 1,
        });
        logger.info("[subrent] Contract artifact saved");
      }
    } catch (dbErr) {
      logger.error("[subrent] Failed to save contract artifact:", dbErr);
    }

    // --- Send email notification ---
    // Same TO-priority + DOCX-attachment fix as /doc (see doc-manual.ts for
    // full bug history): env override → crewSecrets.email → underscore fallback.
    // Previously used the nonexistent 'vip-bike@mail.ru' (HYPHEN) fallback.
    try {
      const smtpHost = process.env.SMTP_HOST || process.env.SMTP_YANDEX_HOST;
      const smtpPort = Number(process.env.SMTP_PORT || process.env.SMTP_YANDEX_PORT || 465);
      const smtpUser = process.env.SMTP_USER || process.env.SMTP_YANDEX_USER;
      const smtpPass = process.env.SMTP_PASS || process.env.SMTP_YANDEX_PASS;
      const emailFrom = process.env.EMAIL_FROM || smtpUser;
      const emailTo = process.env.EMAIL_DEFAULT_TO || crewSecrets?.email || "vip_bike@mail.ru";

      if (smtpHost && smtpUser && smtpPass) {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: { user: smtpUser, pass: smtpPass },
        });

        const emailBody = [
          `Договор субаренды №${contractNumber}`,
          ``,
          `Мотоцикл: ${context.bikeMake} ${context.bikeModel}`,
          `Собственник: ${context.ownerFullName}`,
          `Процент собственника: ${context.ownerPercentage}%`,
          `Период: ${context.contractStartDate} ${context.contractStartTime} -- ${context.contractEndDate} ${context.contractEndTime}`,
          ``,
          `Договор сгенерирован в Telegram-боте.`,
          `Документ во вложении.`,
        ].join("\n");

        await transporter.sendMail({
          from: emailFrom,
          to: emailTo,
          subject: `Договор субаренды №${contractNumber} -- ${context.bikeMake} ${context.bikeModel}`,
          text: emailBody,
          attachments: [{
            filename: docFileName,
            content: Buffer.from(docBuffer),
            contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          }],
        });
        logger.info(`[subrent] Email with DOCX sent to ${emailTo}`);
      }
    } catch (emailErr) {
      logger.warn("[subrent] Email send failed (non-fatal):", emailErr);
    }

    // Success message with details (HTML parse mode for safety with user data)
    await sendComplexMessage({
      botToken: TELEGRAM_BOT_TOKEN,
      chatId: userId,
      text: `✅ <b>Договор субаренды №${contractNumber} готов!</b>\n\n🏍 ${context.bikeMake} ${context.bikeModel}\n👤 ${context.ownerFullName}\n💰 ${context.ownerPercentage}%\n\n📧 Копия отправлена на email администратору.`,
      parseMode: "HTML",
    });

  } catch (error) {
    logger.error("[subrent-manual] Generate error:", error);
    await sendComplexMessage({
      botToken: TELEGRAM_BOT_TOKEN,
      chatId: userId,
      text: "❌ Ошибка генерации договора. Попробуйте /subrent заново.",
    });
  }
}
