// /app/webhook-handlers/commands/doc-manual.ts
/**
 * /doc command handler - SMART MANUAL VERSION (supports both RENT and SALE)
 * =============================================================================
 *
 * PHILOSOPHY: Maximum simplicity, minimum input.
 * - Current year = 2026 (don't ask for it!)
 * - Smart parsers that assume current year for issue dates
 * - No warranty for used bikes (sell as-is)
 * - Inline keyboards only where genuinely useful
 *
 * Flow (RENT) - 10 steps:
 *   1. Full name → "Иванов Иван Иванович"
 *   2. Passport → "4509 123456 15.03.2020 ОМВД"
 *   3. Birth → "15.03.1990" (year needed here)
 *   4. Address → free text
 *   5. Has license? → inline keyboard (Yes/No)
 *   6. License → "99 76 123456 15.03 15.03" (dates assume 2026!) — skipped if no license
 *   7. Categories → inline keyboard — skipped if no license
 *   8. Start → "сегодня 18" or inline keyboard
 *   9. End → "завтра 10" or inline keyboard
 *  10. Deposit choice → inline keyboard (Confirm / Override / Swap with СТС)
 *      └─ if "Swap with СТС" chosen: 6 mini-steps to collect СТС fields,
 *         then back to confirm. The cash deposit is replaced by the
 *         renter's vehicle СТС held in pledge (see migration
 *         20260617000000_rental_sts_pledge.sql and
 *         /skills/rental-contract-from-photos/SKILL.md §"СТС-вместо-депозита").
 *   → Done!
 *
 * Flow (SALE) - 5 steps:
 *   1. Full name
 *   2. Passport → "4509 123456 15.03 ОМВД"
 *   3. Birth → "15.03.1990"
 *   4. Address → free text
 *   5. Price → inline keyboard or "390000"
 *   → Done!
 */

"use server";

import { logger } from "@/lib/logger";
import { supabaseAdmin } from "@/hooks/supabase";
import { sendComplexMessage, KeyboardButton } from "../actions/sendComplexMessage";
import { notifyAdmin, sendTelegramDocument } from "@/app/actions";
import { deriveUserAccessTier, getAccessTierLabel } from "@/app/lib/derive-access-tier";
import type { AccessTier } from "@/app/lib/ocr-constants";
import { buildFranchizeDocxFromTemplate } from "@/app/franchize/lib/docx-capability";
import { createHash } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";
import { convertTextDateToTimestamp, resolveCrewOwnerChatId } from "@/lib/rental-date-utils";
import { buildRentalContractVariables, type CrewSecrets as RentalCrewSecrets } from "@/app/lib/rental-contract-vars";
import { privateSchema } from "@/lib/private-secrets";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CURRENT_YEAR = 2026; // 👍 Fixed current year
const DOC_STATE_EXPIRY_MINUTES = 30;

// ── Constants (minimal inline keyboards) ─────────────────────────────────────
// Simplified: we only care about A, B (M included), or no license. C/C1 ignored.

const CATEGORIES = ["A", "B", "нет"]; // B includes M (49cc scooters), A for full bikes
const TIME_SLOTS = ["10:00", "12:00", "14:00", "16:00", "18:00", "20:00"];
// Dynamic prices fetched from Supabase at runtime

// ── Keyboard builders (only where useful) ─────────────────────────────────────

/**
 * Build simplified category keyboard: A, B (includes M), or no license
 * M is implicitly included in B category for 49cc scooters
 */
function buildCategoryKeyboard(selected: string[] = []): KeyboardButton[][] {
  const rows: KeyboardButton[][] = [];

  // Single row with 3 options
  rows.push([
    { text: `A ${selected.includes("A") ? "✅" : "⭕"}`, callback_data: "c_A" },
    { text: `B ${selected.includes("B") ? "✅" : "⭕"}`, callback_data: "c_B" },
    { text: `Нет прав ${selected.includes("нет") ? "✅" : "⭕"}`, callback_data: "c_нет" },
  ]);

  rows.push([
    { text: "✓ Готово", callback_data: "cdone" },
    { text: "❌ Отменить", callback_data: "cancel" },
  ]);
  return rows;
}

/**
 * Build dynamic price keyboard from actual Supabase bike prices
 * Each bike price gets ±10% variants for negotiation flexibility
 */
function buildPriceKeyboard(): Promise<Array<Array<KeyboardButton>>> {
  return (async () => {
    try {
    const { data: bikes } = await supabaseAdmin
      .from("cars")
      .select("id, make, model, specs")
      .eq("type", "bike")
      .order("id");

    if (!bikes?.length) return [[{ text: "✏️ Своя цена", callback_data: "p_custom" }]];

    // Extract unique sale prices from bikes
    const priceMap = new Map<number, string>(); // price -> bike name
    for (const bike of bikes) {
      const price = bike.specs?.sale_price;
      if (price && price > 0) {
        const key = Math.round(price / 1000) * 1000; // Round to nearest 1000
        const name = `${bike.make} ${bike.model}`;
        if (!priceMap.has(key) || name.length < priceMap.get(key)!.length) {
          priceMap.set(key, name);
        }
      }
    }

    // Sort prices and create keyboard with ±10% variants
    const sortedPrices = Array.from(priceMap.entries()).sort((a, b) => a[0] - b[0]);
    const rows: KeyboardButton[][] = [];

    for (const [price, bikeName] of sortedPrices) {
      const base = Math.round(price / 1000) * 1000;
      const low = Math.round(base * 0.9 / 1000) * 1000;
      const high = Math.round(base * 1.1 / 1000) * 1000;

      // Create variants for this price range
      const variants = [low, base, high].filter((v, i, arr) => arr.indexOf(v) === i);
      const variantText = variants.length > 1
        ? `${variants[0].toLocaleString('ru-RU')}–${variants[variants.length-1].toLocaleString('ru-RU')}k`
        : `${base.toLocaleString('ru-RU')}k`;

      rows.push([{
        text: `${variantText} ₽ (${bikeName})`,
        callback_data: `p_${base}`,
      }]);
    }

    // Add custom option at the end
    rows.push([{ text: "✏️ Своя цена", callback_data: "p_custom" }]);
    return rows;
  } catch (error) {
    logger.error("[buildPriceKeyboard] Failed:", error);
    // Fallback to basic prices
    return [
      [{ text: "100 000 ₽", callback_data: "p_100000" }],
      [{ text: "265 000 ₽", callback_data: "p_265000" }],
      [{ text: "390 000 ₽", callback_data: "p_390000" }],
      [{ text: "550 000 ₽", callback_data: "p_550000" }],
      [{ text: "750 000 ₽", callback_data: "p_750000" }],
      [{ text: "✏️ Своя цена", callback_data: "p_custom" }],
    ];
  }
  })();
}

function buildDealKeyboard(): KeyboardButton[][] {
  return [[
    { text: "📋 Аренда", callback_data: "d_rent" },
    { text: "💰 Продажа", callback_data: "d_sale" },
  ]];
}

function buildStartKeyboard(): KeyboardButton[][] {
  const now = new Date();
  const currentHour = now.getHours();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const fmt = (d: Date) => `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}`;

  const rows: KeyboardButton[][] = [];

  // Smart defaults based on current time
  if (currentHour < 14) {
    rows.push([
      { text: "📅 Сегодня 18:00", callback_data: "s_today_1800" },
    ]);
  } else if (currentHour < 20) {
    rows.push([
      { text: "📅 Сегодня 20:00", callback_data: "s_today_2000" },
    ]);
  }

  rows.push([
    { text: `📅 Завтра 10:00`, callback_data: "s_tomorrow_1000" },
    { text: `📅 Завтра 18:00`, callback_data: "s_tomorrow_1800" },
  ]);

  rows.push([
    { text: "✏️ Свое время", callback_data: "s_custom" },
  ]);

  return rows;
}

/**
 * Build end-date keyboard — defaults to same time as start
 * If startTime is "15:30", shows "Завтра 15:30" and "Послезавтра 15:30"
 */
function buildEndKeyboard(startTime?: string): KeyboardButton[][] {
  const timeLabel = startTime || "10:00";
  // Encode time as HHMM for callback_data (e.g. "15:30" → "1530")
  const timeCode = timeLabel.replace(":", "");

  return [
    [
      { text: `📅 Завтра ${timeLabel}`, callback_data: `e_tomorrow_${timeCode}` },
      { text: `📅 Послезавтра ${timeLabel}`, callback_data: `e_2days_${timeCode}` },
    ],
    [
      { text: "📅 Завтра 10:00", callback_data: "e_tomorrow_1000" },
    ],
    [
      { text: "✏️ Свое время", callback_data: "e_custom" },
    ],
  ];
}

function buildHasLicenseKeyboard(): KeyboardButton[][] {
  return [
    [
      { text: "✅ Да", callback_data: "hl_yes" },
      { text: "❌ Нет", callback_data: "hl_no" },
    ],
  ];
}

function buildConfirmKeyboard(): KeyboardButton[][] {
  return [
    [
      { text: "✅ Всё верно", callback_data: "ok" },
      { text: "↩️ Начать заново", callback_data: "restart" },
    ],
    [{ text: "❌ Отменить", callback_data: "cancel" }],
  ];
}

/**
 * Build deposit-choice keyboard — 3 options:
 *   1. Confirm the bike's spec.deposit_rub as cash deposit
 *   2. Override with custom cash amount (free text input)
 *   3. Swap cash deposit for renter's own vehicle СТС in pledge
 *
 * @param depositAmount Cash deposit amount pulled from bike.specs.deposit_rub (or fallback "20000")
 * @param bike          Bike object (for context in the confirm button label)
 */
function buildDepositChoiceKeyboard(depositAmount: string, bike?: any): KeyboardButton[][] {
  const amount = Number(depositAmount) || 20000;
  const formatted = amount.toLocaleString("ru-RU");
  const bikeLabel = bike ? ` (${bike.make} ${bike.model})` : "";
  return [
    [{ text: `✅ Депозит ${formatted} ₽${bikeLabel}`, callback_data: "dep_confirm" }],
    [{ text: `✏️ Своя сумма`, callback_data: "dep_custom" }],
    [{ text: `🪪 СТС вместо депозита`, callback_data: "dep_sts" }],
    [{ text: "❌ Отменить", callback_data: "cancel" }],
  ];
}

/**
 * СТС-owner-relation enum codes. We use short ASCII enum codes in
 * callback_data instead of raw Cyrillic for two reasons:
 *   1. Telegram callback_data has a 64-byte limit — Cyrillic chars are 2
 *      UTF-8 bytes each, so "sr_сам арендатор" already eats 32 bytes; a
 *      longer relation like "sr_доверенность представителя по нотариальной"
 *      would blow the limit.
 *   2. Avoids the URI-encoding roundtrip — `decodeURIComponent` on data
 *      that was never percent-encoded is a no-op for valid input, but
 *      THROWS URIError if the data contains a literal `%` (which Russian
 *      users won't type in a relation, but the principle is wrong).
 * The label map below is the single source of truth for button text and
 * the human-readable string stored in context.stsOwnerRelation.
 */
