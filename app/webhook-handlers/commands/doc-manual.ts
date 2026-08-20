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
 * Flow (SALE) - 7 steps:
 *   1. Full name
 *   2. Passport → "4509 123456 15.03 ОМВД"
 *   3. Birth → "15.03.1990"
 *   4. Address → free text
 *   5. Color → inline keyboard (confirm bike.specs.color or input custom)
 *   6. VIN → inline keyboard (confirm bike.specs.vin, input custom, or skip)
 *      └─ Skip is useful when selling used bikes whose frame/VIN is unknown
 *         — the contract then renders "уточняется" via the template fallback.
 *   7. Price → inline keyboard or "390000"
 *   → Done!
 */

"use server";

import { logger } from "@/lib/logger";
import { supabaseAdmin } from "@/hooks/supabase";
import { sendComplexMessage, KeyboardButton } from "../actions/sendComplexMessage";
import { notifyAdmin, sendTelegramDocument } from "@/app/actions";
import { deriveUserAccessTier, getAccessTierLabel } from "@/app/lib/derive-access-tier";
import type { AccessTier } from "@/app/lib/ocr-constants";
import { buildFranchizeDocxFromTemplate, uploadDocxToStorage } from "@/app/franchize/lib/docx-capability";
import { createHash, randomUUID } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";
import { convertTextDateToTimestamp, resolveCrewOwnerChatId } from "@/lib/rental-date-utils";
import { buildRentalContractVariables, type CrewSecrets as RentalCrewSecrets } from "@/app/lib/rental-contract-vars";
import { privateSchema } from "@/lib/private-secrets";
import nodemailer from "nodemailer";
import { calculatePriceForDuration, getHelmetPrice } from "@/app/franchize/lib/pricing-calculator";
// v3 polish: centralized notification templates (HTML-escaped, Russian-ized, with deep links)
import { buildDocSuccessMessage, buildDocAdminAuditMessage } from "@/app/franchize/lib/notification-templates";
import { isCrewMember } from "@/app/lib/user-rental-secrets";
import { createLeadFollowupTodos } from "@/app/franchize/server-actions/crew-todos";
import { createRentalVerificationTodos } from "@/app/franchize/server-actions/rental-verification-todos";
import { getCrewBikes, getAllBikes, loadCrewSecrets as loadCrewSecretsShared, loadTemplateForCrew } from "../lib/crew-access";

// ── escapeHtml: HTML-escape user-provided strings for safe embedding in Telegram HTML messages ──
function escapeHtml(s: unknown): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CURRENT_YEAR = 2026; // 👍 Fixed current year
const DOC_STATE_EXPIRY_MINUTES = 30;

// ── Crew slug resolution ────────────────────────────────────────────────────

/**
 * Read the selected crew slug from user_states context.selectedCrew.
 * Falls back to "vip-bike" if not set.
 */
async function getDocCrewSlug(userId: string): Promise<string> {
  try {
    const { data } = await supabaseAdmin
      .from("user_states")
      .select("context")
      .eq("user_id", userId)
      .maybeSingle();
    const selectedCrew = (data?.context as any)?.selectedCrew;
    return selectedCrew || "vip-bike";
  } catch (error) {
    logger.warn("[/doc] Failed to read crew slug from user_states, using default:", error);
    return "vip-bike";
  }
}

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
 * Build end-date keyboard — shows quick-pick options.
 *
 * If startTime is known, shows a "Сегодня <start+3h>" button for short
 * hourly rentals (most common same-day scenario: start at 18:00, end at
 * 21:00). The +3h suggestion is only shown if start+3h doesn't cross
 * midnight (endH <= 23); otherwise the button is omitted and the
 * operator falls through to "✏️ Свое время".
 *
 * Remaining buttons default to the same time-of-day as the start for
 * next-day and day-after-next returns.
 */
function buildEndKeyboard(startTime?: string): KeyboardButton[][] {
  const timeLabel = startTime || "10:00";
  // Encode time as HHMM for callback_data (e.g. "15:30" → "1530")
  const timeCode = timeLabel.replace(":", "");

  const rows: KeyboardButton[][] = [];

  // Smart same-day suggestion: start + 3 hours (common short-rental duration)
  if (startTime) {
    const [h, m] = startTime.split(':').map(Number);
    const endH = h + 3;
    if (endH <= 23) {
      const sameDayTime = `${String(endH).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`;
      const sameDayCode = sameDayTime.replace(":", "");
      rows.push([{ text: `📅 Сегодня ${sameDayTime} (3 ч)`, callback_data: `e_today_${sameDayCode}` }]);
    }
  }

  rows.push([
    { text: `📅 Завтра ${timeLabel}`, callback_data: `e_tomorrow_${timeCode}` },
    { text: `📅 Послезавтра ${timeLabel}`, callback_data: `e_2days_${timeCode}` },
  ]);
  rows.push([{ text: "📅 Завтра 10:00", callback_data: "e_tomorrow_1000" }]);
  rows.push([{ text: "✏️ Свое время", callback_data: "e_custom" }]);

  return rows;
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
    [
      { text: "🔢 Исправить шаг", callback_data: "correct_step" },
      { text: "❌ Отменить", callback_data: "cancel" },
    ],
  ];
}

/**
 * Build the final SALE confirmation summary shown before contract generation.
 *
 * Includes color / VIN rows so the operator can do a last sanity check on
 * the values collected in steps 5-6. Falls back to "—" if the operator
 * skipped VIN entry, mirroring the "уточняется" that will appear in the
 * generated contract.
 */
