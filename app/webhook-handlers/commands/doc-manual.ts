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
 * Flow (RENT) - 9 steps:
 *   1. Full name → "Иванов Иван Иванович"
 *   2. Passport → "4509 123456 15.03.2020 ОМВД"
 *   3. Birth → "15.03.1990" (year needed here)
 *   4. Address → free text
 *   5. Has license? → inline keyboard (Yes/No)
 *   6. License → "99 76 123456 15.03 15.03" (dates assume 2026!) — skipped if no license
 *   7. Categories → inline keyboard — skipped if no license
 *   8. Start → "сегодня 18" or inline keyboard
 *   9. End → "завтра 10" or inline keyboard
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
 * Parse "99 76 123456 15.03 15.03.2028"
 * Dates without year → issue=2026, expiry=2026 (if same) or next year
 */
function parseLicense(text: string): { series: string; number: string; issueDate: string; expiryDate: string } | null {
  const parts = text.trim().split(/\s+/);
  if (parts.length < 4) return null;

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

  if (!series || !number || dates.length < 2) return null;

  // If both dates are same and current year, make expiry 10 years later
  let [issue, expiry] = dates;
  if (issue === expiry && issue.endsWith(`.${CURRENT_YEAR}`)) {
    const [d, m, y] = issue.split('.');
    expiry = `${d}.${m}.${parseInt(y) + 10}`;
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
 * Build rent summary for confirmation — works with or without license
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
    "",
    "Всё верно?",
  );
  return lines.join("\n");
}

// ── Contract generation ─────────────────────────────────────────────────────