const STS_RELATION_LABELS: Record<string, string> = {
  self: "сам арендатор",
  wife: "жена",
  husband: "муж",
  father: "отец",
  mother: "мать",
  son: "сын",
  daughter: "дочь",
  brother: "брат",
  sister: "сестра",
  power_of_attorney: "доверенность",
  custom: "другое (ввести)",
};

/**
 * Build СТС-owner-relation keyboard — quick-pick common relations.
 * The renter can also type a free-text relation (handled in handleDocText).
 */
function buildStsRelationKeyboard(): KeyboardButton[][] {
  const r = (code: string) => `sr_${code}`;
  const label = (code: string) => STS_RELATION_LABELS[code] || code;
  return [
    [
      { text: `🧑 ${label("self")}`, callback_data: r("self") },
      { text: `👨‍👩‍👧 ${label("wife")}`, callback_data: r("wife") },
    ],
    [
      { text: `👨 ${label("father")}`, callback_data: r("father") },
      { text: `👩 ${label("mother")}`, callback_data: r("mother") },
    ],
    [
      { text: `📄 ${label("power_of_attorney")}`, callback_data: r("power_of_attorney") },
      { text: `✏️ ${label("custom")}`, callback_data: r("custom") },
    ],
    [{ text: "❌ Отменить", callback_data: "cancel" }],
  ];
}

/**
 * Build "skip optional field" keyboard for СТС sub-flow.
 * Used for sts_vehicle and sts_vin which are optional.
 */
function buildStsSkipKeyboard(): KeyboardButton[][] {
  return [
    [{ text: "⏭ Пропустить", callback_data: "sts_skip" }],
    [{ text: "❌ Отменить", callback_data: "cancel" }],
  ];
}

// ── State type ─────────────────────────────────────────────────────────────

interface DocFlowContext {
  dealType: "rent" | "sale";
  bikeId: string;
  bikeMake?: string;
  bikeModel?: string;
  mpFullName?: string;
  mpSeries?: string;
  mpNumber?: string;
  mpIssueDate?: string;
  mpIssuedBy?: string;
  mpBirthDate?: string;
  mpRegistration?: string;
  mlFullName?: string;
  mlSeries?: string;
  mlNumber?: string;
  mlIssueDate?: string;
  mlExpiryDate?: string;
  mlCategories?: string[];
  mlAccessTier?: AccessTier;
  rentStartDate?: string;
  rentStartTime?: string;
  rentEndDate?: string;
  rentEndTime?: string;
  salePrice?: string;
  // ── СТС-вместо-депозита (added 2026-06-17) ────────────────────────────────
  // When stsPledgeUsed=true, the cash deposit is replaced by the renter's
  // own vehicle СТС held in pledge (see migration 20260617000000_rental_sts_pledge.sql
  // and /skills/rental-contract-from-photos/SKILL.md §"СТС-вместо-депозита").
  stsPledgeUsed?: boolean;
  stsSeries?: string;          // e.g. "77"
  stsNumber?: string;          // e.g. "12345678"
  stsIssueDate?: string;       // e.g. "15.05.2023" (optional)
  stsVehiclePlate?: string;    // e.g. "А123БВ77" — REQUIRED
  stsVehicleVin?: string;      // e.g. "XTA12345678901234" (optional)
  stsVehicleModel?: string;    // e.g. "Toyota Camry" (optional but recommended)
  stsVehicleYear?: string;     // e.g. "2021" (optional)
  stsOwnerFullName?: string;   // e.g. "Иванов Иван Иванович" — REQUIRED (default = renter)
  stsOwnerRegistration?: string; // e.g. "г. Москва, ул. ..." (optional)
  stsOwnerRelation?: string;   // e.g. "сам арендатор" (default), "жена", "отец", "доверенность"
  stsPledgeReturnDays?: number; // default 3
  depositAmountSkipped?: string; // cash deposit that was replaced by СТС (for analytics)
  depositOverride?: string;     // if user picked "own amount" instead of bike.specs.deposit_rub
}

// ── Bike resolution ─────────────────────────────────────────────────────

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
    .order("make", { ascending: true })
    .limit(20);
  return (data || []);
}

// ── Smart parsers (current year = 2026) ─────────────────────────────────────

/**
 * Parse "4509 123456 15.03.2020 ОМВД по Н.Новгороду"
 * Year is required — passports issued in various years
 */
function parsePassport(text: string): { series: string; number: string; issueDate: string; issuedBy: string } | null {
  const parts = text.trim().split(/\s+/);
  if (parts.length < 3) return null;

  // Find series (4 digits) and number (6 digits)
  let series = "", number = "", dateIdx = -1;
  for (let i = 0; i < parts.length; i++) {
    const cleaned = parts[i].replace(/\D/g, '');
    if (!series && cleaned.length === 4) series = cleaned;
    else if (!number && cleaned.length === 6) number = cleaned;
    else if (dateIdx === -1 && /^\d{1,2}\.\d{1,2}(\.\d{2,4})?$/.test(parts[i])) dateIdx = i;
  }

  if (!series || !number || dateIdx === -1) return null;

  let dateStr = parts[dateIdx];
  const parts2 = dateStr.split('.');
  if (parts2.length === 2) {
    // No year provided — reject, year is required for passport issue date
    return null;
  }
  // Normalize 2-digit year → 4-digit
  if (parts2[2].length === 2) {
    const y = parseInt(parts2[2]);
    parts2[2] = y > 50 ? `19${y}` : `20${y}`;
    dateStr = parts2.join('.');
  }

  const issuedBy = parts.slice(dateIdx + 1).join(' ') || "не указано";
  return { series, number, issueDate: dateStr, issuedBy };
}

/**
 * Parse "99 76 123456 15.03 15.03.2028" or "99 76 123456 15.03" (single date)
 * Dates without year → issue=2026, expiry=issue+10 years
 * Expiry date is optional: if only one date provided, it's treated as issue date
 * and expiry is automatically calculated as +10 years from issue date
 */
function parseLicense(text: string): { series: string; number: string; issueDate: string; expiryDate: string } | null {
  const parts = text.trim().split(/\s+/);
  if (parts.length < 3) return null;

  let series = "", number = "";
  const dates: string[] = [];

  for (let i = 0; i < parts.length; i++) {
    const cleaned = parts[i].replace(/\D/g, '');
    if (!series && cleaned.length === 2) series = cleaned;
    else if (!number && cleaned.length === 6) number = cleaned;
    else if (/^\d{1,2}\.\d{1,2}(\.\d{2,4})?$/.test(parts[i])) {
      let d = parts[i];
      if (!d.includes('.')) continue;
      const parts2 = d.split('.');
      if (parts2.length === 2) d += `.${CURRENT_YEAR}`;
      else if (parts2[2].length === 2) {
        const y = parseInt(parts2[2]);
        parts2[2] = y > 50 ? `19${y}` : `20${y}`;
        d = parts2.join('.');
      }
      dates.push(d);
    }
  }

  if (!series || !number || dates.length < 1) return null;

  // If only one date provided, it's the issue date; calculate expiry as +10 years
  let [issue, expiry] = dates;
  if (dates.length === 1) {
    issue = dates[0];
    const [d, m, y] = issue.split('.');
    expiry = `${d}.${m}.${parseInt(y) + 10}`;
  } else {
    // Two dates provided: issue and expiry
    // If both are same and current year, make expiry 10 years later
    if (issue === expiry && issue.endsWith(`.${CURRENT_YEAR}`)) {
      const [d, m, y] = issue.split('.');
      expiry = `${d}.${m}.${parseInt(y) + 10}`;
    }
  }

  return { series, number, issueDate: issue, expiryDate: expiry };
}

/**
 * Parse "15.03.1990" or "15.03" (but keep year for birth!)
 */
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

// ── Schedule parsers ─────────────────────────────────────────────────────────

/**
 * Decode callback_data time format to HH:MM
 * Supports: "1800" → "18:00", "10" → "10:00", "1530" → "15:30"
 */
function decodeCallbackTime(raw: string): string {
  if (/^\d{4}$/.test(raw)) {
    // HHMM format: "1530" → "15:30"
    return `${raw.slice(0, 2)}:${raw.slice(2)}`;
  }
  // Just hour: "18" → "18:00"
  return `${raw.padStart(2, '0')}:00`;
}

/**
 * Parse start date only: "сегодня 18", "завтра 10:00", "15.06 18", "15.06.2026 20:00"
 * Returns only the start date/time — the end is asked in a separate step
 */