function buildSaleSummary(context: DocFlowContext, price: string | number): string {
  const colorLine = context.saleColor
    ? `🎨 Цвет: ${context.saleColor}`
    : `🎨 Цвет: (не указан — в договоре будет «уточняется»)`;
  const vinLine = context.saleVinSkipped
    ? `🔢 VIN: пропущен (в договоре будет «уточняется»)`
    : (context.saleVin
        ? `🔢 VIN: ${context.saleVin}`
        : `🔢 VIN: (из карточки ТС)`);
  // Delivery info (NEW)
  let deliveryLine = "";
  if (context.saleDeliveryMethod === 'pickup') {
    deliveryLine = "🏪 Самовывоз";
  } else if (context.saleDeliveryMethod === 'transport_company') {
    const tc = context.saleTransportCompany || "?";
    const payer = context.saleTransportPaymentType === 'buyer_pays' ? 'покупатель' : 'за наш счёт';
    deliveryLine = `🚚 ТК: ${tc} (${payer})`;
  }

  return [
    "*📋 Продажа — проверьте:*",
    "",
    `👤 ${context.mpFullName}`,
    `🪪 ${context.mpSeries} ${context.mpNumber}`,
    `📅 ${context.mpBirthDate}`,
    `🏠 ${context.mpRegistration}`,
    "",
    colorLine,
    vinLine,
    "",
    `💰 ${Number(price).toLocaleString("ru-RU")} ₽`,
    deliveryLine ? `\n${deliveryLine}` : "",
    "",
    "Всё верно?",
  ].join("\n");
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
 * Build deposit destination keyboard — asks WHERE the deposit was collected.
 * Shown after deposit_choice (when a cash deposit amount is confirmed).
 * NOT shown if СТС is chosen (no cash deposit to track).
 */
function buildDepositDestinationKeyboard(depositAmount: number): KeyboardButton[][] {
  const formatted = depositAmount.toLocaleString("ru-RU");
  return [
    [{ text: `💵 Всё наличными (${formatted} ₽)`, callback_data: "depdest_cash" }],
    [
      { text: "💳 Тинькофф", callback_data: "depdest_tbank" },
      { text: "💳 Сбербанк", callback_data: "depdest_sber" },
    ],
    [{ text: "🔀 Смешанный", callback_data: "depdest_split" }],
    [{ text: "❌ Отменить", callback_data: "cancel" }],
  ];
}

/**
 * Navigate to the deposit destination step.
 * Called after deposit_choice confirms a cash deposit amount.
 * Skipped if СТС is chosen (stsPledgeUsed=true) or deposit=0.
 */
async function gotoDepositDestination(chatId: number, userId: string, context: DocFlowContext): Promise<void> {
  const depositAmount = Number(context.depositOverride || "20000");
  if (depositAmount <= 0) {
    // No deposit to track — skip to confirm
    logger.info(`[/doc] Deposit amount is 0, skipping deposit_destination`);
    const summary = buildRentSummary(context);
    await setState(userId, "confirm", context);
    await sendComplexMessage(chatId, summary, buildConfirmKeyboard(), { keyboardType: 'inline', parseMode: 'Markdown' });
    return;
  }
  await setState(userId, "deposit_destination", context);
  await sendComplexMessage(
    chatId,
    withStep(`💰 *Депозит: ${depositAmount.toLocaleString("ru-RU")} ₽*\n\nГде получен депозит?`, "deposit_destination", context.dealType),
    buildDepositDestinationKeyboard(depositAmount),
    { keyboardType: 'inline', parseMode: 'Markdown' },
  );
}

/**
 * Format deposit destination for display in verification summary.
 * Returns a string like " (💵 наличными)" or " (💳 Тинькофф)" or " (💵5 000 + 💳Т15 000)".
 * Returns empty string if no destination info (backward compat for old flows).
 */
function formatDepositDestination(context: DocFlowContext): string {
  const cash = context.depositCashAmount || 0;
  const card = context.depositCardAmount || 0;
  const dest = context.depositCardDestination;

  if (cash === 0 && card === 0) return ""; // no destination info
  if (cash > 0 && card === 0) return " (💵 наличными)";
  if (cash === 0 && card > 0 && dest) {
    return dest === 'tbank' ? " (💳 Тинькофф)" : " (💳 Сбербанк)";
  }
  if (cash > 0 && card > 0 && dest) {
    const destLabel = dest === 'tbank' ? '💳Т' : '💳С';
    return ` (💵${cash.toLocaleString('ru-RU')} + ${destLabel}${card.toLocaleString('ru-RU')})`;
  }
  return "";
}

/**
 * Insert deposit_entries rows for the collected deposit.
async function insertDepositEntries(rentalId: string, userId: string, context: DocFlowContext): Promise<void> {
  const depositAmount = Number(context.depositOverride || "20000");
  if (depositAmount <= 0 || context.stsPledgeUsed) {
    logger.info(`[/doc] No deposit entries to insert (amount=${depositAmount}, sts=${context.stsPledgeUsed})`);
    return;
  }

  const cashPortion = context.depositCashAmount || 0;
  const cardPortion = context.depositCardAmount || 0;
  const cardDest = context.depositCardDestination;

  // If no destination info, default to all cash (backward compat)
  if (cashPortion === 0 && cardPortion === 0) {
    try {
      await supabaseAdmin.from("deposit_entries").insert({
        rental_id: rentalId,
        entry_type: "deposit_collected",
        amount: depositAmount,
        direction: "in",
        destination: "cash",
        operator_chat_id: String(userId),
        notes: "Deposit collected via /doc (no destination specified, defaulted to cash)",
      });
      logger.info(`[/doc] Inserted deposit_entries: ${depositAmount} cash (default)`);
    } catch (err) {
      logger.warn(`[/doc] Failed to insert deposit_entries (cash default):`, err);
    }
    return;
  }

  // Insert cash portion if > 0
  if (cashPortion > 0) {
    try {
      await supabaseAdmin.from("deposit_entries").insert({
        rental_id: rentalId,
        entry_type: "deposit_collected",
        amount: cashPortion,
        direction: "in",
        destination: "cash",
        operator_chat_id: String(userId),
        notes: "Deposit (cash portion)",
      });
      logger.info(`[/doc] Inserted deposit_entries: ${cashPortion} cash`);
    } catch (err) {
      logger.warn(`[/doc] Failed to insert deposit_entries (cash):`, err);
    }
  }

  // Insert card portion if > 0
  if (cardPortion > 0 && cardDest) {
    try {
      await supabaseAdmin.from("deposit_entries").insert({
        rental_id: rentalId,
        entry_type: "deposit_collected",
        amount: cardPortion,
        direction: "in",
        destination: cardDest,
        operator_chat_id: String(userId),
        notes: `Deposit (${cardDest === 'tbank' ? 'T-Bank' : 'Sber'} portion)`,
      });
      logger.info(`[/doc] Inserted deposit_entries: ${cardPortion} ${cardDest}`);
    } catch (err) {
      logger.warn(`[/doc] Failed to insert deposit_entries (${cardDest}):`, err);
    }
  }
}

/**
 * Parse a date+time pair into a valid Date object.
 * Handles both DD.MM.YYYY (Russian) and YYYY-MM-DD (ISO) date formats.
 */
function parseRuDateTime(dateStr: string | undefined, timeStr: string | undefined): Date {
  if (!dateStr) return new Date(NaN);
  // DD.MM.YYYY → YYYY-MM-DD
  const dmy = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  const iso = dmy
    ? `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
    : dateStr;
  return new Date(`${iso}T${timeStr || '10:00'}`);
}

/**
 * Build equipment selection keyboard.
 * Shows current selections and allows toggling each item.
 */
function buildEquipmentKeyboard(context: DocFlowContext): KeyboardButton[][] {
  const helmets = context.helmets || 0;
  const gloves = context.gloves || 0;
  const jacket = context.jacket || false;
  const pants = context.pants || false;
  const boots = context.boots || false;
  const net = context.net || false;
  const backpack = context.backpack || false;
  const charger = context.charger || false;

  return [
    [
      { text: `🪖 Шлемы: ${helmets}`, callback_data: "eq_helmets" },
      { text: `🧤 Перчатки: ${gloves}`, callback_data: "eq_gloves" },
    ],
    [
      { text: `${jacket ? "✅" : "⬜"} Куртка`, callback_data: "eq_jacket" },
      { text: `${pants ? "✅" : "⬜"} Штаны`, callback_data: "eq_pants" },
    ],
    [
      { text: `${boots ? "✅" : "⬜"} Боты`, callback_data: "eq_boots" },
    ],
    [
      { text: `${net ? "✅" : "⬜"} Сетка`, callback_data: "eq_net" },
      { text: `${backpack ? "✅" : "⬜"} Рюкзак`, callback_data: "eq_backpack" },
    ],
    [
      { text: `${charger ? "✅" : "⬜"} Зарядка`, callback_data: "eq_charger" },
    ],
    [{ text: "✅ Готово", callback_data: "eq_done" }],
    [{ text: "❌ Отменить", callback_data: "cancel" }],
  ];
}

/**
 * Build payment split keyboard.
 * Shows calculated total and allows entering cash/bank split.
 */
function buildPaymentSplitKeyboard(totalAmount: number): KeyboardButton[][] {
  const formatted = totalAmount.toLocaleString("ru-RU");
  return [
    [{ text: `💰 Итого: ${formatted} ₽`, callback_data: "pay_info" }],
    // I4 enhancement: allow operator to override the calculated price
    [{ text: "✏️ Изменить цену", callback_data: "pay_override" }],
    [{ text: "💵 Ввести сумму наличными", callback_data: "pay_cash" }],
    [
      { text: "✅ Всё наличными", callback_data: "pay_all_cash" },
    ],
    [
      { text: "💳 Всё на Тинькофф", callback_data: "paydest_tbank" },
      { text: "💳 Всё на Сбербанк", callback_data: "paydest_sber" },
    ],
    [
      { text: "🔀 Смешанный (часть наличными, часть безнал)", callback_data: "paydest_split" },
    ],
    [{ text: "❌ Отменить", callback_data: "cancel" }],
  ];
}

/**
 * Build sale-color keyboard.
 *
 * Two modes depending on whether the bike card has a color:
 *   - hasColor=true:  [✅ Цвет: <color>] [✏️ Свой цвет] [❌ Отменить]
 *   - hasColor=false: [✏️ Ввести цвет] [❌ Отменить]
 *
 * The "Ввести цвет" path keeps the user in the sale_color state but clears
 * the inline keyboard — the operator then types the color as free text,
 * handled by the sale_color text-input branch.
 */
function buildSaleColorKeyboard(bikeColor: string): KeyboardButton[][] {
  const rows: KeyboardButton[][] = [];
  if (bikeColor) {
    rows.push([{ text: `✅ Цвет: ${bikeColor}`, callback_data: "salecol_confirm" }]);
  }
  rows.push([{ text: "✏️ Свой цвет", callback_data: "salecol_custom" }]);
  rows.push([{ text: "❌ Отменить", callback_data: "cancel" }]);
  return rows;
}

/**
 * Build sale-VIN keyboard.
 *
 * Three modes depending on whether the bike card has a VIN/frame:
 *   - hasVin=true:  [✅ VIN: <vin>] [✏️ Свой VIN] [⏭ Пропустить] [❌ Отменить]
 *   - hasVin=false: [✏️ Ввести VIN] [⏭ Пропустить] [❌ Отменить]
 *
 * "Пропустить" leaves context.saleVin unset and sets saleVinSkipped=true,
 * so the contract falls through to bike.specs.vin (also empty) → template
 * renders "уточняется". This is intentional for used bikes sold as-is.
 */
function buildSaleVinKeyboard(bikeVin: string): KeyboardButton[][] {
  const rows: KeyboardButton[][] = [];
  if (bikeVin) {
    // Truncate display label to keep button text readable on mobile
    const display = bikeVin.length > 20 ? `${bikeVin.slice(0, 18)}…` : bikeVin;
    rows.push([{ text: `✅ VIN: ${display}`, callback_data: "salevin_confirm" }]);
  }
  rows.push([{ text: "✏️ Свой VIN", callback_data: "salevin_custom" }]);
  rows.push([{ text: "⏭ Пропустить VIN", callback_data: "salevin_skip" }]);
  rows.push([{ text: "❌ Отменить", callback_data: "cancel" }]);
  return rows;
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

  // ── Sale flow overrides (added 2026-06-29) ────────────────────────────────
  // Sale flow has two extra steps where the operator can override the bike's
  // catalog color / VIN at contract-generation time. This is essential when
  // selling used bikes whose Supabase card lacks a color or VIN (very common
  // for trade-ins), and useful even when the card has them — lets the
  // operator double-check the values on the physical bike before signing.
  saleColor?: string;        // operator-confirmed or custom color
  saleVin?: string;          // operator-confirmed or custom VIN/frame
  saleVinSkipped?: boolean;  // operator chose to skip VIN entry (no override)

  // ── Client phone linking (added 2026-07-05) ──────────────────────────────
  // When a client arrives via web callback (phone = user_id in users table),
  // the operator can enter their phone to link the contract to the lead.
  // Used as telegram_chat_id in rental_contract_artifacts.
  clientPhone?: string;           // phone number (normalized: digits + leading +)
  clientPhoneResolved?: boolean;  // true if operator entered phone OR skipped

  // ── Equipment selection (added 2026-07-06) ────────────────────────────────
  // Additional equipment rented with the bike. Prices: helmet=500 (hourly <24h) or 1000 (daily ≥24h),
  // gloves=500, jacket=500, pants=500, boots=500, net=500, backpack=500, bag=500, charger=0 (free but tracked for return).
  helmets?: number;        // 0-2 helmets
  gloves?: number;         // 0-2 pairs of gloves
  jacket?: boolean;        // motorcycle jacket
  pants?: boolean;         // motorcycle pants
  boots?: boolean;         // motorcycle boots
  net?: boolean;           // safety net
  backpack?: boolean;      // backpack
  bag?: boolean;           // small bag
  charger?: boolean;       // charger (free, but tracked for return)

  // ── Odometer reading (added 2026-07-06) ───────────────────────────────────
  // Odometer value before rental (in km). Used for damage/overage tracking.
  odometerBefore?: number;

  // ── Payment split (added 2026-07-06) ──────────────────────────────────────
  // How the total is split between cash and bank transfer.
  cashAmount?: number;     // amount paid in cash
  bankAmount?: number;     // amount paid by bank transfer
  // Which bank card the bank portion went to (mirrors depositCardDestination).
  // Set by paydest_tbank / paydest_sber / paysplit_tbank / paysplit_sber callbacks.
  paymentCardDestination?: 'tbank' | 'sber';
  // I4 code-review fix: when operator overrides the price, this flag prevents
  // gotoPaymentSplit + all pay_* handlers + createRentalFromDocContract from
  // re-calculating the price from scratch and discarding the override.
  priceOverridden?: boolean;

  // ── Deposit destination (added 2026-08-10) ────────────────────────────────
  // Tracks WHERE the deposit was collected: cash, T-Bank card, Sber card, or split.
  // If depositCashAmount + depositCardAmount = total deposit, split is recorded.
  // If stsPledgeUsed=true, these fields are undefined (no cash deposit).
  depositCashAmount?: number;      // cash portion of deposit (0 if all card)
  depositCardDestination?: 'tbank' | 'sber';  // which card for the card portion
  depositCardAmount?: number;      // card portion of deposit (0 if all cash)

  // ── Step tracking (added 2026-08-10) ──────────────────────────────────────
  // Used for step numbering ("Шаг 3/17") and step correction.
  currentStep?: number;
  totalSteps?: number;
  correctedSteps?: number[];

  // ── Delivery method (added 2026-08-10 — sale only) ────────────────────────
  saleDeliveryMethod?: 'pickup' | 'transport_company';
  saleTransportCompany?: string;
  saleTransportPaymentType?: 'buyer_pays' | 'seller_pays';
}

// ── Step arrays for flow-specific numbering ──────────────────────────────────

interface StepDef { num: number | string; state: string; label: string; }

const RENT_STEPS: StepDef[] = [
  { num: 1, state: 'deal', label: 'Тип сделки' },
  { num: 2, state: 'bike', label: 'Выбор байка' },
  { num: 3, state: 'name', label: 'ФИО' },
  { num: 4, state: 'passport', label: 'Паспорт' },
  { num: 5, state: 'birth', label: 'Дата рождения' },
  { num: 6, state: 'address', label: 'Адрес регистрации' },
  { num: 7, state: 'has_license', label: 'Наличие ВУ' },
  { num: 8, state: 'categories', label: 'Категории ВУ' },
  { num: 9, state: 'schedule_start', label: 'Дата и время начала' },
  { num: 10, state: 'schedule_end', label: 'Дата и время окончания' },
  { num: 11, state: 'equipment', label: 'Оборудование' },
  { num: 12, state: 'odometer', label: 'Одометр' },
  { num: 13, state: 'payment_split', label: 'Способ оплаты' },
  { num: 14, state: 'deposit_choice', label: 'Депозит / СТС' },
  { num: 15, state: 'deposit_destination', label: 'Где получен депозит' },
  { num: '15a', state: 'deposit_split_cash', label: 'Смешанный: сколько наличными' },
  { num: '15b', state: 'deposit_split_card', label: 'Смешанный: выбор карты' },
  { num: 16, state: 'confirm', label: 'Проверка данных' },
  // СТС sub-flow states (not numbered — shown as "СТС: серия" etc.)
  { num: 'СТС-1', state: 'sts_series', label: 'СТС: серия и номер' },
  { num: 'СТС-2', state: 'sts_plate', label: 'СТС: госномер' },
  { num: 'СТС-3', state: 'sts_owner', label: 'СТС: собственник' },
  { num: 'СТС-4', state: 'sts_relation', label: 'СТС: отношение' },
  { num: 'СТС-5', state: 'sts_vehicle', label: 'СТС: ТС' },
  { num: 'СТС-6', state: 'sts_vin', label: 'СТС: VIN' },
];

const SALE_STEPS: StepDef[] = [
  { num: 1, state: 'deal', label: 'Тип сделки' },
  { num: 2, state: 'bike', label: 'Выбор байка' },
  { num: 3, state: 'name', label: 'ФИО' },
  { num: 4, state: 'passport', label: 'Паспорт' },
  { num: 5, state: 'birth', label: 'Дата рождения' },
  { num: 6, state: 'address', label: 'Адрес регистрации' },
  { num: 7, state: 'sale_color', label: 'Цвет' },
  { num: 8, state: 'sale_vin', label: 'VIN' },
  { num: 9, state: 'price', label: 'Цена' },
  { num: 10, state: 'client_phone', label: 'Телефон покупателя' },
  { num: 11, state: 'sale_delivery', label: 'Способ получения' },
  { num: 12, state: 'sale_transport', label: 'Транспортная компания' },
  { num: 13, state: 'confirm', label: 'Проверка данных' },
];

/**
 * Get step label for the current state.
 * Returns "Шаг 3/16" for numbered steps, "СТС-1" for СТС sub-flow,
 * or "" if state not found.
 */
function stepLabel(state: string, dealType?: string): string {
  const steps = dealType === 'sale' ? SALE_STEPS : RENT_STEPS;
  const step = steps.find(s => s.state === state);
  if (!step) return '';
  if (typeof step.num === 'string' && step.num.startsWith('СТС')) {
    return String(step.num);
  }
  const total = dealType === 'sale' ? 13 : 16;
  return `Шаг ${step.num}/${total}`;
}

/**
 * Prepend step label to a message text.
 * Returns "Шаг 3/16\n\n<message>" or just "<message>" if no step found.
 */
// I4 enhancement (user request): step numbers are no longer shown in prompts.
// Previously withStep() prepended "Шаг N/M\n\n" to the message — but only for
// SOME steps (inconsistent). User requested removing step numbers entirely.
//
// The function is kept for backward compat (callers still pass state/dealType)
// but now just returns the message unchanged. The stepLabel() function is still
// used internally by getVisibleSteps() for the step-correction list (which
// shows "N. <label>" using step.label, not stepLabel()).
function withStep(message: string, state: string, dealType?: string): string {
  return message;
}

/**
 * Get visible steps for step correction (filter out conditional states).
 */
function getVisibleSteps(context: DocFlowContext): StepDef[] {
  const steps = context.dealType === 'sale' ? SALE_STEPS : RENT_STEPS;
  return steps.filter(s => {
    // Always hide confirm and СТС sub-states from correction list
    if (s.state === 'confirm') return false;
    if (typeof s.num === 'string' && s.num.startsWith('СТС')) return false;
    // Hide deposit_destination if СТС chosen
    if (s.state === 'deposit_destination' && context.stsPledgeUsed) return false;
    // Hide split sub-states if not in split mode
    if (s.state === 'deposit_split_cash' && context.depositCardDestination === undefined) return false;
    if (s.state === 'deposit_split_card' && context.depositCardDestination === undefined) return false;
    // Hide sale_transport if not TC
    if (s.state === 'sale_transport' && context.saleDeliveryMethod !== 'transport_company') return false;
    return true;
  });
}

// ── Bike resolution ─────────────────────────────────────────────────────

async function resolveBikeById(bikeId: string): Promise<any> {
  const { data: exactMatch } = await supabaseAdmin
    .from("cars")
    .select("id, make, model, specs, type, crew_id, owner_id")
    .eq("id", bikeId)
    .in("type", ["bike", "ebike"])
    .maybeSingle();
  if (exactMatch) return exactMatch;

  const { data: candidates } = await supabaseAdmin
    .from("cars")
    .select("id, make, model, specs, type, crew_id, owner_id")
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
  // Fallback: return ALL bikes (for admin use)
  return await getAllBikes();
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
 * Capitalize each word in a full name (ФИО) for proper document formatting.
 * Converts any input case to Russian Title Case, which is the convention
 * for formal contracts:
 *   "иванов иван иванович" → "Иванов Иван Иванович"
 *   "ИВАНОВ"               → "Иванов"
 *   "оруджов-салавеев"      → "Оруджов-Салавеев"
 *   "pavel"                → "Pavel"
 *
 * Handles hyphenated names (capitalises after each hyphen), collapses
 * extra whitespace, and works for both Cyrillic and Latin alphabets.
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
        // Capitalise first char and any char that follows a hyphen
        .replace(/(^|-)([a-zа-яё])/gi, (_m, prefix: string, char: string) => prefix + char.toUpperCase())
    )
    .join(' ');
}

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
 * Parse end date only: "сегодня 21", "завтра 10", "послезавтра 10", "16.06 10", "16.06.2026 10:00"
 * startDate is the rent start date (DD.MM.YYYY) used to resolve relative dates.
 * "сегодня" = same calendar day as the start date (for short hourly rentals).
 */
function parseEndDate(text: string, startDate?: string): { date: string; time: string } | null {
  const t = text.trim().toLowerCase();
  const today = new Date();
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const dayAfter = new Date(today); dayAfter.setDate(today.getDate() + 2);

  // startRef is used ONLY for "сегодня" — an alias for "same calendar day as start"
  // (short hourly rentals like 18:00 → 21:00).
  // "завтра" / "послезавтра" are relative to TODAY (calendar semantics), matching
  // parseStartDate — otherwise a "завтра ... → завтра ..." rent reads as +1 day.
  let startRef = new Date(today);
  if (startDate) {
    const sp = startDate.split('.');
    if (sp.length === 3) startRef = new Date(`${sp[2]}-${sp[1]}-${sp[0]}`);
  }

  const formatDate = (d: Date) => `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;

  // "сегодня 21" or "сегодня 21:00" — same day as start date (short hourly rentals)
  const todayMatch = t.match(/сегодня\s+(\d{1,2})(:(\d{2}))?/);
  if (todayMatch) {
    const hour = todayMatch[1].padStart(2, '0');
    const min = todayMatch[3] || '00';
    return { date: formatDate(startRef), time: `${hour}:${min}` };
  }

  // "завтра 10" or "завтра 10:00" — relative to TODAY (consistent with parseStartDate)
  const tomorrowMatch = t.match(/завтра\s+(\d{1,2})(:(\d{2}))?/);
  if (tomorrowMatch) {
    const hour = tomorrowMatch[1].padStart(2, '0');
    const min = tomorrowMatch[3] || '00';
    return { date: formatDate(tomorrow), time: `${hour}:${min}` };
  }

  // "послезавтра 10" — relative to TODAY
  const dayAfterMatch = t.match(/послезавтра\s+(\d{1,2})(:(\d{2}))?/);
  if (dayAfterMatch) {
    const hour = dayAfterMatch[1].padStart(2, '0');
    const min = dayAfterMatch[3] || '00';
    return { date: formatDate(dayAfter), time: `${hour}:${min}` };
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
  const hasLicense = (context.mlCategories || []).length > 0 && context.mlCategories[0] !== "нет";
  const lines = [
    "*📋 Проверьте: *",
    "",
    `👤 ${context.mpFullName}`,
    `🪪 ${context.mpSeries} ${context.mpNumber} от ${context.mpIssueDate}`,
    `📅 ${context.mpBirthDate}`,
  ];
  if (hasLicense) {
    lines.push("", `🚗 ВУ: категории ${(context.mlCategories || []).join(", ")}`);
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
    const depositLabel = formatDepositDestination(context);
    lines.push("", `💰 Депозит: ${Number(deposit).toLocaleString("ru-RU")} ₽${depositLabel}`);
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
 * Parse Russian vehicle plate, e.g. "А123БВ77" or "А123ВС77".
 * Validates the standard format: Letter(1-2) Digits(3) Letters(2) Region(2-3)
 * Uses the standard 12 GOST letters + Б (common in older/special series).
 */
function parseStsPlate(text: string): string | null {
  const t = text.trim().toUpperCase().replace(/\s+/g, "");
  // Russian GOST plate letters + common extras like Б
  const LETTERS = "АБВЕКМНОРСТУХABEKMHOPCTYX";
  const LETTERS_CLASS = `[${LETTERS}]`;
  // Standard Russian plate format: A123BC77 (1 letter + 3 digits + 2 letters + 2-3 digit region)
  const stdRe = new RegExp(`^${LETTERS_CLASS}\\d{3}${LETTERS_CLASS}{2}(\\d{2,3})$`);
  if (stdRe.test(t)) return t;
  // Allow trailing RUS suffix
  const rusRe = new RegExp(`^${LETTERS_CLASS}\\d{3}${LETTERS_CLASS}{2}(\\d{2,3})RUS?$`, "i");
  const m2 = t.match(rusRe);
  if (m2) return t.replace(/RUS?$/i, "");
  // Trailer / moto format: 2 letters + 4 digits + region (e.g. АБ1234 77)
  const motoRe = new RegExp(`^${LETTERS_CLASS}{2}\\d{4}(\\d{2,3})$`);
  if (motoRe.test(t)) return t;
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
async function loadCrewSecrets(crewSlug: string): Promise<RentalCrewSecrets> {
  const fallbacks: Record<string, string> = {
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
    returnAddress: "г. Нижний Новгород, пл. Комсомольская 2",
  };

  const merged = await loadCrewSecretsShared(crewSlug, fallbacks);

  return {
    organizationName: merged.organizationName || fallbacks.organizationName,
    organizationShort: merged.organizationShort || fallbacks.organizationShort,
    ogrnip: merged.ogrnip || fallbacks.ogrnip,
    inn: merged.inn || fallbacks.inn,
    bankAccount: merged.bankAccount || fallbacks.bankAccount,
    bankName: merged.bankName || fallbacks.bankName,
    bankCity: merged.bankCity || fallbacks.bankCity,
    bankCorrAccount: merged.bankCorrAccount || fallbacks.bankCorrAccount,
    email: merged.email || fallbacks.email,
    legalAddress: merged.legalAddress || fallbacks.legalAddress,
    issuerName: merged.issuerName || fallbacks.issuerName,
    signatoryRole: merged.signatoryRole || fallbacks.signatoryRole,
    organizationRepresentative: merged.organizationRepresentative || fallbacks.organizationRepresentative,
    issuerRepresentative: merged.issuerRepresentative || merged.organizationRepresentative || fallbacks.organizationRepresentative,
    returnAddress: merged.returnAddress || fallbacks.returnAddress,
    contractDefaults: merged,
  };
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
    logger.info('[/doc] createRentalFromDocContract: starting', {
      chatId,
      userId,
      bikeId: bike.id,
      crewId: bike.crew_id,
      rentStartDate: context.rentStartDate,
      rentStartTime: context.rentStartTime,
      rentEndDate: context.rentEndDate,
      rentEndTime: context.rentEndTime,
    });

    // Convert TEXT dates to TIMESTAMPTZ
    const startDateIso = context.rentStartDate && context.rentStartTime
      ? convertTextDateToTimestamp(context.rentStartDate, context.rentStartTime, 3)
      : null;

    const endDateIso = context.rentEndDate && context.rentEndTime
      ? convertTextDateToTimestamp(context.rentEndDate, context.rentEndTime, 3)
      : null;

    logger.info('[/doc] createRentalFromDocContract: date conversion', {
      startDateIso,
      endDateIso,
      rentStartDate: context.rentStartDate,
      rentStartTime: context.rentStartTime,
      rentEndDate: context.rentEndDate,
      rentEndTime: context.rentEndTime,
    });

    if (!startDateIso || !endDateIso) {
      logger.error('[/doc] Date conversion failed', {
        startDateIso,
        endDateIso,
        rentStartDate: context.rentStartDate,
        rentStartTime: context.rentStartTime,
        rentEndDate: context.rentEndDate,
        rentEndTime: context.rentEndTime,
      });
      return null;
    }

    // Calculate total cost with tier-aware pricing
    const baseDailyPrice = Number(bike.specs?.dailyPrice || bike.specs?.rent_weekday || '10000');
    const start = new Date(startDateIso);
    const end = new Date(endDateIso);
    const hours = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60) * 10) / 10;
    const days = Math.max(1, Math.ceil(hours / 24));

    // Use tier-aware pricing calculator (handles 3h/6h/12h tiers, weekday/weekend, multi-day)
    const specsForPricing = {
      price_per_hour: bike.specs?.price_per_hour,
      price_per_2h: bike.specs?.price_per_2h,
      price_per_3h: bike.specs?.price_per_3h,
      price_per_6h: bike.specs?.price_per_6h,
      price_per_12h: bike.specs?.price_per_12h,
      dailyPrice: bike.specs?.dailyPrice,
      rent_weekday: bike.specs?.rent_weekday,
      rent_weekend: bike.specs?.rent_weekend,
      rent_2_4d: bike.specs?.rent_2_4d,
      rent_5_10d: bike.specs?.rent_5_10d,
      rent_11_30d: bike.specs?.rent_11_30d,
    };
    const tierResult = calculatePriceForDuration(specsForPricing, hours, startDateIso);
    const dailyPrice = Number(tierResult.rate > 0 ? tierResult.rate : baseDailyPrice);
    // FIX: ensure totalCost is a number (tierResult.price can be string from JSONB specs)
    // Also add equipment costs to totalCost (was missing — only rental price was saved)
    const baseRentalCost = Number(tierResult.price > 0 ? tierResult.price : baseDailyPrice * days);
    const helmetsEq = context.helmets || 0;
    const glovesEq = context.gloves || 0;
    const jacketEq = context.jacket ? 1 : 0;
    const pantsEq = context.pants ? 1 : 0;
    const bootsEq = context.boots ? 1 : 0;
    const netEq = context.net ? 1 : 0;
    const backpackEq = context.backpack ? 1 : 0;
    const bagEq = context.bag ? 1 : 0;
    const equipmentCostTotal = helmetsEq * getHelmetPrice(hours) + glovesEq * 500 + jacketEq * 500 + pantsEq * 500 + bootsEq * 500 + netEq * 500 + backpackEq * 500 + bagEq * 500;
    // CR fix: if operator overrode the price, use the overridden value
    // (cashAmount + bankAmount) instead of the recalculated total.
    const totalCost = context.priceOverridden
      ? (context.cashAmount || 0) + (context.bankAmount || 0)
      : (baseRentalCost + equipmentCostTotal);

    logger.info('[/doc] createRentalFromDocContract: pricing', {
      dailyPrice,
      hours,
      days,
      baseRentalCost,
      equipmentCostTotal,
      totalCost,
      tier: tierResult.period,
      tierPrice: tierResult.price,
    });

    // Resolve crew owner for placeholder user_id
    // Fail if crew owner cannot be resolved - don't fall back to renter
    if (!bike.crew_id) {
      logger.error("[/doc] Bike has no crew_id, cannot resolve crew owner", { bikeId: bike.id });
      return null;
    }
    const effectiveCrewId = bike.crew_id;
    const crewOwnerChatId = await resolveCrewOwnerChatId(supabaseAdmin, effectiveCrewId);
    
    logger.info('[/doc] createRentalFromDocContract: crew owner resolution', {
      crewId: effectiveCrewId,
      originalCrewId: bike.crew_id,
      crewOwnerChatId,
    });
    
    if (!crewOwnerChatId) {
      logger.error('[/doc] No crew owner found for crew_id:', bike.crew_id);
      return null;
    }

    // Create rentals row
    const rentalInsert = {
      user_id: crewOwnerChatId,
      owner_id: crewOwnerChatId,
      created_by_operator_chat_id: crewOwnerChatId,
      crew_id: effectiveCrewId,  // 2026-08-19 review: was MISSING — rental insert failed silently because crew_id is required
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
        doc_sha256: docSha256,
        // Store renter name + phone in metadata so the admin page can display
        // the actual renter (not the crew owner placeholder user_id).
        renter_name: context.mpFullName || '',
        renter_phone: context.clientPhone || '',
        // CR fix: store equipment in metadata so getRentalReturnTodos can
        // generate accessory return-checklist items for this rental.
        equipment: {
          helmets: context.helmets || 0,
          gloves: context.gloves || 0,
          jacket: context.jacket || false,
          pants: context.pants || false,
          boots: context.boots || false,
          net: context.net || false,
          backpack: context.backpack || false,
          bag: context.bag || false,
          charger: context.charger || false,
        },
        // CR fix: record if the operator overrode the calculated price
        price_overridden: context.priceOverridden || false,
        price_override_amount: context.priceOverridden
          ? (context.cashAmount || 0) + (context.bankAmount || 0)
          : null,
        // Fix: store odometer_before so RentalOdometerDelta can display it
        odometer_before: context.odometerBefore || null,
        // Fix: store payment split so closure modal can show "было получено"
        payment_split: {
          cash: context.cashAmount || 0,
          bank: context.bankAmount || 0,
          card_destination: context.paymentCardDestination || null,
        },
      },
    };

    logger.info('[/doc] createRentalFromDocContract: inserting rental', rentalInsert);

    const { data: rental, error: rentalError } = await supabaseAdmin
      .from('rentals')
      .insert(rentalInsert)
      .select('rental_id')
      .maybeSingle();

    if (rentalError) {
      logger.error('[/doc] Failed to create rental:', {
        error: rentalError,
        insert: rentalInsert,
      });
      return null;
    }

    if (!rental?.rental_id) {
      logger.error('[/doc] No rental_id returned', { rental });
      return null;
    }

    logger.info('[/doc] Created rental:', rental.rental_id);

    // ── I5: Create equipment_rentals rows for equipment rented with bike ─────
    // Maps equipment flags from context to equipment_rental rows with primary_rental_id
    if (bike.crew_id && (context.helmets || context.gloves || context.jacket || context.boots)) {
      try {
        const { createEquipmentRowsForRental } = await import('@/app/franchize/server-actions/equipment-rentals');
        const equipmentResult = await createEquipmentRowsForRental({
          rentalId: rental.rental_id,
          context,
          operatorChatId: String(userId),
          crewId: bike.crew_id,
        });
        if (equipmentResult.success) {
          logger.info(`[/doc] Created ${equipmentResult.created} equipment_rentals rows`);
        } else {
          logger.warn(`[/doc] Failed to create equipment_rentals: ${equipmentResult.error}`);
        }
      } catch (eqErr: any) {
        logger.warn(`[/doc] Equipment rental creation exception (non-fatal): ${eqErr?.message}`);
      }
    }

    return rental.rental_id;
  } catch (error) {
    logger.error('[/doc] Rental creation exception:', error);
    return null;
  }
}

async function generateContract(chatId: number, userId: string, context: DocFlowContext, crewSlug?: string): Promise<boolean> {
  try {
    const bike = await resolveBikeById(context.bikeId);
    if (!bike) {
      await sendComplexMessage(chatId, "🚨 Байк не найден. Попробуйте /doc", [], { removeKeyboard: true });
      return false;
    }

    // Load crew secrets for contract defaults
    const resolvedSlug = crewSlug || await getDocCrewSlug(userId);
    const crewSecrets = await loadCrewSecrets(resolvedSlug);

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
          phone: context.clientPhone || "",
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
        // Equipment selection
        equipment: {
          helmets: context.helmets || 0,
          gloves: context.gloves || 0,
          jacket: context.jacket || false,
          pants: context.pants || false,
          boots: context.boots || false,
          net: context.net || false,
          backpack: context.backpack || false,
          bag: context.bag || false,
          charger: context.charger || false,
        },
        // Odometer reading
        odometerBefore: context.odometerBefore || 0,
        // Payment split
        paymentSplit: {
          cashAmount: context.cashAmount || 0,
          bankAmount: context.bankAmount || 0,
        },
        // 2026-08-19 review: pass the override flag so buildRentalContractVariables
        // uses the operator's custom price instead of recalculating from tiers.
        priceOverridden: context.priceOverridden || false,
        // Deposit payment method (how the deposit was collected — cash/card)
        depositPaymentMethod: (() => {
          const depCash = context.depositCashAmount || 0;
          const depCard = context.depositCardAmount || 0;
          const depDest = context.depositCardDestination;
          if (depCash > 0 && depCard > 0) {
            return `наличными ${depCash} ₽ + на карту (${depDest === 'tbank' ? 'Тинькофф' : 'Сбербанк'}) ${depCard} ₽`;
          }
          if (depCard > 0) {
            return `на карту (${depDest === 'tbank' ? 'Тинькофф' : 'Сбербанк'})`;
          }
          if (depCash > 0) {
            return 'наличными';
          }
          // Default: if no deposit payment info, just say "наличными"
          return 'наличными';
        })(),
      });
    } else {
      // Sale contract still uses manual construction (TODO: could be extracted too)
      const salePrice = context.salePrice || String(bike.specs?.sale_price || bike.specs?.price_rub || "390000");
      // Effective color/VIN: prefer operator overrides collected in steps 5-6,
      // fall back to bike.specs, finally to the template's "уточняется".
      // Override resolution rules:
      //   - saleColor set     → use operator-confirmed/entered color
      //   - saleColor unset   → fall back to bike.specs.color
      //   - saleVin set       → use operator-confirmed/entered VIN
      //   - saleVinSkipped    → empty string (forces "уточняется" downstream)
      //   - neither (confirm) → fall back to bike.specs.vin || frame
      const effectiveColor = context.saleColor != null && context.saleColor !== ""
        ? context.saleColor
        : (bike.specs?.color || "уточняется");
      const bikeCatalogVin = String(bike.specs?.vin || bike.specs?.frame || bike.specs?.vin_number || "").trim();
      // VIN: leave BLANK (not "уточняется") when no VIN is available.
      // The contract template will show an empty field — better to have no VIN
      // than a fake "уточняется" placeholder that looks like data.
      const effectiveVin = context.saleVinSkipped
        ? ""
        : (context.saleVin != null && context.saleVin !== ""
            ? context.saleVin
            : bikeCatalogVin);
      logger.info(`[/doc] SALE overrides: color=${effectiveColor} vin=${effectiveVin} (saleColor=${context.saleColor ?? "<unset>"} saleVin=${context.saleVin ?? "<unset>"} skipped=${!!context.saleVinSkipped})`);
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
        product_color: effectiveColor,
        product_type: bike.specs?.bike_subtype || (isElectric ? "Электромотоцикл" : "Мотоцикл"),
        product_motor_type: isElectric ? "Электрический двигатель" : "ДВС",
        product_motor_power: bike.specs?.power_kw ? `${bike.specs.power_kw} кВт` : (bike.specs?.engine_cc ? `рабочий объем ${bike.specs.engine_cc} куб.см` : ""),
        product_vin: effectiveVin,
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
        bike_vin: effectiveVin,
        bike_category: bike.specs?.category || "A/L3",
        bike_color: effectiveColor,
        bike_year: bike.specs?.year || "уточняется",
        bike_engine_cc: String(bike.specs?.engine_cc || bike.specs?.displacement_cc || "0"),
        bike_power_hp: String(bike.specs?.power_hp || bike.specs?.max_power_hp || "0"),
        // All electric bikes capped at 3kW in contracts (regulatory class limit for L1B/L2B)
        bike_power_kw: (() => {
          const raw = String(bike.specs?.power_kw || "0");
          if (isElectric) {
            const num = Number(raw);
            return num > 3 ? "3" : raw;
          }
          return raw;
        })(),
        bike_battery: String(bike.specs?.battery || (isElectric ? "уточняется" : "")),
        buyer_phone: context.clientPhone || "",
        // Delivery fields (NEW)
        delivery_method: context.saleDeliveryMethod || "",
        delivery_method_label: context.saleDeliveryMethod === 'pickup' ? "Самовывоз из шоурума"
          : context.saleDeliveryMethod === 'transport_company' ? "Транспортная компания" : "",
        transport_company_name: context.saleTransportCompany || "",
        transport_payment_label: context.saleTransportPaymentType === 'buyer_pays' ? "за счёт покупателя"
          : context.saleTransportPaymentType === 'seller_pays' ? "за счёт продавца" : "",
      };
    }

    // Load HTML template based on deal type — check crew-specific first
    const templateKey = isRent ? "rental" : "sale";
    let htmlTemplate: string;
    try {
      htmlTemplate = loadTemplateForCrew(templateKey, resolvedSlug);
    } catch (templateErr) {
      logger.error("[/doc] Failed to load template:", templateErr);
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

    // --- Upload DOCX to Supabase Storage (rental-contracts bucket) ---
    let docStoragePath: string | null = null;
    try {
      const uploadResult = await uploadDocxToStorage({
        crewSlug: resolvedSlug,
        contractKey: vars.document_key,
        buffer: docxBuf,
        metadata: {
          source: `telegram-doc-${isRent ? 'rental' : 'sale'}`,
          bike_id: bike.id,
          client: context.mpFullName || "",
        },
      });
      docStoragePath = uploadResult.storagePath;
      logger.info("[/doc] DOCX uploaded to storage:", docStoragePath);
    } catch (uploadErr) {
      logger.warn("[/doc] Storage upload failed (non-fatal):", uploadErr);
    }

    const qrDeepLink = `https://t.me/oneBikePlsBot/app?startapp=rent_${bike.id}_${docSha256}`;
    const qrPngUrl = `https://api.qrserver.com/v1/create-qr-code/?size=420x420&data=${encodeURIComponent(qrDeepLink)}&color=000000&bgcolor=ffffff`;

    let qrPngBuffer: Buffer | null = null;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const qrRes = await fetch(qrPngUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (qrRes.ok) qrPngBuffer = Buffer.from(await qrRes.arrayBuffer());
    } catch (qrErr) {
      logger.warn("[/doc] QR failed:", qrErr);
    }

    // Send DOCX via Telegram directly (no media group, separate send)
    try {
      await sendTelegramDocument(String(chatId), docxBuf, docFileName);
      logger.info("[/doc] DOCX sent via sendTelegramDocument");
    } catch (e) {
      logger.error("[/doc] sendTelegramDocument failed:", e);
    }

    // Send QR as separate photo (if available)
    if (qrPngBuffer) {
      try {
        const formData = new FormData();
        formData.append("chat_id", String(chatId));
        formData.append("photo", new Blob([new Uint8Array(qrPngBuffer)], { type: "image/png" }), "qr.png");
        formData.append("caption", `📲 QR для быстрой повторной аренды
${qrDeepLink}`);
        formData.append("parse_mode", "HTML");
        await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN || TELEGRAM_BOT_TOKEN}/sendPhoto`, { method: "POST", body: formData });
        logger.info("[/doc] QR photo sent");
      } catch (qrSendErr) {
        logger.warn("[/doc] QR photo send failed:", qrSendErr);
      }
    }

    // ── Send DOCX to crew email (aligned with web app flow) ──────────────
    try {
      const smtpHost = process.env.SMTP_HOST || process.env.SMTP_YANDEX_HOST;
      const smtpPort = Number(process.env.SMTP_PORT || process.env.SMTP_YANDEX_PORT || 465);
      const smtpUser = process.env.SMTP_USER || process.env.SMTP_YANDEX_USER;
      const smtpPass = process.env.SMTP_PASS || process.env.SMTP_YANDEX_PASS;
      const emailFrom = process.env.EMAIL_FROM || smtpUser;
      const emailTo = process.env.EMAIL_DEFAULT_TO || crewSecrets.email || "vip_bike@mail.ru";
      if (smtpHost && smtpUser && smtpPass) {
        const docType = isRent ? "аренды" : "купли-продажи";
        const emailBody = [
          `Договор ${docType} №${vars.contract_number || vars.document_key}`,
          ``,
          `Байк: ${bike.make} ${bike.model}`,
          `Клиент: ${context.mpFullName || "—"}`,
          `Телефон: ${context.clientPhone || "—"}`,
          ``,
          isRent
            ? `Период: ${context.rentStartDate || "?"} ${context.rentStartTime || ""} → ${context.rentEndDate || "?"} ${context.rentEndTime || ""}`
            : `Цена: ${context.salePrice || "?"} ₽`,
          ``,
          `Договор сгенерирован через /doc команду.`,
          `Документ во вложении.`,
        ].join("\n");
        const transporter = nodemailer.createTransport({
          host: smtpHost, port: smtpPort, secure: smtpPort === 465,
          auth: { user: smtpUser, pass: smtpPass },
          connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 8000,
        });
        // Fire-and-forget — don't block the command on email
        transporter.sendMail({
          from: emailFrom, to: emailTo,
          subject: `Договор ${docType} — ${bike.make} ${bike.model}`,
          text: emailBody,
          attachments: [{
            filename: docFileName,
            content: docxBuf,
            contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          }],
        }).then(() => logger.info(`[/doc] Email with DOCX sent to ${emailTo}`))
          .catch((emailErr: any) => logger.warn("[/doc] Email send failed (non-fatal):", emailErr?.message || emailErr));
      }
    } catch (emailSetupErr) {
      logger.warn("[/doc] Email setup failed:", emailSetupErr);
    }

    let rentalId: string | null = null;
    if (isRent) {
      // Create rentals row for unified tracking (before artifact)
      try {
        rentalId = await createRentalFromDocContract(chatId, String(userId), context, bike, docSha256);
        if (rentalId) {
          logger.info('[/doc] Rental created successfully:', rentalId);
          // Insert deposit_entries rows (tracks WHERE deposit was collected: cash/tbank/sber/split)
          await insertDepositEntries(rentalId, String(userId), context);
        } else {
          logger.warn('[/doc] Failed to create rental, continuing without rental_id');
        }
      } catch (rentalErr) {
        logger.error('[/doc] Rental creation exception:', rentalErr);
      }
    }

    // Save rental secrets for 1-click next rent.
    // If the caller is a crew member (operator creating contract for a renter),
    // leave chat_id NULL so the operator does not accidentally load the renter's
    // personal data in their own profile/order. The renter claims it via QR.
    const creatorIsCrewMember = await isCrewMember(String(userId), resolvedSlug);
    const secretChatId = creatorIsCrewMember ? null : String(userId);
    const { error: secretsError } = await privateSchema().from("user_rental_secrets").insert({
      chat_id: secretChatId,
      crew_slug: resolvedSlug,
      doc_sha256: docSha256,
      renter_full_name: context.mpFullName || null,
      renter_passport: `${context.mpSeries || ""} ${context.mpNumber || ""}`.trim() || null,
      renter_passport_issue_date: context.mpIssueDate || null,
      renter_passport_issued_by: context.mpIssuedBy || null,
      renter_registration: context.mpRegistration || null,
      renter_driver_license: isRent ? `${context.mlSeries || ""} ${context.mlNumber || ""}`.trim() || null : null,
      renter_birth_date: context.mpBirthDate || null,
      renter_phone: context.clientPhone || null,
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
        crew_slug: resolvedSlug,
        storage_path: docStoragePath,
        original_sha256: docSha256,
        requested_bike_id: context.bikeId,
        resolved_bike_id: bike.id,
        telegram_chat_id: String(userId),          // Always operator's Telegram ID (will be re-linked on QR claim)
        created_by_operator_chat_id: String(userId), // Preserved forever — never overwritten
        renter_phone: context.clientPhone || null,  // Phone in dedicated column (was wrongly stored in telegram_chat_id)
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
        daily_price: Number(vars.daily_price_rub) || bike.specs?.dailyPrice || bike.specs?.rent_weekday || null,
        deposit_rub: depositForRecord,
        total_sum: Number(vars.subtotal_rub) || Number(vars.pricing_tier_price_rub) || Number(bike.specs?.dailyPrice || bike.specs?.rent_weekday || "10000"),
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

      // Dedup by semantic key: same renter + same bike + same start date = duplicate (retry)
      const dedupRentKey = [
        (context.mpFullName || "").trim().toUpperCase(),
        context.bikeId,
        context.rentStartDate,
      ].join("|");
      const { data: existingRental } = await privateSchema()
        .from("rental_contract_artifacts")
        .select("id, storage_path")
        .eq("crew_slug", resolvedSlug)
        .eq("renter_full_name", context.mpFullName || "")
        .eq("requested_bike_id", context.bikeId)
        .eq("rent_start_date", context.rentStartDate || "")
        .maybeSingle();

      if (existingRental) {
        logger.info("[/doc] Duplicate rental detected (same renter+bike+date), skipping. existing id:", existingRental.id, "key:", dedupRentKey);
        // Backfill storage_path on existing record if missing
        if (!existingRental.storage_path && docStoragePath) {
          await privateSchema().from("rental_contract_artifacts").update({ storage_path: docStoragePath }).eq("id", existingRental.id);
          logger.info("[/doc] Backfilled storage_path on existing rental artifact");
        }
      } else {
        const { error: rentError } = await privateSchema()
          .from("rental_contract_artifacts")
          .insert(rentInsert);
        if (rentError) {
          logger.error("[/doc] Failed to save rental_contract_artifacts:", rentError);
        }
      }
    } else {
      const salePrice = context.salePrice || String(bike.specs?.sale_price || bike.specs?.price_rub || "390000");

      // Dedup by semantic key: same buyer + same bike = duplicate (retry)
      const { data: existingSale } = await privateSchema()
        .from("sale_contract_artifacts")
        .select("id, storage_path")
        .eq("crew_slug", resolvedSlug)
        .eq("buyer_full_name", context.mpFullName || "")
        .eq("requested_bike_id", context.bikeId)
        .maybeSingle();

      if (existingSale) {
        logger.info("[/doc] Duplicate sale detected (same buyer+bike), skipping. existing id:", existingSale.id);
        if (!existingSale.storage_path && docStoragePath) {
          await privateSchema().from("sale_contract_artifacts").update({ storage_path: docStoragePath }).eq("id", existingSale.id);
          logger.info("[/doc] Backfilled storage_path on existing sale artifact");
        }
      } else {
        // sale_contract_artifacts is in private schema — use explicit columns only
        const { error: saleError } = await privateSchema().from("sale_contract_artifacts").insert({
          contract_key: vars.document_key,
          crew_slug: resolvedSlug,
          storage_path: docStoragePath,
          original_sha256: docSha256,
          requested_bike_id: context.bikeId,
          resolved_bike_id: bike.id,
          telegram_chat_id: String(userId),
          buyer_phone: context.clientPhone || null,
          telegram_message_id: null,
          buyer_full_name: context.mpFullName || null,
          buyer_passport_number: `${context.mpSeries || ""} ${context.mpNumber || ""}`.trim() || null,
          buyer_passport_issued_by: context.mpIssuedBy || null,
          buyer_passport_issue_date: context.mpIssueDate || null,
          buyer_registration: context.mpRegistration || null,
          sale_price: salePrice,
          warranty_months: "0",
          template_version: 1,
          // Delivery fields (NEW)
          delivery_method: context.saleDeliveryMethod || null,
          transport_company_name: context.saleTransportCompany || null,
          transport_payment_type: context.saleTransportPaymentType || null,
        });
        if (saleError) {
          logger.error("[/doc] Failed to save sale_contract_artifacts:", saleError);
      }
    }
    }

  // ── Send confirmation to the operator (v3 polish: rich context + deep links) ──
  // Was: "✅ Договор аренды готов!" with generic "🚀 Открыть" button → bot app root.
  // Now: full context (bike, client, dates, price, rental ID) + 2 deep-link buttons.
  const bikeTitleForMsg = `${bike.make} ${bike.model}`.trim();
  const startDateForMsg = isRent ? `${context.rentStartDate || ""} ${context.rentStartTime || ""}`.trim() : undefined;
  const endDateForMsg = isRent ? `${context.rentEndDate || ""} ${context.rentEndTime || ""}`.trim() : undefined;
  const depositForMsg = isRent ? Number(context.depositOverride || 20000) : undefined;

  const successText = buildDocSuccessMessage({
    isRent,
    bikeTitle: bikeTitleForMsg,
    clientName: context.mpFullName,
    startDate: startDateForMsg,
    endDate: endDateForMsg,
    salePrice: !isRent ? Number(context.salePrice || 0) : undefined,
    depositRub: depositForMsg,
    categories: isRent ? (context.mlCategories || []) : undefined,
    shortRentalId: rentalId || undefined ? (rentalId as string).slice(0, 8) : undefined,
    crewSlug: resolvedSlug,
    // BUG 13 fix: pass rental status so "Что дальше" advice is context-aware.
    // /doc creates rentals with status=active → advice becomes "покажите QR-код"
    rentalStatus: isRent ? "active" : undefined,
  });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://v0-car-test.vercel.app";
  const webUrl = rentalId ? `${siteUrl}/franchize/${resolvedSlug}/rental/${rentalId}` : "";
  const botLink = process.env.TELEGRAM_BOT_LINK || "https://t.me/oneBikePlsBot/app";
  const tgDeepLink = rentalId
    ? `${botLink}?startapp=rental_${rentalId}`
    : botLink;
  // BUG 16 fix: add leads + analytics buttons (was only 2 buttons, user reported 0 appeared)
  const leadsWebUrl = `${siteUrl}/franchize/${resolvedSlug}/leads`;
  const analyticsWebUrl = `${siteUrl}/franchize/${resolvedSlug}/rentals-analytics`;

  // FIX: embed links as HTML <a> tags in the message body instead of inline buttons.
  // Inline buttons trigger the default message handler when clicked, which derails
  // the conversation ("Некорректный ввод. Пожалуйста, выбери вариант из меню").
  const successLinks: string[] = [];
  if (tgDeepLink) successLinks.push(`<a href="${escapeHtml(tgDeepLink)}">📋 Открыть аренду</a>`);
  if (webUrl) successLinks.push(`<a href="${escapeHtml(webUrl)}">🌐 В браузере</a>`);
  if (isRent) successLinks.push(`<a href="${escapeHtml(leadsWebUrl)}">👥 Лиды</a>`);
  if (isRent) successLinks.push(`<a href="${escapeHtml(analyticsWebUrl)}">📈 Аналитика</a>`);
  const successTextWithLinks = successLinks.length > 0
    ? `${successText}\n\n${successLinks.join("  ")}`
    : successText;

  await sendComplexMessage(
    chatId,
    successTextWithLinks,
    [], // NO inline buttons — plain text links in message body
    { removeKeyboard: true, parseMode: "HTML" },
  );

  // ── Auto-shame operator if they skipped phone input ──
  // Phone is needed for QR claim flow — without it, renter can't be linked.
  // Send a friendly "атата" directly to the operator who ran /doc.
  // FIX: use a plain text link (not an inline button) — inline buttons trigger the
  // default message handler when clicked, which derails the conversation.
  // The link is embedded directly in the message body as an HTML <a> tag.
  if (isRent && !context.clientPhone) {
    try {
      const rentalShortId = rentalId ? escapeHtml((rentalId as string).slice(0, 8)) : "?";
      const rentalLinkHtml = tgDeepLink ? `<a href="${escapeHtml(tgDeepLink)}">📋 Открыть аренду</a>` : "";
      const shameMessage =
        `🚨 <b>Атата! Ты пропустил ввод телефона клиента</b>\n\n` +
        `🏍 ${escapeHtml(bikeTitleForMsg)}\n` +
        `👤 ${escapeHtml(context.mpFullName || "Клиент")}\n` +
        `🔑 Аренда: ${rentalShortId}\n\n` +
        `Без телефона клиент не получит QR-код и не сможет привязать свой Telegram.\n` +
        `QR-код сейчас можно показывать только визуально с экрана.\n\n` +
        `💡 <b>Совет:</b> введите телефон на следующей аренде — клиент сможет получить QR-код в личные сообщения и сам привязать аккаунт.` +
        (rentalLinkHtml ? `\n\n${rentalLinkHtml}` : "");
      await sendComplexMessage(
        chatId, // same chat as the operator who ran /doc
        shameMessage,
        [], // NO inline buttons — plain text link in message body instead
        { parseMode: "HTML" },
      );
    } catch (shameErr) {
      console.warn("[/doc] Shame message failed (non-fatal):", shameErr);
    }
  }

  // ── Notify boss/admin (v3 polish: Russian-ized keys, no English "User:/Bike:/Client:") ──
  // Polish: send with inline buttons (rental link) + phone skip warning.
  // Was: notifyAdmin(auditText) — plain text, no buttons, no phone warning.
  const phoneSkipped = isRent && !context.clientPhone;
  const auditText = buildDocAdminAuditMessage({
    isRent,
    bikeTitle: bikeTitleForMsg,
    clientName: context.mpFullName,
    startDate: startDateForMsg,
    endDate: endDateForMsg,
    salePrice: !isRent ? Number(context.salePrice || 0) : undefined,
    depositRub: depositForMsg,
    shortRentalId: rentalId || undefined ? (rentalId as string).slice(0, 8) : undefined,
    crewSlug: resolvedSlug,
  });

  // Build admin message with phone status + warning
  let adminMessage = auditText;
  if (isRent) {
    adminMessage += `\n📞 Телефон: ${context.clientPhone ? escapeHtml(context.clientPhone) : "⚠️ НЕ УКАЗАН"}`;
    if (phoneSkipped) {
      adminMessage += `\n\n🚨 <b>Атата!</b> Оператор пропустил ввод телефона. Без телефона клиент не получит QR-код и не сможет привязать свой Telegram. Напомните оператору, что телефон — это важно!`;
    }
  }

  // Send with plain text link (not inline button — buttons trigger default handler when clicked)
  try {
    const adminChatId = "413553377"; // salavey13
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://v0-car-test.vercel.app";
    const rentalWebUrl = rentalId ? `${siteUrl}/franchize/${resolvedSlug}/rental/${rentalId}` : "";
    const botLink = process.env.TELEGRAM_BOT_LINK || "https://t.me/oneBikePlsBot/app";
    const rentalTgLink = rentalId ? `${botLink}?startapp=rental_${rentalId}` : "";

    // FIX: embed links as HTML <a> tags in the message body instead of inline buttons.
    // Inline buttons trigger the default message handler when clicked, which derails
    // the conversation ("Некорректный ввод. Пожалуйста, выбери вариант из меню").
    const links: string[] = [];
    if (rentalTgLink) links.push(`<a href="${escapeHtml(rentalTgLink)}">📋 Открыть аренду</a>`);
    if (rentalWebUrl) links.push(`<a href="${escapeHtml(rentalWebUrl)}">🌐 В браузере</a>`);
    if (links.length > 0) adminMessage += `\n\n${links.join("  ")}`;

    await sendComplexMessage(
      adminChatId,
      adminMessage,
      [], // NO inline buttons — plain text links in message body
      { parseMode: "HTML" },
    );
  } catch (adminErr) {
    // Fallback: plain text notifyAdmin if sendComplexMessage fails
    console.warn("[/doc] Admin notify with links failed, falling back to plain text:", adminErr);
    await notifyAdmin(adminMessage);
  }

  // --- Create/update lead in franchize_intents ---
  // This ensures the client appears on the leads page with proper state
  const leadPhone = context.clientPhone || "";
  // BUG 11 fix: always use operator's Telegram chat ID as leadUserId, NEVER the phone.
  // Was: leadUserId = leadPhone || String(userId) → phone stored as user_id in
  // franchize_intents.telegram_user_id, crew_todos.lead_id, and potentially users.user_id.
  // Phone is NOT a Telegram chat ID — storing it as user_id pollutes the users table
  // and breaks lead matching. Phone goes in the separate `phone` field.
  const leadUserId = String(userId);
  try {
    const { upsertFranchizeLead } = await import("@/app/franchize/lib/leads");
    await upsertFranchizeLead({
      slug: resolvedSlug,
      userId: leadUserId,
      intentType: isRent ? "rent" : "sale",
      stage: "contract_generated",
      bikeId: bike.id,
      bikeTitle: `${bike.make} ${bike.model}`,
      phone: leadPhone || undefined,
      fullName: context.mpFullName || undefined,
      sourceRoute: "/doc-manual",
      contactChannel: "telegram_bot",
      urgencyScore: isRent ? 90 : 85,
      metadata: {
        dealType: isRent ? "rent" : "sale",
        operatorId: String(userId),
        hasPassport: !!(context.mpSeries && context.mpNumber),
        hasLicense: !!(context.mlSeries && context.mlNumber),
      },
      ensureUser: true,
    });

    // ── Create crew_todos for equipment return and default checks ──────────
    if (isRent) {
      const todos: Array<{ title: string; priority: "low" | "medium" | "high" }> = [
        { title: `🔧 Проверить ТС при возврате: ${bike.make} ${bike.model} (${context.rentEndDate} ${context.rentEndTime})`, priority: "high" },
        { title: `🔑 Принять ключи от ${bike.make} ${bike.model}`, priority: "high" },
        { title: `📄 Проверить документы при возврате ${bike.make} ${bike.model}`, priority: "medium" },
        { title: `🔍 Осмотр на повреждения: ${bike.make} ${bike.model}`, priority: "high" },
        // NEW (per user request): photo reminder. Final odometer is captured by
        // the closure modal — no longer in the todo list (was redundant).
        { title: `📸 Сфотографировать байк при возврате: ${bike.make} ${bike.model}`, priority: "high" },
      ];
      if ((context.helmets || 0) > 0) todos.push({ title: `🪖 Принять ${context.helmets} шлем(а/ов)`, priority: "medium" });
      if ((context.gloves || 0) > 0) todos.push({ title: `🧤 Принять ${context.gloves} перчатки`, priority: "low" });
      if (context.jacket) todos.push({ title: `🧥 Принять куртку`, priority: "low" });
      if (context.boots) todos.push({ title: `👢 Принять боты`, priority: "low" });
      if (context.net) todos.push({ title: `🌐 Принять сетку`, priority: "low" });
      if (context.backpack) todos.push({ title: `👜 Принять рюкзак`, priority: "low" });
      if (context.bag) todos.push({ title: `👜 Принять сумку`, priority: "low" });
      if (context.charger) todos.push({ title: `🔌 Принять зарядное устройство`, priority: "medium" });

      if (!bike.crew_id) {
        logger.error("[/doc] Bike has no crew_id, cannot create rent todos", { bikeId: bike.id });
      } else {
      const crewId = bike.crew_id;
      // BUG 11 fix: use operator's chat ID, not phone (same as leadUserId above)
      const leadId = String(userId);

      const result = await createLeadFollowupTodos({
        crewId,
        leadId,
        leadPhone: context.clientPhone || "",
        leadName: context.mpFullName || "",
        bikeId: bike.id,
        todos,
        assignedTo: String(userId),
        rentalId: rentalId || undefined,  // Phase 3c: set FK directly
        metadata: {
          rental_id: rentalId || null,
          rent_end_date: context.rentEndDate || null,
        },
      });

      if (result.success) {
        logger.info(`[/doc] Created ${result.created} crew_todos for equipment return + checks (${result.skipped} skipped)`);
      } else {
        logger.warn("[/doc] Failed to create crew_todos:", result.error);
      }

      // ── Also create standard verification todos (passport, odometer, dates) ──
      if (rentalId) {
        try {
          const vResult = await createRentalVerificationTodos(rentalId, crewId, leadId);
          logger.info(`[/doc] Created ${vResult.created} verification todos for rental ${rentalId}`);
        } catch (vErr) {
          logger.warn("[/doc] Failed to create verification todos (non-fatal):", vErr);
        }
      }
      } // close else (bike has crew_id for rent)
    }

    // ── Create crew_todos for SALE deals ────────────────────────────────────
    if (!isRent) {
      const saleTodos: Array<{ title: string; priority: "low" | "medium" | "high" }> = [
        { title: `📦 Подготовить ТС к передаче: ${bike.make} ${bike.model}`, priority: "high" },
        { title: `🔑 Передать ключи и документы: ${bike.make} ${bike.model}`, priority: "high" },
        { title: `📋 Подписать Акт приёма-передачи с ${context.mpFullName || "покупателем"}`, priority: "high" },
        { title: `💳 Проконтролировать оплату (${context.salePrice || "?"} ₽)`, priority: "medium" },
      ];

      if (!bike.crew_id) {
        logger.error("[/doc] Bike has no crew_id, cannot create sale todos", { bikeId: bike.id });
      } else {
      const crewId = bike.crew_id;
      // BUG 11 fix: use operator's chat ID, not phone (same as leadUserId above)
      const leadId = String(userId);

      const result = await createLeadFollowupTodos({
        crewId,
        leadId,
        leadPhone: context.clientPhone || "",
        leadName: context.mpFullName || "",
        bikeId: bike.id,
        todos: saleTodos,
        assignedTo: String(userId),
        metadata: {
          deal_type: "sale",
        },
      });

      if (result.success) {
        logger.info(`[/doc] Created ${result.created} crew_todos for sale deal (${result.skipped} skipped)`);
      } else {
        logger.warn("[/doc] Failed to create sale crew_todos:", result.error);
      }
      } // close else (bike has crew_id for sale)
    }
  } catch (leadErr) {
    logger.warn("[/doc] Failed to create lead:", leadErr);
  }


  // --- Send email notification (fire-and-forget to avoid Vercel timeout) ---
  // The DOCX was already sent via Telegram — email is a non-critical backup.
  // We start the SMTP connection but don't block the function response on it.
  // TO priority: explicit env override → crew's email from Supabase → hardcoded fallback.
  try {
    const smtpHost = process.env.SMTP_HOST || process.env.SMTP_YANDEX_HOST;
    const smtpPort = Number(process.env.SMTP_PORT || process.env.SMTP_YANDEX_PORT || 465);
    const smtpUser = process.env.SMTP_USER || process.env.SMTP_YANDEX_USER;
    const smtpPass = process.env.SMTP_PASS || process.env.SMTP_YANDEX_PASS;
    const emailFrom = process.env.EMAIL_FROM || smtpUser;
    const emailTo = process.env.EMAIL_DEFAULT_TO || crewSecrets.email || "vip_bike@mail.ru";

    if (smtpHost && smtpUser && smtpPass) {
      const docType = isRent ? "аренды" : "купли-продажи";
      const emailBody = [
        `Договор ${docType} №${vars.document_key || vars.contract_number || bike.id}`,
        ``,
        `Байк: ${bike.make} ${bike.model}`,
        `Клиент: ${context.mpFullName || "—"}`,
        ``,
        isRent ? `Период: ${context.rentStartDate || "?"} ${context.rentStartTime || ""} — ${context.rentEndDate || "?"} ${context.rentEndTime || ""}` : `Цена: ${Number(context.salePrice || 0).toLocaleString("ru-RU")} ₽`,
        ``,
        `Договор сгенерирован в Telegram-боте.`,
        `Документ во вложении.`,
      ].filter(Boolean).join("\n");

      // Fire-and-forget: start SMTP send but don't await it.
      // The function returns immediately; email completes in background.
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPass },
        connectionTimeout: 5000,  // 5s connection timeout
        greetingTimeout: 5000,
        socketTimeout: 8000,
      });

      // Don't await — let it run in background
      transporter.sendMail({
        from: emailFrom,
        to: emailTo,
        subject: `Договор ${docType} — ${bike.make} ${bike.model}`,
        text: emailBody,
        attachments: [{
          filename: docFileName,
          content: docxBuf,
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        }],
      }).then(() => {
        logger.info(`[/doc] Email with DOCX sent to ${emailTo}`);
      }).catch((emailErr: any) => {
        logger.warn("[/doc] Email send failed (non-fatal):", emailErr?.message || emailErr);
      });
    }
  } catch (emailSetupErr) {
    logger.warn("[/doc] Email setup failed (non-fatal):", emailSetupErr);
  }

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
 * Equipment selection step.
 * Allows operator to select additional equipment (helmets, gloves, net, etc.)
 */
async function gotoEquipment(chatId: number, userId: string, context: DocFlowContext): Promise<void> {
  await setState(userId, "equipment", context);
  await sendComplexMessage(
    chatId,
    `*Дополнительное оборудование*\n\n` +
    `Выберите оборудование для аренды:\n` +
    `• Шлем: 1 000 ₽\n` +
    `• Перчатки: 500 ₽\n` +
    `• Сетка: 500 ₽\n` +
    `• Рюкзак: 500 ₽\n` +
    `• Сумка: 500 ₽\n` +
    `• Зарядка: бесплатно (возврат)`,
    buildEquipmentKeyboard(context),
    { keyboardType: 'inline', parseMode: 'Markdown' },
  );
}

/**
 * Odometer reading step.
 * Asks operator to enter odometer value before rental.
 */
async function gotoOdometer(chatId: number, userId: string, context: DocFlowContext): Promise<void> {
  await setState(userId, "odometer", context);
  await sendComplexMessage(
    chatId,
    `*Показания одометра*\n\n` +
    `Введите текущий пробег байка (в км):\n\n` +
    `Пример: \`1234\``,
    [],
    { removeKeyboard: true, parseMode: 'Markdown' },
  );
}