async function generateContract(chatId: number, userId: string, context: DocFlowContext): Promise<boolean> {
  try {
    const bike = await resolveBikeById(context.bikeId);
    if (!bike) {
      await sendComplexMessage(chatId, "🚨 Байк не найден. Попробуйте /doc", [], { removeKeyboard: true });
      return false;
    }

    const isElectric = bike.type === "ebike" || /электро|electric|e-bike|ebike/i.test(String(bike.specs?.type || bike.specs?.fuel_type || ""));
    const isRent = context.dealType === "rent";
    const now = new Date();

    const vars: Record<string, string> = {
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
      seller_address: "г. Нижний Новгород, пл. Комсомольская 2",
      lessor_address: "г. Нижний Новгород, пл. Комсомольская 2",
      issuer_name: "Воробьев Р.В.",
      issuer_signatory: "Менеджер Мотосалона",
      issuer_representative: "ИП Воробьев Р.В.",
      signature_timestamp: now.toLocaleString("ru-RU"),
      signature_fingerprint: "manual-telegram-doc",
      renter_signature: "согласие через Telegram",
    };

    if (isRent) {
      Object.assign(vars, {
        renter_full_name: context.mpFullName || "",
        renter_birth_date: context.mpBirthDate || "",
        renter_phone: "",
        renter_email: "",
        renter_driver_license: `${context.mlSeries || ""} ${context.mlNumber || ""}`.trim(),
        renter_passport: `${context.mpSeries || ""} ${context.mpNumber || ""}`.trim(),
        renter_passport_issue_date: context.mpIssueDate || "",
        renter_passport_issued_by: context.mpIssuedBy || "",
        renter_registration: context.mpRegistration || "",
        renter_address: context.mpRegistration || "",
        bike_make_model: `${bike.make || ""} ${bike.model || ""}`.trim(),
        bike_make: bike.make || "уточняется",
        bike_model: bike.model || "уточняется",
        bike_plate: bike.specs?.plate || "уточняется",
        bike_vin: bike.specs?.vin || bike.specs?.frame || "уточняется",
        bike_category: bike.specs?.category || "A/L3",
        bike_color: bike.specs?.color || "уточняется",
        bike_year: bike.specs?.year || "уточняется",
        bike_engine_cc: String(bike.specs?.engine_cc || bike.specs?.displacement_cc || "0"),
        bike_power_hp: String(bike.specs?.power_hp || bike.specs?.max_power_hp || "0"),
        bike_power_kw: String(bike.specs?.power_kw || "0"),
        bike_max_speed: String(bike.specs?.max_speed || bike.specs?.top_speed_kmh || "уточняется"),
        bike_battery: String(bike.specs?.battery || (isElectric ? "уточняется" : "")),
        bike_vehicle_type_label: isElectric ? "ЭЛЕКТРОМОТОЦИКЛА" : "МОТОЦИКЛА",
        bike_vehicle_type_accusative: isElectric ? "электромотоцикл" : "мотоцикл",
        bike_vehicle_type_genitive: isElectric ? "электромотоцикла" : "мотоцикла",
        bike_engine_spec_line_1: (() => {
          const ccPart = bike.specs?.engine_cc ? `рабочий объем ${bike.specs.engine_cc} куб. см` : "";
          const hpPart = bike.specs?.power_hp ? `мощность ${bike.specs.power_hp} л.с.` : "";
          if (isElectric) return bike.specs?.power_kw ? `мощность двигателя (номинальная) ${bike.specs.power_kw} кВт` : "";
          return [ccPart, hpPart].filter(Boolean).join(", ") || "";
        })(),
        bike_engine_spec_line_2: bike.specs?.max_speed ? `максимальная конструктивная скорость ${bike.specs.max_speed} км/ч` : "",
        bike_engine_spec_line_3: (() => {
          if (isElectric) return bike.specs?.battery ? `аккумулятор: тип/ёмкость ${bike.specs.battery}` : "";
          return "";
        })(),
        rent_start_date: context.rentStartDate || "",
        rent_start_time: (context.rentStartTime || "18:00").replace('.', ':'),
        rent_end_date: context.rentEndDate || "",
        rent_end_time: (context.rentEndTime || "10:00").replace('.', ':'),
        daily_price_rub: String(bike.specs?.dailyPrice || bike.specs?.rent_weekday || "10000"),
        hourly_price_rub: String(bike.specs?.price_per_hour || ""),
        deposit_rub: String(bike.specs?.deposit_rub || "20000"),
        subtotal_rub: String(bike.specs?.dailyPrice || bike.specs?.rent_weekday || "10000"),
        bike_value_rub: String(bike.specs?.sale_price || bike.specs?.price_rub || "850000"),
        bike_value_words: "",
        bike_mileage: String(bike.specs?.mileage || ""),
        return_address: "г. Нижний Новгород, пл. Комсомольская 2",
        included_km_per_day: "200",
        extra_km_fee_rub: "35",
        late_return_penalty_rub: "10000",
        late_return_penalty_max_days: "90",
        equipment: "ключ(и) 1 шт.; шлем 1",
        damage_notes_at_delivery: "от даты начала аренды",
        damage_notes_at_return: "от даты возврата ТС",
        battery_level_start: "100 %",
        battery_level_end: "____ %",
        media_links: "телефон",
        damage_price_list: "мотоцикл в сборе / царапина на пластике / прочее по расчету",
        document_key: `rental-${bike.id}-${Date.now()}`,
      });
    }

    if (!isRent) {
      const salePrice = context.salePrice || String(bike.specs?.sale_price || bike.specs?.price_rub || "390000");
      Object.assign(vars, {
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
      });
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
        await sendTelegramDocument(String(chatId), docxBuf, docFileName, caption);
        docSent = true;
        logger.info("[/doc] DOCX sent via sendTelegramDocument");
      } catch (e) {
        logger.error("[/doc] sendTelegramDocument also failed:", e);
      }
    }

    if (!docSent) {
      logger.error("[/doc] All document delivery methods failed!");
    }

    const { error: secretsError } = await supabaseAdmin.schema("private").from("user_rental_secrets").insert({
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
      source_rental_id: null,
      verification_status: "verified",
      template_version: 1,
    });
    if (secretsError) {
      logger.error("[/doc] Failed to save user_rental_secrets:", secretsError);
    }

    if (isRent) {
      // rental_contract_artifacts is in private schema — use explicit columns only
      const { error: rentError } = await supabaseAdmin.schema("private").from("rental_contract_artifacts").insert({
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
        deposit_rub: bike.specs?.deposit_rub || null,
        total_sum: Number(bike.specs?.dailyPrice || bike.specs?.rent_weekday || "10000"),
        template_version: 1,
      });
      if (rentError) {
        logger.error("[/doc] Failed to save rental_contract_artifacts:", rentError);
      }
    } else {
      const salePrice = context.salePrice || String(bike.specs?.sale_price || bike.specs?.price_rub || "390000");

      // sale_contract_artifacts is in private schema — use explicit columns only
      const { error: saleError } = await supabaseAdmin.schema("private").from("sale_contract_artifacts").insert({
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
      await sendComplexMessage(chatId, "❌ Формат: 99 76 123456 15.03 15.03", [], { removeKeyboard: true });
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

    const summary = buildRentSummary(context);
    await setState(userId, "confirm", context);
    await sendComplexMessage(chatId, summary, buildConfirmKeyboard(), { keyboardType: 'inline', parseMode: 'Markdown' });
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
      `✅\n\n*ВУ*\n\n99 76 123456 15.03 15.03\n(год = ${CURRENT_YEAR})`,
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

    const summary = buildRentSummary(context);
    await setState(userId, "confirm", context);
    await sendComplexMessage(chatId, summary, buildConfirmKeyboard(), { keyboardType: 'inline', parseMode: 'Markdown' });
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
