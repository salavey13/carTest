// /app/webhook-handlers/commands/ekip-manual.ts
/**
 * /ekip command handler - EQUIPMENT RENTAL/SELLING (SMART MANUAL VERSION)
 * =============================================================================
 *
 * Gold standard reference: /app/webhook-handlers/commands/doc-manual.ts
 *
 * PHILOSOPHY: Follows the doc-manual.ts patterns for consistency.
 * - Equipment catalog loaded from cars table where type='equipment'
 * - State machine with Supabase persistence
 * - Inline keyboards for selections
 * - Smart parsers for dates, passport, etc.
 * - Contract generation via docx-capability
 *
 * Flow (RENT) - 9 steps:
 *   1. Deal type → Rent/Sale
 *   2. Equipment type → category (jacket, pants, suit, helmet, gloves...)
 *   3. Items → multi-select by id (paginated, toggle ✅), then «Готово»
 *   4. Full name → "Иванов Иван Иванович"
 *   5. Passport → "4509 123456 15.03.2020 ОМВД"
 *   6. Birth → "15.03.1990"
 *   7. Address → free text
 *   8. Start → "сегодня 18" or inline keyboard
 *   9. End → "завтра 10" or inline keyboard
 *   10. Payment split → cash/bank/split
 *   11. Deposit choice → Confirm / Override
 *   → Done! (ONE contract for ALL selected equipment — equipmentIds[])
 *
 * Flow (SALE) - 7 steps:
 *   1. Deal type → Rent/Sale
 *   2. Equipment type → category (jacket, pants, suit...)
 *   3. Items → multi-select by id (paginated, toggle ✅), then «Готово»
 *   4. Full name
 *   5. Passport
 *   6. Birth
 *   7. Address
 *   8. Price → inline keyboard or custom
 *   → Done! (ONE contract listing ALL equipment, total price = sum)
 */

"use server";

import { logger } from "@/lib/logger";
import { supabaseAdmin } from "@/hooks/supabase";
import { sendComplexMessage, KeyboardButton } from "../actions/sendComplexMessage";
import { notifyAdmin, sendTelegramDocument } from "@/app/actions";
import { buildFranchizeDocxFromTemplate, uploadDocxToStorage } from "@/app/franchize/lib/docx-capability";
import { loadCrewSecrets as loadCrewSecretsShared, loadTemplateForCrewWithOverrides } from "../lib/crew-access";
import { buildRentalContractVariables, type CrewSecrets as RentalCrewSecrets } from "@/app/lib/rental-contract-vars";
import { privateSchema } from "@/lib/private-secrets";
import { convertTextDateToTimestamp, resolveCrewOwnerChatId } from "@/lib/rental-date-utils";
import {
  EQUIPMENT_CATEGORY_LABELS,
  categoryEmoji,
  normalizeMaterialKey,
  materialDisplay,
  itemDailyPrice,
  itemSalePrice,
  itemSize,
  sumDailyPrices,
  sumSalePrices,
  equipmentTitle,
  parseRuDateTime,
  rentDaysBetween,
  apportionTotal,
  normalizePaymentMethod,
  normalizeDepositMethod,
} from "@/app/franchize/lib/equipment-shared";

// Reuse utilities from doc-manual
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
const CURRENT_YEAR = 2026;
const EKIP_STATE_EXPIRY_MINUTES = 30;

// Items per page in the equipment selection keyboard
const EKIP_PAGE_SIZE = 10;

// ══════════════════════════════════════════════════════════════════════════
// 2026-09-10 EQUIPMENT PARITY: /ekip now writes to the SAME tables as /doc
// and the web checkout — unified `rentals` (metadata.item_type='equipment'),
// deposit_entries, crew_todos return reminders and sale_contract_artifacts.
// Before this fix the command only generated a DOCX: equipment deals were
// invisible to the CRM (no pipeline, no money ledger, no return flow).
// ══════════════════════════════════════════════════════════════════════════

// ── Equipment catalog ────────────────────────────────────────────────────────

interface EquipmentItem {
  id: string;
  make: string;
  model: string;
  image_url?: string;
  daily_price?: number | null; // cars-table column (seed 20260812000006); wins over specs copy
  specs: {
    daily_price?: number;
    rent_weekday?: number;
    rent_weekend?: number;
    sale_price?: number;
    category?: string;
    deposit_rub?: number;
    image_url?: string;
    size?: string;
    sizes?: string[];      // B.3: multi-size items (array per gold standard)
    colors?: string[];     // B.4: multi-color items
    materials?: string;    // B.1: material string per gold standard (e.g., "Текстиль", "Кожа")
    features?: string[];
    badge?: string;
    [key: string]: unknown; // allow arbitrary JSONB fields
  };
  crew_id?: string;
}

/**
 * Crew-scoped equipment catalog.
 *
 * FIX (2026-09-10): the previous implementation ignored its `crewSlug` param
 * and loaded EVERY crew's equipment (cross-tenant leak), and didn't select
 * `cars.daily_price` — so seeded 500₽ items were quoted at the 1000₽ fallback
 * (sumDailyPrices fallback). Now: resolve crew by slug, filter by crew_id,
 * select the price column.
 */
async function getEquipmentCatalog(crewSlug?: string): Promise<EquipmentItem[]> {
  try {
    let query = supabaseAdmin
      .from("cars")
      .select("id, make, model, specs, crew_id, daily_price, image_url")
      .eq("type", "equipment");

    if (crewSlug) {
      const { data: crew } = await supabaseAdmin
        .from("crews")
        .select("id")
        .eq("slug", crewSlug)
        .maybeSingle();
      if (crew?.id) {
        query = query.eq("crew_id", crew.id);
      }
    }

    const { data, error } = await query.order("make, model");

    if (error) {
      logger.error("[/ekip] Failed to load equipment catalog:", error);
      return [];
    }

    return (data || []) as EquipmentItem[];
  } catch (error) {
    logger.error("[/ekip] Exception loading equipment catalog:", error);
    return [];
  }
}

async function resolveEquipmentById(equipmentId: string): Promise<EquipmentItem | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from("cars")
      .select("id, make, model, specs, crew_id, daily_price, image_url")
      .eq("type", "equipment")
      .eq("id", equipmentId)
      .maybeSingle();

    if (error || !data) return null;
    return data as EquipmentItem;
  } catch (error) {
    logger.error("[/ekip] Failed to resolve equipment:", error);
    return null;
  }
}

/**
 * Crew-scoped catalog for the CURRENT flow: prefers the crew selected in the
 * context (multi-crew operator support) and falls back to user_states.
 */
async function catalogFor(userId: string, context: EkipFlowContext): Promise<EquipmentItem[]> {
  const slug = context.selectedCrew || await getEkipCrewSlug(userId);
  return getEquipmentCatalog(slug);
}

// ── Crew slug resolution ────────────────────────────────────────────────────

async function getEkipCrewSlug(userId: string): Promise<string> {
  try {
    const { data } = await supabaseAdmin
      .from("user_states")
      .select("context")
      .eq("user_id", userId)
      .maybeSingle();
    const selectedCrew = (data?.context as any)?.selectedCrew;
    return selectedCrew || "vip-bike";
  } catch (error) {
    logger.warn("[/ekip] Failed to read crew slug from user_states, using default:", error);
    return "vip-bike";
  }
}

// ── Keyboard builders ───────────────────────────────────────────────────────

function buildDealKeyboard(): KeyboardButton[][] {
  return [[
    { text: "📋 Аренда", callback_data: "d_rent" },
    { text: "💰 Продажа", callback_data: "d_sale" },
  ]];
}

function buildEquipmentKeyboard(equipmentList: EquipmentItem[], selectedId?: string): KeyboardButton[][] {
  const rows: KeyboardButton[][] = [];

  // Group by category if available
  const grouped = new Map<string, EquipmentItem[]>();
  for (const item of equipmentList) {
    const category = item.specs?.category || "Прочее";
    if (!grouped.has(category)) grouped.set(category, []);
    grouped.get(category)!.push(item);
  }

  for (const [category, items] of grouped.entries()) {
    for (const item of items) {
      const isSelected = selectedId === item.id;
      const prefix = item.specs?.category === "helmet" ? "🪖"
        : item.specs?.category === "jacket" ? "🧥"
        : item.specs?.category === "gloves" ? "🧤"
        : item.specs?.category === "boots" ? "👢"
        : item.specs?.category === "pants" ? "👖"
        : item.specs?.category === "net" ? "🌐"
        : item.specs?.category === "backpack" ? "👜"
        : "📦";

      rows.push([{
        text: `${isSelected ? "✅ " : ""}${prefix} ${item.make} ${item.model}`,
        callback_data: `eq_${item.id}`,
      }]);
    }
  }

  rows.push([
    { text: "✅ Готово", callback_data: "eq_done" },
    { text: "❌ Отменить", callback_data: "cancel" },
  ]);

  return rows;
}

function buildCategoryKeyboard(equipmentList: EquipmentItem[], selectedIds: string[]): KeyboardButton[][] {
  // First step of equipment selection: pick a TYPE (jacket/pants/suit...) —
  // showing 60+ items at once is useless, so we walk type → items.
  const byCategory = new Map<string, EquipmentItem[]>();
  for (const item of equipmentList) {
    const category = item.specs?.category || "other";
    if (!byCategory.has(category)) byCategory.set(category, []);
    byCategory.get(category)!.push(item);
  }

  const rows: KeyboardButton[][] = [];
  for (const [category, items] of byCategory.entries()) {
    const label = EQUIPMENT_CATEGORY_LABELS[category] || category;
    const counts = items.length > 0 ? ` (${items.length})` : "";
    rows.push([{
      text: `${categoryEmoji(category)} ${label}${counts}`,
      callback_data: `ecat_${category}`,
    }]);
  }

  rows.push([
    { text: selectedIds.length > 0 ? `✅ Готово (${selectedIds.length})` : "✅ Готово", callback_data: "eq_done" },
    { text: "❌ Отменить", callback_data: "cancel" },
  ]);

  return rows;
}