/**
 * Payment split step.
 * Calculates total and asks how to split between cash and bank transfer.
 */
async function gotoPaymentSplit(chatId: number, userId: string, context: DocFlowContext): Promise<void> {
  const bike = await resolveBikeById(context.bikeId);
  if (!bike) {
    logger.error(`[/doc] gotoPaymentSplit: bike not found for ${context.bikeId}`);
    await sendComplexMessage(chatId, "❌ Байк не найден", [], { removeKeyboard: true });
    return;
  }

  // Calculate total using tier-aware pricing
  const specs = bike.specs || {};
  const startDate = context.rentStartDate;
  const startTime = context.rentStartTime || "10:00";
  const endDate = context.rentEndDate;
  const endTime = context.rentEndTime || "10:00";

  // Calculate rental hours
  const start = parseRuDateTime(startDate, startTime);
  const end = parseRuDateTime(endDate, endTime);
  const hours = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60) * 10) / 10);

  // Use tier-aware pricing
  const specsForPricing = {
    price_per_hour: specs.price_per_hour,
    price_per_2h: specs.price_per_2h,
    price_per_3h: specs.price_per_3h,
    price_per_6h: specs.price_per_6h,
    price_per_12h: specs.price_per_12h,
    dailyPrice: specs.dailyPrice,
    rent_weekday: specs.rent_weekday,
    rent_weekend: specs.rent_weekend,
    rent_2_4d: specs.rent_2_4d,
    rent_5_10d: specs.rent_5_10d,
    rent_11_30d: specs.rent_11_30d,
  };

  const startDateForCalc = (() => {
    if (!startDate) return undefined;
    const dmy = startDate.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
    return startDate;
  })();

  const tierResult = calculatePriceForDuration(specsForPricing, hours, startDateForCalc);
  const rentalCost = Number(tierResult.price > 0 ? tierResult.price : Number(specs.dailyPrice || specs.rent_weekday || 10000));

  // Add equipment costs
  const helmets = context.helmets || 0;
  const gloves = context.gloves || 0;
  const jacket = context.jacket ? 1 : 0;
  const boots = context.boots ? 1 : 0;
  const net = context.net ? 1 : 0;
  const backpack = context.backpack ? 1 : 0;
  const bag = context.bag ? 1 : 0;

  const equipmentCost = helmets * getHelmetPrice(hours) + gloves * 500 + jacket * 500 + boots * 500 + net * 500 + backpack * 500 + bag * 500;
  const calculatedTotal = rentalCost + equipmentCost;

  // CR fix: if operator overrode the price, use the overridden value instead
  // of the recalculated total. Without this, gotoPaymentSplit silently discards
  // the override and the operator's custom price is lost.
  const totalAmount = context.priceOverridden
    ? (context.cashAmount || 0) + (context.bankAmount || 0)
    : calculatedTotal;

  // Store total in context for later use (only if not overridden — don't clobber)
  if (!context.priceOverridden) {
    context.cashAmount = totalAmount; // Default to all cash
    context.bankAmount = 0;
  }

  await setState(userId, "payment_split", context);

  // Build a human-readable period label from tierResult.period (e.g., "/ 6 часов" → "6 часов")
  const periodLabel = (tierResult.period || '').replace(/^\//, '').trim() || `${Math.ceil(hours / 24)} дн.`;

  await sendComplexMessage(
    chatId,
    `*Расчёт стоимости*\n\n` +
    `Аренда (${periodLabel}): *${rentalCost.toLocaleString("ru-RU")} ₽*\n` +
    (equipmentCost > 0 ? `Оборудование: *${equipmentCost.toLocaleString("ru-RU")} ₽*\n` : "") +
    `\n💰 *Итого: ${totalAmount.toLocaleString("ru-RU")} ₽*\n\n` +
    `Как будет оплачено?`,
    buildPaymentSplitKeyboard(totalAmount),
    { keyboardType: 'inline', parseMode: 'Markdown' },
  );
}

