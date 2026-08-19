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
import { sendTelegramDocument } from "@/app/actions";
import { buildFranchizeDocxFromTemplate, uploadDocxToStorage } from "@/app/franchize/lib/docx-capability";
import { loadCrewSecrets as loadCrewSecretsShared, loadTemplateForCrew } from "../lib/crew-access";
import { buildRentalContractVariables, type CrewSecrets as RentalCrewSecrets } from "@/app/lib/rental-contract-vars";

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

// Russian labels for equipment categories (mirrors actions-runtime.ts)
const EQUIPMENT_CATEGORY_LABELS: Record<string, string> = {
  helmet: "Шлемы",
  jacket: "Куртки",
  pants: "Штаны",
  gloves: "Перчатки",
  boots: "Боты",
  security: "Безопасность",
  electronics: "Электроника",
  suit: "Комбинезоны",
};

// Items per page in the equipment selection keyboard
const EKIP_PAGE_SIZE = 10;

// ── Equipment catalog ────────────────────────────────────────────────────────

interface EquipmentItem {
  id: string;
  make: string;
  model: string;
  specs: {
    daily_price?: number;
    rent_weekday?: number;
    rent_weekend?: number;
    sale_price?: number;
    category?: string;
    deposit_rub?: number;
    image_url?: string;
    size?: string;
  };
  crew_id?: string;
}

