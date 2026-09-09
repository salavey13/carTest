// app/franchize/lib/equipment-shared.ts
//
// Pure (side-effect free) helpers shared by the equipment domain:
//   • bot /ekip flow           (app/webhook-handlers/commands/ekip-manual.ts)
//   • equipment server actions (app/franchize/server-actions/equipment-rentals.ts)
//   • web checkout             (app/franchize/actions-runtime.ts)
//   • unit tests               (tests/franchize/*.spec.ts)
//
// WHY a separate file: "use server" modules may only export async functions,
// so pure helpers used by tests must live in a plain module.
//
// CANONICAL STORAGE (migration 20260815000001 + 20260910120000):
// equipment rentals live in `rentals` with metadata.item_type='equipment'.
// The legacy `equipment_rentals` table is an archive — nothing writes to it.

// ── Labels / category helpers ────────────────────────────────────────────────

/** Russian labels for equipment categories (mirrors actions-runtime.ts). */
export const EQUIPMENT_CATEGORY_LABELS: Record<string, string> = {
  helmet: "Шлемы",
  jacket: "Куртки",
  pants: "Штаны",
  gloves: "Перчатки",
  boots: "Боты",
  security: "Безопасность",
  electronics: "Электроника",
  suit: "Комбинезоны",
};

export function categoryEmoji(category: string): string {
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

// ── Material normalization (B.1) ─────────────────────────────────────────────

/** Short English keys for callback_data (Telegram 64-byte limit). */
export const MATERIAL_KEY_MAP: Record<string, string> = {
  "кожа": "leather",
  "текстиль": "textile",
  "эндуро": "enduro",
  "полиэстер": "polyester",
};

export const MATERIAL_LABEL_MAP: Record<string, { label: string; emoji: string }> = {
  leather: { label: "Кожа", emoji: "🟤" },
  textile: { label: "Текстиль", emoji: "🔵" },
  enduro: { label: "Эндуро", emoji: "🟢" },
  polyester: { label: "Полиэстер", emoji: "🟣" },
  other: { label: "Другое", emoji: "📦" },
};

/**
 * Normalize a Russian material string to a short English key.
 * "Кожа" → "leather", "Текстиль" → "textile", etc.
 * Strings containing "кожа" but also "текстиль" → "combo" (composite).
 * Unknown strings → "other".
 */
export function normalizeMaterialKey(material: string | undefined | null): string {
  if (!material || typeof material !== "string") return "other";
  const lower = material.toLowerCase();
  const hasLeather = lower.includes("кож");
  const hasTextile = lower.includes("текстил") || lower.includes("полиэстер") || lower.includes("polyester");
  if (hasLeather && hasTextile) return "combo";
  if (hasLeather) return "leather";
  if (hasTextile) return "textile";
  if (lower.includes("эндуро") || lower.includes("enduro")) return "enduro";
  for (const [ru, key] of Object.entries(MATERIAL_KEY_MAP)) {
    if (lower === ru || lower.includes(ru)) return key;
  }
  return "other";
}

/** Get display label + emoji for a material key. */
export function materialDisplay(key: string): { label: string; emoji: string } {
  return MATERIAL_LABEL_MAP[key] || MATERIAL_LABEL_MAP.other;
}

// ── Catalog item shape + pricing ─────────────────────────────────────────────

/**
 * Minimal equipment item shape (subset of a `cars` row with type='equipment').
 * `daily_price` is the cars-table column; `specs.daily_price` is the legacy
 * jsonb copy — both are accepted, the column wins (it is what the operator
 * sees in the catalog UI and what the seed migration 20260812000006 sets).
 */
export interface EquipmentCatalogItem {
  id: string;
  make: string;
  model: string;
  daily_price?: number | null;
  specs?: {
    daily_price?: number;
    rent_weekday?: number;
    sale_price?: number;
    deposit_rub?: number;
    category?: string;
    size?: string;
    sizes?: string[];
    materials?: string;
    [key: string]: unknown;
  } | null;
}

const FALLBACK_DAILY_PRICE = 1000;
const FALLBACK_SALE_PRICE = 5000;

/** Daily rent price of one equipment item (column → specs → fallback). */
export function itemDailyPrice(item: EquipmentCatalogItem): number {
  const column = Number(item.daily_price);
  if (Number.isFinite(column) && column > 0) return column;
  const specs = Number(item.specs?.daily_price);
  if (Number.isFinite(specs) && specs > 0) return specs;
  const weekday = Number(item.specs?.rent_weekday);
  if (Number.isFinite(weekday) && weekday > 0) return weekday;
  return FALLBACK_DAILY_PRICE;
}

/** Sale price of one equipment item (specs → fallback). */
export function itemSalePrice(item: EquipmentCatalogItem): number {
  const sale = Number(item.specs?.sale_price);
  if (Number.isFinite(sale) && sale > 0) return sale;
  return FALLBACK_SALE_PRICE;
}

/** Sum of daily prices across selected items. */
export function sumDailyPrices(items: EquipmentCatalogItem[]): number {
  return items.reduce((acc, i) => acc + itemDailyPrice(i), 0);
}

/** Sum of sale prices across selected items. */
export function sumSalePrices(items: EquipmentCatalogItem[]): number {
  return items.reduce((acc, i) => acc + itemSalePrice(i), 0);
}

/** "MT Street Pro" / "A, B, C" title for one or many items. */
export function equipmentTitle(items: EquipmentCatalogItem[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return `${items[0].make} ${items[0].model}`;
  return items.map((i) => `${i.make} ${i.model}`).join(", ");
}

/** Best-effort size for metadata.equipment_size (specs.size or first of sizes). */
export function itemSize(item: EquipmentCatalogItem): string | null {
  const size = item.specs?.size;
  if (typeof size === "string" && size.trim()) return size.trim();
  const sizes = item.specs?.sizes;
  if (Array.isArray(sizes) && sizes.length > 0) return String(sizes[0]);
  return null;
}

// ── Duration / price math ────────────────────────────────────────────────────

/** Parse DD.MM.YYYY (+ HH:MM) into a Date (local server time). */
export function parseRuDateTime(dateStr: string | undefined, timeStr: string | undefined): Date {
  if (!dateStr) return new Date(NaN);
  const dmy = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  const iso = dmy
    ? `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`
    : dateStr;
  return new Date(`${iso}T${timeStr || "10:00"}`);
}

/**
 * Rent duration in whole days (min 1), the way /ekip quotes it:
 * hours rounded to 0.1 then ceil to days.
 */
export function rentDaysBetween(
  start: Date,
  end: Date,
): { hours: number; days: number } {
  const hours = Math.max(1, Math.round(((end.getTime() - start.getTime()) / (1000 * 60 * 60)) * 10) / 10);
  const days = Math.max(1, Math.ceil(hours / 24));
  return { hours, days };
}

/**
 * Apportion a deal total across items proportionally to their daily price.
 * Returns integer rubles; the LAST item absorbs the rounding remainder so the
 * parts always sum to exactly `total`.
 */
export function apportionTotal(total: number, items: EquipmentCatalogItem[]): number[] {
  const n = items.length;
  if (n === 0) return [];
  if (n === 1) return [Math.round(total)];
  const dailies = items.map(itemDailyPrice);
  const dailySum = dailies.reduce((a, b) => a + b, 0);
  if (dailySum <= 0) {
    const even = Math.floor(total / n);
    const parts = Array.from({ length: n }, () => even);
    parts[n - 1] += total - even * n;
    return parts;
  }
  const parts = dailies.map((d) => Math.floor((total * d) / dailySum));
  const assigned = parts.reduce((a, b) => a + b, 0);
  parts[n - 1] += total - assigned;
  return parts;
}

// ── Payment normalization ────────────────────────────────────────────────────

/**
 * cash_transactions.payment_method CHECK allows only cash|card|transfer|other.
 * Bot/card destinations (tbank/sber) must be normalized to 'card' before they
 * can reach metadata.payment_method consumed by the money trigger.
 */
export function normalizePaymentMethod(dest: string | null | undefined): "cash" | "card" {
  if (dest && dest !== "cash") return "card";
  return "cash";
}

/**
 * rentals.deposit_method CHECK allows only cash|bank_transfer|telegram_stars|none.
 * tbank/sber card portions map to 'bank_transfer' (same mapping as /doc).
 */
export function normalizeDepositMethod(dest: string | null | undefined): "cash" | "bank_transfer" {
  return dest && dest !== "cash" ? "bank_transfer" : "cash";
}

// ── Status mapping (legacy equipment_rentals ↔ unified rentals) ─────────────

export type LegacyEquipmentStatus = "active" | "returned" | "damaged" | "lost" | "overdue";
export type UnifiedRentalStatus = "pending_confirmation" | "confirmed" | "active" | "completed" | "cancelled" | "disputed";

/** Legacy equipment status → unified rentals.status (migration 20260815000001 mapping). */
export function legacyStatusToUnified(status: string): UnifiedRentalStatus {
  switch (status) {
    case "active":
    case "overdue":
      return "active";
    case "returned":
      return "completed";
    case "lost":
    case "damaged":
      return "disputed";
    case "cancelled":
      return "cancelled";
    default:
      return "active";
  }
}

/** Unified rentals.status (+ metadata.equipment_condition) → legacy status for API compat. */
export function unifiedToLegacyStatus(status: string, equipmentCondition?: string | null): LegacyEquipmentStatus {
  switch (status) {
    case "active":
      return "active";
    case "completed":
      return "returned";
    case "disputed":
      return equipmentCondition === "Утерян" ? "lost" : "damaged";
    case "cancelled":
      return "active"; // closest legacy bucket; cancelled equipment had no legacy value
    default:
      return "active";
  }
}

/** Return condition (server action input) → unified rentals.status. */
export function conditionToUnifiedStatus(condition: "returned" | "damaged" | "lost"): UnifiedRentalStatus {
  return condition === "returned" ? "completed" : "disputed";
}

/** Return condition → metadata.equipment_condition (migration vocabulary). */
export function conditionToEquipmentCondition(condition: "returned" | "damaged" | "lost"): string {
  switch (condition) {
    case "returned": return "Норм";
    case "lost": return "Утерян";
    case "damaged": return "Есть повреждения";
  }
}

// ── Category → per-crew catalog resolution (I5 flag mapping, fixed) ─────────

/** DocFlowContext equipment flags mapped to specs.category keys. */
export const EQUIPMENT_FLAG_TO_CATEGORY: Record<string, string> = {
  helmets: "helmet",
  gloves: "gloves",
  jacket: "jacket",
  pants: "pants",
  boots: "boots",
};

/**
 * Resolve a REAL per-crew cars.id for an equipment category.
 *
 * Replaces the phantom `EQUIPMENT_FLAG_TO_CAR_ID` constants (slug-less ids like
 * `equip-helmet-street-pro` + a non-existent `equip-boots-street-sport`) —
 * seeded ids carry a `-{crewSlug}` suffix (20260812000006), and crews may have
 * their own catalog, so the only reliable resolution is by crew + category.
 *
 * Returns null when the crew has no item of that category (caller decides
 * whether to skip silently — legacy behavior — or surface a warning).
 */
export function pickCrewEquipmentByCategory(
  crewCatalog: EquipmentCatalogItem[],
  category: string,
): EquipmentCatalogItem | null {
  const matches = crewCatalog.filter((i) => (i.specs?.category || "") === category);
  if (matches.length === 0) return null;
  // Deterministic: alphabetical by make/model.
  matches.sort((a, b) => `${a.make} ${a.model}`.localeCompare(`${b.make} ${b.model}`));
  return matches[0];
}