/**
 * Sale flow step 5: confirm or override the bike's catalog color.
 *
 * Pulled into its own router so the same prompt can be invoked from:
 *   - the address state handler (the normal sale entry path)
 *   - the salecol_custom callback (re-prompt after user asked for custom
 *     input but typed something invalid)
 *
 * NB: bike is re-fetched here (not passed in) because by the time we
 * reach this step the operator may have spent several minutes on the
 * previous steps — re-fetching guards against the bike card being
 * updated mid-flow (rare, but cheap to defend against).
 */
async function gotoSaleColor(chatId: number, userId: string, context: DocFlowContext): Promise<void> {
  const bike = await resolveBikeById(context.bikeId);
  const bikeColor = String(bike?.specs?.color || "").trim();
  await setState(userId, "sale_color", context);
  await sendComplexMessage(
    chatId,
    `🎨 *Цвет ТС*\n\n` +
    (bikeColor
      ? `Цвет из карточки ТС: *${bikeColor}*\n\nПодтвердите или введите свой:`
      : `В карточке ТС цвет не указан — введите цвет вручную:`),
    buildSaleColorKeyboard(bikeColor),
    { keyboardType: 'inline', parseMode: 'Markdown' },
  );
}

/**
 * Sale flow step 6: confirm, override, or skip the bike's VIN/frame.
 *
 * "Skip" is the explicit "I don't know the VIN and don't want to enter
 * one" path — the contract will render "уточняется" via the template
 * fallback. This is the right behaviour for trade-ins / used bikes sold
 * as-is where the frame number is undocumented.
 */
