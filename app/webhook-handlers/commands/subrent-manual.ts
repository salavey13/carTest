// /app/webhook-handlers/commands/subrent-manual.ts
/**
 * /subrent command handler - Bike owner subrental agreement
 * =============================================================================
 *
 * Flow for park to rent bike from owner for commercial subrenting:
 *   1. Bike → select from catalog or enter new
 *   1b. Bike documents (plate / СТС / ОСАГО) — prefilled from specs when known
 *   2. Owner full name
 *   3. Owner passport
 *   4. Owner birth date
 *   5. Owner registration address
 *   6. Owner phone
 *   7. Owner email (optional)
 *   8. Owner percentage (default 50%)
 *   9. Minimum tiered daily prices (1d / 2+d / 3+d — defaults from bike specs)
 *   10. Hourly prices (3h/6h/12h — defaults from bike specs)
 *   11. Seasonal prices (weekday/weekend — defaults from bike specs)
 *   12. Contract start date/time
 *   13. Contract duration (default to Nov 22 seasonal)
 *   14. Confirm
 *   → Generate subrental agreement (contract + Приложение 1/2 acts)
 */

"use server";

import { logger } from "@/lib/logger";
import { supabaseAdmin } from "@/hooks/supabase";
import { sendComplexMessage, KeyboardButton } from "../actions/sendComplexMessage";
import { notifyAdmin, sendTelegramDocument } from "@/app/actions";
import { buildFranchizeDocxFromTemplate, uploadDocxToStorage } from "@/app/franchize/lib/docx-capability";
import { createHash } from "crypto";
import { privateSchema } from "@/lib/private-secrets";
import nodemailer from "nodemailer";
import { getCrewBikes, getAllBikes, loadTemplateForCrew } from "../lib/crew-access";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CURRENT_YEAR = 2026;
const STATE_EXPIRY_MINUTES = 30;

/**
 * Read the selected crew slug from user_states context.
 * Falls back to "vip-bike" if not set.
 */
async function getSubrentCrewSlug(userId: string): Promise<string> {
  try {
    const { data } = await supabaseAdmin
      .from("user_states")
      .select("context")
      .eq("user_id", userId)
      .maybeSingle();
    const selectedCrew = (data?.context as any)?.selectedCrew;
    return selectedCrew || "vip-bike";
  } catch {
    return "vip-bike";
  }
}

// ── Constants ───────────────────────────────────────────────────────────────────

const DEFAULT_OWNER_PERCENTAGE = 50;
const DEFAULT_MIN_DAILY_PRICE = 9000;
/** Fallback tier prices when the bike has no specs rent tiers (paper-contract
 *  pattern: 8000/7000/6000 per the Yamaha R7 reference agreement). */
const DEFAULT_MIN_PRICES = { tier1: 9000, tier2: 8000, tier3: 7000 };
const DEFAULT_HOURLY_PRICES = { "3h": 6000, "6h": 7000, "12h": 8000 };
const DEFAULT_SEASONAL_PRICES = { weekday: 14000, weekend: 16000 };
const DEFAULT_REGULAR_DEPOSIT = 10000;
const DEFAULT_NEW_CLIENT_DEPOSIT = 20000;
const DEFAULT_KM_ALLOWANCE = 200;
const DEFAULT_EXTRA_KM_FEE = 30;
const DEFAULT_DOWNTIME_COMPENSATION = 4000;
const DEFAULT_REPORTING_DAYS = 2;
const DEFAULT_LATE_PENALTY_PERCENT = 0.2;

/** Catalog specs defaults for an existing bike (rent tiers, hourly, seasonal). */
interface BikeSpecDefaults {
  tier1?: number;
  tier2?: number;
  tier3?: number;
  hourly3h?: number;
  hourly6h?: number;
  hourly12h?: number;
  weekday?: number;
  weekend?: number;
}