async function getEquipmentCatalog(crewSlug?: string): Promise<EquipmentItem[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from("cars")
      .select("id, make, model, specs, crew_id")
      .eq("type", "equipment")
      .order("make, model");

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
      .select("id, make, model, specs, crew_id")
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

function categoryEmoji(category: string): string {
  switch (category) {
    case "helmet": return "🪖";
    case "jacket": return "🧥";
    case "pants": return "👖";
    case "gloves": return "🧤";
    case "boots": return "👢";
    case "suit": return "🧥";
    case "security": return "🔒";
    case "electronics": return "📡";
    default: return "📦";
  }
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
): KeyboardButton[][] {
  const items = equipmentList.filter((i) => (i.specs?.category || "other") === category);
  const label = EQUIPMENT_CATEGORY_LABELS[category] || category;
  const pageCount = Math.max(1, Math.ceil(items.length / EKIP_PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), pageCount - 1);
  const pageItems = items.slice(safePage * EKIP_PAGE_SIZE, (safePage + 1) * EKIP_PAGE_SIZE);

  const rows: KeyboardButton[][] = [];
  for (const item of pageItems) {
    const selected = selectedIds.includes(item.id);
    const size = item.specs?.size ? ` (${item.specs.size})` : "";
    rows.push([{
      text: `${selected ? "✅ " : ""}${categoryEmoji(category)} ${item.make} ${item.model}${size}`,
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

function parseRuDateTime(dateStr: string | undefined, timeStr: string | undefined): Date {
  if (!dateStr) return new Date(NaN);
  const dmy = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  const iso = dmy
    ? `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
    : dateStr;
  return new Date(`${iso}T${timeStr || '10:00'}`);
}

// ── Summary builders ─────────────────────────────────────────────────────────

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

function sumDailyPrices(items: EquipmentItem[]): number {
  return items.reduce((acc, i) => acc + Number(i.specs?.daily_price || i.specs?.rent_weekday || 1000), 0);
}

function sumSalePrices(items: EquipmentItem[]): number {
  return items.reduce((acc, i) => acc + Number(i.specs?.sale_price || 5000), 0);
}

function equipmentTitle(items: EquipmentItem[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return `${items[0].make} ${items[0].model}`;
  return items.map((i) => `${i.make} ${i.model}`).join(", ");
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

  // 2026-08-19 review: handle cancel + restart BEFORE the state check.
  // Previously, if the ekip state had been cleared (e.g. by an error in
  // an earlier step, or by the eq_done handler moving state forward to
  // a stage that didn't expect further equipment clicks), clicking
  // "❌ Отменить" would hit the `if (!ekipState) return false` guard,
  // fall through to handleDocCallback (also no doc state) → fall through
  // to "Неизвестная кнопка. Используй /help или /doc." This was confusing
  // for users who just wanted to abort.
  //
  // Now: cancel + restart always succeed, even with no state.
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

  const ekipState = await getState(userId);
  if (!ekipState) return false;

  const { state, context } = ekipState;

  if (callbackData === "d_rent") {
    context.dealType = "rent";
    // Deal type is chosen FIRST (like doc-manual) — then equipment type → items
    await setState(userId, "equipment", context);
    await sendComplexMessage(
      chatId,
      `📋 *Аренда*\n\n📦 *Выберите тип оборудования*`,
      buildCategoryKeyboard(await getEquipmentCatalog(), selectedEquipmentIds(context)),
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
      buildCategoryKeyboard(await getEquipmentCatalog(), selectedEquipmentIds(context)),
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
      await setState(userId, state, context);
      await sendComplexMessage(
        chatId,
        `📦 *Выберите тип оборудования*`,
        buildCategoryKeyboard(await getEquipmentCatalog(), selectedEquipmentIds(context)),
        { keyboardType: 'inline', parseMode: 'Markdown' },
      );
      return true;
    }

    context.equipmentCategory = category;
    context.equipmentPage = 0;
    await setState(userId, state, context);
    const label = EQUIPMENT_CATEGORY_LABELS[category] || category;
    const items = await getEquipmentCatalog();
    const chosen = selectedEquipmentIds(context).length;
    const chosenNote = chosen > 0 ? `\n\n✅ Уже выбрано: ${chosen} шт. — кликните ещё или «Готово».` : "";
    await sendComplexMessage(
      chatId,
      `📦 *${label}* — выберите предметы${chosenNote}`,
      buildCategoryItemsKeyboard(items, category, selectedEquipmentIds(context), 0),
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
      buildCategoryItemsKeyboard(await getEquipmentCatalog(), category, selectedEquipmentIds(context), page),
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

      const category = context.equipmentCategory;
      const page = context.equipmentPage || 0;
      const catalog = await getEquipmentCatalog();
      if (category) {
        const label = EQUIPMENT_CATEGORY_LABELS[category] || category;
        const added = idx >= 0 ? "➖ Убрано" : "➕ Добавлено";
        const chosenNote = ids.length > 0 ? ` (выбрано: ${ids.length} шт.)` : "";
        await sendComplexMessage(
          chatId,
          `${added}: ${equipment.make} ${equipment.model}${chosenNote}\n\n📦 *${label}*`,
          buildCategoryItemsKeyboard(catalog, category, ids, page),
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
      htmlTemplate = loadTemplateForCrew(templateKey, crewSlug);
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

    // Success message
    const successItems = equipmentTitle(equipmentItems);
    const successTotal = isRent
      ? `${sumDailyPrices(equipmentItems) * Math.max(1, 0)} ₽/сутки` // placeholder replaced below
      : `${Number(context.salePrice || sumSalePrices(equipmentItems)).toLocaleString("ru-RU")} ₽`;
    const successText = [
      `✅ *Договор ${isRent ? 'аренды' : 'продажи'} оборудования готов!*`,
      "",
      `📦 ${successItems}${equipmentItems.length > 1 ? ` (${equipmentItems.length} шт.)` : ""}`,
      `👤 ${context.mpFullName || ""}`,
      isRent ? `📅 ${context.rentStartDate || ""} ${context.rentStartTime || ""} → ${context.rentEndDate || ""} ${context.rentEndTime || ""}` : `💰 ${successTotal}`,
    ].join("\n");

    await sendComplexMessage(
      chatId,
      successText,
      [],
      { removeKeyboard: true, parseMode: 'Markdown' },
    );

    // Notify admin
    try {
      const adminChatId = "413553377"; // salavey13
      const adminMessage = [
        `📦 *${isRent ? 'Аренда' : 'Продажа'} оборудования*`,
        "",
        `📦 ${successItems}${equipmentItems.length > 1 ? ` (${equipmentItems.length} шт.)` : ""}`,
        `👤 ${context.mpFullName || ""}`,
        isRent ? `📅 ${context.rentStartDate || ""} ${context.rentStartTime || ""} → ${context.rentEndDate || ""} ${context.rentEndTime || ""}` : `💰 ${successTotal}`,
      ].join("\n");

      await sendComplexMessage(
        adminChatId,
        adminMessage,
        [],
        { parseMode: 'Markdown' },
      );
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

  // Start with deal type selection (same as doc-manual quality bar)
  const context: EkipFlowContext = {
    dealType: "rent",
    equipmentId: "",
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