async function gotoSaleVin(chatId: number, userId: string, context: DocFlowContext): Promise<void> {
  const bike = await resolveBikeById(context.bikeId);
  const bikeVin = String(bike?.specs?.vin || bike?.specs?.frame || bike?.specs?.vin_number || "").trim();
  await setState(userId, "sale_vin", context);
  await sendComplexMessage(
    chatId,
    `🔢 *VIN / № рамы ТС*\n\n` +
    (bikeVin
      ? `VIN из карточки ТС: \`${bikeVin}\`\n\nПодтвердите, введите свой или пропустите:`
      : `В карточке ТС VIN не указан — введите свой или пропустите:`),
    buildSaleVinKeyboard(bikeVin),
    { keyboardType: 'inline', parseMode: 'Markdown' },
  );
}

/**
 * Sale flow step 7: price selection.
 *
 * Extracted into a router because it's now called from three different
 * end-points (sale_vin callback confirm / sale_vin text input / sale_vin
 * skip). Previously the price prompt was inline in the address handler.
 */
async function gotoPrice(chatId: number, userId: string, context: DocFlowContext): Promise<void> {
  await setState(userId, "price", context);
  const priceKeyboard = await buildPriceKeyboard();
  await sendComplexMessage(chatId, withStep("💰 Цена:", "price", context.dealType), priceKeyboard, { keyboardType: 'inline' });
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
• сегодня 21
• сегодня 21:30
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
    await sendComplexMessage(chatId, withStep("Тип договора:", "deal"), buildDealKeyboard(), { keyboardType: 'inline' });
    return true;
  }

  // Optional client phone step — links contract to web callback lead
  if (state === "client_phone") {
    const cleaned = text.replace(/[^\d+]/g, "");
    if (cleaned.length < 10) {
      await sendComplexMessage(chatId, "❌ Неверный формат. Введите номер или нажмите «Пропустить».", [], { removeKeyboard: true });
      return true;
    }
    context.clientPhone = cleaned;
    context.clientPhoneResolved = true;
    await setState(userId, "confirm", context);
    await sendComplexMessage(chatId, `✅ Телефон клиента: ${cleaned}\n\n⏳ Генерирую...`, [], { removeKeyboard: true });
    const crewSlug = await getDocCrewSlug(userId);
    const success = await generateContract(chatId, userId, context, crewSlug);
    if (success) {
      await clearState(userId);
    }
    return true;
  }

  if (state === "name") {
    context.mpFullName = capitalizeFullName(text);
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
      // Sale flow: collect color + VIN before price so the contract's
      // bike section is filled correctly even when the Supabase card is
      // missing these fields (common for used/trade-in bikes).
      await gotoSaleColor(chatId, userId, context);
    }
    return true;
  }

  if (state === "has_license") {
    // User typed instead of pressing button — re-prompt
    await sendComplexMessage(chatId, withStep("*Водительское удостоверение есть?*", "has_license"), buildHasLicenseKeyboard(), { keyboardType: 'inline', parseMode: "Markdown" });
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
    // Route to equipment selection (NEW step) instead of deposit_choice
    await gotoEquipment(chatId, userId, context);
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
    const owner = capitalizeFullName(text);
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

  if (state === "equipment") {
    // User typed instead of clicking equipment buttons — re-prompt
    logger.info(`[/doc] equipment: ${userId} → typed instead of clicking, re-prompting`);
    await gotoEquipment(chatId, userId, context);
    return true;
  }

  if (state === "payment_split") {
    // User typed instead of clicking payment buttons — re-prompt
    logger.info(`[/doc] payment_split: ${userId} → typed instead of clicking, re-prompting`);
    await gotoPaymentSplit(chatId, userId, context);
    return true;
  }

  // I4 enhancement: price override — operator types a custom total price
  if (state === "price_override") {
    const value = text.replace(/\D/g, '');
    if (!value || parseInt(value) < 100) {
      logger.info(`[/doc] price_override: ${userId} → invalid input "${text.slice(0,40)}"`);
      await sendComplexMessage(chatId, "❌ Введите цену (минимум 100 ₽)", [], { removeKeyboard: true });
      return true;
    }
    const newPrice = parseInt(value);
    // Override the cash/bank amounts to reflect the new total (default all cash)
    context.cashAmount = newPrice;
    context.bankAmount = 0;
    context.priceOverridden = true;  // CR fix: flag prevents re-calc from discarding override
    logger.info(`[/doc] price_override: ${userId} → new price=${newPrice}`);
    // Re-show the payment split with the new price
    await gotoPaymentSplit(chatId, userId, context);
    return true;
  }

  if (state === "odometer") {
    // User entered odometer reading
    const value = text.replace(/\D/g, '');
    if (!value || parseInt(value) < 0 || parseInt(value) > 999999) {
      logger.info(`[/doc] odometer: ${userId} → invalid input "${text.slice(0,40)}"`);
      await sendComplexMessage(chatId, "❌ Введите пробег в км (0-999999)", [], { removeKeyboard: true });
      return true;
    }
    context.odometerBefore = parseInt(value);
    logger.info(`[/doc] odometer: ${userId} → odometerBefore=${context.odometerBefore}`);
    await gotoPaymentSplit(chatId, userId, context);
    return true;
  }

  if (state === "payment_cash") {
    // User entered cash amount
    const value = text.replace(/\D/g, '');
    if (!value || parseInt(value) < 0) {
      logger.info(`[/doc] payment_cash: ${userId} → invalid input "${text.slice(0,40)}"`);
      await sendComplexMessage(chatId, "❌ Введите сумму наличными (руб)", [], { removeKeyboard: true });
      return true;
    }
    const cashAmount = parseInt(value);
    const bike = await resolveBikeById(context.bikeId);
    const specs = bike?.specs || {};
    const startDate = context.rentStartDate;
    const startTime = context.rentStartTime || "10:00";
    const endDate = context.rentEndDate;
    const endTime = context.rentEndTime || "10:00";
    const start = parseRuDateTime(startDate, startTime);
    const end = parseRuDateTime(endDate, endTime);
    const hours = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60) * 10) / 10);
    const specsForPricing = {
      price_per_hour: specs.price_per_hour,
      price_per_3h: specs.price_per_3h,
      price_per_6h: specs.price_per_6h,
      price_per_12h: specs.price_per_12h,
      dailyPrice: specs.dailyPrice,
      rent_weekday: specs.rent_weekday,
      rent_weekend: specs.rent_weekend,
      rent_2_4d: specs.rent_2_4d,
      rent_5_10d: specs.rent_5_10d,
      rent_11_30d: specs.rent_11_30d,
    };
    const startDateForCalc = (() => {
      if (!startDate) return undefined;
      const dmy = startDate.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
      if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
      return startDate;
    })();
    const tierResult = calculatePriceForDuration(specsForPricing, hours, startDateForCalc);
    const rentalCost = Number(tierResult.price > 0 ? tierResult.price : Number(specs.dailyPrice || specs.rent_weekday || 10000));
    const helmets = context.helmets || 0;
    const gloves = context.gloves || 0;
    const jacket = context.jacket ? 1 : 0;
    const boots = context.boots ? 1 : 0;
    const net = context.net ? 1 : 0;
    const backpack = context.backpack ? 1 : 0;
    const bag = context.bag ? 1 : 0;
    const equipmentCost = helmets * getHelmetPrice(hours) + gloves * 500 + jacket * 500 + boots * 500 + net * 500 + backpack * 500 + bag * 500;
    const totalAmount = context.priceOverridden ? (context.cashAmount || 0) + (context.bankAmount || 0) : (rentalCost + equipmentCost);
    context.cashAmount = Math.min(cashAmount, totalAmount);
    context.bankAmount = Math.max(0, totalAmount - cashAmount);
    logger.info(`[/doc] payment_cash: ${userId} → cash=${context.cashAmount}, bank=${context.bankAmount}`);
    await gotoDepositChoice(chatId, userId, context);
    return true;
  }

  if (state === "payment_split_cash") {
    // User entered cash amount for split payment (came from paydest_split).
    // After parsing, ask which card the bank portion went to.
    const value = text.replace(/\D/g, '');
    if (!value || parseInt(value) < 0) {
      logger.info(`[/doc] payment_split_cash: ${userId} → invalid input "${text.slice(0,40)}"`);
      await sendComplexMessage(chatId, "❌ Введите сумму наличными (руб)", [], { removeKeyboard: true });
      return true;
    }
    const cashAmount = parseInt(value);
    const bike = await resolveBikeById(context.bikeId);
    const specs = bike?.specs || {};
    const startDate = context.rentStartDate;
    const startTime = context.rentStartTime || "10:00";
    const endDate = context.rentEndDate;
    const endTime = context.rentEndTime || "10:00";
    const start = parseRuDateTime(startDate, startTime);
    const end = parseRuDateTime(endDate, endTime);
    const hours = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60) * 10) / 10);
    const specsForPricing = {
      price_per_hour: specs.price_per_hour,
      price_per_3h: specs.price_per_3h,
      price_per_6h: specs.price_per_6h,
      price_per_12h: specs.price_per_12h,
      dailyPrice: specs.dailyPrice,
      rent_weekday: specs.rent_weekday,
      rent_weekend: specs.rent_weekend,
      rent_2_4d: specs.rent_2_4d,
      rent_5_10d: specs.rent_5_10d,
      rent_11_30d: specs.rent_11_30d,
    };
    const startDateForCalc = (() => {
      if (!startDate) return undefined;
      const dmy = startDate.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
      if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
      return startDate;
    })();
    const tierResult = calculatePriceForDuration(specsForPricing, hours, startDateForCalc);
    const rentalCost = Number(tierResult.price > 0 ? tierResult.price : Number(specs.dailyPrice || specs.rent_weekday || 10000));
    const helmets = context.helmets || 0;
    const gloves = context.gloves || 0;
    const jacket = context.jacket ? 1 : 0;
    const boots = context.boots ? 1 : 0;
    const net = context.net ? 1 : 0;
    const backpack = context.backpack ? 1 : 0;
    const bag = context.bag ? 1 : 0;
    const equipmentCost = helmets * getHelmetPrice(hours) + gloves * 500 + jacket * 500 + boots * 500 + net * 500 + backpack * 500 + bag * 500;
    const totalAmount = context.priceOverridden ? (context.cashAmount || 0) + (context.bankAmount || 0) : (rentalCost + equipmentCost);
    context.cashAmount = Math.min(cashAmount, totalAmount);
    context.bankAmount = Math.max(0, totalAmount - cashAmount);
    logger.info(`[/doc] payment_split_cash: ${userId} → cash=${context.cashAmount}, bank=${context.bankAmount}, asking which card`);
    // Show keyboard with two card options (mirrors depsplit_* pattern)
    const bankFormatted = context.bankAmount.toLocaleString("ru-RU");
    await sendComplexMessage(
      chatId,
      `💳 *Куда пойдёт безналичная часть (${bankFormatted} ₽)?*`,
      [
        [{ text: "💳 Тинькофф", callback_data: "paysplit_tbank" }],
        [{ text: "💳 Сбербанк", callback_data: "paysplit_sber" }],
        [{ text: "❌ Отменить", callback_data: "cancel" }],
      ],
      { keyboardType: 'inline', parseMode: 'Markdown' },
    );
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
    // Route to deposit destination (cash/card/split) instead of directly to confirm
    await gotoDepositDestination(chatId, userId, context);
    return true;
  }

  if (state === "deposit_choice") {
    // User typed instead of pressing a deposit-choice button — re-prompt
    logger.info(`[/doc] deposit_choice: ${userId} → typed instead of clicking, re-prompting`);
    await gotoDepositChoice(chatId, userId, context);
    return true;
  }

  // ── Deposit destination text handlers ─────────────────────────────────────
  if (state === "deposit_destination") {
    // User typed instead of pressing a destination button — re-prompt
    logger.info(`[/doc] deposit_destination: ${userId} → typed instead of clicking, re-prompting`);
    await gotoDepositDestination(chatId, userId, context);
    return true;
  }

  if (state === "sale_delivery") {
    // User typed instead of pressing a delivery button — re-prompt
    logger.info(`[/doc] sale_delivery: ${userId} → typed instead of clicking, re-prompting`);
    await gotoSaleDelivery(chatId, userId, context);
    return true;
  }

  if (state === "deposit_split_cash") {
    // User entered the cash portion for a split deposit
    const cashAmount = parseInt(text.replace(/\D/g, ''));
    const total = Number(context.depositOverride || "20000");
    if (isNaN(cashAmount) || cashAmount < 0 || cashAmount >= total) {
      logger.info(`[/doc] deposit_split_cash: ${userId} → invalid input "${text.slice(0,40)}"`);
      await sendComplexMessage(chatId,
        `❌ Введите сумму наличными (от 0 до ${(total - 1).toLocaleString("ru-RU")} ₽)\n` +
        `Весь депозит: ${total.toLocaleString("ru-RU")} ₽`,
        [], { removeKeyboard: true });
      return true;
    }
    context.depositCashAmount = cashAmount;
    context.depositCardAmount = total - cashAmount;
    logger.info(`[/doc] deposit_split_cash: ${userId} → cash=${cashAmount}, card=${context.depositCardAmount}`);
    // Ask which card for the remaining portion
    await setState(userId, "deposit_split_card", context);
    await sendComplexMessage(
      chatId,
      `Остаток: ${context.depositCardAmount!.toLocaleString("ru-RU")} ₽\n\nНа какую карту?`,
      [
        [{ text: "💳 Тинькофф", callback_data: "depsplit_tbank" }],
        [{ text: "💳 Сбербанк", callback_data: "depsplit_sber" }],
      ],
      { keyboardType: 'inline', parseMode: 'Markdown' },
    );
    return true;
  }

  if (state === "deposit_split_card") {
    // User typed instead of pressing a card button — re-prompt
    logger.info(`[/doc] deposit_split_card: ${userId} → typed instead of clicking, re-prompting`);
    await sendComplexMessage(
      chatId,
      `На какую карту? (остаток: ${context.depositCardAmount?.toLocaleString("ru-RU") || "?"} ₽)`,
      [
        [{ text: "💳 Тинькофф", callback_data: "depsplit_tbank" }],
        [{ text: "💳 Сбербанк", callback_data: "depsplit_sber" }],
      ],
      { keyboardType: 'inline' },
    );
    return true;
  }

  // ── Sale color text input (state=sale_color) ─────────────────────────────
  // Reached when the operator types a custom color instead of pressing one
  // of the inline buttons. We accept any non-empty trimmed string ≥ 2 chars
  // (filtering fat-finger single-char sends) and advance to the VIN step.
  if (state === "sale_color") {
    const color = text.trim();
    if (color.length < 2) {
      logger.info(`[/doc] sale_color: ${userId} → too-short input "${text.slice(0,40)}"`);
      await sendComplexMessage(chatId, "❌ Введите цвет (минимум 2 символа)", [], { removeKeyboard: true });
      return true;
    }
    context.saleColor = color;
    logger.info(`[/doc] sale_color (text): ${userId} → color="${color}"`);
    await gotoSaleVin(chatId, userId, context);
    return true;
  }

  // ── Sale VIN text input (state=sale_vin) ─────────────────────────────────
  // VIN validation is intentionally lenient — bike frame numbers vary in
  // length (some are 17-char ISO VINs, some are shorter frame stamps), so
  // we only require a sensible minimum (5 chars) and basic alnum+dashes
  // composition. Operators are responsible for entering what's physically
  // on the bike.
  if (state === "sale_vin") {
    const vin = text.trim().toUpperCase();
    if (vin.length < 5) {
      logger.info(`[/doc] sale_vin: ${userId} → too-short input "${text.slice(0,40)}"`);
      await sendComplexMessage(
        chatId,
        "❌ VIN слишком короткий (минимум 5 символов)\n\nИли нажмите «Пропустить».",
        buildSaleVinKeyboard(""),
        { keyboardType: 'inline', parseMode: "Markdown" },
      );
      return true;
    }
    context.saleVin = vin;
    context.saleVinSkipped = false;
    logger.info(`[/doc] sale_vin (text): ${userId} → vin="${vin}"`);
    await gotoPrice(chatId, userId, context);
    return true;
  }

  if (state === "price_custom") {
    const price = text.replace(/\D/g, '');
    if (!price || parseInt(price) < 10000) {
      await sendComplexMessage(chatId, "❌ Введите цену (руб)", [], { removeKeyboard: true });
      return true;
    }
    context.salePrice = price;
    // Route to delivery method step (NEW — sale flow step 11)
    await gotoSaleDelivery(chatId, userId, context);
    return true;
  }

  // ── Step correction text handler ───────────────────────────────────────────
  if (state === "step_correction") {
    const visibleSteps = getVisibleSteps(context);
    const stepNum = parseInt(text.trim());
    if (isNaN(stepNum) || stepNum < 1) {
      await sendComplexMessage(chatId,
        `⚠️ Введите номер шага от 1 до ${visibleSteps.length}`,
        [], { removeKeyboard: true });
      return true;
    }
    // Find by number (visibleSteps are 1-indexed by position, not by .num)
    const step = visibleSteps[stepNum - 1];
    if (!step) {
      await sendComplexMessage(chatId,
        `⚠️ Нет такого шага. Введите число от 1 до ${visibleSteps.length}`,
        [], { removeKeyboard: true });
      return true;
    }
    // Track corrected step (M2 fix: was `typeof step.num === 'number' ? step.num : step.num` — meaningless ternary)
    const stepKey = step.num;
    context.correctedSteps = context.correctedSteps || [];
    if (!context.correctedSteps.includes(stepKey as number)) {
      context.correctedSteps.push(stepKey as number);
    }
    logger.info(`[/doc] step_correction: ${userId} → correcting step ${step.num} (${step.state})`);

    // Special handling: correcting step 1 (deal type) resets everything
    if (step.state === 'deal') {
      await clearState(userId);
      await sendComplexMessage(chatId, "🔄 Начнём заново с выбора типа сделки.", buildDealKeyboard(), { keyboardType: 'inline' });
      await setState(userId, "deal", context);
      return true;
    }

    // Route to the step's question handler
    // The state machine will re-ask the question; after answering, the flow
    // continues normally (which may go to confirm if it's the last step,
    // or to the next step if mid-flow).
    await setState(userId, step.state, context);
    await reAskStep(chatId, userId, context, step.state);
    return true;
  }

  // ── Sale transport company text handler ───────────────────────────────────
  if (state === "sale_transport") {
    const companyName = text.trim();
    if (companyName.length < 2) {
      await sendComplexMessage(chatId, "❌ Введите название ТК (минимум 2 символа)", [], { removeKeyboard: true });
      return true;
    }
    context.saleTransportCompany = companyName;
    logger.info(`[/doc] sale_transport: ${userId} → TC="${companyName}"`);
    const summary = buildSaleSummary(context, context.salePrice || "");
    await setState(userId, "confirm", context);
    await sendComplexMessage(chatId, summary, buildConfirmKeyboard(), { keyboardType: 'inline', parseMode: 'Markdown' });
    return true;
  }

  return false;
}