function parseStartDate(text: string): { date: string; time: string } | null {
  const t = text.trim().toLowerCase();
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const formatDate = (d: Date) => `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;

  // "сегодня 18" or "сегодня 18:00"
  const todayMatch = t.match(/сегодня\s+(\d{1,2})(:(\d{2}))?/);
  if (todayMatch) {
    const hour = todayMatch[1].padStart(2, '0');
    const min = todayMatch[3] || '00';
    return { date: formatDate(today), time: `${hour}:${min}` };
  }

  // "завтра 10" or "завтра 10:00"
  const tomorrowMatch = t.match(/завтра\s+(\d{1,2})(:(\d{2}))?/);
  if (tomorrowMatch) {
    const hour = tomorrowMatch[1].padStart(2, '0');
    const min = tomorrowMatch[3] || '00';
    return { date: formatDate(tomorrow), time: `${hour}:${min}` };
  }

  // "15.06 18" or "15.06.2026 18:00"
  const dateMatch = t.match(/(\d{1,2})\.(\d{1,2})(\.(\d{2,4}))?\s+(\d{1,2})(:(\d{2}))?/);
  if (dateMatch) {
    let [, d, m, , y, h, , min] = dateMatch;
    const year = y ? (y.length === 2 ? (parseInt(y) > 50 ? `19${y}` : `20${y}`) : y) : CURRENT_YEAR;
    const hour = h.padStart(2, '0');
    const minute = min || '00';
    return { date: `${d.padStart(2,'0')}.${m.padStart(2,'0')}.${year}`, time: `${hour}:${minute}` };
  }

  return null;
}

/**
 * Parse end date only: "завтра 10", "послезавтра 10", "16.06 10", "16.06.2026 10:00"
 * startDate is the rent start date (DD.MM.YYYY) used to resolve relative dates
 */
function parseEndDate(text: string, startDate?: string): { date: string; time: string } | null {
  const t = text.trim().toLowerCase();
  const today = new Date();

  // Resolve start date for relative calculations
  let startRef = new Date(today);
  if (startDate) {
    const sp = startDate.split('.');
    if (sp.length === 3) startRef = new Date(`${sp[2]}-${sp[1]}-${sp[0]}`);
  }

  const formatDate = (d: Date) => `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;

  // "завтра 10" or "завтра 10:00" — relative to start date
  const tomorrowMatch = t.match(/завтра\s+(\d{1,2})(:(\d{2}))?/);
  if (tomorrowMatch) {
    const hour = tomorrowMatch[1].padStart(2, '0');
    const min = tomorrowMatch[3] || '00';
    const d = new Date(startRef);
    d.setDate(startRef.getDate() + 1);
    return { date: formatDate(d), time: `${hour}:${min}` };
  }

  // "послезавтра 10"
  const dayAfterMatch = t.match(/послезавтра\s+(\d{1,2})(:(\d{2}))?/);
  if (dayAfterMatch) {
    const hour = dayAfterMatch[1].padStart(2, '0');
    const min = dayAfterMatch[3] || '00';
    const d = new Date(startRef);
    d.setDate(startRef.getDate() + 2);
    return { date: formatDate(d), time: `${hour}:${min}` };
  }

  // "16.06 10" or "16.06.2026 10:00"
  const dateMatch = t.match(/(\d{1,2})\.(\d{1,2})(\.(\d{2,4}))?\s+(\d{1,2})(:(\d{2}))?/);
  if (dateMatch) {
    let [, d, m, , y, h, , min] = dateMatch;
    const year = y ? (y.length === 2 ? (parseInt(y) > 50 ? `19${y}` : `20${y}`) : y) : CURRENT_YEAR;
    const hour = h.padStart(2, '0');
    const minute = min || '00';
    return { date: `${d.padStart(2,'0')}.${m.padStart(2,'0')}.${year}`, time: `${hour}:${minute}` };
  }

  // "16.06" without time → default 10:00
  const dateOnlyMatch = t.match(/^(\d{1,2})\.(\d{1,2})(\.(\d{2,4}))?$/);
  if (dateOnlyMatch) {
    let [, d, m, , y] = dateOnlyMatch;
    const year = y ? (y.length === 2 ? (parseInt(y) > 50 ? `19${y}` : `20${y}`) : y) : CURRENT_YEAR;
    return { date: `${d.padStart(2,'0')}.${m.padStart(2,'0')}.${year}`, time: '10:00' };
  }

  return null;
}

/**
 * Build rent summary for confirmation — works with or without license,
 * and shows either the cash deposit or the СТС pledge depending on
 * context.stsPledgeUsed.
 */
function buildRentSummary(context: DocFlowContext): string {
  const hasLicense = context.mlSeries && context.mlNumber;
  const lines = [
    "*📋 Проверьте: *",
    "",
    `👤 ${context.mpFullName}`,
    `🪪 ${context.mpSeries} ${context.mpNumber} от ${context.mpIssueDate}`,
    `📅 ${context.mpBirthDate}`,
  ];
  if (hasLicense) {
    lines.push("", `🚗 ВУ: ${context.mlSeries} ${context.mlNumber} (${(context.mlCategories || []).join(", ")})`);
  }
  lines.push(
    "",
    `📅 ${context.rentStartDate} ${context.rentStartTime} → ${context.rentEndDate} ${context.rentEndTime}`,
  );

  // ── Collateral line: cash deposit OR СТС pledge ──
  if (context.stsPledgeUsed) {
    const owner = context.stsOwnerFullName || context.mpFullName || "";
    const relation = context.stsOwnerRelation || "сам арендатор";
    lines.push(
      "",
      `🪪 СТС в залоге: ${context.stsSeries || ""} № ${context.stsNumber || ""}`,
      `🚗 ТС: ${context.stsVehicleModel || ""} ${context.stsVehiclePlate || ""}${context.stsVehicleYear ? ` (${context.stsVehicleYear} г.в.)` : ""}${context.stsVehicleVin ? `\n   VIN: ${context.stsVehicleVin}` : ""}`,
      `👤 Собственник: ${owner}${relation !== "сам арендатор" ? ` (${relation})` : ""}`,
    );
  } else {
    const deposit = context.depositOverride || "20000";
    lines.push("", `💰 Депозит: ${Number(deposit).toLocaleString("ru-RU")} ₽`);
  }

  lines.push("", "Всё верно?");
  return lines.join("\n");
}

// ── СТС parsers (rent only, СТС-вместо-депозита flow) ─────────────────────────

/**
 * Parse СТС series + number.
 * Accepted formats:
 *   "77 12345678"        → series=77, number=12345678
 *   "77 № 12345678"      → series=77, number=12345678
 *   "7712 345678"        → series=7712 (4-digit), number=345678 (6-digit) — legacy
 * The Russian СТС has a series of 2 digits (region code) and a 10-digit number
 * since 2018, but pre-2018 documents used 4-digit series. We accept both.
 */
function parseStsSeriesNumber(text: string): { series: string; number: string } | null {
  const t = text.trim().replace(/^sts/i, "").trim();
  // Remove decorative № sign and any non-alphanumeric separators except spaces
  const cleaned = t.replace(/[№]/g, " ").replace(/\s+/g, " ").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;

  // Find first pure-digit token as series (2 or 4 digits), next as number
  let series = "", number = "";
  for (const p of parts) {
    const digits = p.replace(/\D/g, "");
    if (!digits) continue;
    if (!series && (digits.length === 2 || digits.length === 4)) {
      series = digits;
    } else if (!number && digits.length >= 6 && digits.length <= 10) {
      number = digits;
    }
    if (series && number) break;
  }
  if (!series || !number) return null;
  return { series, number };
}

/**
 * Parse Russian vehicle plate, e.g. "А123БВ77" or "А123ВВ 77".
 * Validates the standard format: Letter(1-2) Digits(3) Letters(2) Region(2-3)
 */
function parseStsPlate(text: string): string | null {
  const t = text.trim().toUpperCase().replace(/\s+/g, "");
  // Standard Russian plate format: A123BC77 (1 letter + 3 digits + 2 letters + 2-3 digit region)
  const m = t.match(/^([АВЕКМНОРСТУХABEKMHOPCTYX])\d{3}([АВЕКМНОРСТУХABEKMHOPCTYX]{2})(\d{2,3})$/);
  if (m) return t;
  // Allow trailing RUS suffix or trailing 77 RUS
  const m2 = t.match(/^([АВЕКМНОРСТУХABEKMHOPCTYX])\d{3}([АВЕКМНОРСТУХABEKMHOPCTYX]{2})(\d{2,3})RUS?$/);
  if (m2) return t.replace(/RUS?$/i, "");
  // Trailer / moto format: 2 letters + 4 digits + region (e.g. АБ1234 77)
  const m3 = t.match(/^([АВЕКМНОРСТУХABEKMHOPCTYX]{2})\d{4}(\d{2,3})$/);
  if (m3) return t;
  return null;
}

/**
 * Parse СТС vehicle model + optional year from free text.
 * Accepted:
 *   "Toyota Camry"          → { model: "Toyota Camry", year: "" }
 *   "Toyota Camry 2021"     → { model: "Toyota Camry", year: "2021" }
 *   "Honda CBR 600 2018"    → { model: "Honda CBR 600", year: "2018" }
 */
function parseStsVehicle(text: string): { model: string; year: string } | null {
  const t = text.trim();
  if (!t) return null;
  const m = t.match(/^(.+?)\s+(19\d{2}|20\d{2})\s*$/);
  if (m) return { model: m[1].trim(), year: m[2] };
  return { model: t, year: "" };
}

/**
 * Parse VIN (17 chars, Latin letters + digits, no I/O/Q).
 * Returns uppercased VIN or null if format is invalid.
 */
function parseStsVin(text: string): string | null {
  const t = text.trim().toUpperCase().replace(/\s+/g, "");
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(t)) return null;
  return t;
}

// ── Contract generation ─────────────────────────────────────────────────────

/**
 * Load crew secrets from private.crew_secrets for the given crew_slug.
 * Returns contract defaults with fallbacks for vip-bike.
 */
/**
 * Load crew secrets for contract defaults.
 * Returns RentalCrewSecrets type compatible with buildRentalContractVariables.
 */
async function loadCrewSecrets(crewSlug: string = "vip-bike"): Promise<RentalCrewSecrets> {
  try {
    const { data: secretsData } = await supabaseAdmin
      .from("crew_secrets")
      .select("contract_defaults")
      .eq("crew_slug", crewSlug)
      .maybeSingle();

    let contractDefaults: Record<string, any> = {};
    if (secretsData?.contract_defaults) {
      contractDefaults = typeof secretsData.contract_defaults === "string"
        ? JSON.parse(secretsData.contract_defaults)
        : secretsData.contract_defaults;
    }

    // Extract contract defaults with fallbacks - matching RentalCrewSecrets shape
    const secrets: RentalCrewSecrets = {
      organizationName: contractDefaults.organizationName || "Мотосалон ВипБайкЭлектро",
      organizationShort: contractDefaults.organizationShort || "ИП Воробьев Р.В.",
      ogrnip: contractDefaults.ogrnip || "326527500025145",
      inn: contractDefaults.inn || "525813643035",
      bankAccount: contractDefaults.bankAccount || "40802810942710013083",
      bankName: contractDefaults.bankName || "Волго-Вятский Банк ПАО Сбербанк",
      bankCity: contractDefaults.bankCity || "г. Нижний Новгород",
      bankCorrAccount: contractDefaults.bankCorrAccount || "30101810900000000603",
      email: contractDefaults.email || "vip_bike@mail.ru",
      legalAddress: contractDefaults.legalAddress || "г. Нижний Новгород, пл. Комсомольская 2",
      issuerName: contractDefaults.issuerName || "Воробьев Р.В.",
      signatoryRole: contractDefaults.signatoryRole || "Менеджер Мотосалона",
      organizationRepresentative: contractDefaults.organizationRepresentative || "ИП Воробьев Р.В.",
      issuerRepresentative: contractDefaults.issuerRepresentative || "Сидоров Илья Олегович",
      returnAddress: contractDefaults.returnAddress || "Н. Н. пл. Комсомольская 2",
      contractDefaults,
    };
    return secrets;
  } catch (error) {
    logger.warn("[/doc] Failed to load crew_secrets, using fallbacks:", error);
    // Return fallback values matching RentalCrewSecrets shape
    const fallbackDefaults: RentalCrewSecrets = {
      organizationName: "Мотосалон ВипБайкЭлектро",
      organizationShort: "ИП Воробьев Р.В.",
      organizationRepresentative: "ИП Воробьев Р.В.",
      issuerRepresentative: "Сидоров Илья Олегович",
      ogrnip: "326527500025145",
      inn: "525813643035",
      bankAccount: "40802810942710013083",
      bankName: "Волго-Вятский Банк ПАО Сбербанк",
      bankCity: "г. Нижний Новгород",
      bankCorrAccount: "30101810900000000603",
      email: "vip_bike@mail.ru",
      legalAddress: "г. Нижний Новгород, пл. Комсомольская 2",
      issuerName: "Воробьев Р.В.",
      signatoryRole: "Менеджер Мотосалона",
      returnAddress: "Н. Н. пл. Комсомольская 2",
    };
    return { ...fallbackDefaults, contractDefaults: {} };
  }
}