function buildCategoryItemsKeyboard(
  equipmentList: EquipmentItem[],
  category: string,
  selectedIds: string[],
  page: number,
  subcategory?: string, // B.1: filter by material (e.g., "Кожа", "Текстиль")
): KeyboardButton[][] {
  // B.1: filter by category + optional subcategory (normalized material key)
  let items = equipmentList.filter((i) => (i.specs?.category || "other") === category);
  if (subcategory) {
    // Review fix: use normalizeMaterialKey for case-insensitive matching.
    // subcategory is now a short English key (e.g., "leather"), not the raw
    // Russian string. Items are filtered by their normalized material key.
    items = items.filter(i => normalizeMaterialKey(i.specs?.materials) === subcategory);
  }
  const label = EQUIPMENT_CATEGORY_LABELS[category] || category;
  const pageCount = Math.max(1, Math.ceil(items.length / EKIP_PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), pageCount - 1);
  const pageItems = items.slice(safePage * EKIP_PAGE_SIZE, (safePage + 1) * EKIP_PAGE_SIZE);

  const rows: KeyboardButton[][] = [];
  for (const item of pageItems) {
    const selected = selectedIds.includes(item.id);
    // B.3: handle both specs.size (string) and specs.sizes (array).
    // Gold standard: sizes is an array of strings, size is singular string.
    const sizeInfo = item.specs?.size
      ? ` (${item.specs.size})`
      : item.specs?.sizes?.length
        ? ` (${item.specs.sizes.join(", ")})`
        : "";
    // B.1 prep: show material if available (normalized display from specs.materials)
    const matKey = normalizeMaterialKey(item.specs?.materials);
    const materialInfo = matKey !== "other" ? ` [${materialDisplay(matKey).label}]` : "";
    rows.push([{
      text: `${selected ? "✅ " : ""}${categoryEmoji(category)} ${item.make} ${item.model}${sizeInfo}${materialInfo}`,
      callback_data: `eq_${item.id}`,
    }]);
  }

  // Pagination row
  const nav: KeyboardButton[] = [];
  if (pageCount > 1) {
    if (safePage > 0) nav.push({ text: "⬅️", callback_data: `epg_${category}_${safePage - 1}` });
    nav.push({ text: `📄 ${safePage + 1}/${pageCount}`, callback_data: "eq_info" });
    if (safePage < pageCount - 1) nav.push({ text: "➡️", callback_data: `epg_${category}_${safePage + 1}` });
  }
  if (nav.length > 0) rows.push(nav);

  rows.push([
    { text: "↩️ Категории", callback_data: "ecat_back" },
    { text: selectedIds.length > 0 ? `✅ Готово (${selectedIds.length} шт.)` : "✅ Готово", callback_data: "eq_done" },
    { text: "❌ Отменить", callback_data: "cancel" },
  ]);

  return rows;
}