/**
 * Re-ask a specific step question (used by step correction).
 * Shows "Было: <old value>" prefix before the question.
 */
async function reAskStep(chatId: number, userId: string, context: DocFlowContext, state: string): Promise<void> {
  // For most states, just setting the state is enough — the next text input
  // will be handled by the existing text handler for that state.
  // We just show a "correcting" prompt.
  const visibleSteps = getVisibleSteps(context);
  const step = visibleSteps.find(s => s.state === state);
  const label = step?.label || state;

  let oldValue = "";
  switch (state) {
    case 'name': oldValue = context.mpFullName || ""; break;
    case 'passport': oldValue = context.mpSeries ? `${context.mpSeries} ${context.mpNumber}` : ""; break;
    case 'birth': oldValue = context.mpBirthDate || ""; break;
    case 'address': oldValue = context.mpRegistration || ""; break;
    case 'categories': oldValue = (context.mlCategories || []).join(", "); break;
    case 'sale_color': oldValue = context.saleColor || ""; break;
    case 'sale_vin': oldValue = context.saleVin || (context.saleVinSkipped ? "(пропущен)" : ""); break;
    case 'sale_transport': oldValue = context.saleTransportCompany || ""; break;
  }

  const prefix = oldValue ? `Было: ${oldValue}\n\n` : '';
  await sendComplexMessage(chatId,
    `✏️ Исправление: ${label}\n\n${prefix}Введите новое значение:`,
    [], { removeKeyboard: true });
}