/**
 * Create a rentals row when /doc command generates a rental contract.
 * Mirrors the skill script logic for unified rental tracking.
 *
 * @param chatId - Telegram chat ID
 * @param userId - User ID (chat_id as string)
 * @param context - DocFlowContext with rental details
 * @param bike - Bike object from catalog
 * @param docSha256 - SHA256 hash of generated document
 * @returns The rental_id UUID, or null if failed
 */
async function createRentalFromDocContract(
  chatId: number,
  userId: string,
  context: DocFlowContext,
  bike: any,
  docSha256: string
): Promise<string | null> {
  try {
    // Convert TEXT dates to TIMESTAMPTZ
    const startDateIso = context.rentStartDate && context.rentStartTime
      ? convertTextDateToTimestamp(context.rentStartDate, context.rentStartTime, 3)
      : null;

    const endDateIso = context.rentEndDate && context.rentEndTime
      ? convertTextDateToTimestamp(context.rentEndDate, context.rentEndTime, 3)
      : null;

    if (!startDateIso || !endDateIso) {
      logger.error('[/doc] Date conversion failed', { startDateIso, endDateIso });
      return null;
    }

    // Calculate total cost from daily price × duration
    // Always round up to full days for simplicity
    const dailyPrice = Number(bike.specs?.dailyPrice || bike.specs?.rent_weekday || '10000');
    const start = new Date(startDateIso);
    const end = new Date(endDateIso);
    const hours = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60) * 10) / 10;
    const days = Math.max(1, Math.ceil(hours / 24));
    const totalCost = dailyPrice * days;  // Simplified: always charge full days

    // Resolve crew owner for placeholder user_id
    // Fail if crew owner cannot be resolved - don't fall back to renter
    const crewOwnerChatId = await resolveCrewOwnerChatId(supabaseAdmin, bike.crew_id);
    if (!crewOwnerChatId) {
      logger.error('[/doc] No crew owner found for crew_id:', bike.crew_id);
      return null;
    }

    // Create rentals row
    const { data: rental, error: rentalError } = await supabaseAdmin
      .from('rentals')
      .insert({
        user_id: crewOwnerChatId,
        owner_id: crewOwnerChatId,
        vehicle_id: bike.id,
        requested_start_date: startDateIso,
        requested_end_date: endDateIso,
        agreed_start_date: startDateIso,
        agreed_end_date: endDateIso,
        status: 'active',
        payment_status: 'fully_paid',
        total_cost: Math.round(totalCost),
        metadata: {
          source: 'doc_command',
          daily_price: dailyPrice,
          created_by: 'doc-manual',
        },
      })
      .select('rental_id')
      .maybeSingle();

    if (rentalError) {
      logger.error('[/doc] Failed to create rental:', rentalError);
      return null;
    }

    if (!rental?.rental_id) {
      logger.error('[/doc] No rental_id returned');
      return null;
    }

    logger.info('[/doc] Created rental:', rental.rental_id);
    return rental.rental_id;
  } catch (error) {
    logger.error('[/doc] Rental creation exception:', error);
    return null;
  }
}