function buildStartKeyboard(): KeyboardButton[][] {
  const now = new Date();
  const currentHour = now.getHours();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const fmt = (d: Date) => `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}`;

  const rows: KeyboardButton[][] = [];

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

function buildEndKeyboard(startTime?: string): KeyboardButton[][] {
  const timeLabel = startTime || "10:00";
  const timeCode = timeLabel.replace(":", "");

  const rows: KeyboardButton[][] = [];

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

function buildPaymentSplitKeyboard(totalAmount: number): KeyboardButton[][] {
  const formatted = totalAmount.toLocaleString("ru-RU");
  return [
    [{ text: `💰 Итого: ${formatted} ₽`, callback_data: "pay_info" }],
    [{ text: "✏️ Своя цена", callback_data: "pay_override" }],
    [{ text: "💵 Ввести сумму наличными", callback_data: "pay_cash" }],
    [{ text: "✅ Всё наличными", callback_data: "pay_all_cash" }],
    [
      { text: "💳 Всё на Тинькофф", callback_data: "paydest_tbank" },
      { text: "💳 Всё на Сбербанк", callback_data: "paydest_sber" },
    ],
    [{ text: "🔀 Смешанный", callback_data: "paydest_split" }],
    [{ text: "❌ Отменить", callback_data: "cancel" }],
  ];
}

function buildDepositChoiceKeyboard(depositAmount: string, equipment?: EquipmentItem | null): KeyboardButton[][] {
  const amount = Number(depositAmount) || 5000;
  const formatted = amount.toLocaleString("ru-RU");
  const eqLabel = equipment ? ` (${equipment.make} ${equipment.model})` : "";
  return [
    [{ text: `✅ Депозит ${formatted} ₽${eqLabel}`, callback_data: "dep_confirm" }],
    [{ text: `✏️ Своя сумма`, callback_data: "dep_custom" }],
    [{ text: "❌ Отменить", callback_data: "cancel" }],
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

function buildPriceKeyboard(): KeyboardButton[][] {
  return [
    [{ text: "2 000 ₽", callback_data: "p_2000" }],
    [{ text: "5 000 ₽", callback_data: "p_5000" }],
    [{ text: "10 000 ₽", callback_data: "p_10000" }],
    [{ text: "15 000 ₽", callback_data: "p_15000" }],
    [{ text: "25 000 ₽", callback_data: "p_25000" }],
    [{ text: "✏️ Своя цена", callback_data: "p_custom" }],
  ];
}

// ── State type ───────────────────────────────────────────────────────────────

interface EkipFlowContext {
  dealType: "rent" | "sale";
  equipmentId: string;
  equipmentIds?: string[];
  equipmentCategory?: string;
  equipmentPage?: number;
  equipmentSubcategory?: string; // B.1: filter by material ("Кожа", "Текстиль", etc.)
  equipmentMake?: string;
  equipmentModel?: string;
  mpFullName?: string;
  mpSeries?: string;
  mpNumber?: string;
  mpIssueDate?: string;
  mpIssuedBy?: string;
  mpBirthDate?: string;
  mpRegistration?: string;
  rentStartDate?: string;
  rentStartTime?: string;
  rentEndDate?: string;
  rentEndTime?: string;
  salePrice?: string;
  depositOverride?: string;
  cashAmount?: number;
  bankAmount?: number;
  paymentCardDestination?: 'tbank' | 'sber';
  priceOverridden?: boolean;
  clientPhone?: string;
  clientPhoneResolved?: boolean;
  // Crew selection — preserved across setState (multi-crew operator support).
  // See doc-manual.ts:795 for the same field with full rationale.
  selectedCrew?: string;
}

// ── Smart parsers (reused from doc-manual) ─────────────────────────────────────

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
  const parts2 = dateStr.split('.');
  if (parts2.length === 2) return null;

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

function decodeCallbackTime(raw: string): string {
  if (/^\d{4}$/.test(raw)) {
    return `${raw.slice(0, 2)}:${raw.slice(2)}`;
  }
  return `${raw.padStart(2, '0')}:00`;
}

function parseStartDate(text: string): { date: string; time: string } | null {
  const t = text.trim().toLowerCase();
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const formatDate = (d: Date) => `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;

  const todayMatch = t.match(/сегодня\s+(\d{1,2})(:(\d{2}))?/);
  if (todayMatch) {
    const hour = todayMatch[1].padStart(2, '0');
    const min = todayMatch[3] || '00';
    return { date: formatDate(today), time: `${hour}:${min}` };
  }

  const tomorrowMatch = t.match(/завтра\s+(\d{1,2})(:(\d{2}))?/);
  if (tomorrowMatch) {
    const hour = tomorrowMatch[1].padStart(2, '0');
    const min = tomorrowMatch[3] || '00';
    return { date: formatDate(tomorrow), time: `${hour}:${min}` };
  }

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

function parseEndDate(text: string, startDate?: string): { date: string; time: string } | null {
  const t = text.trim().toLowerCase();
  const today = new Date();
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const dayAfter = new Date(today); dayAfter.setDate(today.getDate() + 2);

  let startRef = new Date(today);
  if (startDate) {
    const sp = startDate.split('.');
    if (sp.length === 3) startRef = new Date(`${sp[2]}-${sp[1]}-${sp[0]}`);
  }

  const formatDate = (d: Date) => `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;

  const todayMatch = t.match(/сегодня\s+(\d{1,2})(:(\d{2}))?/);
  if (todayMatch) {
    const hour = todayMatch[1].padStart(2, '0');
    const min = todayMatch[3] || '00';
    return { date: formatDate(startRef), time: `${hour}:${min}` };
  }

  const tomorrowMatch = t.match(/завтра\s+(\d{1,2})(:(\d{2}))?/);
  if (tomorrowMatch) {
    const hour = tomorrowMatch[1].padStart(2, '0');
    const min = tomorrowMatch[3] || '00';
    return { date: formatDate(tomorrow), time: `${hour}:${min}` };
  }

  const dayAfterMatch = t.match(/послезавтра\s+(\d{1,2})(:(\d{2}))?/);
  if (dayAfterMatch) {
    const hour = dayAfterMatch[1].padStart(2, '0');
    const min = dayAfterMatch[3] || '00';
    return { date: formatDate(dayAfter), time: `${hour}:${min}` };
  }

  const dateMatch = t.match(/(\d{1,2})\.(\d{1,2})(\.(\d{2,4}))?\s+(\d{1,2})(:(\d{2}))?/);
  if (dateMatch) {
    let [, d, m, , y, h, , min] = dateMatch;
    const year = y ? (y.length === 2 ? (parseInt(y) > 50 ? `19${y}` : `20${y}`) : y) : CURRENT_YEAR;
    const hour = h.padStart(2, '0');
    const minute = min || '00';
    return { date: `${d.padStart(2,'0')}.${m.padStart(2,'0')}.${year}`, time: `${hour}:${minute}` };
  }

  const dateOnlyMatch = t.match(/^(\d{1,2})\.(\d{1,2})(\.(\d{2,4}))?$/);
  if (dateOnlyMatch) {
    let [, d, m, , y] = dateOnlyMatch;
    const year = y ? (y.length === 2 ? (parseInt(y) > 50 ? `19${y}` : `20${y}`) : y) : CURRENT_YEAR;
    return { date: `${d.padStart(2,'0')}.${m.padStart(2,'0')}.${year}`, time: '10:00' };
  }

  return null;
}

// ── Summary builders ─────────────────────────────────────────────────────
// NOTE: parseRuDateTime / sumDailyPrices / sumSalePrices / equipmentTitle now
// come from @/app/franchize/lib/equipment-shared. Price helpers are catalog
// aware: cars.daily_price (seed 20260812000006) wins over the legacy 1000₽
// fallback, so seeded 500₽ items are quoted correctly.

function selectedEquipmentIds(context: EkipFlowContext): string[] {
  const ids = context.equipmentIds?.length ? context.equipmentIds : (context.equipmentId ? [context.equipmentId] : []);
  return ids;
}

async function resolveAllEquipment(context: EkipFlowContext): Promise<EquipmentItem[]> {
  const ids = selectedEquipmentIds(context);
  const items: EquipmentItem[] = [];
  for (const id of ids) {
    const item = await resolveEquipmentById(id);
    if (item) items.push(item);
  }
  return items;
}

function buildRentSummary(context: EkipFlowContext, items?: EquipmentItem[]): string {
  const resolved = items || [];
  const lines = [
    "*📋 Проверьте:*",
    "",
    `👤 ${context.mpFullName}`,
    `🪪 ${context.mpSeries} ${context.mpNumber} от ${context.mpIssueDate}`,
    `📅 ${context.mpBirthDate}`,
    "",
    `📦 Оборудование: ${equipmentTitle(resolved) || context.equipmentMake || ""}`,
    `📅 ${context.rentStartDate} ${context.rentStartTime} → ${context.rentEndDate} ${context.rentEndTime}`,
    "",
    `💰 Депозит: ${Number(context.depositOverride || "5000").toLocaleString("ru-RU")} ₽`,
    "",
    "Всё верно?",
  ];
  return lines.join("\n");
}

function buildSaleSummary(context: EkipFlowContext, price: string | number, items?: EquipmentItem[]): string {
  const resolved = items || [];
  return [
    "*📋 Продажа — проверьте:*",
    "",
    `👤 ${context.mpFullName}`,
    `🪪 ${context.mpSeries} ${context.mpNumber}`,
    `📅 ${context.mpBirthDate}`,
    `🏠 ${context.mpRegistration}`,
    "",
    `📦 Оборудование: ${equipmentTitle(resolved) || context.equipmentMake || ""}`,
    "",
    `💰 ${Number(price).toLocaleString("ru-RU")} ₽`,
    "",
    "Всё верно?",
  ].join("\n");
}

// ── State management ─────────────────────────────────────────────────────────

async function setState(userId: string, state: string, context: EkipFlowContext) {
  await supabaseAdmin.from("user_states").upsert({
    user_id: userId,
    state,
    context: { ...context, _ekip: true }, // Marker for ekip state
    expires_at: new Date(Date.now() + EKIP_STATE_EXPIRY_MINUTES * 60 * 1000).toISOString(),
  });
}

async function clearState(userId: string) {
  await supabaseAdmin.from("user_states").delete().eq("user_id", userId);
}

async function getState(userId: string): Promise<{ state: string; context: EkipFlowContext } | null> {
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
  return { state: data.state, context: (data.context || {}) as EkipFlowContext };
}

// ── Navigation helpers ───────────────────────────────────────────────────────

function withStep(message: string, state: string, dealType?: string): string {
  // Step numbers not shown (consistent with doc-manual I4 enhancement)
  return message;
}

async function gotoPaymentSplit(chatId: number, userId: string, context: EkipFlowContext): Promise<void> {
  const equipmentItems = await resolveAllEquipment(context);
  if (!equipmentItems.length) {
    logger.error(`[/ekip] gotoPaymentSplit: equipment not found for ${context.equipmentId}`);
    await sendComplexMessage(chatId, "❌ Оборудование не найдено", [], { removeKeyboard: true });
    return;
  }

  // Calculate price based on duration (sum of all selected items' daily rates)
  const startDate = context.rentStartDate;
  const startTime = context.rentStartTime || "10:00";
  const endDate = context.rentEndDate;
  const endTime = context.rentEndTime || "10:00";

  const start = parseRuDateTime(startDate, startTime);
  const end = parseRuDateTime(endDate, endTime);
  const hours = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60) * 10) / 10);
  const days = Math.max(1, Math.ceil(hours / 24));

  const dailyTotal = sumDailyPrices(equipmentItems);
  const totalAmount = context.priceOverridden
    ? (context.cashAmount || 0) + (context.bankAmount || 0)
    : dailyTotal * days;

  if (!context.priceOverridden) {
    context.cashAmount = totalAmount;
    context.bankAmount = 0;
  }

  await setState(userId, "payment_split", context);

  const periodLabel = days === 1 ? "1 день" : `${days} дн.`;
  const itemsLabel = equipmentItems.length > 1
    ? `Выбрано: ${equipmentItems.length} шт.`
    : equipmentTitle(equipmentItems);

  await sendComplexMessage(
    chatId,
    `*Расчёт стоимости*\n\n` +
    `${itemsLabel}\n` +
    `Аренда (${periodLabel}): *${(dailyTotal * days).toLocaleString("ru-RU")} ₽*\n\n` +
    `💰 *Итого: ${totalAmount.toLocaleString("ru-RU")} ₽*\n\n` +
    `Как будет оплачено?`,
    buildPaymentSplitKeyboard(totalAmount),
    { keyboardType: 'inline', parseMode: 'Markdown' },
  );
}

async function gotoDepositChoice(chatId: number, userId: string, context: EkipFlowContext): Promise<void> {
  const equipmentItems = await resolveAllEquipment(context);
  const depositAmount = String(context.depositOverride || equipmentItems[0]?.specs?.deposit_rub || "5000");
  await setState(userId, "deposit_choice", context);
  const formatted = Number(depositAmount).toLocaleString("ru-RU");
  await sendComplexMessage(
    chatId,
    `*Депозит / обеспечительный платёж*\n\n` +
    `Оборудование: ${equipmentTitle(equipmentItems) || context.equipmentId}\n` +
    `Депозит: *${formatted} ₽*\n\n` +
    `Выберите вариант:`,
    buildDepositChoiceKeyboard(depositAmount, equipmentItems[0]),
    { keyboardType: 'inline', parseMode: 'Markdown' },
  );
}

async function gotoPrice(chatId: number, userId: string, context: EkipFlowContext): Promise<void> {
  await setState(userId, "price", context);
  await sendComplexMessage(chatId, withStep("💰 Цена:", "price", context.dealType), buildPriceKeyboard(), { keyboardType: 'inline' });
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

export async function handleEkipText(userId: string, chatId: number, text: string): Promise<boolean> {
  const ekipState = await getState(userId);
  if (!ekipState) return false;

  // 2026-08-19 HOTFIX: only handle text input when the user is actually in
  // the /ekip flow (mirrors the same fix in handleEkipCallback). The /doc
  // flow shares state-name strings like "name", "passport", "birth", etc.
  // — without this marker check, /ekip would intercept /doc's text input
  // for the same step names and corrupt the /doc flow's state machine.
  const isEkipState = (ekipState.context as any)?._ekip === true;
  if (!isEkipState) return false;

  const { state, context } = ekipState;

  if (state === "name") {
    context.mpFullName = capitalizeFullName(text);
    await setState(userId, "passport", context);
    await sendComplexMessage(
      chatId,
      `✅ ${text}\n\n*Паспорт*\n\n4509 123456 15.03.2020 ОМВД по Н.Новгороду`,
      [],
      { removeKeyboard: true, parseMode: 'Markdown' },
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
      { removeKeyboard: true, parseMode: 'Markdown' },
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
      { removeKeyboard: true, parseMode: 'Markdown' },
    );
    return true;
  }

  if (state === "address") {
    context.mpRegistration = text.trim();
    const isRent = context.dealType === "rent";
    if (isRent) {
      await setState(userId, "schedule_start", context);
      await sendComplexMessage(chatId, "✅\n\n*Когда аренда?*", buildStartKeyboard(), { keyboardType: 'inline', parseMode: 'Markdown' });
    } else {
      await gotoPrice(chatId, userId, context);
    }
    return true;
  }

  if (state === "schedule_start") {
    const s = parseStartDate(text);
    if (!s) {
      await sendComplexMessage(chatId, START_DATE_EXAMPLES, [], { removeKeyboard: true, parseMode: 'Markdown' });
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
      await sendComplexMessage(chatId, END_DATE_EXAMPLES, [], { removeKeyboard: true, parseMode: 'Markdown' });
      return true;
    }
    context.rentEndDate = e.date;
    context.rentEndTime = e.time;
    await gotoPaymentSplit(chatId, userId, context);
    return true;
  }

  if (state === "payment_cash") {
    const value = text.replace(/\D/g, '');
    if (!value || parseInt(value) < 0) {
      await sendComplexMessage(chatId, "❌ Введите сумму наличными (руб)", [], { removeKeyboard: true });
      return true;
    }
    const cashAmount = parseInt(value);
    const items = await resolveAllEquipment(context);
    const dailyTotal = sumDailyPrices(items);

    const start = parseRuDateTime(context.rentStartDate, context.rentStartTime);
    const end = parseRuDateTime(context.rentEndDate, context.rentEndTime);
    const hours = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60) * 10) / 10);
    const days = Math.max(1, Math.ceil(hours / 24));
    const totalAmount = context.priceOverridden ? (context.cashAmount || 0) + (context.bankAmount || 0) : dailyTotal * days;

    context.cashAmount = Math.min(cashAmount, totalAmount);
    context.bankAmount = Math.max(0, totalAmount - cashAmount);
    await gotoDepositChoice(chatId, userId, context);
    return true;
  }

  if (state === "payment_split_cash") {
    const value = text.replace(/\D/g, '');
    if (!value || parseInt(value) < 0) {
      await sendComplexMessage(chatId, "❌ Введите сумму наличными (руб)", [], { removeKeyboard: true });
      return true;
    }
    const cashAmount = parseInt(value);
    const items = await resolveAllEquipment(context);
    const dailyTotal = sumDailyPrices(items);

    const start = parseRuDateTime(context.rentStartDate, context.rentStartTime);
    const end = parseRuDateTime(context.rentEndDate, context.rentEndTime);
    const hours = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60) * 10) / 10);
    const days = Math.max(1, Math.ceil(hours / 24));
    const totalAmount = context.priceOverridden ? (context.cashAmount || 0) + (context.bankAmount || 0) : dailyTotal * days;

    context.cashAmount = Math.min(cashAmount, totalAmount);
    context.bankAmount = Math.max(0, totalAmount - cashAmount);

    const bankFormatted = context.bankAmount.toLocaleString("ru-RU");
    await setState(userId, "payment_split_card", context);
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

  if (state === "price_override") {
    const value = text.replace(/\D/g, '');
    if (!value || parseInt(value) < 100) {
      await sendComplexMessage(chatId, "❌ Введите цену (минимум 100 ₽)", [], { removeKeyboard: true });
      return true;
    }
    const newPrice = parseInt(value);
    context.cashAmount = newPrice;
    context.bankAmount = 0;
    context.priceOverridden = true;
    await gotoPaymentSplit(chatId, userId, context);
    return true;
  }

  if (state === "deposit_custom") {
    const amount = text.replace(/\D/g, '');
    if (!amount || parseInt(amount) < 500) {
      await sendComplexMessage(chatId, "❌ Введите сумму депозита (руб), минимум 500", [], { removeKeyboard: true });
      return true;
    }
    context.depositOverride = amount;
    const items = await resolveAllEquipment(context);
    const summary = buildRentSummary(context, items);
    await setState(userId, "confirm", context);
    await sendComplexMessage(chatId, summary, buildConfirmKeyboard(), { keyboardType: 'inline', parseMode: 'Markdown' });
    return true;
  }

  if (state === "price_custom") {
    const price = text.replace(/\D/g, '');
    if (!price || parseInt(price) < 100) {
      await sendComplexMessage(chatId, "❌ Введите цену (руб)", [], { removeKeyboard: true });
      return true;
    }
    context.salePrice = price;
    const items = await resolveAllEquipment(context);
    const summary = buildSaleSummary(context, price, items);
    await setState(userId, "confirm", context);
    await sendComplexMessage(chatId, summary, buildConfirmKeyboard(), { keyboardType: 'inline', parseMode: 'Markdown' });
    return true;
  }

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
    const success = await generateContract(chatId, userId, context);
    if (success) {
      await clearState(userId);
    }
    return true;
  }

  return false;
}