/**
 * Navigate to the sale delivery method step (NEW — sale flow step 11).
 * Called after price is set, before confirm.
 */
async function gotoSaleDelivery(chatId: number, userId: string, context: DocFlowContext): Promise<void> {
  await setState(userId, "sale_delivery", context);
  await sendComplexMessage(
    chatId,
    withStep(`📦 *Способ получения*\n\nКак покупатель получит мотоцикл?`, "sale_delivery", "sale"),
    [
      [{ text: "🏪 Самовывоз", callback_data: "delivery_pickup" }],
      [{ text: "🚚 ТК (покупатель)", callback_data: "delivery_tc_buyer" }],
      [{ text: "🚚 ТК (за наш счёт)", callback_data: "delivery_tc_seller" }],
    ],
    { keyboardType: 'inline', parseMode: 'Markdown' },
  );
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
    await sendComplexMessage(chatId, withStep("*Аренда - ФИО*", "name", "rent"), [], { removeKeyboard: true, parseMode: "Markdown" });
    return true;
  }

  if (callbackData === "d_sale") {
    context.dealType = "sale";
    await setState(userId, "name", context);
    await sendComplexMessage(chatId, withStep("*Продажа - ФИО*", "name", "sale"), [], { removeKeyboard: true, parseMode: "Markdown" });
    return true;
  }

  // ── Has license? Yes/No ──
  if (callbackData === "hl_yes") {
    // Simplified: skip license serial number entry, go directly to categories
    await setState(userId, "categories", context);
    await sendComplexMessage(
      chatId,
      `✅\n\n*Категории водительского удостоверения*`,
      buildCategoryKeyboard(),
      { keyboardType: 'inline', parseMode: 'Markdown' },
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

    // "today" button = same calendar day as start (short hourly alias).
    // "tomorrow" / "2days" buttons are relative to TODAY (calendar semantics),
    // NOT to start date — otherwise a tomorrow-start + tomorrow-end reads as +1d.
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

    if (when === "today") {
      // Same calendar day as start — short hourly rental (e.g. 18:00→21:00)
      context.rentEndDate = fmt(startRef);
      context.rentEndTime = timeStr;
    } else if (when === "tomorrow") {
      const end = new Date(today);
      end.setDate(today.getDate() + 1);
      context.rentEndDate = fmt(end);
      context.rentEndTime = timeStr;
    } else if (when === "2days") {
      const end = new Date(today);
      end.setDate(today.getDate() + 2);
      context.rentEndDate = fmt(end);
      context.rentEndTime = timeStr;
    } else {
      // Unknown end callback — re-prompt
      await sendComplexMessage(chatId, withStep("*Когда заканчиваем?*", "schedule_end", context.dealType), buildEndKeyboard(context.rentStartTime), { keyboardType: 'inline', parseMode: 'Markdown' });
      return true;
    }

    // End date resolved → route to equipment selection (NEW step)
    await gotoEquipment(chatId, userId, context);
    return true;
  }

  // ── Equipment callbacks (eq_*) — NEW step after schedule_end ─────────────
  // IMPORTANT: Must call setState after each modification, otherwise context
  // changes are lost on next callback (state reloads from storage).
  if (callbackData === "eq_helmets") {
    const current = context.helmets || 0;
    context.helmets = current >= 2 ? 0 : current + 1;
    await setState(userId, "equipment", context);
    logger.info(`[/doc] eq_helmets: ${userId} → helmets=${context.helmets}`);
    await sendComplexMessage(chatId, withStep(`🪖 Шлемы: ${context.helmets}`, "equipment", context.dealType), buildEquipmentKeyboard(context), { keyboardType: 'inline', parseMode: 'Markdown' });
    return true;
  }

  if (callbackData === "eq_gloves") {
    const current = context.gloves || 0;
    context.gloves = current >= 2 ? 0 : current + 1;
    await setState(userId, "equipment", context);
    logger.info(`[/doc] eq_gloves: ${userId} → gloves=${context.gloves}`);
    await sendComplexMessage(chatId, withStep(`🧤 Перчатки: ${context.gloves}`, "equipment", context.dealType), buildEquipmentKeyboard(context), { keyboardType: 'inline', parseMode: 'Markdown' });
    return true;
  }

  if (callbackData === "eq_net") {
    context.net = !context.net;
    await setState(userId, "equipment", context);
    logger.info(`[/doc] eq_net: ${userId} → net=${context.net}`);
    await sendComplexMessage(chatId, `Сетка: ${context.net ? "✅" : "⬜"}`, buildEquipmentKeyboard(context), { keyboardType: 'inline', parseMode: 'Markdown' });
    return true;
  }

  if (callbackData === "eq_backpack") {
    context.backpack = !context.backpack;
    await setState(userId, "equipment", context);
    logger.info(`[/doc] eq_backpack: ${userId} → backpack=${context.backpack}`);
    await sendComplexMessage(chatId, `Рюкзак: ${context.backpack ? "✅" : "⬜"}`, buildEquipmentKeyboard(context), { keyboardType: 'inline', parseMode: 'Markdown' });
    return true;
  }

  if (callbackData === "eq_bag") {
    context.bag = !context.bag;
    await setState(userId, "equipment", context);
    logger.info(`[/doc] eq_bag: ${userId} → bag=${context.bag}`);
    await sendComplexMessage(chatId, `Сумка: ${context.bag ? "✅" : "⬜"}`, buildEquipmentKeyboard(context), { keyboardType: 'inline', parseMode: 'Markdown' });
    return true;
  }

  if (callbackData === "eq_charger") {
    context.charger = !context.charger;
    await setState(userId, "equipment", context);
    logger.info(`[/doc] eq_charger: ${userId} → charger=${context.charger}`);
    await sendComplexMessage(chatId, `Зарядка: ${context.charger ? "✅" : "⬜"}`, buildEquipmentKeyboard(context), { keyboardType: 'inline', parseMode: 'Markdown' });
    return true;
  }

  if (callbackData === "eq_jacket") {
    context.jacket = !context.jacket;
    await setState(userId, "equipment", context);
    logger.info(`[/doc] eq_jacket: ${userId} → jacket=${context.jacket}`);
    await sendComplexMessage(chatId, `🧥 Куртка: ${context.jacket ? "✅" : "⬜"}`, buildEquipmentKeyboard(context), { keyboardType: 'inline', parseMode: 'Markdown' });
    return true;
  }

  if (callbackData === "eq_pants") {
    context.pants = !context.pants;
    await setState(userId, "equipment", context);
    logger.info(`[/doc] eq_pants: ${userId} → pants=${context.pants}`);
    await sendComplexMessage(chatId, `👖 Штаны: ${context.pants ? "✅" : "⬜"}`, buildEquipmentKeyboard(context), { keyboardType: 'inline', parseMode: 'Markdown' });
    return true;
  }

  if (callbackData === "eq_boots") {
    context.boots = !context.boots;
    await setState(userId, "equipment", context);
    logger.info(`[/doc] eq_boots: ${userId} → boots=${context.boots}`);
    await sendComplexMessage(chatId, `👢 Боты: ${context.boots ? "✅" : "⬜"}`, buildEquipmentKeyboard(context), { keyboardType: 'inline', parseMode: 'Markdown' });
    return true;
  }

  if (callbackData === "eq_done") {
    logger.info(`[/doc] eq_done: ${userId} → equipment done (helmets=${context.helmets || 0}, gloves=${context.gloves || 0}, jacket=${!!context.jacket}, pants=${!!context.pants}, boots=${!!context.boots}, net=${!!context.net}, backpack=${!!context.backpack}, bag=${!!context.bag}, charger=${!!context.charger}), moving to odometer`);
    await gotoOdometer(chatId, userId, context);
    return true;
  }

  // ── Payment split callbacks (pay_*) — NEW step after odometer ───────────
  if (callbackData === "pay_info") {
    // Just informational button, do nothing
    return true;
  }

  // I4 enhancement: price override — operator can manually set the total
  if (callbackData === "pay_override") {
    logger.info(`[/doc] pay_override: ${userId} → asking for custom price`);
    await setState(userId, "price_override", context);
    const currentTotal = (context.cashAmount || 0) + (context.bankAmount || 0);
    await sendComplexMessage(
      chatId,
      `*✏️ Изменение цены*\n\nТекущая цена: *${currentTotal.toLocaleString("ru-RU")} ₽*\n\nВведите новую итоговую цену (руб):\n\nПример: \`7000\``,
      [], { removeKeyboard: true, parseMode: "Markdown" },
    );
    return true;
  }

  if (callbackData === "pay_cash") {
    logger.info(`[/doc] pay_cash: ${userId} → asking for cash amount`);
    await setState(userId, "payment_cash", context);
    await sendComplexMessage(
      chatId,
      "*Введите сумму наличными (руб)*\n\nПример: `5000`",
      [], { removeKeyboard: true, parseMode: "Markdown" },
    );
    return true;
  }

  if (callbackData === "pay_all_cash") {
    const bike = await resolveBikeById(context.bikeId);
    const specs = bike?.specs || {};
    const startDate = context.rentStartDate;
    const startTime = context.rentStartTime || "10:00";
    const endDate = context.rentEndDate;
    const endTime = context.rentEndTime || "10:00";
    const start = parseRuDateTime(startDate, startTime);
    const end = parseRuDateTime(endDate, endTime);
    const hours = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60) * 10) / 10);
    const specsForPricing = {
      price_per_hour: specs.price_per_hour,
      price_per_3h: specs.price_per_3h,
      price_per_6h: specs.price_per_6h,
      price_per_12h: specs.price_per_12h,
      dailyPrice: specs.dailyPrice,
      rent_weekday: specs.rent_weekday,
      rent_weekend: specs.rent_weekend,
      rent_2_4d: specs.rent_2_4d,
      rent_5_10d: specs.rent_5_10d,
      rent_11_30d: specs.rent_11_30d,
    };
    const startDateForCalc = (() => {
      if (!startDate) return undefined;
      const dmy = startDate.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
      if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
      return startDate;
    })();
    const tierResult = calculatePriceForDuration(specsForPricing, hours, startDateForCalc);
    const rentalCost = Number(tierResult.price > 0 ? tierResult.price : Number(specs.dailyPrice || specs.rent_weekday || 10000));
    const helmets = context.helmets || 0;
    const gloves = context.gloves || 0;
    const jacket = context.jacket ? 1 : 0;
    const boots = context.boots ? 1 : 0;
    const net = context.net ? 1 : 0;
    const backpack = context.backpack ? 1 : 0;
    const bag = context.bag ? 1 : 0;
    const equipmentCost = helmets * getHelmetPrice(hours) + gloves * 500 + jacket * 500 + boots * 500 + net * 500 + backpack * 500 + bag * 500;
    const totalAmount = context.priceOverridden ? (context.cashAmount || 0) + (context.bankAmount || 0) : (rentalCost + equipmentCost);
    context.cashAmount = totalAmount;
    context.bankAmount = 0;
    logger.info(`[/doc] pay_all_cash: ${userId} → cash=${totalAmount}, bank=0`);
    await gotoDepositChoice(chatId, userId, context);
    return true;
  }

  if (callbackData === "pay_all_bank") {
    // Legacy button — kept as a fallback for older keyboards still in flight.
    // Routes to the new paydest_tbank handler (T-Bank is the default card).
    logger.warn(`[/doc] pay_all_bank: ${userId} → legacy button pressed, defaulting to tbank. Update keyboard to use paydest_* buttons.`);
    callbackData = "paydest_tbank";
  }

  // ── Payment destination callbacks (paydest_*) — NEW ──────────────────────
  // Mirrors the deposit destination pattern: operator picks which card the
  // bank portion went to (or "split" to enter a mixed cash+card amount).
  if (callbackData === "paydest_tbank" || callbackData === "paydest_sber") {
    const dest = callbackData === "paydest_tbank" ? "tbank" : "sber";
    const bike = await resolveBikeById(context.bikeId);
    const specs = bike?.specs || {};
    const startDate = context.rentStartDate;
    const startTime = context.rentStartTime || "10:00";
    const endDate = context.rentEndDate;
    const endTime = context.rentEndTime || "10:00";
    const start = parseRuDateTime(startDate, startTime);
    const end = parseRuDateTime(endDate, endTime);
    const hours = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60) * 10) / 10);
    const specsForPricing = {
      price_per_hour: specs.price_per_hour,
      price_per_3h: specs.price_per_3h,
      price_per_6h: specs.price_per_6h,
      price_per_12h: specs.price_per_12h,
      dailyPrice: specs.dailyPrice,
      rent_weekday: specs.rent_weekday,
      rent_weekend: specs.rent_weekend,
      rent_2_4d: specs.rent_2_4d,
      rent_5_10d: specs.rent_5_10d,
      rent_11_30d: specs.rent_11_30d,
    };
    const startDateForCalc = (() => {
      if (!startDate) return undefined;
      const dmy = startDate.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
      if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
      return startDate;
    })();
    const tierResult = calculatePriceForDuration(specsForPricing, hours, startDateForCalc);
    const rentalCost = Number(tierResult.price > 0 ? tierResult.price : Number(specs.dailyPrice || specs.rent_weekday || 10000));
    const helmets = context.helmets || 0;
    const gloves = context.gloves || 0;
    const jacket = context.jacket ? 1 : 0;
    const boots = context.boots ? 1 : 0;
    const net = context.net ? 1 : 0;
    const backpack = context.backpack ? 1 : 0;
    const bag = context.bag ? 1 : 0;
    const equipmentCost = helmets * getHelmetPrice(hours) + gloves * 500 + jacket * 500 + boots * 500 + net * 500 + backpack * 500 + bag * 500;
    const totalAmount = context.priceOverridden ? (context.cashAmount || 0) + (context.bankAmount || 0) : (rentalCost + equipmentCost);
    context.cashAmount = 0;
    context.bankAmount = totalAmount;
    context.paymentCardDestination = dest;
    logger.info(`[/doc] ${callbackData}: ${userId} → all ${dest} bank=${totalAmount}`);
    await gotoDepositChoice(chatId, userId, context);
    return true;
  }

  if (callbackData === "paydest_split") {
    // Ask how much is cash; the rest goes to a card (chosen next)
    const bike = await resolveBikeById(context.bikeId);
    const specs = bike?.specs || {};
    const startDate = context.rentStartDate;
    const startTime = context.rentStartTime || "10:00";
    const endDate = context.rentEndDate;
    const endTime = context.rentEndTime || "10:00";
    const start = parseRuDateTime(startDate, startTime);
    const end = parseRuDateTime(endDate, endTime);
    const hours = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60) * 10) / 10);
    const specsForPricing = {
      price_per_hour: specs.price_per_hour,
      price_per_3h: specs.price_per_3h,
      price_per_6h: specs.price_per_6h,
      price_per_12h: specs.price_per_12h,
      dailyPrice: specs.dailyPrice,
      rent_weekday: specs.rent_weekday,
      rent_weekend: specs.rent_weekend,
      rent_2_4d: specs.rent_2_4d,
      rent_5_10d: specs.rent_5_10d,
      rent_11_30d: specs.rent_11_30d,
    };
    const startDateForCalc = (() => {
      if (!startDate) return undefined;
      const dmy = startDate.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
      if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
      return startDate;
    })();
    const tierResult = calculatePriceForDuration(specsForPricing, hours, startDateForCalc);
    const rentalCost = Number(tierResult.price > 0 ? tierResult.price : Number(specs.dailyPrice || specs.rent_weekday || 10000));
    const helmets = context.helmets || 0;
    const gloves = context.gloves || 0;
    const jacket = context.jacket ? 1 : 0;
    const boots = context.boots ? 1 : 0;
    const net = context.net ? 1 : 0;
    const backpack = context.backpack ? 1 : 0;
    const bag = context.bag ? 1 : 0;
    const equipmentCost = helmets * getHelmetPrice(hours) + gloves * 500 + jacket * 500 + boots * 500 + net * 500 + backpack * 500 + bag * 500;
    const totalAmount = context.priceOverridden ? (context.cashAmount || 0) + (context.bankAmount || 0) : (rentalCost + equipmentCost);
    logger.info(`[/doc] paydest_split: ${userId} → asking for cash portion (total=${totalAmount})`);
    // Use payment_split_cash state (separate from payment_cash) so we can ask
    // which card the bank portion goes to after the cash amount is typed.
    await setState(userId, "payment_split_cash", context);
    await sendComplexMessage(
      chatId,
      `🔀 *Смешанная оплата: ${totalAmount.toLocaleString("ru-RU")} ₽*\n\nСколько наличными? Остальное пойдёт на карту (выберете следующей кнопкой).`,
      [], { removeKeyboard: true, parseMode: "Markdown" },
    );
    return true;
  }

  // ── Payment split card callbacks (paysplit_*) — NEW ──────────────────────
  // After paydest_split + payment_cash (operator typed the cash amount),
  // ask which card the bank portion went to.
  if (callbackData === "paysplit_tbank" || callbackData === "paysplit_sber") {
    const dest = callbackData === "paysplit_tbank" ? "tbank" : "sber";
    context.paymentCardDestination = dest;
    logger.info(`[/doc] ${callbackData}: ${userId} → split: cash=${context.cashAmount} ${dest}=${context.bankAmount}`);
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
    // Route to deposit destination (cash/card/split) instead of directly to confirm
    await gotoDepositDestination(chatId, userId, context);
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

  // ── Deposit destination callbacks (depdest_*) — NEW step ──────────────────
  if (callbackData === "depdest_cash") {
    context.depositCashAmount = Number(context.depositOverride || "20000");
    context.depositCardAmount = 0;
    context.depositCardDestination = undefined;
    logger.info(`[/doc] depdest_cash: ${userId} → all cash ${context.depositCashAmount}`);
    const summary = buildRentSummary(context);
    await setState(userId, "confirm", context);
    await sendComplexMessage(chatId, summary, buildConfirmKeyboard(), { keyboardType: 'inline', parseMode: 'Markdown' });
    return true;
  }

  if (callbackData === "depdest_tbank" || callbackData === "depdest_sber") {
    const dest = callbackData === "depdest_tbank" ? "tbank" : "sber";
    context.depositCashAmount = 0;
    context.depositCardAmount = Number(context.depositOverride || "20000");
    context.depositCardDestination = dest;
    logger.info(`[/doc] ${callbackData}: ${userId} → all ${dest} ${context.depositCardAmount}`);
    const summary = buildRentSummary(context);
    await setState(userId, "confirm", context);
    await sendComplexMessage(chatId, summary, buildConfirmKeyboard(), { keyboardType: 'inline', parseMode: 'Markdown' });
    return true;
  }

  if (callbackData === "depdest_split") {
    // Ask how much is cash; the rest goes to a card
    const total = Number(context.depositOverride || "20000");
    logger.info(`[/doc] depdest_split: ${userId} → asking for cash portion (total=${total})`);
    await setState(userId, "deposit_split_cash", context);
    await sendComplexMessage(
      chatId,
      `🔀 *Смешанный депозит: ${total.toLocaleString("ru-RU")} ₽*\n\nСколько наличными?`,
      [], { removeKeyboard: true, parseMode: "Markdown" },
    );
    return true;
  }

  // ── Deposit split card callbacks (depsplit_*) ─────────────────────────────
  if (callbackData === "depsplit_tbank" || callbackData === "depsplit_sber") {
    const dest = callbackData === "depsplit_tbank" ? "tbank" : "sber";
    context.depositCardDestination = dest;
    logger.info(`[/doc] ${callbackData}: ${userId} → split: cash=${context.depositCashAmount} ${dest}=${context.depositCardAmount}`);
    const summary = buildRentSummary(context);
    await setState(userId, "confirm", context);
    await sendComplexMessage(chatId, summary, buildConfirmKeyboard(), { keyboardType: 'inline', parseMode: 'Markdown' });
    return true;
  }

  // ── Sale color callbacks (salecol_*) — sale flow step 5 ─────────────────
  if (callbackData === "salecol_confirm") {
    // Operator confirms the bike's catalog color
    const bike = await resolveBikeById(context.bikeId);
    context.saleColor = String(bike?.specs?.color || "").trim();
    logger.info(`[/doc] salecol_confirm: ${userId} → color="${context.saleColor}"`);
    await gotoSaleVin(chatId, userId, context);
    return true;
  }

  if (callbackData === "salecol_custom") {
    // Operator wants to type a custom color — keep state=sale_color, drop
    // the inline keyboard, and ask for free-text input. The sale_color
    // text-input branch picks up the next message.
    logger.info(`[/doc] salecol_custom: ${userId} → asking for custom color`);
    await sendComplexMessage(
      chatId,
      "*Введите цвет ТС*",
      [], { removeKeyboard: true, parseMode: "Markdown" },
    );
    return true;
  }

  // ── Sale VIN callbacks (salevin_*) — sale flow step 6 ───────────────────
  if (callbackData === "salevin_confirm") {
    // Operator confirms the bike's catalog VIN/frame
    const bike = await resolveBikeById(context.bikeId);
    context.saleVin = String(bike?.specs?.vin || bike?.specs?.frame || bike?.specs?.vin_number || "").trim();
    context.saleVinSkipped = false;
    logger.info(`[/doc] salevin_confirm: ${userId} → vin="${context.saleVin}"`);
    await gotoPrice(chatId, userId, context);
    return true;
  }

  if (callbackData === "salevin_custom") {
    // Operator wants to type a custom VIN — keep state=sale_vin, drop the
    // inline keyboard, and ask for free-text input.
    logger.info(`[/doc] salevin_custom: ${userId} → asking for custom VIN`);
    await sendComplexMessage(
      chatId,
      "*Введите VIN / № рамы ТС*\n\n17 символов (латиница + цифры) или короче для номера рамы.",
      [], { removeKeyboard: true, parseMode: "Markdown" },
    );
    return true;
  }

  if (callbackData === "salevin_skip") {
    // Operator chooses not to enter a VIN — leave saleVin unset, mark
    // skipped. Contract will render "уточняется" via template fallback.
    context.saleVin = undefined;
    context.saleVinSkipped = true;
    logger.info(`[/doc] salevin_skip: ${userId} → VIN entry skipped`);
    await gotoPrice(chatId, userId, context);
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
      await sendComplexMessage(chatId, withStep("*Введите цену (руб)*", "price", "sale"), [], { removeKeyboard: true, parseMode: "Markdown" });
      return true;
    }
    context.salePrice = price;
    // Route to delivery method step (NEW — sale flow step 11)
    await gotoSaleDelivery(chatId, userId, context);
    return true;
  }

  // ── Delivery method callbacks (NEW — sale flow step 11) ───────────────────
  if (callbackData === "delivery_pickup") {
    context.saleDeliveryMethod = 'pickup';
    context.saleTransportCompany = undefined;
    context.saleTransportPaymentType = undefined;
    logger.info(`[/doc] delivery_pickup: ${userId} → pickup`);
    const summary = buildSaleSummary(context, context.salePrice || "");
    await setState(userId, "confirm", context);
    await sendComplexMessage(chatId, summary, buildConfirmKeyboard(), { keyboardType: 'inline', parseMode: 'Markdown' });
    return true;
  }

  if (callbackData === "delivery_tc_buyer" || callbackData === "delivery_tc_seller") {
    context.saleDeliveryMethod = 'transport_company';
    context.saleTransportPaymentType = callbackData === "delivery_tc_buyer" ? 'buyer_pays' : 'seller_pays';
    logger.info(`[/doc] ${callbackData}: ${userId} → TC (${context.saleTransportPaymentType})`);
    await setState(userId, "sale_transport", context);
    await sendComplexMessage(
      chatId,
      `🚚 *Транспортная компания*\n\nУкажите название ТК:\n(например: Деловые Линии, ПЭК, СДЭК)`,
      [], { removeKeyboard: true, parseMode: 'Markdown' },
    );
    return true;
  }

  // ── Step correction callback (NEW) ─────────────────────────────────────────
  if (callbackData === "correct_step") {
    const visibleSteps = getVisibleSteps(context);
    const list = visibleSteps.map((s, i) => `${i + 1}. ${s.label}`).join('\n');
    await setState(userId, "step_correction", context);
    await sendComplexMessage(chatId,
      `🔢 *Какой шаг исправить?*\n\n${list}\n\nВведите номер:`,
      [], { removeKeyboard: true, parseMode: 'Markdown' });
    return true;
  }

  if (callbackData === "ok") {
    // Before generating: ask for optional client phone (for callback leads)
    // This links the contract to the web lead (phone = user_id in users table)
    if (!context.clientPhoneResolved) {
      await setState(userId, "client_phone", context);
      await sendComplexMessage(
        chatId,
        "📞 *Телефон клиента*\n\nЕсли клиент пришёл с сайта (заявка на звонок), введите его номер — договор привяжется к заявке.\n\nИли нажмите «Пропустить».",
        [
          [{ text: "⏭ Пропустить", callback_data: "ph_skip" }],
          [{ text: "❌ Отменить", callback_data: "cancel" }],
        ],
        { keyboardType: "inline", parseMode: "Markdown" },
      );
      return true;
    }
    const docCrewSlug = await getDocCrewSlug(userId);
    await sendComplexMessage(chatId, "⏳ Генерирую...", [], { removeKeyboard: true });
    const success = await generateContract(chatId, userId, context, docCrewSlug);
    if (success) {
      await clearState(userId);
    }
    return true;
  }

  if (callbackData === "ph_skip") {
    context.clientPhoneResolved = true;
    await setState(userId, "confirm", context);
    const docCrewSlug = await getDocCrewSlug(userId);
    await sendComplexMessage(chatId, "⏳ Генерирую...", [], { removeKeyboard: true });
    const success = await generateContract(chatId, userId, context, docCrewSlug);
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

  // Resolve crew slug from user_states context
  const crewSlug = await getDocCrewSlug(userIdStr);

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
    await sendComplexMessage(chatId, withStep("Тип договора:", "deal"), buildDealKeyboard(), { keyboardType: 'inline' });
    return;
  }

  const bikes = await getAvailableBikes(crewSlug);
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