async function generateContract(chatId: number, userId: string, context: DocFlowContext): Promise<boolean> {
  try {
    const bike = await resolveBikeById(context.bikeId);
    if (!bike) {
      await sendComplexMessage(chatId, "🚨 Байк не найден. Попробуйте /doc", [], { removeKeyboard: true });
      return false;
    }

    // Load crew secrets for contract defaults
    const crewSecrets = await loadCrewSecrets();

    const isElectric = bike.type === "ebike" || /электро|electric|e-bike|ebike/i.test(String(bike.specs?.type || bike.specs?.fuel_type || ""));
    const isRent = context.dealType === "rent";
    const now = new Date();

    let vars: Record<string, string>;

    if (isRent) {
      // Use shared builder for rental contracts
      vars = buildRentalContractVariables({
        renter: {
          fullName: context.mpFullName || "",
          birthDate: context.mpBirthDate || "",
          phone: "",
          email: "",
          passportSeries: context.mpSeries,
          passportNumber: context.mpNumber,
          passportIssueDate: context.mpIssueDate,
          passportIssuedBy: context.mpIssuedBy,
          registration: context.mpRegistration,
          address: context.mpRegistration,
          driverLicenseSeries: context.mlSeries,
          driverLicenseNumber: context.mlNumber,
        },
        bike: {
          id: bike.id,
          make: bike.make,
          model: bike.model,
          type: bike.type,
          specs: bike.specs,
        },
        period: {
          startDate: context.rentStartDate || "",
          startTime: context.rentStartTime || "18:00",
          endDate: context.rentEndDate || "",
          endTime: context.rentEndTime || "10:00",
          depositOverride: context.depositOverride ? Number(context.depositOverride) : undefined,
        },
        crewSecrets,
        stsPledge: {
          used: context.stsPledgeUsed || false,
          series: context.stsSeries,
          number: context.stsNumber,
          issueDate: context.stsIssueDate,
          vehiclePlate: context.stsVehiclePlate,
          vehicleVin: context.stsVehicleVin,
          vehicleModel: context.stsVehicleModel,
          vehicleYear: context.stsVehicleYear,
          ownerFullName: context.stsOwnerFullName,
          ownerRegistration: context.stsOwnerRegistration,
          ownerRelation: context.stsOwnerRelation,
          pledgeReturnDays: context.stsPledgeReturnDays,
        },
        meta: {
          signatureTimestamp: now.toLocaleString("ru-RU"),
          signatureFingerprint: "manual-telegram-doc",
          renterSignature: "согласие через Telegram",
          documentKey: `rental-${bike.id}-${Date.now()}`,
          appendixDate: `${String(now.getDate()).padStart(2,'0')}.${String(now.getMonth()+1).padStart(2,'0')}.${now.getFullYear()}`,
        },
      });
    } else {
      // Sale contract still uses manual construction (TODO: could be extracted too)
      const salePrice = context.salePrice || String(bike.specs?.sale_price || bike.specs?.price_rub || "390000");
      vars = {
        contract_number: `${now.getDate()}.${now.getMonth() + 1}/${bike.id}`,
        day: String(now.getDate()).padStart(2, "0"),
        month: now.toLocaleString("ru-RU", { month: "long" }),
        month_num: String(now.getMonth() + 1).padStart(2, "0"),
        year: String(now.getFullYear()),
        contract_day: String(now.getDate()),
        contract_month_genitive: now.toLocaleString("ru-RU", { month: "long" }),
        contract_year: String(now.getFullYear()),
        appendix_date: `${String(now.getDate()).padStart(2,'0')}.${String(now.getMonth()+1).padStart(2,'0')}.${now.getFullYear()}`,
        buyer_full_name: context.mpFullName || "",
        buyer_short_name: context.mpFullName?.split(' ').map((n, i) => i === 0 ? n : `${n[0]}.`).join(' ') || "",
        buyer_birth_date: context.mpBirthDate || "",
        buyer_passport_number: `${context.mpSeries || ""} ${context.mpNumber || ""}`.trim(),
        buyer_passport_issued_by: context.mpIssuedBy || "",
        buyer_passport_issue_date: context.mpIssueDate || "",
        buyer_registration: context.mpRegistration || "",
        buyer_email: "",
        product_name: isElectric ? "Электромотоцикл" : "Мотоцикл",
        product_color: bike.specs?.color || "уточняется",
        product_type: bike.specs?.bike_subtype || (isElectric ? "Электромотоцикл" : "Мотоцикл"),
        product_motor_type: isElectric ? "Электрический двигатель" : "ДВС",
        product_motor_power: bike.specs?.power_kw ? `${bike.specs.power_kw} кВт` : (bike.specs?.engine_cc ? `рабочий объем ${bike.specs.engine_cc} куб.см` : ""),
        product_vin: bike.specs?.vin || bike.specs?.frame || "уточняется",
        product_year: String(bike.specs?.year || "уточняется"),
        product_unit: "шт.",
        spec_number: `${now.getDate()}.${now.getMonth() + 1}/${bike.id}`,
        seller_address: crewSecrets.legalAddress,
        lessor_address: crewSecrets.legalAddress,
        issuer_name: crewSecrets.issuerName,
        issuer_signatory: crewSecrets.signatoryRole || "Менеджер",
        issuer_representative: crewSecrets.organizationRepresentative || crewSecrets.issuerRepresentative || crewSecrets.issuerName,
        organization_name: crewSecrets.organizationName,
        organization_short: crewSecrets.organizationShort,
        ogrnip: crewSecrets.ogrnip,
        inn: crewSecrets.inn,
        bank_account: crewSecrets.bankAccount,
        bank_name: crewSecrets.bankName,
        bank_city: crewSecrets.bankCity,
        bank_corr_account: crewSecrets.bankCorrAccount,
        email: crewSecrets.email,
        legal_address: crewSecrets.legalAddress,
        signature_timestamp: now.toLocaleString("ru-RU"),
        signature_fingerprint: "manual-telegram-doc",
        renter_signature: "согласие через Telegram",
        price_digits: salePrice,
        price_words: numberToWords(Number(salePrice)),
        price_digits_table: salePrice.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1 ') + ",00",
        warranty_months: "0", // Sold "as-is", no warranty
        document_key: `sale-${bike.id}-${Date.now()}`,
        bike_make: bike.make || "уточняется",
        bike_model: bike.model || "уточняется",
        bike_vin: bike.specs?.vin || bike.specs?.frame || "уточняется",
        bike_category: bike.specs?.category || "A/L3",
        bike_color: bike.specs?.color || "уточняется",
        bike_year: bike.specs?.year || "уточняется",
        bike_engine_cc: String(bike.specs?.engine_cc || bike.specs?.displacement_cc || "0"),
        bike_power_hp: String(bike.specs?.power_hp || bike.specs?.max_power_hp || "0"),
        bike_power_kw: String(bike.specs?.power_kw || "0"),
        bike_battery: String(bike.specs?.battery || (isElectric ? "уточняется" : "")),
      };
    }

    // Load HTML template based on deal type
    const templateFileName = isRent ? "RENTAL_DEAL_TEMPLATE.html" : "SALE_DEAL_TEMPLATE.html";
    const templatePath = join(process.cwd(), "docs", templateFileName);
    let htmlTemplate: string;
    try {
      htmlTemplate = readFileSync(templatePath, "utf8");
    } catch (readErr) {
      logger.error("[/doc] Failed to read HTML template", templatePath, readErr);
      await sendComplexMessage(chatId, "🚨 Ошибка: шаблон договора не найден. Обратитесь к администратору.", [], { removeKeyboard: true });
      return false;
    }

    const docFileName = `${context.dealType}-${bike.make}-${bike.model}-${context.rentStartDate || now.toISOString().split('T')[0]}.docx`
      .replace(/[^a-zA-Zа-яА-Я0-9.\-]/g, "-")
      .replace(/-+/g, "-");

    // Generate DOCX via the shared docx-capability pipeline
    const docResult = await buildFranchizeDocxFromTemplate({
      integrationScope: `telegram-doc-${isRent ? 'rental' : 'sale'}`,
      uploadedBy: String(userId),
      documentKey: vars.document_key,
      fileName: docFileName,
      template: htmlTemplate,
      variables: vars,
      flowType: isRent ? "rental" : "sale",
      templateMode: "html",
    });

    const docxBuf = Buffer.from(docResult.bytes);
    const docSha256 = docResult.sha256;

    const qrDeepLink = `https://t.me/oneBikePlsBot/app?startapp=rent_${bike.id}_${docSha256}`;
    const qrPngUrl = `https://api.qrserver.com/v1/create-qr-code/?size=420x420&data=${encodeURIComponent(qrDeepLink)}&color=000000&bgcolor=ffffff`;

    let qrPngBuffer: Buffer | null = null;
    try {
      // AbortSignal.timeout is Node 22+ / experimental, use manual timeout for compatibility
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const qrRes = await fetch(qrPngUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (qrRes.ok) qrPngBuffer = Buffer.from(await qrRes.arrayBuffer());
    } catch (qrErr) {
      logger.warn("[/doc] QR failed:", qrErr);
    }

    // ── Send document via Telegram ──────────────────────────────
    let docSent = false;
    const caption = `${isRent ? 'Аренда' : 'Продажа'}: ${bike.make} ${bike.model}\n\n🔗 Быстрая повторная аренда:\n${qrDeepLink}`;

    if (qrPngBuffer) {
      // Try sending DOCX + QR as a media group
      const token = process.env.TELEGRAM_BOT_TOKEN;
      try {
        const form = new FormData();
        form.append('chat_id', String(chatId));
        form.append('media', JSON.stringify([
          { type: 'document', media: 'attach://docx', parse_mode: 'HTML' },
          { type: 'photo', media: 'attach://qr', caption: `📲 <b>QR для повторной аренды</b>\n${qrDeepLink}`, parse_mode: 'HTML' },
        ]));
        form.append('docx', new Blob([docxBuf], {type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}), docFileName);
        form.append('qr', new Blob([qrPngBuffer], {type:'image/png'}), `qr.png`);

        const res = await fetch(`https://api.telegram.org/bot${token}/sendMediaGroup`, {method:'POST', body: form});
        const resBody = await res.json();
        if (resBody?.ok) {
          docSent = true;
          logger.info("[/doc] DOCX + QR sent as media group");
        } else {
          logger.warn("[/doc] sendMediaGroup failed:", resBody?.description);
        }
      } catch (e) {
        logger.warn("[/doc] sendMediaGroup exception:", e);
      }
    }

    // Fallback: send DOCX alone
    if (!docSent) {
      try {
        await sendTelegramDocument(String(chatId), docxBuf, docFileName);
        docSent = true;
        logger.info("[/doc] DOCX sent via sendTelegramDocument");
      } catch (e) {
        logger.error("[/doc] sendTelegramDocument also failed:", e);
      }
    }

    if (!docSent) {
      logger.error("[/doc] All document delivery methods failed!");
    }

    let rentalId: string | null = null;
    if (isRent) {
      // Create rentals row for unified tracking (before artifact)
      try {
        rentalId = await createRentalFromDocContract(chatId, String(userId), context, bike, docSha256);
        if (rentalId) {
          logger.info('[/doc] Rental created successfully:', rentalId);
        } else {
          logger.warn('[/doc] Failed to create rental, continuing without rental_id');
        }
      } catch (rentalErr) {
        logger.error('[/doc] Rental creation exception:', rentalErr);
      }
    }

    const { error: secretsError } = await privateSchema().from("user_rental_secrets").insert({
      chat_id: String(userId),
      crew_slug: "vip-bike",
      doc_sha256: docSha256,
      renter_full_name: context.mpFullName || null,
      renter_passport: `${context.mpSeries || ""} ${context.mpNumber || ""}`.trim() || null,
      renter_passport_issue_date: context.mpIssueDate || null,
      renter_passport_issued_by: context.mpIssuedBy || null,
      renter_registration: context.mpRegistration || null,
      renter_driver_license: isRent ? `${context.mlSeries || ""} ${context.mlNumber || ""}`.trim() || null : null,
      renter_birth_date: context.mpBirthDate || null,
      renter_phone: null,
      renter_email: null,
      renter_address: context.mpRegistration || null,
      source_doc_key: vars.document_key,
      source_rental_id: rentalId || null,  // Link to rentals table if rental was created
      verification_status: "verified",
      template_version: 1,
    });
    if (secretsError) {
      logger.error("[/doc] Failed to save user_rental_secrets:", secretsError);
    }

    if (isRent) {

      // rental_contract_artifacts is in private schema — use explicit columns only.
      // sts_* columns added by migration 20260617000000_rental_sts_pledge.sql
      // (nullable / have defaults, so it's safe to omit when stsPledgeUsed=false).
      const depositForRecord = context.depositOverride
        || String(bike.specs?.deposit_rub || "20000");

      const rentInsert: Record<string, any> = {
        contract_key: vars.document_key,
        original_sha256: docSha256,
        requested_bike_id: context.bikeId,
        resolved_bike_id: bike.id,
        telegram_chat_id: String(userId),
        telegram_message_id: null,
        renter_full_name: context.mpFullName || null,
        renter_passport: `${context.mpSeries || ""} ${context.mpNumber || ""}`.trim() || null,
        renter_passport_issued_by: context.mpIssuedBy || null,
        renter_passport_issue_date: context.mpIssueDate || null,
        renter_registration: context.mpRegistration || null,
        renter_driver_license: `${context.mlSeries || ""} ${context.mlNumber || ""}`.trim() || null,
        renter_birth_date: context.mpBirthDate || null,
        license_categories: (context.mlCategories || []).join(", ") || null,
        rent_start_date: context.rentStartDate || null,
        rent_end_date: context.rentEndDate || null,
        daily_price: bike.specs?.dailyPrice || bike.specs?.rent_weekday || null,
        deposit_rub: depositForRecord,
        total_sum: Number(bike.specs?.dailyPrice || bike.specs?.rent_weekday || "10000"),
        template_version: 1,
        rental_id: rentalId || null,  // FK to rentals table if rental was created
        // СТС pledge columns (added 2026-06-17):
        sts_pledge_used: !!context.stsPledgeUsed,
        sts_pledge_return_days: context.stsPledgeReturnDays || 3,
        deposit_amount_skipped: context.stsPledgeUsed ? depositForRecord : null,
      };
      if (context.stsPledgeUsed) {
        Object.assign(rentInsert, {
          sts_series: context.stsSeries || null,
          sts_number: context.stsNumber || null,
          sts_issue_date: context.stsIssueDate || null,
          sts_vehicle_plate: context.stsVehiclePlate || null,
          sts_vehicle_vin: context.stsVehicleVin || null,
          sts_vehicle_model: context.stsVehicleModel || null,
          sts_vehicle_year: context.stsVehicleYear || null,
          sts_owner_full_name: context.stsOwnerFullName || null,
          sts_owner_registration: context.stsOwnerRegistration || null,
          sts_owner_relation: context.stsOwnerRelation || "сам арендатор",
        });
      }

      const { error: rentError } = await privateSchema()
        .from("rental_contract_artifacts")
        .insert(rentInsert);
      if (rentError) {
        logger.error("[/doc] Failed to save rental_contract_artifacts:", rentError);
      }
    } else {
      const salePrice = context.salePrice || String(bike.specs?.sale_price || bike.specs?.price_rub || "390000");

      // sale_contract_artifacts is in private schema — use explicit columns only
      const { error: saleError } = await privateSchema().from("sale_contract_artifacts").insert({
        contract_key: vars.document_key,
        original_sha256: docSha256,
        requested_bike_id: context.bikeId,
        resolved_bike_id: bike.id,
        telegram_chat_id: String(userId),
        telegram_message_id: null,
        buyer_full_name: context.mpFullName || null,
        buyer_passport_number: `${context.mpSeries || ""} ${context.mpNumber || ""}`.trim() || null,
        buyer_passport_issued_by: context.mpIssuedBy || null,
        buyer_passport_issue_date: context.mpIssueDate || null,
        buyer_registration: context.mpRegistration || null,
        sale_price: salePrice,
        warranty_months: "0", // Sold "as-is", no warranty
        template_version: 1,
      });
      if (saleError) {
        logger.error("[/doc] Failed to save sale_contract_artifacts:", saleError);
      }
    }

    await sendComplexMessage(
      chatId,
      `✅ *${isRent ? 'Договор аренды' : 'Договор купли-продажи'} готов!*${isRent ? `\n\n🛡 Категории: ${(context.mlCategories || []).join(", ")}` : ""}`,
      [[{ text: "🚀 Открыть", url: process.env.TELEGRAM_BOT_LINK || "https://t.me/oneBikePlsBot/app" }]],
      { removeKeyboard: true, parseMode: "Markdown" },
    );

    await notifyAdmin(
      `📄 ${isRent ? 'Аренда' : 'Продажа'} (ввод с кнопок)\n` +
      `User: ${userId}\n` +
      `Bike: ${bike.make} ${bike.model}\n` +
      `Client: ${context.mpFullName}` +
      (isRent ? `\nCats: ${(context.mlCategories || []).join(", ")}` : "") +
      (!isRent ? `\nPrice: ${Number(context.salePrice || 0).toLocaleString("ru-RU")} ₽` : ""),
    );

    return true;
  } catch (error) {
    logger.error("[/doc] Generate failed", error);
    await sendComplexMessage(chatId, "🚨 Ошибка. Попробуйте ещё раз.", [], { removeKeyboard: true });
    return false;
  }
}

// ── Number to Russian words (supports millions) ─────────────────────────────

function numberToWords(n: number): string {
  const units = ["", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
  const teens = ["десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать", "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать"];
  const tens = ["", "", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят", "восемьдесят", "девяносто"];
  const hundreds = ["", "сто", "двести", "триста", "четыреста", "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот"];

  if (n >= 1000000) {
    const m = Math.floor(n / 1000000);
    const r = n % 1000000;
    const lastTwo = m % 100, lastOne = m % 10;
    let w = "миллионов";
    if (lastTwo >= 11 && lastTwo <= 19) w = "миллионов";
    else if (lastOne === 1) w = "миллион";
    else if (lastOne >= 2 && lastOne <= 4) w = "миллиона";
    return numberToWords(m) + " " + w + (r > 0 ? " " + numberToWords(r) : "");
  }
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

/**
 * Route user to the deposit-choice step (NEW step 10 in rent flow).
 * Fetches bike.specs.deposit_rub for display in the inline keyboard.
 * Called after schedule_end is fully resolved.
 */
async function gotoDepositChoice(chatId: number, userId: string, context: DocFlowContext): Promise<void> {
  const bike = await resolveBikeById(context.bikeId);
  const depositAmount = String(bike?.specs?.deposit_rub || "20000");
  await setState(userId, "deposit_choice", context);
  const formatted = Number(depositAmount).toLocaleString("ru-RU");
  await sendComplexMessage(
    chatId,
    `*Депозит / обеспечительный платёж*\n\n` +
    `Байк: ${bike ? `${bike.make} ${bike.model}` : context.bikeId}\n` +
    `Депозит из карточки ТС: *${formatted} ₽*\n\n` +
    `Выберите вариант:`,
    buildDepositChoiceKeyboard(depositAmount, bike),
    { keyboardType: 'inline', parseMode: 'Markdown' },
  );
}

/**
 * Mark СТС sub-flow as complete and route to confirm step.
 * Sets stsPledgeUsed=true, clears any cash-deposit override, and snapshots
 * the cash deposit that was replaced by СТС (for analytics / audit in DB).
 */
async function gotoConfirmFromSts(chatId: number, userId: string, context: DocFlowContext): Promise<void> {
  context.stsPledgeUsed = true;
  context.depositOverride = undefined; // СТС replaces cash deposit

  // Snapshot the cash deposit that was skipped — used downstream by
  // generateContract() to populate sts_deposit_amount_skipped in the
  // template and deposit_amount_skipped in the DB record. We resolve it
  // here (not in generateContract) so the value is stable across retries.
  if (!context.depositAmountSkipped) {
    const bike = await resolveBikeById(context.bikeId);
    context.depositAmountSkipped = String(bike?.specs?.deposit_rub || "20000");
  }

  if (!context.stsOwnerRelation) context.stsOwnerRelation = "сам арендатор";
  if (!context.stsPledgeReturnDays) context.stsPledgeReturnDays = 3;

  logger.info(`[/doc] СТС sub-flow complete: ${userId} → sts=${context.stsSeries} ${context.stsNumber} plate=${context.stsVehiclePlate} owner=${context.stsOwnerFullName} relation=${context.stsOwnerRelation} depositSkipped=${context.depositAmountSkipped}`);

  const summary = buildRentSummary(context);
  await setState(userId, "confirm", context);
  await sendComplexMessage(chatId, summary, buildConfirmKeyboard(), { keyboardType: 'inline', parseMode: 'Markdown' });
}

async function setState(userId: string, state: string, context: DocFlowContext) {
  await supabaseAdmin.from("user_states").upsert({
    user_id: userId,
    state,
    context,
    expires_at: new Date(Date.now() + DOC_STATE_EXPIRY_MINUTES * 60 * 1000).toISOString(),
  });
}

async function clearState(userId: string) {
  await supabaseAdmin.from("user_states").delete().eq("user_id", userId);
}

async function getState(userId: string): Promise<{ state: string; context: DocFlowContext } | null> {
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
  return { state: data.state, context: (data.context || {}) as DocFlowContext };
}

// ── Text handlers ─────────────────────────────────────────────────────────────

const START_DATE_EXAMPLES = `*Когда начинаем?*

Примеры:
• сегодня 18
• сегодня 15:30
• завтра 10
• завтра 14:00
• 15.06 18
• 13.06 15:30
• 15.06.2026 10:00`;

const END_DATE_EXAMPLES = `*Когда заканчиваем?*

Примеры:
• завтра 10
• завтра 15:30
• послезавтра 10
• 16.06 10
• 16.06 15:30
• 17.06.2026 18:00`;

export async function handleDocText(userId: string, chatId: number, text: string): Promise<boolean> {
  const docState = await getState(userId);
  if (!docState) return false;

  const { state, context } = docState;

  if (state === "bike") {
    const bike = await resolveBikeById(text.trim());
    if (!bike) {
      await sendComplexMessage(chatId, "🚲 Не найден. Попробуйте:", [], { keyboardType: "reply" });
      return true;
    }
    context.bikeId = bike.id;
    context.bikeMake = bike.make;
    context.bikeModel = bike.model;
    await setState(userId, "deal", context);
    await sendComplexMessage(chatId, `🏍 ${bike.make} ${bike.model}`, [], { removeKeyboard: true });
    await sendComplexMessage(chatId, "Тип договора:", buildDealKeyboard(), { keyboardType: 'inline' });
    return true;
  }

  if (state === "name") {
    context.mpFullName = text.trim();
    await setState(userId, "passport", context);
    await sendComplexMessage(
      chatId,
      `✅ ${text}\n\n*Паспорт*\n\n4509 123456 15.03.2020 ОМВД по Н.Новгороду`,
      [],
      { removeKeyboard: true, parseMode: "Markdown" },
    );
    return true;
  }

  if (state === "passport") {
    const p = parsePassport(text);
    if (!p) {
      await sendComplexMessage(chatId, "❌ Формат: 4509 123456 15.03.2020 ОМВД", [], { removeKeyboard: true });
      return true;
    }
    context.mpSeries = p.series;
    context.mpNumber = p.number;
    context.mpIssueDate = p.issueDate;
    context.mpIssuedBy = p.issuedBy;
    await setState(userId, "birth", context);
    await sendComplexMessage(
      chatId,
      `✅ Паспорт ${p.series} ${p.number} от ${p.issueDate}\n\n*Дата рождения*\n\n15.03.1990`,
      [],
      { removeKeyboard: true, parseMode: "Markdown" },
    );
    return true;
  }

  if (state === "birth") {
    const d = parseDate(text, true);
    if (!d) {
      await sendComplexMessage(chatId, "❌ Формат: 15.03.1990", [], { removeKeyboard: true });
      return true;
    }
    context.mpBirthDate = d;
    await setState(userId, "address", context);
    await sendComplexMessage(
      chatId,
      `✅ ${d}\n\n*Адрес регистрации*`,
      [],
      { removeKeyboard: true, parseMode: "Markdown" },
    );
    return true;
  }

  if (state === "address") {
    context.mpRegistration = text.trim();
    const isRent = context.dealType === "rent";
    if (isRent) {
      await setState(userId, "has_license", context);
      await sendComplexMessage(
        chatId,
        "✅\n\n*Водительское удостоверение есть?*",
        buildHasLicenseKeyboard(),
        { keyboardType: 'inline', parseMode: "Markdown" },
      );
    } else {
      await setState(userId, "price", context);
      const priceKeyboard = await buildPriceKeyboard();
      await sendComplexMessage(chatId, "💰 Цена:", priceKeyboard, { keyboardType: 'inline' });
    }
    return true;
  }

  if (state === "has_license") {
    // User typed instead of pressing button — re-prompt
    await sendComplexMessage(chatId, "*Водительское удостоверение есть?*", buildHasLicenseKeyboard(), { keyboardType: 'inline', parseMode: "Markdown" });
    return true;
  }

  if (state === "license") {
    const l = parseLicense(text);
    if (!l) {
      await sendComplexMessage(chatId, "❌ Формат: 99 76 123456 15.03 или 99 76 123456 15.03 15.03.2028", [], { removeKeyboard: true });
      return true;
    }
    context.mlSeries = l.series;
    context.mlNumber = l.number;
    context.mlIssueDate = l.issueDate;
    context.mlExpiryDate = l.expiryDate;
    await setState(userId, "categories", context);
    await sendComplexMessage(chatId, `✅ ВУ ${l.series} ${l.number}\n\n*Категории*`, buildCategoryKeyboard(), { keyboardType: 'inline' });
    return true;
  }

  if (state === "schedule_start" || state === "schedule") {
    // Parse start date from free text, then ask for end date
    const s = parseStartDate(text);
    if (!s) {
      await sendComplexMessage(chatId, START_DATE_EXAMPLES, [], { removeKeyboard: true, parseMode: "Markdown" });
      return true;
    }
    context.rentStartDate = s.date;
    context.rentStartTime = s.time;
    await setState(userId, "schedule_end", context);
    await sendComplexMessage(
      chatId,
      `✅ Старт: ${context.rentStartDate} ${context.rentStartTime}\n\n${END_DATE_EXAMPLES}`,
      buildEndKeyboard(context.rentStartTime),
      { keyboardType: 'inline', parseMode: 'Markdown' },
    );
    return true;
  }

  if (state === "schedule_end") {
    const e = parseEndDate(text, context.rentStartDate);
    if (!e) {
      await sendComplexMessage(chatId, END_DATE_EXAMPLES, [], { removeKeyboard: true, parseMode: "Markdown" });
      return true;
    }
    context.rentEndDate = e.date;
    context.rentEndTime = e.time;
    // Route to deposit_choice (NEW step 10) instead of jumping straight to confirm
    await gotoDepositChoice(chatId, userId, context);
    return true;
  }

  // ── СТС-вместо-депозита sub-flow text states ──────────────────────────────
  // Order: sts_series → sts_plate → sts_owner → sts_relation → sts_vehicle → sts_vin → confirm

  if (state === "sts_series") {
    const sn = parseStsSeriesNumber(text);
    if (!sn) {
      logger.info(`[/doc] sts_series: ${userId} → invalid input "${text.slice(0,40)}"`);
      await sendComplexMessage(
        chatId,
        "❌ Формат: серия номер\n\nПримеры:\n• 77 12345678\n• 77 № 12345678\n• 7712 345678",
        [], { removeKeyboard: true, parseMode: "Markdown" },
      );
      return true;
    }
    context.stsSeries = sn.series;
    context.stsNumber = sn.number;
    logger.info(`[/doc] sts_series: ${userId} → series=${sn.series} number=${sn.number}`);
    await setState(userId, "sts_plate", context);
    await sendComplexMessage(
      chatId,
      `✅ СТС ${sn.series} № ${sn.number}\n\n*Гос. рег. знак ТС*\n\nПример: А123БВ77`,
      [], { removeKeyboard: true, parseMode: "Markdown" },
    );
    return true;
  }

  if (state === "sts_plate") {
    const plate = parseStsPlate(text);
    if (!plate) {
      logger.info(`[/doc] sts_plate: ${userId} → invalid input "${text.slice(0,40)}"`);
      await sendComplexMessage(
        chatId,
        "❌ Формат: А123БВ77\n\nПримеры:\n• А123БВ77 (1 буква + 3 цифры + 2 буквы + регион)\n• АБ1234 77 (мото/прицеп)",
        [], { removeKeyboard: true, parseMode: "Markdown" },
      );
      return true;
    }
    context.stsVehiclePlate = plate;
    logger.info(`[/doc] sts_plate: ${userId} → plate=${plate}`);
    await setState(userId, "sts_owner", context);
    // Pre-fill owner name from renter's full name — most common case
    await sendComplexMessage(
      chatId,
      `✅ ${plate}\n\n*Собственник ТС*\n\nЕсли собственник = арендатор, просто отправьте: \`${context.mpFullName || ""}\`\nИначе введите ФИО собственника.`,
      [], { removeKeyboard: true, parseMode: "Markdown" },
    );
    return true;
  }

  if (state === "sts_owner") {
    const owner = text.trim();
    if (owner.length < 5) {
      await sendComplexMessage(chatId, "❌ Введите ФИО собственника полностью", [], { removeKeyboard: true });
      return true;
    }
    context.stsOwnerFullName = owner;

    // If owner ≠ renter, ask for relation; otherwise default to "сам арендатор".
    // NB: we explicitly require BOTH renterName AND ownerName non-empty AND
    // equal — otherwise we ask for relation. This avoids the silent-fallback
    // bug where an empty mpFullName (edge case: state corruption) would
    // short-circuit on `renterName &&` and default to "сам арендатор" even
    // when the owner was clearly a different person.
    const renterName = (context.mpFullName || "").trim().toLowerCase();
    const ownerName = owner.trim().toLowerCase();
    const ownerIsRenter = !!renterName && !!ownerName && ownerName === renterName;
    if (ownerIsRenter) {
      // Owner = renter — skip relation, default it
      context.stsOwnerRelation = "сам арендатор";
      logger.info(`[/doc] sts_owner: ${userId} → owner=renter, defaulting relation`);
      await setState(userId, "sts_vehicle", context);
      await sendComplexMessage(
        chatId,
        "✅ собственник = арендатор\n\n*Марка/модель ТС* (можно с годом)\n\nПример: Toyota Camry 2021",
        buildStsSkipKeyboard(),
        { keyboardType: 'inline', parseMode: "Markdown" },
      );
    } else {
      // Owner ≠ renter (or renter name unknown) — ask for relation
      logger.info(`[/doc] sts_owner: ${userId} → owner differs from renter, asking relation`);
      await setState(userId, "sts_relation", context);
      await sendComplexMessage(
        chatId,
        `✅ ${owner}\n\n*Отношение собственника к арендатору?*`,
        buildStsRelationKeyboard(),
        { keyboardType: 'inline', parseMode: "Markdown" },
      );
    }
    return true;
  }

  if (state === "sts_relation") {
    // Free-text relation (fallback when user types instead of pressing button)
    const rel = text.trim();
    if (rel.length < 2) {
      logger.info(`[/doc] sts_relation: ${userId} → invalid input "${text.slice(0,40)}"`);
      await sendComplexMessage(chatId, "*Отношение собственника к арендатору?*", buildStsRelationKeyboard(), { keyboardType: 'inline', parseMode: "Markdown" });
      return true;
    }
    context.stsOwnerRelation = rel;
    logger.info(`[/doc] sts_relation (free text): ${userId} → relation="${rel}"`);
    await setState(userId, "sts_vehicle", context);
    await sendComplexMessage(
      chatId,
      `✅ ${rel}\n\n*Марка/модель ТС* (можно с годом)\n\nПример: Toyota Camry 2021`,
      buildStsSkipKeyboard(),
      { keyboardType: 'inline', parseMode: "Markdown" },
    );
    return true;
  }

  if (state === "sts_vehicle") {
    // Optional — user can skip via button (handled in callback) or type
    const v = parseStsVehicle(text);
    if (!v) {
      logger.info(`[/doc] sts_vehicle: ${userId} → invalid input "${text.slice(0,40)}"`);
      await sendComplexMessage(
        chatId,
        "*Марка/модель ТС* (можно с годом)\n\nПример: Toyota Camry 2021",
        buildStsSkipKeyboard(),
        { keyboardType: 'inline', parseMode: "Markdown" },
      );
      return true;
    }
    context.stsVehicleModel = v.model;
    context.stsVehicleYear = v.year;
    logger.info(`[/doc] sts_vehicle: ${userId} → model="${v.model}" year="${v.year}"`);
    await setState(userId, "sts_vin", context);
    await sendComplexMessage(
      chatId,
      `✅ ${v.model}${v.year ? ` ${v.year} г.в.` : ""}\n\n*VIN ТС* (17 символов, необязательно)`,
      buildStsSkipKeyboard(),
      { keyboardType: 'inline', parseMode: "Markdown" },
    );
    return true;
  }

  if (state === "sts_vin") {
    // Optional — user can skip or type VIN
    const vin = parseStsVin(text);
    if (!vin) {
      logger.info(`[/doc] sts_vin: ${userId} → invalid input "${text.slice(0,40)}"`);
      await sendComplexMessage(
        chatId,
        "❌ VIN — 17 символов (буквы латиницы + цифры, без I/O/Q)\n\nИли нажмите «Пропустить».",
        buildStsSkipKeyboard(),
        { keyboardType: 'inline', parseMode: "Markdown" },
      );
      return true;
    }
    context.stsVehicleVin = vin;
    logger.info(`[/doc] sts_vin: ${userId} → vin=${vin}`);
    // СТС sub-flow complete → go to confirm
    await gotoConfirmFromSts(chatId, userId, context);
    return true;
  }

  if (state === "deposit_custom") {
    // User typed custom deposit amount
    const amount = text.replace(/\D/g, '');
    if (!amount || parseInt(amount) < 1000) {
      logger.info(`[/doc] deposit_custom: ${userId} → invalid input "${text.slice(0,40)}"`);
      await sendComplexMessage(chatId, "❌ Введите сумму депозита (руб), минимум 1000", [], { removeKeyboard: true });
      return true;
    }
    context.depositOverride = amount;
    context.stsPledgeUsed = false; // explicit cash deposit
    logger.info(`[/doc] deposit_custom: ${userId} → amount=${amount}`);
    const summary = buildRentSummary(context);
    await setState(userId, "confirm", context);
    await sendComplexMessage(chatId, summary, buildConfirmKeyboard(), { keyboardType: 'inline', parseMode: 'Markdown' });
    return true;
  }

  if (state === "deposit_choice") {
    // User typed instead of pressing a deposit-choice button — re-prompt
    logger.info(`[/doc] deposit_choice: ${userId} → typed instead of clicking, re-prompting`);
    await gotoDepositChoice(chatId, userId, context);
    return true;
  }

  if (state === "price_custom") {
    const price = text.replace(/\D/g, '');
    if (!price || parseInt(price) < 10000) {
      await sendComplexMessage(chatId, "❌ Введите цену (руб)", [], { removeKeyboard: true });
      return true;
    }
    context.salePrice = price;
    const summary = [
      "*📋 Продажа - проверьте:*",
      "",
      `👤 ${context.mpFullName}`,
      `🪪 ${context.mpSeries} ${context.mpNumber}`,
      `📅 ${context.mpBirthDate}`,
      `🏠 ${context.mpRegistration}`,
      "",
      `💰 ${Number(price).toLocaleString("ru-RU")} ₽`,
      "",
      "Всё верно?",
    ].join("\n");
    await setState(userId, "confirm", context);
    await sendComplexMessage(chatId, summary, buildConfirmKeyboard(), { keyboardType: 'inline', parseMode: 'Markdown' });
    return true;
  }

  return false;
}

// ── Callback handlers ───────────────────────────────────────────────────────

export async function handleDocCallback(
  userId: string,
  chatId: number,
  callbackData: string,
  callbackQueryId?: string,
): Promise<boolean> {
  const docState = await getState(userId);
  if (!docState) return false;

  const { state, context } = docState;

  // Answer callback query to stop loading animation on button
  if (callbackQueryId) {
    try {
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery?callback_query_id=${callbackQueryId}`, { method: "POST" });
    } catch (e) {
      logger.warn("[/doc] Failed to answer callback query:", e);
    }
  }

  if (callbackData === "cancel") {
    await sendComplexMessage(chatId, "❌ Отменено. /doc для начала.", [], { removeKeyboard: true });
    await clearState(userId);
    return true;
  }

  if (callbackData === "restart") {
    await clearState(userId);
    await docCommand(chatId, parseInt(userId), undefined, "/doc");
    return true;
  }

  if (callbackData === "d_rent") {
    context.dealType = "rent";
    await setState(userId, "name", context);
    await sendComplexMessage(chatId, "*Аренда - ФИО*", [], { removeKeyboard: true, parseMode: "Markdown" });
    return true;
  }

  if (callbackData === "d_sale") {
    context.dealType = "sale";
    await setState(userId, "name", context);
    await sendComplexMessage(chatId, "*Продажа - ФИО*", [], { removeKeyboard: true, parseMode: "Markdown" });
    return true;
  }

  // ── Has license? Yes/No ──
  if (callbackData === "hl_yes") {
    await setState(userId, "license", context);
    await sendComplexMessage(
      chatId,
      `✅\n\n*ВУ*\n\nФормат: серия номер дата_выдачи [дата_окончания]\n\nПримеры:\n• 99 76 123456 15.03 (срок auto +10 лет)\n• 99 76 123456 15.03 15.03.2028\n\n(год без числа = ${CURRENT_YEAR})`,
      [],
      { removeKeyboard: true, parseMode: "Markdown" },
    );
    return true;
  }

  if (callbackData === "hl_no") {
    // No license — skip license & categories, go straight to schedule
    context.mlCategories = ["нет"];
    context.mlAccessTier = deriveUserAccessTier(["нет"]);
    await setState(userId, "schedule_start", context);
    await sendComplexMessage(chatId, "✅ Нет ВУ\n\n*Когда аренда?*", buildStartKeyboard(), { keyboardType: 'inline', parseMode: 'Markdown' });
    return true;
  }

  if (callbackData.startsWith("c_")) {
    const cat = callbackData.slice(2);
    const cats = context.mlCategories || [];
    const idx = cats.indexOf(cat);
    if (idx >= 0) cats.splice(idx, 1);
    else cats.push(cat);
    context.mlCategories = cats;
    await setState(userId, state, context);
    await sendComplexMessage(chatId, `🏷 ${(cats || []).join(", ") || "нет"}`, buildCategoryKeyboard(cats), { keyboardType: 'inline' });
    return true;
  }

  if (callbackData === "cdone") {
    context.mlAccessTier = deriveUserAccessTier(context.mlCategories || []);
    await setState(userId, "schedule_start", context);
    await sendComplexMessage(chatId, `✅ ${(context.mlCategories || []).join(", ")}\n\n*Когда аренда?*`, buildStartKeyboard(), { keyboardType: 'inline', parseMode: 'Markdown' });
    return true;
  }

  if (callbackData.startsWith("s_")) {
    const parts = callbackData.slice(2).split('_');
    const when = parts[0];
    const rawTime = parts[1];

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const fmt = (d: Date) => `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;

    if (when === "custom") {
      await setState(userId, "schedule", context);
      await sendComplexMessage(chatId, START_DATE_EXAMPLES, [], { removeKeyboard: true, parseMode: "Markdown" });
      return true;
    }

    const start = when === "today" ? today : tomorrow;
    const timeStr = decodeCallbackTime(rawTime);

    context.rentStartDate = fmt(start);
    context.rentStartTime = timeStr;

    // Ask for end date
    await setState(userId, "schedule_end", context);
    await sendComplexMessage(
      chatId,
      `✅ Старт: ${context.rentStartDate} ${context.rentStartTime}\n\n*Когда заканчиваем?*`,
      buildEndKeyboard(context.rentStartTime),
      { keyboardType: 'inline', parseMode: 'Markdown' },
    );
    return true;
  }

  // ── End date callbacks (e_*) ──
  if (callbackData.startsWith("e_")) {
    const parts = callbackData.slice(2).split('_');
    const when = parts[0];
    const rawTime = parts[1];

    const today = new Date();
    const fmt = (d: Date) => `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;

    // Resolve start date for relative end calculation
    let startRef = new Date(today);
    if (context.rentStartDate) {
      const sp = context.rentStartDate.split('.');
      if (sp.length === 3) startRef = new Date(`${sp[2]}-${sp[1]}-${sp[0]}`);
    }

    if (when === "custom") {
      await setState(userId, "schedule_end", context);
      await sendComplexMessage(chatId, END_DATE_EXAMPLES, [], { removeKeyboard: true, parseMode: "Markdown" });
      return true;
    }

    const timeStr = decodeCallbackTime(rawTime);

    if (when === "tomorrow") {
      const end = new Date(startRef);
      end.setDate(startRef.getDate() + 1);
      context.rentEndDate = fmt(end);
      context.rentEndTime = timeStr;
    } else if (when === "2days") {
      const end = new Date(startRef);
      end.setDate(startRef.getDate() + 2);
      context.rentEndDate = fmt(end);
      context.rentEndTime = timeStr;
    } else {
      // Unknown end callback — re-prompt
      await sendComplexMessage(chatId, "*Когда заканчиваем?*", buildEndKeyboard(context.rentStartTime), { keyboardType: 'inline', parseMode: 'Markdown' });
      return true;
    }

    // End date resolved → route to deposit_choice (NEW step 10) instead of confirm
    await gotoDepositChoice(chatId, userId, context);
    return true;
  }

  // ── Deposit choice callbacks (dep_*) — NEW step 10 ──────────────────────
  if (callbackData === "dep_confirm") {
    // User confirms bike's spec.deposit_rub (or default 20000) as cash deposit
    const bike = await resolveBikeById(context.bikeId);
    context.depositOverride = String(bike?.specs?.deposit_rub || "20000");
    context.stsPledgeUsed = false;
    logger.info(`[/doc] dep_confirm: ${userId} → cash deposit=${context.depositOverride}`);
    const summary = buildRentSummary(context);
    await setState(userId, "confirm", context);
    await sendComplexMessage(chatId, summary, buildConfirmKeyboard(), { keyboardType: 'inline', parseMode: 'Markdown' });
    return true;
  }

  if (callbackData === "dep_custom") {
    // User wants to enter a custom cash deposit amount
    logger.info(`[/doc] dep_custom: ${userId} → asking for custom amount`);
    await setState(userId, "deposit_custom", context);
    await sendComplexMessage(
      chatId,
      "*Введите сумму депозита (руб)*\n\nМинимум 1000 ₽",
      [], { removeKeyboard: true, parseMode: "Markdown" },
    );
    return true;
  }

  if (callbackData === "dep_sts") {
    // User chose to swap cash deposit for СТС in pledge — enter СТС sub-flow
    context.stsPledgeUsed = true;
    context.stsPledgeReturnDays = 3;
    logger.info(`[/doc] dep_sts: ${userId} → entering СТС sub-flow (pledge return days=3)`);
    await setState(userId, "sts_series", context);
    await sendComplexMessage(
      chatId,
      `🪪 *СТС вместо депозита*\n\n` +
      `Вместо денежного депозита вы передаёте оригинал СТС своего ТС в залог.\n` +
      `СТС возвращается в течение 3 рабочих дней после возврата мотоцикла.\n\n` +
      `*Серия и номер СТС*\n\nПримеры:\n• 77 12345678\n• 77 № 12345678\n• 7712 345678`,
      [], { removeKeyboard: true, parseMode: "Markdown" },
    );
    return true;
  }

  // ── СТС-owner-relation callbacks (sr_*) ─────────────────────────────────
  // We use enum codes (sr_self, sr_wife, sr_father, ...) in callback_data
  // and look up the human-readable label via STS_RELATION_LABELS. See the
  // comment block above buildStsRelationKeyboard() for rationale.
  if (callbackData.startsWith("sr_")) {
    const code = callbackData.slice(3);
    if (code === "custom") {
      await setState(userId, "sts_relation", context);
      await sendComplexMessage(
        chatId,
        "*Введите отношение собственника к арендатору*\n\nНапример: брат, сын, доверенность",
        [], { removeKeyboard: true, parseMode: "Markdown" },
      );
      return true;
    }
    const label = STS_RELATION_LABELS[code];
    if (!label) {
      // Unknown relation code — could be from an older keyboard version.
      // Re-prompt with the current keyboard instead of crashing.
      logger.warn(`[/doc] Unknown sr_ code: ${code} (user ${userId})`);
      await sendComplexMessage(
        chatId,
        "*Отношение собственника к арендатору?*",
        buildStsRelationKeyboard(),
        { keyboardType: 'inline', parseMode: "Markdown" },
      );
      return true;
    }
    context.stsOwnerRelation = label;
    logger.info(`[/doc] sr_${code}: ${userId} → relation="${label}"`);
    await setState(userId, "sts_vehicle", context);
    await sendComplexMessage(
      chatId,
      `✅ ${label}\n\n*Марка/модель ТС* (можно с годом)\n\nПример: Toyota Camry 2021`,
      buildStsSkipKeyboard(),
      { keyboardType: 'inline', parseMode: "Markdown" },
    );
    return true;
  }

  // ── СТС skip optional field (sts_skip) ──────────────────────────────────
  if (callbackData === "sts_skip") {
    if (state === "sts_vehicle") {
      // Skip vehicle model/year → go to VIN
      logger.info(`[/doc] sts_skip: ${userId} → skipped vehicle model (state=sts_vehicle)`);
      await setState(userId, "sts_vin", context);
      await sendComplexMessage(
        chatId,
        "*VIN ТС* (17 символов, необязательно)",
        buildStsSkipKeyboard(),
        { keyboardType: 'inline', parseMode: "Markdown" },
      );
      return true;
    }
    if (state === "sts_vin") {
      // Skip VIN → СТС sub-flow complete → go to confirm
      logger.info(`[/doc] sts_skip: ${userId} → skipped VIN (state=sts_vin), going to confirm`);
      await gotoConfirmFromSts(chatId, userId, context);
      return true;
    }
    // sts_skip pressed from an unexpected state (e.g. user clicked a stale
    // button from a previous /doc session). Consume the callback to stop the
    // Telegram loading spinner and re-route to the current expected state.
    logger.warn(`[/doc] sts_skip pressed from unexpected state=${state} (user ${userId})`);
    await sendComplexMessage(
      chatId,
      "⚠️ Эта кнопка уже не актуальна. Используйте кнопки ниже.",
      [],
      { removeKeyboard: true, parseMode: "Markdown" },
    );
    // Best-effort: route back to deposit_choice so user is not stuck
    await gotoDepositChoice(chatId, userId, context);
    return true;
  }

  if (callbackData.startsWith("p_")) {
    const price = callbackData.slice(2);
    if (price === "custom") {
      await setState(userId, "price_custom", context);
      await sendComplexMessage(chatId, "*Введите цену (руб)*", [], { removeKeyboard: true, parseMode: "Markdown" });
      return true;
    }
    context.salePrice = price;
    const summary = [
      "*📋 Продажа - проверьте:*",
      "",
      `👤 ${context.mpFullName}`,
      `🪪 ${context.mpSeries} ${context.mpNumber}`,
      `📅 ${context.mpBirthDate}`,
      `🏠 ${context.mpRegistration}`,
      "",
      `💰 ${Number(price).toLocaleString("ru-RU")} ₽`,
      "",
      "Всё верно?",
    ].join("\n");
    await setState(userId, "confirm", context);
    await sendComplexMessage(chatId, summary, buildConfirmKeyboard(), { keyboardType: 'inline', parseMode: 'Markdown' });
    return true;
  }

  if (callbackData === "ok") {
    await sendComplexMessage(chatId, "⏳ Генерирую...", [], { removeKeyboard: true });
    const success = await generateContract(chatId, userId, context);
    // Only clear state after successful generation to preserve context on failure
    if (success) {
      await clearState(userId);
    }
    return true;
  }

  logger.warn("[/doc] Unknown callback", { callbackData, state });
  return false;
}

// ── Main command ─────────────────────────────────────────────────────────────

export async function docCommand(
  chatId: number,
  userId: number,
  username: string | undefined,
  text: string,
  photos?: any[],
  documents?: any[],
) {
  const userIdStr = String(userId);
  logger.info(`[/doc] ${userIdStr}: ${text}`);

  // TODO: future OCR support — photos and documents are available here
  // if (photos?.length) { /* OCR pipeline */ }
  // if (documents?.length) { /* OCR pipeline */ }

  const parts = text.trim().split(/\s+/);
  const bikeArg = parts.slice(1).join(" ").trim();

  if (bikeArg) {
    const bike = await resolveBikeById(bikeArg);
    if (!bike) {
      await sendComplexMessage(chatId, `🚲 "${bikeArg}" не найден.`, [], { removeKeyboard: true });
      return;
    }
    const context: DocFlowContext = {
      bikeId: bike.id,
      bikeMake: bike.make,
      bikeModel: bike.model,
      dealType: "rent",
    };
    await setState(userIdStr, "deal", context);
    await sendComplexMessage(chatId, `🏍 ${bike.make} ${bike.model}`, [], { removeKeyboard: true });
    await sendComplexMessage(chatId, "Тип договора:", buildDealKeyboard(), { keyboardType: 'inline' });
    return;
  }

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

  await setState(userIdStr, "bike", { bikeId: "", dealType: "rent" });
  await sendComplexMessage(
    chatId,
    "📄 *Выберите байк или введите ID*\n\n🟢 Базовый  🟡 Средний  🔴 Профи",
    buttons,
    { keyboardType: "reply", parseMode: "Markdown" },
  );
}