// ── Callback handlers ───────────────────────────────────────────────────────

export async function handleEkipCallback(
  userId: string,
  chatId: number,
  callbackData: string,
  callbackQueryId?: string,
): Promise<boolean> {
  // Answer the callback query first so the button stops spinning,
  // regardless of whether we have state.
  if (callbackQueryId) {
    try {
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery?callback_query_id=${callbackQueryId}`, { method: "POST" });
    } catch (e) {
      logger.warn("[/ekip] Failed to answer callback query:", e);
    }
  }

  // 2026-08-21 FIX: cancel/restart early-return previously fired BEFORE the
  // `_ekip` marker check, so clicking /doc's "❌ Отменить" or "↩️ Начать
  // заново" button mid-/doc-flow wiped /doc's state and either showed the
  // /ekip-branded "use /ekip" message or actually started /ekip. We now
  // check the marker FIRST and bail out if the user is not in /ekip flow,
  // letting /doc's handler run next in the dispatcher chain.
  //
  // Edge case: if ekip state was cleared by an earlier error and the user
  // clicks "❌ Отменить" (no state at all), we still want to clear any
  // leftover state. We handle that by always clearing when there's NO state
  // AND the user clicks cancel. But if there IS a state and it's a /doc
  // state, we bail out so /doc's handler runs.
  const ekipState = await getState(userId);
  if (!ekipState) {
    // No state — handle bare cancel/restart as best-effort fallback so the
    // user isn't stuck with an inline keyboard they can't dismiss.
    if (callbackData === "cancel") {
      await sendComplexMessage(chatId, "❌ Отменено.", [], { removeKeyboard: true });
      await clearState(userId);
      return true;
    }
    if (callbackData === "restart") {
      await clearState(userId);
      // Don't auto-start /ekip when there was no /ekip state — could have
      // been a stale /doc button. Let the user type the command they want.
      await sendComplexMessage(chatId, "↩️ Используйте /doc, /ekip или /testdrive.", [], { removeKeyboard: true });
      return true;
    }
    return false;
  }

  // 2026-08-19 HOTFIX: only handle callbacks when the user is actually in
  // the /ekip flow. The /doc flow ALSO uses `eq_done` callback_data (and
  // shared `eq_*` prefixes historically) — if we don't check the marker,
  // the /ekip handler intercepts /doc's "✅ Готово" button and rejects it
  // with "Сначала выберите оборудование" because the /doc context doesn't
  // have ekip's `equipmentIds` field.
  //
  // The marker is set by ekip's setState() which writes
  // `context: { ...context, _ekip: true }`. /doc's setState doesn't add
  // this marker, so checking it reliably distinguishes the two flows.
  const isEkipState = (ekipState.context as any)?._ekip === true;
  if (!isEkipState) return false;

  // Now safe to handle cancel/restart — we know we're in a /ekip flow.
  if (callbackData === "cancel") {
    await sendComplexMessage(chatId, "❌ Отменено. /ekip для начала.", [], { removeKeyboard: true });
    await clearState(userId);
    return true;
  }

  if (callbackData === "restart") {
    await clearState(userId);
    await ekipCommand(chatId, parseInt(userId), undefined, "/ekip");
    return true;
  }

  const { state, context } = ekipState;

  if (callbackData === "d_rent") {
    context.dealType = "rent";
    // Deal type is chosen FIRST (like doc-manual) — then equipment type → items
    await setState(userId, "equipment", context);
    await sendComplexMessage(
      chatId,
      `📋 *Аренда*\n\n📦 *Выберите тип оборудования*`,
      buildCategoryKeyboard(await catalogFor(userId, context), selectedEquipmentIds(context)),
      { keyboardType: 'inline', parseMode: 'Markdown' },
    );
    return true;
  }

  if (callbackData === "d_sale") {
    context.dealType = "sale";
    await setState(userId, "equipment", context);
    await sendComplexMessage(
      chatId,
      `💰 *Продажа*\n\n📦 *Выберите тип оборудования*`,
      buildCategoryKeyboard(await catalogFor(userId, context), selectedEquipmentIds(context)),
      { keyboardType: 'inline', parseMode: 'Markdown' },
    );
    return true;
  }

  // ── Equipment selection: category → items (multi-select, paginated) ──
  if (callbackData.startsWith("ecat_")) {
    const category = callbackData.slice(5);
    if (category === "back") {
      // Back to category list
      context.equipmentCategory = undefined;
      context.equipmentPage = 0;
      context.equipmentSubcategory = undefined; // LOW fix: reset subcategory too
      await setState(userId, state, context);
      await sendComplexMessage(
        chatId,
        `📦 *Выберите тип оборудования*`,
        buildCategoryKeyboard(await catalogFor(userId, context), selectedEquipmentIds(context)),
        { keyboardType: 'inline', parseMode: 'Markdown' },
      );
      return true;
    }

    context.equipmentCategory = category;
    context.equipmentPage = 0;
    context.equipmentSubcategory = undefined; // B.1: reset subcategory on new category
    await setState(userId, state, context);

    // B.1: Subcategory preselection — check if items in this category have
    // different materials (specs.materials string per gold standard). If 2+
    // distinct materials found, show subcategory picker. If 0-1, go straight
    // to items (skip subcategory step).
    // Review fix: use normalizeMaterialKey() for case-insensitive matching +
    // short English keys in callback_data (avoids Telegram 64-byte limit).
    const label = EQUIPMENT_CATEGORY_LABELS[category] || category;
    const allItems = await catalogFor(userId, context);
    const categoryItems = allItems.filter(i => i.specs?.category === category);
    // Collect distinct material keys (normalized)
    const distinctKeys = [...new Set(
      categoryItems
        .map(i => normalizeMaterialKey(i.specs?.materials))
    )].filter(k => k !== "other" || categoryItems.some(i => normalizeMaterialKey(i.specs?.materials) === "other" && i.specs?.materials));

    if (distinctKeys.length >= 2) {
      // Show subcategory picker with normalized keys
      const subRows: KeyboardButton[][] = distinctKeys.map(k => {
        const d = materialDisplay(k);
        return [{
          text: `${d.emoji} ${d.label}`,
          callback_data: `eksub_${k}`,
        }];
      });
      subRows.push([{ text: "📦 Все", callback_data: "eksub_all" }]);
      subRows.push([{ text: "↩️ Категории", callback_data: "ecat_back" }]);
      await sendComplexMessage(
        chatId,
        `📦 *${label}* — выберите тип:`,
        subRows,
        { keyboardType: 'inline', parseMode: 'Markdown' },
      );
      return true;
    }

    // Only one material (or none) — skip subcategory, go straight to items
    const chosen = selectedEquipmentIds(context).length;
    const chosenNote = chosen > 0 ? `\n\n✅ Уже выбрано: ${chosen} шт. — кликните ещё или «Готово».` : "";
    await sendComplexMessage(
      chatId,
      `📦 *${label}* — выберите предметы${chosenNote}`,
      buildCategoryItemsKeyboard(allItems, category, selectedEquipmentIds(context), 0, context.equipmentSubcategory),
      { keyboardType: 'inline', parseMode: 'Markdown' },
    );
    return true;
  }

  // B.1: Subcategory selection handler — eksub_<key> or eksub_all
  // Review fix: callback_data now uses short English keys (leather/textile/enduro/all)
  // instead of raw Russian strings (avoids Telegram 64-byte limit + case issues).
  if (callbackData.startsWith("eksub_")) {
    const subKey = callbackData.slice(6); // "leather", "textile", "enduro", "all"
    context.equipmentSubcategory = subKey === "all" ? undefined : subKey;
    context.equipmentPage = 0;
    await setState(userId, state, context);

    const category = context.equipmentCategory;
    if (!category) return true;
    const label = EQUIPMENT_CATEGORY_LABELS[category] || category;
    const allItems = await catalogFor(userId, context);
    const chosen = selectedEquipmentIds(context).length;
    const chosenNote = chosen > 0 ? `\n\n✅ Уже выбрано: ${chosen} шт. — кликайте ещё или «Готово».` : "";
    const subDisplay = subKey === "all" ? "" : ` (${materialDisplay(subKey).label})`;
    await sendComplexMessage(
      chatId,
      `📦 *${label}*${subDisplay} — выберите предметы${chosenNote}`,
      buildCategoryItemsKeyboard(allItems, category, selectedEquipmentIds(context), 0, context.equipmentSubcategory),
      { keyboardType: 'inline', parseMode: 'Markdown' },
    );
    return true;
  }

  if (callbackData.startsWith("epg_")) {
    // Pagination: epg_{category}_{page}
    const parts = callbackData.split("_");
    const page = Number(parts[parts.length - 1]) || 0;
    const category = parts.slice(1, parts.length - 1).join("_");
    context.equipmentCategory = category;
    context.equipmentPage = page;
    await setState(userId, state, context);
    const label = EQUIPMENT_CATEGORY_LABELS[category] || category;
    await sendComplexMessage(
      chatId,
      `📦 *${label}* — страница ${page + 1}`,
      buildCategoryItemsKeyboard(await catalogFor(userId, context), category, selectedEquipmentIds(context), page, context.equipmentSubcategory),
      { keyboardType: 'inline', parseMode: 'Markdown' },
    );
    return true;
  }

  if (callbackData.startsWith("eq_")) {
    const eqId = callbackData.slice(3);
    if (eqId === "done") {
      // Equipment selection done, proceed to name
      const ids = selectedEquipmentIds(context);
      if (!ids.length) {
        await sendComplexMessage(chatId, "❌ Сначала выберите оборудование", [], { removeKeyboard: true });
        return true;
      }
      const items = await resolveAllEquipment(context);
      const picked = equipmentTitle(items);
      await setState(userId, "name", context);
      await sendComplexMessage(chatId, withStep(`*Выбрано: ${picked}*\n\n*ФИО*`, "name", context.dealType), [], { removeKeyboard: true, parseMode: 'Markdown' });
      return true;
    }

    const equipment = await resolveEquipmentById(eqId);
    if (equipment) {
      // Multi-select: toggle this item in equipmentIds
      const ids = selectedEquipmentIds(context);
      const idx = ids.indexOf(equipment.id);
      const wasFirst = ids.length === 0;
      const isSelecting = idx < 0; // true = adding, false = removing
      if (idx >= 0) {
        ids.splice(idx, 1); // deselect
      } else {
        ids.push(equipment.id); // select
      }
      context.equipmentIds = ids;
      context.equipmentId = ids[0] || context.equipmentId;
      if (ids.length === 1) {
        context.equipmentMake = equipment.make;
        context.equipmentModel = equipment.model;
      } else if (ids.length === 0) {
        context.equipmentMake = undefined;
        context.equipmentModel = undefined;
      }
      await setState(userId, state, context);

      // B.2: Photo preview — send a photo of the selected item so the
      // operator can verify they picked the right one. Silent if no
      // image_url (many equipment items don't have photos yet). Only
      // send when SELECTING (not deselecting) to avoid spam.
      if (isSelecting && equipment.image_url && equipment.image_url.trim()) {
        try {
          await fetch(
            `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto?chat_id=${chatId}&photo=${encodeURIComponent(equipment.image_url)}&caption=${encodeURIComponent(`📷 ${equipment.make} ${equipment.model} — проверьте перед подтверждением`)}`,
            { method: 'POST', signal: AbortSignal.timeout(5000) }
          );
        } catch (photoErr) {
          // Silent — don't break the flow if photo URL is broken
          logger.warn('[/ekip] Photo preview failed (non-fatal):', photoErr);
        }
      }

      const category = context.equipmentCategory;
      const page = context.equipmentPage || 0;
      const catalog = await catalogFor(userId, context);
      if (category) {
        const label = EQUIPMENT_CATEGORY_LABELS[category] || category;
        const added = idx >= 0 ? "➖ Убрано" : "➕ Добавлено";
        const chosenNote = ids.length > 0 ? ` (выбрано: ${ids.length} шт.)` : "";
        await sendComplexMessage(
          chatId,
          `${added}: ${equipment.make} ${equipment.model}${chosenNote}\n\n📦 *${label}*`,
          buildCategoryItemsKeyboard(catalog, category, ids, page, context.equipmentSubcategory),
          { keyboardType: 'inline', parseMode: 'Markdown' },
        );
      } else {
        await sendComplexMessage(
          chatId,
          `📦 Выбрано: ${equipment.make} ${equipment.model}`,
          buildCategoryKeyboard(catalog, ids),
          { keyboardType: 'inline', parseMode: 'Markdown' },
        );
      }
    }
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
      await setState(userId, "schedule_start", context);
      await sendComplexMessage(chatId, START_DATE_EXAMPLES, [], { removeKeyboard: true, parseMode: 'Markdown' });
      return true;
    }

    const start = when === "today" ? today : tomorrow;
    const timeStr = decodeCallbackTime(rawTime);

    context.rentStartDate = fmt(start);
    context.rentStartTime = timeStr;

    await setState(userId, "schedule_end", context);
    await sendComplexMessage(
      chatId,
      `✅ Старт: ${context.rentStartDate} ${context.rentStartTime}\n\n*Когда заканчиваем?*`,
      buildEndKeyboard(context.rentStartTime),
      { keyboardType: 'inline', parseMode: 'Markdown' },
    );
    return true;
  }

  if (callbackData.startsWith("e_")) {
    const parts = callbackData.slice(2).split('_');
    const when = parts[0];
    const rawTime = parts[1];

    const today = new Date();
    const fmt = (d: Date) => `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;

    let startRef = new Date(today);
    if (context.rentStartDate) {
      const sp = context.rentStartDate.split('.');
      if (sp.length === 3) startRef = new Date(`${sp[2]}-${sp[1]}-${sp[0]}`);
    }

    if (when === "custom") {
      await setState(userId, "schedule_end", context);
      await sendComplexMessage(chatId, END_DATE_EXAMPLES, [], { removeKeyboard: true, parseMode: 'Markdown' });
      return true;
    }

    const timeStr = decodeCallbackTime(rawTime);

    if (when === "today") {
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
      await sendComplexMessage(chatId, withStep("*Когда заканчиваем?*", "schedule_end", context.dealType), buildEndKeyboard(context.rentStartTime), { keyboardType: 'inline', parseMode: 'Markdown' });
      return true;
    }

    await gotoPaymentSplit(chatId, userId, context);
    return true;
  }

  // Payment callbacks
  if (callbackData === "pay_info") return true;

  if (callbackData === "pay_override") {
    await setState(userId, "price_override", context);
    const currentTotal = (context.cashAmount || 0) + (context.bankAmount || 0);
    await sendComplexMessage(
      chatId,
      `*✏️ Изменение цены*\n\nТекущая цена: *${currentTotal.toLocaleString("ru-RU")} ₽*\n\nВведите новую итоговую цену (руб):\n\nПример: \`2000\``,
      [], { removeKeyboard: true, parseMode: 'Markdown' },
    );
    return true;
  }

  if (callbackData === "pay_cash") {
    await setState(userId, "payment_cash", context);
    await sendComplexMessage(
      chatId,
      "*Введите сумму наличными (руб)*\n\nПример: `1500`",
      [], { removeKeyboard: true, parseMode: 'Markdown' },
    );
    return true;
  }

  if (callbackData === "pay_all_cash") {
    const items = await resolveAllEquipment(context);
    const dailyTotal = sumDailyPrices(items);

    const start = parseRuDateTime(context.rentStartDate, context.rentStartTime);
    const end = parseRuDateTime(context.rentEndDate, context.rentEndTime);
    const hours = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60) * 10) / 10);
    const days = Math.max(1, Math.ceil(hours / 24));
    const totalAmount = context.priceOverridden ? (context.cashAmount || 0) + (context.bankAmount || 0) : dailyTotal * days;

    context.cashAmount = totalAmount;
    context.bankAmount = 0;
    await gotoDepositChoice(chatId, userId, context);
    return true;
  }

  if (callbackData === "paydest_tbank" || callbackData === "paydest_sber") {
    const dest = callbackData === "paydest_tbank" ? "tbank" : "sber";
    const items = await resolveAllEquipment(context);
    const dailyTotal = sumDailyPrices(items);

    const start = parseRuDateTime(context.rentStartDate, context.rentStartTime);
    const end = parseRuDateTime(context.rentEndDate, context.rentEndTime);
    const hours = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60) * 10) / 10);
    const days = Math.max(1, Math.ceil(hours / 24));
    const totalAmount = context.priceOverridden ? (context.cashAmount || 0) + (context.bankAmount || 0) : dailyTotal * days;

    context.cashAmount = 0;
    context.bankAmount = totalAmount;
    context.paymentCardDestination = dest;
    await gotoDepositChoice(chatId, userId, context);
    return true;
  }

  if (callbackData === "paydest_split") {
    const items = await resolveAllEquipment(context);
    const dailyTotal = sumDailyPrices(items);

    const start = parseRuDateTime(context.rentStartDate, context.rentStartTime);
    const end = parseRuDateTime(context.rentEndDate, context.rentEndTime);
    const hours = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60) * 10) / 10);
    const days = Math.max(1, Math.ceil(hours / 24));
    const totalAmount = context.priceOverridden ? (context.cashAmount || 0) + (context.bankAmount || 0) : dailyTotal * days;

    await setState(userId, "payment_split_cash", context);
    await sendComplexMessage(
      chatId,
      `🔀 *Смешанная оплата: ${totalAmount.toLocaleString("ru-RU")} ₽*\n\nСколько наличными?`,
      [], { removeKeyboard: true, parseMode: 'Markdown' },
    );
    return true;
  }

  if (callbackData === "paysplit_tbank" || callbackData === "paysplit_sber") {
    const dest = callbackData === "paysplit_tbank" ? "tbank" : "sber";
    context.paymentCardDestination = dest;
    await gotoDepositChoice(chatId, userId, context);
    return true;
  }

  // Deposit callbacks
  if (callbackData === "dep_confirm") {
    const items = await resolveAllEquipment(context);
    context.depositOverride = String(items[0]?.specs?.deposit_rub || "5000");
    const summary = buildRentSummary(context, items);
    await setState(userId, "confirm", context);
    await sendComplexMessage(chatId, summary, buildConfirmKeyboard(), { keyboardType: 'inline', parseMode: 'Markdown' });
    return true;
  }

  if (callbackData === "dep_custom") {
    await setState(userId, "deposit_custom", context);
    await sendComplexMessage(
      chatId,
      "*Введите сумму депозита (руб)*\n\nМинимум 500 ₽",
      [], { removeKeyboard: true, parseMode: 'Markdown' },
    );
    return true;
  }

  // Price callbacks (sale)
  if (callbackData.startsWith("p_")) {
    const price = callbackData.slice(2);
    if (price === "custom") {
      await setState(userId, "price_custom", context);
      await sendComplexMessage(chatId, withStep("*Введите цену (руб)*", "price", "sale"), [], { removeKeyboard: true, parseMode: 'Markdown' });
      return true;
    }
    context.salePrice = price;
    const items = await resolveAllEquipment(context);
    const summary = buildSaleSummary(context, price, items);
    await setState(userId, "confirm", context);
    await sendComplexMessage(chatId, summary, buildConfirmKeyboard(), { keyboardType: 'inline', parseMode: 'Markdown' });
    return true;
  }

  // Confirm callbacks
  if (callbackData === "ok") {
    if (!context.clientPhoneResolved) {
      await setState(userId, "client_phone", context);
      await sendComplexMessage(
        chatId,
        "📞 *Телефон клиента*\n\nЕсли клиент пришёл с сайта (заявка на звонок), введите его номер.\n\nИли нажмите «Пропустить».",
        [
          [{ text: "⏭ Пропустить", callback_data: "ph_skip" }],
          [{ text: "❌ Отменить", callback_data: "cancel" }],
        ],
        { keyboardType: "inline", parseMode: "Markdown" },
      );
      return true;
    }
    await sendComplexMessage(chatId, "⏳ Генерирую...", [], { removeKeyboard: true });
    const success = await generateContract(chatId, userId, context);
    if (success) {
      await clearState(userId);
    }
    return true;
  }

  if (callbackData === "ph_skip") {
    context.clientPhoneResolved = true;
    await setState(userId, "confirm", context);
    await sendComplexMessage(chatId, "⏳ Генерирую...", [], { removeKeyboard: true });
    const success = await generateContract(chatId, userId, context);
    if (success) {
      await clearState(userId);
    }
    return true;
  }

  if (callbackData === "correct_step") {
    // Step correction not implemented for equipment yet
    await sendComplexMessage(chatId, "🔧 Исправление шагов в разработке. Используйте «Начать заново».", [], { removeKeyboard: true });
    return true;
  }

  logger.warn("[/ekip] Unknown callback", { callbackData, state });
  return false;
}