const toNum = (v: unknown): number | undefined => {
  const n = parseInt(String(v ?? "").replace(/\D/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

/** Coerce a JSONB spec value to a trimmed string ("" for missing/non-scalar). */
const toSpecStr = (v: unknown): string =>
  typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "";

function extractBikeSpecDefaults(specs: Record<string, unknown> | null | undefined): BikeSpecDefaults {
  const s = specs ?? {};
  return {
    tier1: toNum(s.dailyPrice) ?? toNum(s.price_per_day),
    tier2: toNum(s["rent_2-4d"]) ?? toNum(s.rent_2_4d) ?? toNum(s["rent_5-10d"]) ?? toNum(s.rent_5_10d),
    tier3: toNum(s.rent_11_30d) ?? toNum(s["rent_5-10d"]) ?? toNum(s.rent_5_10d),
    hourly3h: toNum(s.price_per_3h),
    hourly6h: toNum(s.price_per_6h),
    hourly12h: toNum(s.price_per_12h),
    weekday: toNum(s.rent_weekday),
    weekend: toNum(s.rent_weekend),
  };
}

/** "Молев Георгий Анатольевич" → "Молев Г.А." — signature-line initials. */
function formatInitials(fullName: string | undefined): string {
  const parts = (fullName || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  const surname = parts[0];
  const initials = parts.slice(1).map((p) => (p[0] ? `${p[0].toUpperCase()}.` : "")).join("");
  return initials ? `${surname} ${initials}` : surname;
}

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

function buildPriceKeyboard(defaults: { tier1: number; tier2: number; tier3: number }): KeyboardButton[][] {
  return [
    [{ text: `✅ Тарифы каталога: ${defaults.tier1} / ${defaults.tier2} / ${defaults.tier3} ₽`, callback_data: "price_default" }],
    [{ text: "✏️ Свои тарифы", callback_data: "price_custom" }],
    [{ text: "❌ Отменить", callback_data: "cancel" }],
  ];
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

  // Catalog-derived price defaults (from cars.specs of the selected bike)
  specDefaults?: BikeSpecDefaults;

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
  /** Owner's Telegram chat id — set when the operator provides it; enables
   *  automatic specs.subrenter_chat_id marking after contract generation. */
  ownerTelegramId?: string;

  // Payment terms
  ownerPercentage?: number;
  minDailyPrice?: number;
  min2plusPrice?: number;
  min3plusPrice?: number;
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

async function getAvailableBikes(crewSlug?: string): Promise<any[]> {
  if (crewSlug) {
    return await getCrewBikes(crewSlug);
  }
  return await getAllBikes();
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
      const bikes = await getAvailableBikes(crewId || await getSubrentCrewSlug(userId));

      await sendComplexMessage({
        botToken: TELEGRAM_BOT_TOKEN,
        chatId: userId,
        text: `🏍 *Субаренда мотоцикла в парк* (1/9)\n\nВыберите мотоцикл, который собственник передаёт в аренду вашему парку:`,
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
    case "owner_tg_skip":
      // Skip the owner-telegram step — no auto-marking; the operator can
      // assign the subrenter later via the admin panel (specs.subrenter_chat_id).
      if (context.step === "owner_tg") {
        context.ownerTelegramId = undefined;
        await promptNextStep(context, userId);
      } else {
        await sendComplexMessage({ botToken: TELEGRAM_BOT_TOKEN, chatId: userId, text: "ℹ️ Кнопка неактуальна — /subrent заново, если нужно." });
      }
      break;

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
          text: `📝 ${isEditMode ? "Изменить" : "Субаренда мотоцикла в парк (2/9)"} данные мотоцикла:\n\n*Марка Модель*\n_Yamaha R7_\n\n*VIN*\n_JYA2... (17 символов)_\n\n*Гос. номер*\n_А123БВ777_\n\n*Год*\n_2023_\n\n*Стоимость (₽)*\n_500000_\n\n*СТС*\n_99 87 356594_\n\n*Полис ОСАГО*\n_ХХХ 0659225087_\n\n📋 Каждое поле с новой строки (последние два можно оставить пустыми):`,
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

          // POLISH (iter12): prefill bike data from catalog specs — the doc's
          // §2.1 table needs VIN / год / оценочная стоимость, and specs carries
          // them (specs.vin, specs.year, specs.price_rub). Previously only
          // make/model were copied and the contract shipped with empty rows.
          const specs = (bike.specs ?? {}) as Record<string, unknown>;
          context.bikeVin = toSpecStr(specs.vin) || context.bikeVin || "";
          context.bikeYear = toSpecStr(specs.year) || context.bikeYear || "";
          context.bikeValue = toSpecStr(specs.price_rub) || context.bikeValue || "";
          context.bikePlate = toSpecStr(specs.plate) || context.bikePlate || "";
          context.bikeRegistrationCert = toSpecStr(specs.registration_cert) || context.bikeRegistrationCert || "";
          context.bikeInsurancePolicy = toSpecStr(specs.insurance_policy) || context.bikeInsurancePolicy || "";
          context.specDefaults = extractBikeSpecDefaults(specs);

          // FIX: edit_bike — after selecting a new bike, go back to confirmation
          if (context.step === "edit_bike") {
            await showConfirmation(context, userId);
          } else if (!context.bikePlate || !context.bikeRegistrationCert || !context.bikeInsurancePolicy) {
            // Документы байка (гос. номер / СТС / ОСАГО) нужны для §2.1
            // договора и Приложения №1 — спрашиваем только недостающие.
            const known = [
              context.bikePlate ? `Гос. номер: ${context.bikePlate}` : null,
              context.bikeRegistrationCert ? `СТС: ${context.bikeRegistrationCert}` : null,
              context.bikeInsurancePolicy ? `ОСАГО: ${context.bikeInsurancePolicy}` : null,
            ].filter(Boolean);
            await sendComplexMessage({
              botToken: TELEGRAM_BOT_TOKEN,
              chatId: userId,
              text: `📄 *Субаренда мотоцикла в парк* (3/9)\n\nДанные для договора (каждое поле с новой строки, лишние можно оставить пустыми):\n\n*Гос. номер*\n_3323BE52_\n\n*СТС (свидетельство о регистрации)*\n_99 87 356594_\n\n*Полис ОСАГО*\n_ХХХ 0659225087_${known.length ? `\n\nУже известно:\n${known.join("\n")}` : ""}`,
              parseMode: "Markdown",
            });
            context.step = "bike_docs";
            await saveState(userId, context);
          } else {
            await sendComplexMessage({
              botToken: TELEGRAM_BOT_TOKEN,
              chatId: userId,
              text: `✅ *Субаренда мотоцикла в парк* (4/9)\n\nВыбран: *${bike.make} ${bike.model}*\nVIN: ${context.bikeVin || "—"}\n\n👤 Введите ФИО собственника (полностью):`,
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
          text: "💰 Введите минимальные суточные тарифы за 1 сутки / 2+ суток / 3+ суток (через пробел):",
        });
        context.step = "price_custom";
        await saveState(userId, context);
      } else if (value === "default") {
        // Тарифы каталога — one tap instead of typing three numbers.
        const d = context.specDefaults ?? {};
        const t1 = d.tier1 ?? DEFAULT_MIN_PRICES.tier1;
        const t2 = d.tier2 ?? DEFAULT_MIN_PRICES.tier2;
        const t3 = d.tier3 ?? DEFAULT_MIN_PRICES.tier3;
        context.minDailyPrice = t1;
        context.min2plusPrice = t2;
        context.min3plusPrice = t3;
        await promptNextStep(context, userId);
      } else {
        // Legacy single-price callbacks (price_9000) still accepted.
        const price = parseInt(value);
        if (!isNaN(price) && price > 0) {
          context.minDailyPrice = price;
          context.min2plusPrice = Math.max(1000, Math.round(price * 0.9));
          context.min3plusPrice = Math.max(1000, Math.round(price * 0.8));
          await promptNextStep(context, userId);
        }
      }
      break;

    case "hourly":
      if (value === "skip") {
        context.hourly3hPrice = DEFAULT_HOURLY_PRICES["3h"];
        context.hourly6hPrice = DEFAULT_HOURLY_PRICES["6h"];
        context.hourly12hPrice = DEFAULT_HOURLY_PRICES["12h"];
        await promptNextStep(context, userId);
      } else if (value === "default") {
        // Почасовые из каталога (specs.price_per_3h/6h/12h).
        const d = context.specDefaults ?? {};
        context.hourly3hPrice = d.hourly3h ?? DEFAULT_HOURLY_PRICES["3h"];
        context.hourly6hPrice = d.hourly6h ?? DEFAULT_HOURLY_PRICES["6h"];
        context.hourly12hPrice = d.hourly12h ?? DEFAULT_HOURLY_PRICES["12h"];
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
      } else if (value === "default") {
        // Сезонные тарифы из каталога (specs.rent_weekday / rent_weekend).
        const d = context.specDefaults ?? {};
        context.weekdayPrice = d.weekday ?? DEFAULT_SEASONAL_PRICES.weekday;
        context.weekendPrice = d.weekend ?? DEFAULT_SEASONAL_PRICES.weekend;
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
        const bikes = await getAvailableBikes(context.crewId || await getSubrentCrewSlug(userId));
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
        // POLISH (iter12): СТС и ОСАГО — строки 6 и 7 (необязательные).
        context.bikeRegistrationCert = bikeLines[6] || "";
        context.bikeInsurancePolicy = bikeLines[7] || "";
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

    case "bike_docs":
      // Гос. номер / СТС / ОСАГО — по одному в строке. Пустая строка сохраняет
      // уже известное значение (или оставляет поле пустым в договоре).
      {
        const docLines = text.split('\n').map(l => l.trim());
        const plate = docLines[0] || context.bikePlate || "";
        const sts = docLines[1] || context.bikeRegistrationCert || "";
        const osago = docLines[2] || context.bikeInsurancePolicy || "";
        context.bikePlate = plate;
        context.bikeRegistrationCert = sts;
        context.bikeInsurancePolicy = osago;
        await sendComplexMessage({
          botToken: TELEGRAM_BOT_TOKEN,
          chatId: userId,
          text: `✅ Данные байка сохранены\nГос. номер: ${plate || "—"}\nСТС: ${sts || "—"}\nОСАГО: ${osago || "—"}\n\n👤 Введите ФИО собственника (полностью):`,
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
        text: `📄 *Субаренда мотоцикла в парк* (5/9)\n\nВведите паспортные данные:\n\n*Серия Номер*\n_4509 123456_\n\n*Дата выдачи*\n_15.03.2020_\n\n*Кем выдано*\n_ОМВД по Н.Новгороду_\n\n📋 Пример в одну строку:\n_4509 123456 15.03.2020 ОМВД по Н.Новгороду_`,
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
          text: `📅 *Субаренда мотоцикла в парк* (6/9)\n\nВведите дату рождения собственника:\n\n*ДД.ММ.ГГГГ*\n_01.01.1990_`,
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
          text: `🏠 *Субаренда мотоцикла в парк* (7/9)\n\nВведите адрес регистрации собственника:\n\n_г. Нижний Новгород, ул. Примерная, д. 1, кв. 1_`,
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
        text: `📱 *Субаренда мотоцикла в парк* (8/9)\n\nВведите телефон собственника:\n\n_+7 (999) 123-45-67_`,
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

    case "owner_tg": {
      const tgId = text.replace(/\D/g, "");
      if (tgId.length < 5) {
        await sendComplexMessage({
          botToken: TELEGRAM_BOT_TOKEN,
          chatId: userId,
          text: "ℹ️ ID выглядит как число (обычно 9-10 цифр). Введите числовой ID собственника или нажмите 'Пропустить'.",
          replyMarkup: JSON.stringify({ inline_keyboard: [[{ text: "⏭ Пропустить", callback_data: "owner_tg_skip" }]] }),
        });
        return;
      }
      context.ownerTelegramId = tgId;
      await promptNextStep(context, userId);
      break;
    }

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

    case "price_custom": {
      // Tiered minimum daily prices: 1 сутки / 2+ суток / 3+ суток (one line,
      // space-separated) — mirrors §5.1.1 of the reference paper contract.
      const nums = text.split(/\s+/).map(n => parseInt(n.replace(/\D/g, '')));
      const valid = nums.filter(n => !isNaN(n) && n > 0);
      if (valid.length >= 3) {
        [context.minDailyPrice, context.min2plusPrice, context.min3plusPrice] = valid;
        await sendComplexMessage({
          botToken: TELEGRAM_BOT_TOKEN,
          chatId: userId,
          text: "⏰ Введите почасовые тарифы через пробел (3ч 6ч 12ч) или нажмите 'Пропустить':",
          replyMarkup: JSON.stringify({ inline_keyboard: [[{ text: "⏭ Пропустить", callback_data: "hourly_skip" }]] }),
        });
        context.step = "hourly";
        await saveState(userId, context);
      } else if (valid.length === 1) {
        // Single value typed — derive tiers with the usual −10%/−20% steps.
        context.minDailyPrice = valid[0];
        context.min2plusPrice = Math.max(1000, Math.round(valid[0] * 0.9));
        context.min3plusPrice = Math.max(1000, Math.round(valid[0] * 0.8));
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
          text: "❌ Введите 3 числа через пробел (1 сутки / 2+ суток / 3+ суток), например: 10000 9000 7000",
        });
      }
      break;
    }

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
        const typedPrices = text.split(/\s+/).map(n => parseInt(n.replace(/\D/g, ''))).filter(n => !isNaN(n) && n > 0);
        if (typedPrices.length >= 3) {
          [context.minDailyPrice, context.min2plusPrice, context.min3plusPrice] = typedPrices;
          context.step = "price";
          await promptNextStep(context, userId);
          return;
        }
        if (typedPrices.length === 1) {
          context.minDailyPrice = typedPrices[0];
          context.min2plusPrice = Math.max(1000, Math.round(typedPrices[0] * 0.9));
          context.min3plusPrice = Math.max(1000, Math.round(typedPrices[0] * 0.8));
          context.step = "price";
          await promptNextStep(context, userId);
          return;
        }
        const d = context.specDefaults ?? {};
        await sendComplexMessage({
          botToken: TELEGRAM_BOT_TOKEN,
          chatId: userId,
          text: `ℹ️ Введите 3 числа через пробел (1 сутки / 2+ суток / 3+ суток) или выберите кнопку:`,
          replyMarkup: JSON.stringify({
            inline_keyboard: buildPriceKeyboard({
              tier1: d.tier1 ?? DEFAULT_MIN_PRICES.tier1,
              tier2: d.tier2 ?? DEFAULT_MIN_PRICES.tier2,
              tier3: d.tier3 ?? DEFAULT_MIN_PRICES.tier3,
            }),
          }),
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
    ask_email: "owner_tg",
    owner_email: "owner_tg",
    owner_tg: "payment",
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
    case "owner_tg":
      await sendComplexMessage({
        botToken: TELEGRAM_BOT_TOKEN,
        chatId: userId,
        text: "📲 Telegram собственника: введите его числовой ID (можно узнать у него или через @userinfobot).\n\nЕсли укажете — после генерации договора байк автоматически получит отметку субаренды (specs.subrenter_chat_id) и собственник увидит аренды своего байка в приложении.",
        replyMarkup: JSON.stringify({ inline_keyboard: [[{ text: "⏭ Пропустить", callback_data: "owner_tg_skip" }]] }),
      });
      break;

    case "payment":
      await sendComplexMessage({
        botToken: TELEGRAM_BOT_TOKEN,
        chatId: userId,
        text: `💰 Процент собственника (${DEFAULT_OWNER_PERCENTAGE}%):`,
        replyMarkup: JSON.stringify({ inline_keyboard: buildPercentageKeyboard(DEFAULT_OWNER_PERCENTAGE) }),
      });
      break;

    case "price": {
      const d = context.specDefaults ?? {};
      const t1 = d.tier1 ?? DEFAULT_MIN_PRICES.tier1;
      const t2 = d.tier2 ?? DEFAULT_MIN_PRICES.tier2;
      const t3 = d.tier3 ?? DEFAULT_MIN_PRICES.tier3;
      await sendComplexMessage({
        botToken: TELEGRAM_BOT_TOKEN,
        chatId: userId,
        text: `💰 Минимальные суточные тарифы за 1 сутки / 2+ суток / 3+ суток (₽):`,
        replyMarkup: JSON.stringify({ inline_keyboard: buildPriceKeyboard({ tier1: t1, tier2: t2, tier3: t3 }) }),
      });
      break;
    }

    case "hourly": {
      const d = context.specDefaults ?? {};
      const h3 = d.hourly3h ?? DEFAULT_HOURLY_PRICES["3h"];
      const h6 = d.hourly6h ?? DEFAULT_HOURLY_PRICES["6h"];
      const h12 = d.hourly12h ?? DEFAULT_HOURLY_PRICES["12h"];
      const kb: KeyboardButton[][] = [[{ text: "⏭ Пропустить", callback_data: "hourly_skip" }]];
      if (d.hourly3h || d.hourly6h || d.hourly12h) {
        kb.unshift([{ text: `✅ Из каталога: ${h3} / ${h6} / ${h12} ₽`, callback_data: "hourly_default" }]);
      }
      await sendComplexMessage({
        botToken: TELEGRAM_BOT_TOKEN,
        chatId: userId,
        text: "⏰ Введите почасовые тарифы через пробел (3ч 6ч 12ч) или нажмите 'Пропустить':",
        replyMarkup: JSON.stringify({ inline_keyboard: kb }),
      });
      break;
    }

    case "seasonal": {
      const d = context.specDefaults ?? {};
      const wd = d.weekday ?? DEFAULT_SEASONAL_PRICES.weekday;
      const we = d.weekend ?? DEFAULT_SEASONAL_PRICES.weekend;
      const kb: KeyboardButton[][] = [[{ text: "⏭ Пропустить", callback_data: "seasonal_skip" }]];
      if (d.weekday || d.weekend) {
        kb.unshift([{ text: `✅ Из каталога: будни ${wd} / выходные ${we} ₽`, callback_data: "seasonal_default" }]);
      }
      await sendComplexMessage({
        botToken: TELEGRAM_BOT_TOKEN,
        chatId: userId,
        text: "📈 Введите сезонные тарифы (будни выходные) или нажмите 'Пропустить':",
        replyMarkup: JSON.stringify({ inline_keyboard: kb }),
      });
      break;
    }

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
${context.bikeRegistrationCert ? `СТС: ${context.bikeRegistrationCert}` : ""}
${context.bikeInsurancePolicy ? `ОСАГО: ${context.bikeInsurancePolicy}` : ""}
${context.bikeValue ? `Оценочная стоимость: ${context.bikeValue} ₽` : ""}

👤 *Собственник:* ${context.ownerFullName}
Паспорт: ${context.ownerPassportSeries} ${context.ownerPassportNumber}
День рождения: ${context.ownerBirthDate}
Телефон: ${context.ownerPhone}
${context.ownerEmail ? `Email: ${context.ownerEmail}` : ""}
${context.ownerTelegramId ? `Telegram ID: ${context.ownerTelegramId} ✅ субарендатор будет назначен автоматически` : "Telegram ID: не указан (отметку субаренды можно поставить в админке)"}

💰 *Условия:*
Процент собственника: ${context.ownerPercentage}%
Мин. тарифы: 1 сут ${(context.minDailyPrice ?? DEFAULT_MIN_PRICES.tier1).toLocaleString("ru-RU")} ₽ / 2+ сут ${(context.min2plusPrice ?? DEFAULT_MIN_PRICES.tier2).toLocaleString("ru-RU")} ₽ / 3+ сут ${(context.min3plusPrice ?? DEFAULT_MIN_PRICES.tier3).toLocaleString("ru-RU")} ₽
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

    // Load crew secrets (Арендатор side). FIX (iter12): private.crew_secrets
    // stores contract data inside the contract_defaults JSONB with camelCase
    // keys — the previous direct `crewSecrets?.organization_short` accesses
    // hit nonexistent columns and silently always used hardcoded fallbacks.
    const resolvedCrewSlug = context.crewId || (await getSubrentCrewSlug(userId)) || "vip-bike";
    let crewCd: Record<string, any> = {};
    try {
      const { data: crewSecretsRow } = await privateSchema()
        .from("crew_secrets")
        .select("contract_defaults")
        .eq("crew_slug", resolvedCrewSlug)
        .maybeSingle();
      if (crewSecretsRow?.contract_defaults) {
        crewCd =
          typeof crewSecretsRow.contract_defaults === "string"
            ? JSON.parse(crewSecretsRow.contract_defaults)
            : crewSecretsRow.contract_defaults;
      }
    } catch (secretsErr) {
      logger.warn("[subrent] crew_secrets load failed, using fallbacks:", secretsErr);
    }
    const pick = (v: unknown, fallback: string): string =>
      typeof v === "string" && v.trim() ? v.trim() : fallback;
    const crew = {
      organization_name: pick(crewCd.organizationName, "Мотосалон ВипБайкЭлектро"),
      organization_short: pick(crewCd.organizationShort, "ИП Воробьев Р.В."),
      organization_representative: pick(crewCd.organizationRepresentative, ""),
      legal_address: pick(crewCd.legalAddress, "г. Нижний Новгород, пл. Комсомольская 2"),
      ogrnip: pick(crewCd.ogrnip, "326527500025145"),
      inn: pick(crewCd.inn, "525813643035"),
      bank_account: pick(crewCd.bankAccount, "40802810942710013083"),
      bank_name: pick(crewCd.bankName, "Волго-Вятский Банк ПАО Сбербанк"),
      bank_city: pick(crewCd.bankCity, "г. Нижний Новгород"),
      bank_corr_account: pick(crewCd.bankCorrAccount, "30101810900000000603"),
      email: pick(crewCd.email, ""),
      organization_phone: pick(crewCd.phone ?? crewCd.organizationPhone, ""),
      organization_initials:
        formatInitials(pick(crewCd.issuerName, "")) || pick(crewCd.organizationShort, ""),
      return_address: pick(crewCd.returnAddress, "г. Нижний Новгород, пл. Комсомольская 2"),
    };

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
      organization_name: crew.organization_name,
      organization_short: crew.organization_short,
      organization_representative: crew.organization_representative,
      legal_address: crew.legal_address,
      ogrnip: crew.ogrnip,
      inn: crew.inn,
      bank_account: crew.bank_account,
      bank_name: crew.bank_name,
      bank_city: crew.bank_city,
      bank_corr_account: crew.bank_corr_account,
      email: crew.email,
      organization_phone: crew.organization_phone,
      organization_initials: crew.organization_initials,

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
      owner_initials: formatInitials(context.ownerFullName),

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
      min_daily_price_rub: String(context.minDailyPrice || DEFAULT_MIN_PRICES.tier1),
      min_daily_price_text: numberToRussianWords(context.minDailyPrice || DEFAULT_MIN_PRICES.tier1),
      min_2plus_daily_price_rub: String(context.min2plusPrice || DEFAULT_MIN_PRICES.tier2),
      min_2plus_daily_price_text: numberToRussianWords(context.min2plusPrice || DEFAULT_MIN_PRICES.tier2),
      min_3plus_daily_price_rub: String(context.min3plusPrice || DEFAULT_MIN_PRICES.tier3),
      min_3plus_daily_price_text: numberToRussianWords(context.min3plusPrice || DEFAULT_MIN_PRICES.tier3),
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
      return_address: crew.return_address,

      // Territory
      insurance_territory: pick(crewCd.insuranceTerritory, "Нижегородской области"),
    };

    // Load template — check crew-specific first
    const template = loadTemplateForCrew("subrental", resolvedCrewSlug);

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
        crewSlug: resolvedCrewSlug,
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
    await notifyAdmin(`📄 Новый договор субаренды\n\nБайк: ${context.bikeMake} ${context.bikeModel}\nСобственник: ${context.ownerFullName}\nПроцент: ${context.ownerPercentage}%${context.ownerTelegramId ? `\nTelegram: ${context.ownerTelegramId} (автоназначение субарендатора)` : ""}`);

    // ── POLISH (iter14): auto-mark the bike as SUBRENTED (specs.subrenter_chat_id)
    // so the catalog-first → subrent-via-specs chain completes in ONE flow.
    // Only possible when: the operator selected an EXISTING catalog bike
    // (context.bikeId) AND provided the owner's Telegram id. Otherwise the
    // admin-panel path stays available.
    if (context.ownerTelegramId && context.bikeId) {
      try {
        const sbMod = await import("@/lib/supabase-server");
        const sb = sbMod.supabaseAdmin;
        const { data: carRow } = await sb.from("cars").select("id, specs").eq("id", context.bikeId).maybeSingle();
        if (carRow?.id) {
          const currentSpecs = (carRow.specs && typeof carRow.specs === "object" ? carRow.specs : {}) as Record<string, unknown>;
          const { error: markError } = await sb
            .from("cars")
            .update({ specs: { ...currentSpecs, subrenter_chat_id: context.ownerTelegramId } })
            .eq("id", context.bikeId);
          if (markError) {
            logger.warn("[subrent] auto-mark subrenter failed:", markError.message);
            await sendComplexMessage({
              botToken: TELEGRAM_BOT_TOKEN,
              chatId: userId,
              text: "⚠️ Не удалось автоматически назначить субарендатора — поставьте отметку в админ-панели (Субарендаторы).",
            });
          } else {
            await sendComplexMessage({
              botToken: TELEGRAM_BOT_TOKEN,
              chatId: userId,
              text: `✅ Байк отмечен как субарендный: specs.subrenter_chat_id = ${context.ownerTelegramId}\n\nСобственник теперь видит аренды своего байка в приложении и получает уведомления.`,
            });
            // Notify the partner he got mini-admin access (mirrors setBikeSubrenterAction)
            try {
              await sendComplexMessage({
                botToken: TELEGRAM_BOT_TOKEN,
                chatId: context.ownerTelegramId,
                text: `🏍 Ваш байк передан в парк «${resolvedCrewSlug}»\n\n${context.bikeMake} ${context.bikeModel}\nДоговор субаренды №${contractNumber} сформирован.\n\nОткрывайте приложение бота — в профиле появился раздел «Мои байки в парке» с арендами вашего мотоцикла.`,
              });
            } catch (partnerNotifyErr) {
              logger.warn("[subrent] partner notify failed (non-fatal):", partnerNotifyErr);
            }
          }
        }
      } catch (markErr) {
        logger.warn("[subrent] auto-mark subrenter threw (non-fatal):", markErr);
      }
    }

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
      // Dedup by semantic key: same owner + same bike + same start date = duplicate (retry).
      // FIX (iter12): the table has NO crew_slug column (crew_id stores the
      // slug) — the old filter errored silently on every call, so the dedup
      // never matched and every retry inserted a duplicate artifact row.
      const { data: existingSubrent } = await privateSchema()
        .from("subrent_contract_artifacts")
        .select("id, storage_path")
        .eq("crew_id", resolvedCrewSlug)
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
        // Base insert: columns that existed since the 20260624 migration.
        // Tiered min prices (min_2plus/min_3plus) come from a newer migration —
        // if it is not applied yet, PostgREST rejects the whole insert with
        // PGRST204, so we retry once without the new columns.
        const baseArtifact: Record<string, unknown> = {
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
          bike_registration_cert: context.bikeRegistrationCert || null,
          bike_insurance_policy: context.bikeInsurancePolicy || null,
          owner_percentage: String(context.ownerPercentage || DEFAULT_OWNER_PERCENTAGE),
          min_daily_price_rub: String(context.minDailyPrice || DEFAULT_MIN_PRICES.tier1),
          hourly_3h_price_rub: String(context.hourly3hPrice || DEFAULT_HOURLY_PRICES["3h"]),
          hourly_6h_price_rub: String(context.hourly6hPrice || DEFAULT_HOURLY_PRICES["6h"]),
          hourly_12h_price_rub: String(context.hourly12hPrice || DEFAULT_HOURLY_PRICES["12h"]),
          weekday_daily_price_rub: String(context.weekdayPrice || DEFAULT_SEASONAL_PRICES.weekday),
          weekend_daily_price_rub: String(context.weekendPrice || DEFAULT_SEASONAL_PRICES.weekend),
          contract_start_date: context.contractStartDate || null,
          contract_start_time: context.contractStartTime || null,
          contract_end_date: context.contractEndDate || null,
          contract_end_time: context.contractEndTime || null,
          crew_id: resolvedCrewSlug || null,
          template_version: 2,
        };
        const tieredArtifact = {
          ...baseArtifact,
          min_2plus_daily_price_rub: String(context.min2plusPrice || DEFAULT_MIN_PRICES.tier2),
          min_3plus_daily_price_rub: String(context.min3plusPrice || DEFAULT_MIN_PRICES.tier3),
        };
        let insertError = await privateSchema()
          .from("subrent_contract_artifacts")
          .insert(tieredArtifact)
          .then(({ error }: { error: unknown }) => error);
        if (insertError) {
          // Migration with tiered columns not applied yet — retry with the
          // base column set so the artifact is never lost.
          logger.warn("[subrent] tiered insert failed, retrying without min_2plus/min_3plus:", insertError);
          insertError = await privateSchema()
            .from("subrent_contract_artifacts")
            .insert(baseArtifact)
            .then(({ error }: { error: unknown }) => error);
        }
        if (insertError) throw insertError;
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
      const emailTo = process.env.EMAIL_DEFAULT_TO || crew.email || "vip_bike@mail.ru";

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