// ── Contract generation ─────────────────────────────────────────────────────

/**
 * Load crew secrets for contract defaults with fallbacks (mirrors doc-manual).
 */
async function loadEkipCrewSecrets(crewSlug: string): Promise<RentalCrewSecrets> {
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

// ── DB persistence (equipment parity with /doc) ─────────────────────────────

interface PersistEkipRentalsInput {
  context: EkipFlowContext;
  equipmentItems: EquipmentItem[];
  crewSlug: string;
  operatorChatId: string;
  docSha256: string;
  documentKey: string;
}

/**
 * Insert ONE unified `rentals` row per selected equipment item
 * (metadata.item_type='equipment' — canonical storage since migration
 * 20260815000001), then persist the deposit (rentals mirror columns +
 * deposit_entries) and create a crew_todos return reminder per row.
 *
 * Money: the auto_create_rental_transaction trigger writes income_equipment
 * when the row is closed (completed/disputed) — same idempotent pattern as
 * bike rentals.
 */
async function persistEkipRentals(
  input: PersistEkipRentalsInput,
): Promise<{ rentalIds: string[]; error: string | null }> {
  const { context, equipmentItems, crewSlug, operatorChatId, docSha256, documentKey } = input;
  try {
    // Resolve crew: equipment rows carry crew_id; fall back to the slug.
    let crewId = equipmentItems.find((i) => i.crew_id)?.crew_id || null;
    if (!crewId && crewSlug) {
      const { data: crew } = await supabaseAdmin
        .from("crews")
        .select("id")
        .eq("slug", crewSlug)
        .maybeSingle();
      crewId = crew?.id || null;
    }
    if (!crewId) {
      return { rentalIds: [], error: "crew_id not resolved (no crew for slug " + (crewSlug || "—") + ")" };
    }

    // Owner placeholder (same approach as /doc): crew owner or the operator.
    const crewOwnerChatId = await resolveCrewOwnerChatId(supabaseAdmin, crewId) || operatorChatId;

    // Dates → TIMESTAMPTZ (same helper/convention as /doc)
    const startIso = context.rentStartDate && context.rentStartTime
      ? convertTextDateToTimestamp(context.rentStartDate, context.rentStartTime, 3)
      : null;
    const endIso = context.rentEndDate && context.rentEndTime
      ? convertTextDateToTimestamp(context.rentEndDate, context.rentEndTime, 3)
      : null;
    if (!startIso || !endIso) {
      return { rentalIds: [], error: `date conversion failed (${context.rentStartDate} ${context.rentStartTime} → ${context.rentEndDate} ${context.rentEndTime})` };
    }

    // Deal money: same math the operator saw in the payment step
    const { days } = rentDaysBetween(
      parseRuDateTime(context.rentStartDate, context.rentStartTime),
      parseRuDateTime(context.rentEndDate, context.rentEndTime),
    );
    const totalCost = context.priceOverridden
      ? (context.cashAmount || 0) + (context.bankAmount || 0)
      : sumDailyPrices(equipmentItems) * days;
    const parts = apportionTotal(totalCost, equipmentItems);

    // Deposit: single amount (no destination question in /ekip) — default cash,
    // same mapping /doc uses when no destination info exists.
    const depositNum = Number(context.depositOverride || equipmentItems[0]?.specs?.deposit_rub || 5000);
    const depositMethod = normalizeDepositMethod("cash");
    const paymentMethod = normalizePaymentMethod(
      (context.bankAmount || 0) > 0 ? (context.paymentCardDestination || "card") : "cash",
    );

    const nowIso = new Date().toISOString();
    const rentalIds: string[] = [];

    for (let idx = 0; idx < equipmentItems.length; idx++) {
      const item = equipmentItems[idx];
      const itemTotal = parts[idx] || 0;
      const insert = {
        user_id: crewOwnerChatId,
        owner_id: crewOwnerChatId,
        created_by_operator_chat_id: operatorChatId || crewOwnerChatId,
        crew_id: crewId,
        vehicle_id: item.id, // real cars.id (type='equipment') — FK-safe
        requested_start_date: startIso,
        requested_end_date: endIso,
        agreed_start_date: startIso,
        agreed_end_date: endIso,
        status: "active" as const,
        payment_status: "fully_paid" as const,
        total_cost: Math.round(itemTotal),
        ...(depositNum > 0 && idx === 0 ? {
          deposit_amount: depositNum,
          deposit_method: depositMethod,
          deposit_collected_at: nowIso,
        } : {}),
        metadata: {
          source: "ekip_command",
          item_type: "equipment",
          crew_id: crewId,
          daily_price: itemDailyPrice(item),
          equipment_title: `${item.make} ${item.model}`,
          equipment_size: itemSize(item),
          equipment_condition: "Выдан",
          damage_reports: [],
          equipment_count: equipmentItems.length,
          document_key: documentKey,
          doc_sha256: docSha256,
          renter_name: context.mpFullName || "",
          renter_phone: context.clientPhone || "",
          payment_method: paymentMethod,
          payment_split: {
            cash: context.cashAmount || 0,
            bank: context.bankAmount || 0,
            card_destination: context.paymentCardDestination || null,
          },
          price_overridden: context.priceOverridden || false,
          contract_verifier: {
            status: "verified",
            verified_at: nowIso,
            source: "ekip_command",
            doc_sha256: docSha256,
          },
        },
      };

      const { data: rentalRow, error: rentalError } = await supabaseAdmin
        .from("rentals")
        .insert(insert)
        .select("rental_id")
        .maybeSingle();

      if (rentalError || !rentalRow?.rental_id) {
        const msg = rentalError?.message || "no rental_id returned";
        logger.error("[/ekip] Failed to create equipment rental:", { error: msg, item: item.id });
        if (rentalIds.length === 0) {
          return { rentalIds: [], error: `rentals insert failed for ${item.make} ${item.model}: ${msg}` };
        }
        break; // some rows saved — report partial success
      }

      rentalIds.push(rentalRow.rental_id);

      // crew_todos return reminder (parity with web-checkout return todos)
      try {
        await supabaseAdmin.from("crew_todos").insert({
          id: `ekip-ret-${Date.now().toString(36)}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
          crew_id: crewId,
          rental_id: rentalRow.rental_id,
          title: `📦 Принять ${item.make} ${item.model} (${context.rentEndDate || ""} ${context.rentEndTime || ""})`.trim(),
          status: "pending",
          priority: "high",
          category: "lead_followup",
          description: JSON.stringify({
            source: "ekip_command",
            rental_id: rentalRow.rental_id,
            rent_end_date: context.rentEndDate || null,
            rent_end_time: context.rentEndTime || null,
            renter_name: context.mpFullName || "",
            renter_phone: context.clientPhone || "",
          }),
        });
      } catch (todoErr) {
        logger.warn("[/ekip] Failed to create return crew_todo (non-fatal):", todoErr);
      }
    }

    // deposit_entries: one row for the deal (linked to the first rental),
    // same shape /doc writes when no destination was specified.
    if (depositNum > 0 && rentalIds.length > 0) {
      try {
        await supabaseAdmin.from("deposit_entries").insert({
          rental_id: rentalIds[0],
          entry_type: "deposit_collected",
          amount: depositNum,
          direction: "in",
          destination: "cash",
          operator_chat_id: crewOwnerChatId || null,
          notes: "Deposit collected via /ekip (no destination specified, defaulted to cash)",
        });
      } catch (depErr) {
        logger.warn("[/ekip] Failed to insert deposit_entries (non-fatal):", depErr);
      }
    }

    logger.info("[/ekip] Equipment rentals persisted:", { crewId, count: rentalIds.length, totalCost, days });
    return { rentalIds, error: rentalIds.length === 0 ? "no rentals inserted" : null };
  } catch (error: any) {
    logger.error("[/ekip] persistEkipRentals exception:", error);
    return { rentalIds: [], error: error?.message || String(error) };
  }
}

interface PersistEkipSaleInput {
  context: EkipFlowContext;
  equipmentItems: EquipmentItem[];
  crewSlug: string;
  operatorChatId: string;
  docSha256: string;
  documentKey: string;
  docStoragePath: string | null;
  salePrice: string;
}

/**
 * Insert private.sale_contract_artifacts for an /ekip SALE deal.
 * The trg_auto_sale_transaction trigger then auto-records income_sale +
 * commission — the exact same money path the /doc sale flow uses.
 * Dedup: same buyer + same first item = retry, update storage instead.
 */
async function persistEkipSaleArtifact(
  input: PersistEkipSaleInput,
): Promise<{ error: string | null }> {
  const { context, equipmentItems, crewSlug, operatorChatId, docSha256, documentKey, docStoragePath, salePrice } = input;
  try {
    const firstItem = equipmentItems[0];

    const { data: existingSale } = await privateSchema()
      .from("sale_contract_artifacts")
      .select("id, storage_path")
      .eq("crew_slug", crewSlug)
      .eq("buyer_full_name", context.mpFullName || "")
      .eq("requested_bike_id", firstItem.id)
      .maybeSingle();

    if (existingSale) {
      logger.info("[/ekip] Duplicate sale detected (same buyer+item), skipping insert. existing id:", existingSale.id);
      if (!existingSale.storage_path && docStoragePath) {
        await privateSchema()
          .from("sale_contract_artifacts")
          .update({ storage_path: docStoragePath })
          .eq("id", existingSale.id);
      }
      return { error: null };
    }

    const { error: saleError } = await privateSchema().from("sale_contract_artifacts").insert({
      contract_key: documentKey,
      crew_slug: crewSlug,
      storage_path: docStoragePath,
      original_sha256: docSha256,
      requested_bike_id: firstItem.id,
      resolved_bike_id: firstItem.id,
      telegram_chat_id: operatorChatId, // operator's chat (QR claim re-links later — same as /doc)
      buyer_phone: context.clientPhone || null,
      telegram_message_id: null,
      buyer_full_name: context.mpFullName || null,
      buyer_passport_number: `${context.mpSeries || ""} ${context.mpNumber || ""}`.trim() || null,
      buyer_passport_issued_by: context.mpIssuedBy || null,
      buyer_passport_issue_date: context.mpIssueDate || null,
      buyer_registration: context.mpRegistration || null,
      sale_price: salePrice,
      total_sum: Number(salePrice) || 0,
      warranty_months: "0",
      template_version: 1,
      created_by_operator_chat_id: operatorChatId || null,
    });
    if (saleError) {
      logger.error("[/ekip] Failed to save sale_contract_artifacts:", saleError);
      return { error: `sale_contract_artifacts insert failed: ${saleError.message}` };
    }
    logger.info("[/ekip] Sale artifact saved:", { crewSlug, buyer: context.mpFullName, salePrice });
    return { error: null };
  } catch (error: any) {
    logger.error("[/ekip] persistEkipSaleArtifact exception:", error);
    return { error: error?.message || String(error) };
  }
}

async function generateContract(chatId: number, userId: string, context: EkipFlowContext): Promise<boolean> {
  try {
    const equipmentItems = await resolveAllEquipment(context);
    if (!equipmentItems.length) {
      await sendComplexMessage(chatId, "🚨 Оборудование не найдено. Попробуйте /ekip", [], { removeKeyboard: true });
      return false;
    }
    const firstEquipment = equipmentItems[0];

    const crewSlug = await getEkipCrewSlug(userId);
    const isRent = context.dealType === "rent";
    const now = new Date();

    let vars: Record<string, string>;

    if (isRent) {
      const dailyTotal = sumDailyPrices(equipmentItems);
      // Use the shared builder (same as web-app and /doc) so the template
      // variables are always complete and consistent.
      const crewSecrets = await loadEkipCrewSecrets(crewSlug);
      const depositNum = Number(context.depositOverride || equipmentItems[0]?.specs?.deposit_rub || 5000);

      // Compute rental cost the same way the bot showed the operator (rent days × rate).
      let rentalDays = 1;
      try {
        const s = parseRuDateTime(context.rentStartDate, context.rentStartTime);
        const e = parseRuDateTime(context.rentEndDate, context.rentEndTime);
        const hours = Math.max(1, Math.round(((e.getTime() - s.getTime()) / (1000 * 60 * 60)) * 10) / 10);
        rentalDays = Math.max(1, Math.ceil(hours / 24));
      } catch {
        rentalDays = 1;
      }
      const totalCost = context.priceOverridden
        ? (context.cashAmount || 0) + (context.bankAmount || 0)
        : dailyTotal * rentalDays;

      const primaryKey = equipmentItems.length === 1
        ? firstEquipment.id
        : `equipment-${equipmentItems.length}`;

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
        },
        bike: {
          id: firstEquipment.id,
          make: firstEquipment.make,
          model: firstEquipment.model,
          type: "equipment",
          specs: firstEquipment.specs,
        },
        period: {
          startDate: context.rentStartDate || "",
          startTime: context.rentStartTime || "10:00",
          endDate: context.rentEndDate || "",
          endTime: context.rentEndTime || "10:00",
          dailyPrice: dailyTotal,
          depositOverride: context.depositOverride ? Number(context.depositOverride) : undefined,
        },
        crewSecrets,
        meta: {
          signatureTimestamp: now.toLocaleString("ru-RU"),
          signatureFingerprint: "manual-telegram-ekip",
          renterSignature: "согласие через Telegram",
          documentKey: `ekip-rental-${primaryKey}-${Date.now()}`,
          contractNumber: `${now.getDate()}.${now.getMonth() + 1}/${primaryKey}`,
        },
        equipmentMode: true,
        equipmentItems: equipmentItems.map((item) => ({
          id: item.id,
          make: item.make,
          model: item.model,
          dailyPrice: Number(item.specs?.daily_price || item.specs?.rent_weekday || 1000),
          specs: {
            material: item.specs?.category,
            size: item.specs?.size,
          },
        })),
        paymentSplit: {
          cashAmount: context.cashAmount || 0,
          bankAmount: context.bankAmount || 0,
        },
        // Keep contract total consistent with what the operator confirmed
        priceBreakdown: {
          totalRub: totalCost,
          basePriceRub: totalCost,
          helmetRub: 0,
          depositRub: depositNum,
          savingsRub: 0,
          savingsPercent: 0,
          tier: "сутки",
        },
      });
    } else {
      const salePrice = context.salePrice || String(sumSalePrices(equipmentItems));
      const primaryKey = equipmentItems.length === 1
        ? firstEquipment.id
        : `equipment-${equipmentItems.length}`;
      vars = {
        contract_number: `${now.getDate()}.${now.getMonth() + 1}/${primaryKey}`,
        day: String(now.getDate()).padStart(2, "0"),
        month: now.toLocaleString("ru-RU", { month: "long" }),
        month_num: String(now.getMonth() + 1).padStart(2, "0"),
        year: String(now.getFullYear()),
        buyer_full_name: context.mpFullName || "",
        buyer_passport: `${context.mpSeries || ""} ${context.mpNumber || ""}`.trim(),
        buyer_passport_issued_by: context.mpIssuedBy || "",
        buyer_passport_issue_date: context.mpIssueDate || "",
        buyer_birth_date: context.mpBirthDate || "",
        buyer_registration: context.mpRegistration || "",
        buyer_phone: context.clientPhone || "",
        equipment_name: equipmentTitle(equipmentItems),
        price_digits: salePrice,
        price_words: numberToWords(Number(salePrice)),
        signature_timestamp: now.toLocaleString("ru-RU"),
        document_key: `ekip-sale-${primaryKey}-${Date.now()}`,
      };
    }

    // Load template (could be crew-specific)
    const templateKey = isRent ? "equipment_rental" : "equipment_sale";
    let htmlTemplate: string;
    try {
      htmlTemplate = await loadTemplateForCrewWithOverrides(templateKey, crewSlug);
    } catch (templateErr) {
      logger.error("[/ekip] Failed to load template:", templateErr);
      await sendComplexMessage(chatId, "🚨 Ошибка: шаблон договора не найден. Обратитесь к администратору.", [], { removeKeyboard: true });
      return false;
    }

    const docFileName = `${context.dealType}-equipment-${equipmentItems.length}-${context.rentStartDate || now.toISOString().split('T')[0]}.docx`
      .replace(/[^a-zA-Zа-яА-Я0-9.\-]/g, "-")
      .replace(/-+/g, "-");

    const docResult = await buildFranchizeDocxFromTemplate({
      integrationScope: `telegram-ekip-${isRent ? 'rental' : 'sale'}`,
      uploadedBy: String(userId),
      documentKey: vars.document_key,
      fileName: docFileName,
      template: htmlTemplate,
      variables: vars,
      flowType: isRent ? "equipment_rental" : "equipment_sale",
      templateMode: "html",
    });

    const docxBuf = Buffer.from(docResult.bytes);
    const docSha256 = docResult.sha256;

    // Upload to storage
    let docStoragePath: string | null = null;
    try {
      const uploadResult = await uploadDocxToStorage({
        crewSlug,
        contractKey: vars.document_key,
        buffer: docxBuf,
        metadata: {
          source: `telegram-ekip-${isRent ? 'rental' : 'sale'}`,
          equipment_id: firstEquipment.id,
          equipment_count: equipmentItems.length,
          client: context.mpFullName || "",
        },
      });
      docStoragePath = uploadResult.storagePath;
      logger.info("[/ekip] DOCX uploaded to storage:", docStoragePath);
    } catch (uploadErr) {
      logger.warn("[/ekip] Storage upload failed (non-fatal):", uploadErr);
    }

    // Send via Telegram
    try {
      await sendTelegramDocument(String(chatId), docxBuf, docFileName);
      logger.info("[/ekip] DOCX sent via sendTelegramDocument");
    } catch (e) {
      logger.error("[/ekip] sendTelegramDocument failed:", e);
    }

    // ── DB persistence (2026-09-10 equipment parity — same tables as /doc) ──
    // RENT  → unified `rentals` rows (metadata.item_type='equipment'), one per
    //         item + deposit mirror + deposit_entries + crew_todos return todo.
    // SALE  → private.sale_contract_artifacts (money trigger auto-records
    //         income_sale + commission exactly like the /doc sale flow).
    // Failure is surfaced to the operator AND the admin chat (a lost deal that
    // exists only as a docx is how equipment deals used to disappear).
    let dealPersistenceError: string | null = null;
    let createdRentalIds: string[] = [];
    try {
      if (isRent) {
        const rentResult = await persistEkipRentals({
          context,
          equipmentItems,
          crewSlug,
          operatorChatId: String(userId),
          docSha256,
          documentKey: vars.document_key,
        });
        createdRentalIds = rentResult.rentalIds;
        dealPersistenceError = rentResult.error;
      } else {
        const saleResult = await persistEkipSaleArtifact({
          context,
          equipmentItems,
          crewSlug,
          operatorChatId: String(userId),
          docSha256,
          documentKey: vars.document_key,
          docStoragePath,
          salePrice: context.salePrice || String(sumSalePrices(equipmentItems)),
        });
        dealPersistenceError = saleResult.error;
      }
    } catch (persistErr: any) {
      dealPersistenceError = persistErr?.message || String(persistErr);
      logger.error("[/ekip] Persistence exception:", persistErr);
    }

    if (dealPersistenceError) {
      const warnMsg =
        `⚠️ *ВНИМАНИЕ: договор создан, но ${isRent ? "аренда" : "продажа"} НЕ сохранена в CRM!*\n\n` +
        `📦 ${equipmentTitle(equipmentItems)}\n` +
        `👤 ${context.mpFullName || "—"}\n` +
        `📱 ${context.clientPhone || "—"}\n` +
        `📄 Договор: ${docFileName}\n\n` +
        `🔍 _Ошибка:_ ${dealPersistenceError}`;
      try {
        await sendComplexMessage(chatId, warnMsg, [], { parseMode: "Markdown" });
      } catch (e) {
        logger.error("[/ekip] Failed to send persistence warning to operator:", e);
      }
      try {
        await notifyAdmin(
          `⚠️ [/ekip] Сделка не сохранена\n` +
          `Operator: ${userId}\n` +
          `Items: ${equipmentTitle(equipmentItems)}\n` +
          `Client: ${context.mpFullName || "—"} (${context.clientPhone || "—"})\n` +
          `Error: ${dealPersistenceError}`
        );
      } catch (e) {
        logger.warn("[/ekip] Admin persistence notify failed:", e);
      }
    }

    // Success message
    const successItems = equipmentTitle(equipmentItems);
    // FIX: was `sumDailyPrices(...) * Math.max(1, 0)` — a placeholder that
    // always showed the DAILY rate. Show the real deal total instead.
    const successTotal = isRent
      ? (() => {
          const { days } = rentDaysBetween(
            parseRuDateTime(context.rentStartDate, context.rentStartTime),
            parseRuDateTime(context.rentEndDate, context.rentEndTime),
          );
          const total = context.priceOverridden
            ? (context.cashAmount || 0) + (context.bankAmount || 0)
            : sumDailyPrices(equipmentItems) * days;
          return `${total.toLocaleString("ru-RU")} ₽ (${days} дн.)`;
        })()
      : `${Number(context.salePrice || sumSalePrices(equipmentItems)).toLocaleString("ru-RU")} ₽`;
    const successText = [
      `✅ *Договор ${isRent ? 'аренды' : 'продажи'} оборудования готов!*`,
      "",
      `📦 ${successItems}${equipmentItems.length > 1 ? ` (${equipmentItems.length} шт.)` : ""}`,
      `👤 ${context.mpFullName || ""}`,
      isRent ? `📅 ${context.rentStartDate || ""} ${context.rentStartTime || ""} → ${context.rentEndDate || ""} ${context.rentEndTime || ""}` : `💰 ${successTotal}`,
      ...(createdRentalIds.length > 0 ? [`🆔 Аренда в CRM: ${createdRentalIds.map((id) => id.slice(0, 8)).join(", ")}`] : []),
    ].join("\n");

    await sendComplexMessage(
      chatId,
      successText,
      [],
      { removeKeyboard: true, parseMode: 'Markdown' },
    );

    // Notify admin (env-routed, same channel as /doc — no hardcoded chat id)
    try {
      const adminMessage = [
        `📦 *${isRent ? 'Аренда' : 'Продажа'} оборудования* (/ekip${crewSlug ? `, ${crewSlug}` : ""})`,
        "",
        `📦 ${successItems}${equipmentItems.length > 1 ? ` (${equipmentItems.length} шт.)` : ""}`,
        `👤 ${context.mpFullName || ""}`,
        isRent ? `📅 ${context.rentStartDate || ""} ${context.rentStartTime || ""} → ${context.rentEndDate || ""} ${context.rentEndTime || ""}` : `💰 ${successTotal}`,
        ...(createdRentalIds.length > 0 ? [`🆔 ${createdRentalIds.map((id) => id.slice(0, 8)).join(", ")}`] : []),
      ].join("\n");

      await notifyAdmin(adminMessage);
    } catch (adminErr) {
      logger.warn("[/ekip] Admin notify failed:", adminErr);
    }

    return true;
  } catch (error) {
    logger.error("[/ekip] Generate failed", error);
    await sendComplexMessage(chatId, "🚨 Ошибка. Попробуйте ещё раз.", [], { removeKeyboard: true });
    return false;
  }
}

// ── Number to Russian words ───────────────────────────────────────────────────

function numberToWords(n: number): string {
  const units = ["", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
  const teens = ["десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать", "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать"];
  const tens = ["", "", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят", "восемьдесят", "девяносто"];
  const hundreds = ["", "сто", "двести", "триста", "четыреста", "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот"];

  if (n >= 1000) {
    const th = Math.floor(n / 1000);
    const r = n % 1000;
    const lastTwo = th % 10;
    let w = "тысяч";
    if (lastTwo === 1) w = "тысяча";
    else if (lastTwo >= 2 && lastTwo <= 4) w = "тысячи";
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

// ── Main command ─────────────────────────────────────────────────────────────

export async function ekipCommand(
  chatId: number,
  userId: number,
  username: string | undefined,
  text: string,
) {
  const userIdStr = String(userId);
  logger.info(`[/ekip] ${userIdStr}: ${text}`);

  const crewSlug = await getEkipCrewSlug(userIdStr);

  const parts = text.trim().split(/\s+/);
  const equipmentArg = parts.slice(1).join(" ").trim();

  // Preserve selectedCrew across setState — multi-crew operator support.
  // See doc-manual.ts:4386 for the same pattern with full rationale.
  const existingState = await getState(userIdStr);
  const preservedSelectedCrew = (existingState?.context as any)?.selectedCrew as string | undefined;

  // Start with deal type selection (same as doc-manual quality bar)
  const context: EkipFlowContext = {
    dealType: "rent",
    equipmentId: "",
    ...(preservedSelectedCrew ? { selectedCrew: preservedSelectedCrew } : {}),
  };

  if (equipmentArg) {
    const equipment = await resolveEquipmentById(equipmentArg);
    if (equipment) {
      context.equipmentId = equipment.id;
      context.equipmentMake = equipment.make;
      context.equipmentModel = equipment.model;
      await setState(userIdStr, "deal", context);
      await sendComplexMessage(chatId, `📦 ${equipment.make} ${equipment.model}`, [], { removeKeyboard: true });
      await sendComplexMessage(chatId, withStep("Тип сделки:", "deal"), buildDealKeyboard(), { keyboardType: 'inline' });
      return;
    }
  }

  // No argument: always start from deal type, then category → items
  await setState(userIdStr, "deal", context);
  await sendComplexMessage(chatId, withStep("Тип сделки:", "deal"), buildDealKeyboard(), { keyboardType: 'inline' });
}
