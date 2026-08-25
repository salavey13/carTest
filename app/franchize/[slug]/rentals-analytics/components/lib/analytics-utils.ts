// /analytics/components/lib/analytics-utils.ts
//
// Shared helpers for the analytics v2 components.
// Pure functions, zero dependencies — safe to import from any client component.
//
// Status color whitelist (allowed hardcoded hex per PRD §0.6):
//   #22c55e (green)   — active, completed, verified, good SLA
//   #eab308 (yellow)  — pending, caution SLA
//   #f59e0b (orange)  — warning SLA, return due soon
//   #ef4444 (red)     — cancelled, overdue, missing docs, critical SLA
//   #3b82f6 (blue)    — info, communication
//   #8b5cf6 (purple)  — confirmed
//   #64748b (gray)    — neutral, inactive
// Everything else MUST come from T: ThemeTokens.

import type {
  AnalyticsRentalRow,
  AnalyticsSaleRow,
  DocStatus,
  RentalStatus,
  SlaSignal,
  Tone,
} from "../types";

// ── Status metadata ──────────────────────────────────────────────────────────

interface StatusMeta {
  label: string;
  color: string;
}

export const RENTAL_STATUS_META: Record<RentalStatus, StatusMeta> = {
  active:               { label: "Активна",      color: "#22c55e" },
  completed:            { label: "Завершена",     color: "#3b82f6" },
  confirmed:            { label: "Подтверждена",  color: "#8b5cf6" },
  pending_confirmation: { label: "Ожидает",       color: "#f59e0b" },
  cancelled:            { label: "Отменена",      color: "#64748b" },
  disputed:             { label: "Спор",          color: "#ef4444" },
};

export function getRentalStatusMeta(status: string): StatusMeta {
  return RENTAL_STATUS_META[status as RentalStatus] ?? {
    label: status,
    color: "#64748b",
  };
}

// ── Formatters ───────────────────────────────────────────────────────────────

export function formatRubles(value: number | null | undefined): string {
  const v = Number(value) || 0;
  return v.toLocaleString("ru-RU") + " ₽";
}

export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
    });
  } catch {
    return "—";
  }
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("ru-RU", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export function formatDateLong(iso: string): string {
  try {
    const s = new Date(iso).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
      weekday: "long",
    });
    // Capitalize only the first letter (Russian months/weekdays are lowercase by default).
    return s.charAt(0).toUpperCase() + s.slice(1);
  } catch {
    return iso;
  }
}

/** Returns the local-calendar YYYY-MM-DD for "today" in Europe/Moscow timezone.
 *  Crucial for users in UTC+ timezones (Moscow UTC+3) — `new Date().toISOString()`
 *  would return yesterday's date between 00:00 and 03:00 local. We force
 *  Europe/Moscow via `toLocaleDateString("en-CA", { timeZone: "Europe/Moscow" })`
 *  which emits YYYY-MM-DD — this MUST match the server-side computation in
 *  `page.tsx` (which also uses `timeZone: "Europe/Moscow"`).
 */
export function todayLocalIso(): string {
  // `en-CA` locale formats dates as YYYY-MM-DD (ISO-like).
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Moscow" });
}

/** Shift a YYYY-MM-DD date by `deltaDays` in UTC (deterministic across timezones).
 *  Parsing with `T00:00:00Z` + `setUTCDate` avoids the local-time pitfall where
 *  `new Date("2024-01-15T00:00:00")` + `setDate` + `toISOString()` would
 *  silently skip days for users east of UTC.
 */
export function shiftDateIso(iso: string, deltaDays: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().split("T")[0];
}

export function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/** Extract the Europe/Moscow YYYY-MM-DD from an ISO datetime string.
 *  Used for date comparisons (e.g. "is agreed_end_date today?") where the
 *  stored datetime is UTC but we want the Moscow-local calendar date —
 *  matches the server-side `todayLocalIso()` rule.
 */
export function localDateOnly(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    // Force Europe/Moscow TZ so "today" matches what the operator sees on
    // their wall clock. `en-CA` locale emits YYYY-MM-DD.
    return new Date(iso).toLocaleDateString("en-CA", {
      timeZone: "Europe/Moscow",
    });
  } catch {
    return null;
  }
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "только что";
    if (mins < 60) return `${mins} мин назад`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} ч назад`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} дн назад`;
    return formatShortDate(iso);
  } catch {
    return "—";
  }
}

// ── Display name helpers ─────────────────────────────────────────────────────

export function getRentalBikeTitle(rental: AnalyticsRentalRow): string {
  if (rental.vehicle) {
    const title = `${rental.vehicle.make || ""} ${rental.vehicle.model || ""}`.trim();
    if (title) return title;
  }
  // Service rentals: derive friendly name from vehicle_id
  if (rental.vehicle_id?.startsWith("vip-bike-svc-")) {
    return "Сервисная услуга";
  }
  return "Байк";
}

export function getSaleBikeTitle(sale: AnalyticsSaleRow): string {
  if (sale.vehicle) {
    const title = `${sale.vehicle.make || ""} ${sale.vehicle.model || ""}`.trim();
    if (title) return title;
  }
  return "Байк";
}

/**
 * FIX (F1): resolve the REAL renter ФИО.
 * For operator-created rentals (/doc flow) rentals.user_id points at the
 * operator/crew owner, so public.users.full_name shows the wrong person.
 * Resolution order:
 *   1. metadata.renter_name  (mirrored by the /doc flow)
 *   2. contract.renter_full_name (private.rental_contract_artifacts)
 *   3. user.full_name (self-service bookings — still correct there)
 */
export function getRenterName(rental: AnalyticsRentalRow): string {
  const md = (rental.metadata || {}) as Record<string, unknown>;
  const mdName = md["renter_name"];
  if (typeof mdName === "string" && mdName.trim().length > 0) return mdName.trim();
  const contractName = rental.contract?.renter_full_name;
  if (contractName && contractName.trim().length > 0) return contractName.trim();
  return rental.user?.full_name || "Без имени";
}

/** FIX (F2): renter phone — metadata.renter_phone → artifact renter_phone. */
export function getRenterPhone(rental: AnalyticsRentalRow): string | null {
  const md = (rental.metadata || {}) as Record<string, unknown>;
  const mdPhone = md["renter_phone"];
  if (typeof mdPhone === "string" && mdPhone.trim().length > 0) return mdPhone.trim();
  const contractPhone = rental.contract?.renter_phone;
  if (contractPhone && contractPhone.trim().length > 0) return contractPhone.trim();
  return null;
}

export function getBuyerName(sale: AnalyticsSaleRow): string {
  return sale.buyer_full_name || "Без имени";
}

// ── Deposit (F3) ─────────────────────────────────────────────────────────────

export interface DepositInfo {
  amount: number | null;
  method: string | null;
  methodLabel: string | null;
  returned: boolean | null;
}

const DEPOSIT_METHOD_LABELS: Record<string, string> = {
  cash: "наличные",
  tbank: "Т-Банк карта",
  t_bank: "Т-Банк карта",
  sber: "Сбербанк карта",
  card: "карта",
};

/** Deposit from metadata.deposit_amount/deposit_method/deposit_returned with
 *  artifact deposit_rub as fallback (private.rental_contract_artifacts). */
export function getDepositInfo(rental: AnalyticsRentalRow): DepositInfo {
  const md = (rental.metadata || {}) as Record<string, unknown>;
  let amount: number | null = null;
  const mdAmount = md["deposit_amount"];
  if (typeof mdAmount === "number") amount = mdAmount;
  else if (typeof mdAmount === "string" && mdAmount.trim().length > 0) {
    const parsed = Number(mdAmount.replace(/[^\d.]/g, ""));
    if (!Number.isNaN(parsed)) amount = parsed;
  }
  if (amount == null && rental.contract?.deposit_rub) {
    const parsed = Number(String(rental.contract.deposit_rub).replace(/[^\d.]/g, ""));
    if (!Number.isNaN(parsed)) amount = parsed;
  }
  const method =
    (typeof md["deposit_method"] === "string" ? (md["deposit_method"] as string) : null) || null;
  const returned = typeof md["deposit_returned"] === "boolean" ? (md["deposit_returned"] as boolean) : null;
  return {
    amount,
    method,
    methodLabel: method ? DEPOSIT_METHOD_LABELS[method.toLowerCase()] || method : null,
    returned,
  };
}

// ── Equipment included in the rent (F4) ───────────────────────────────────────

const EQUIPMENT_LABELS: Record<string, string> = {
  helmets: "шлем",
  gloves: "перчатки",
  jacket: "куртка",
  pants: "штаны",
  boots: "ботинки",
  net: "сетка",
  bag: "сумка",
  backpack: "рюкзак",
  charger: "зарядка",
};

export interface EquipmentSummary {
  /** Human-readable list, e.g. "2 шлема, перчатки" */
  text: string;
  /** Estimated equipment cost part of the total (₽), using operator prices. */
  cost: number;
  items: Array<{ key: string; label: string; qty: number }>;
}

/** Parse metadata.equipment into a readable list with quantities.
 *  Numeric values are quantities (helmets: 2 → "2 шлема"), booleans are on/off. */
export function getEquipmentSummary(rental: AnalyticsRentalRow): EquipmentSummary {
  const md = (rental.metadata || {}) as Record<string, unknown>;
  const eq = md["equipment"];
  const items: Array<{ key: string; label: string; qty: number }> = [];
  if (eq && typeof eq === "object") {
    for (const [key, value] of Object.entries(eq as Record<string, unknown>)) {
      if (typeof value === "number" && value > 0) {
        items.push({ key, label: EQUIPMENT_LABELS[key] || key, qty: value });
      } else if (value === true) {
        items.push({ key, label: EQUIPMENT_LABELS[key] || key, qty: 1 });
      }
    }
  }
  // Operator price list (mirrors the CSV export pricing rule)
  const UNIT_PRICES: Record<string, number> = {
    helmets: 1000, gloves: 500, jacket: 500, pants: 500,
    boots: 500, net: 500, bag: 500, backpack: 500, charger: 500,
  };
  const cost = items.reduce((sum, it) => sum + (UNIT_PRICES[it.key] || 500) * it.qty, 0);

  const parts = items.map((it) => {
    if (it.qty > 1) {
      // crude Russian plural: шлем → шлема (2-4) / шлемов (5+)
      const base = it.label;
      const plural = it.qty >= 5 ? `${base}ов` : `${base}а`;
      return `${it.qty} ${plural}`;
    }
    return it.label;
  });
  return { text: parts.join(", "), cost, items };
}

// ── Payment split ────────────────────────────────────────────────────────────

export interface PaymentSplit {
  bank: number | null;
  cash: number | null;
  cardDestination: string | null;
  text: string | null;
}

export function getPaymentSplit(rental: AnalyticsRentalRow): PaymentSplit {
  const md = (rental.metadata || {}) as Record<string, unknown>;
  const ps = md["payment_split"];
  if (!ps || typeof ps !== "object") return { bank: null, cash: null, cardDestination: null, text: null };
  const obj = ps as Record<string, unknown>;
  const bank = typeof obj.bank === "number" ? obj.bank : null;
  const cash = typeof obj.cash === "number" ? obj.cash : null;
  const cardDestination =
    typeof obj.card_destination === "string" && obj.card_destination.length > 0
      ? obj.card_destination
      : null;
  const parts: string[] = [];
  if (bank != null && bank > 0) parts.push(`${bank.toLocaleString("ru-RU")} ₽ безнал${cardDestination ? ` (${cardDestination})` : ""}`);
  if (cash != null && cash > 0) parts.push(`${cash.toLocaleString("ru-RU")} ₽ нал`);
  return { bank, cash, cardDestination, text: parts.length ? parts.join(" + ") : null };
}

// ── Document completeness ────────────────────────────────────────────────────

const DOC_FIELDS: Array<{ key: keyof AnalyticsRentalRow; label: string }> = [
  { key: "passport_mainpage_photo",          label: "Паспорт (основная)" },
  { key: "passport_registration_photo",      label: "Паспорт (регистрация)" },
  { key: "drivers_licence_frontal_photo",    label: "Водительское удостоверение" },
];

export function computeDocStatus(rental: AnalyticsRentalRow): DocStatus {
  const present = DOC_FIELDS.filter((f) => {
    const v = rental[f.key];
    return typeof v === "string" && v.length > 0;
  });
  // metadata may carry 2 more (passport_back, license_back)
  const md = (rental.metadata || {}) as Record<string, unknown>;
  const extraCount = [
    md["passport_backpage_photo"],
    md["drivers_licence_back_photo"],
  ].filter((v) => typeof v === "string" && (v as string).length > 0).length;

  const count = present.length + extraCount;
  const total = 5;
  const missingLabels = DOC_FIELDS.filter((f) => {
    const v = rental[f.key];
    return !(typeof v === "string" && v.length > 0);
  }).map((f) => f.label);
  if (!md["passport_backpage_photo"]) missingLabels.push("Паспорт (оборот)");
  if (!md["drivers_licence_back_photo"]) missingLabels.push("Вод. удостоверение (оборот)");

  return {
    count,
    total,
    complete: count >= total,
    missing: missingLabels,
  };
}

// ── SLA / countdown ──────────────────────────────────────────────────────────

export function computeSlaSignals(rental: AnalyticsRentalRow): SlaSignal[] {
  const now = Date.now();
  const signals: SlaSignal[] = [];

  // Days in rental — FIX (F8): compute the contractual duration
  // (start → end, rounded up, min 1 day), NOT the elapsed wall-clock time
  // since start. A completed 6-hour rental must show 1д, not 3д.
  const startDate = rental.agreed_start_date || rental.requested_start_date;
  const endDate = rental.agreed_end_date || rental.requested_end_date;
  if (startDate && endDate) {
    const ms = new Date(endDate).getTime() - new Date(startDate).getTime();
    const days = Math.max(1, Math.ceil(ms / 86400000));
    signals.push({
      key: "days_active",
      label: "Дней в аренде",
      value: `${days}д`,
      tone: "neutral",
      priority: 1,
    });
  } else if (startDate) {
    // Open-ended rental: elapsed time since start
    const days = Math.max(1, Math.ceil((now - new Date(startDate).getTime()) / 86400000));
    signals.push({
      key: "days_active",
      label: "Дней в аренде",
      value: `${days}д`,
      tone: days > 30 ? "warning" : "neutral",
      priority: 1,
    });
  }

  // Until return
  if (rental.status === "active" && rental.agreed_end_date) {
    const ms = new Date(rental.agreed_end_date).getTime() - now;
    if (ms < 0) {
      const overdueDays = Math.floor(-ms / 86400000);
      signals.push({
        key: "return_overdue",
        label: "Просрочен возврат",
        value: `${overdueDays}д`,
        tone: "danger",
        priority: 10,
        detail: "Возврат просрочен",
      });
    } else {
      const hours = Math.floor(ms / 3600000);
      const days = Math.floor(hours / 24);
      const h = hours % 24;
      const value = days > 0 ? `${days}д ${h}ч` : `${h}ч`;
      signals.push({
        key: "until_return",
        label: "До возврата",
        value,
        tone: hours < 24 ? "danger" : hours < 72 ? "warning" : "good",
        priority: 8,
      });
    }
  }

  // FIX (F11): the documents 0/5 signal is intentionally removed.
  // Rentals created via the /doc command already have verified documents
  // (contract_verifier.status = verified in metadata); the photo-uploaded
  // checklist is not relevant for this flow.

  return signals.sort((a, b) => b.priority - a.priority);
}

export function toneColor(tone: Tone): string {
  switch (tone) {
    case "good":    return "#22c55e";
    case "warning": return "#f59e0b";
    case "danger":  return "#ef4444";
    case "neutral":
    default:        return "#64748b";
  }
}

// ── Handoff status ───────────────────────────────────────────────────────────

export interface HandoffStatus {
  done: boolean;
  returned: boolean;
  label: string;
}

/** FIX (F6): handoff status derived from real /doc-flow signals:
 *  - handed out when odometer_before is recorded (or metadata.handoff_at set);
 *  - returned when return_confirmed_at is set or status = completed. */
export function getHandoffStatus(rental: AnalyticsRentalRow): HandoffStatus {
  const md = (rental.metadata || {}) as Record<string, unknown>;
  const handoffAt = md["handoff_at"];
  const odoBefore = md["odometer_before"];
  const returnedAt = md["return_confirmed_at"];
  const handedOut =
    (typeof handoffAt === "string" && handoffAt.length > 0) ||
    typeof odoBefore === "number";
  const returned =
    (typeof returnedAt === "string" && returnedAt.length > 0) ||
    rental.status === "completed";
  if (returned) return { done: true, returned: true, label: "Возвращен" };
  if (handedOut || rental.status === "active") return { done: true, returned: false, label: "Передан" };
  return { done: false, returned: false, label: "Ожидает" };
}

// ── Service detection ────────────────────────────────────────────────────────

export function isServiceRental(rental: AnalyticsRentalRow): boolean {
  return !!rental.vehicle_id && rental.vehicle_id.startsWith("vip-bike-svc-");
}

// ── Service sign: client (+revenue) vs crew/internal (−expense) ──────────────
// A service rental carries a "sign" in the money math:
//   - metadata.client present  → client work (+). Counts toward day/week TOTAL.
//   - metadata.client absent   → internal/crew work (−) = mechanic salary.
//     Reported separately ("Внутр. работы / зарплата"), NOT added to totals.
// Mirrors the jq rule in boss-commands/evening-summary.sh & weekly-revenue.sh
// and the input convention in skills/service-work-text ("... для <client>").
export function getServiceClient(
  rental: AnalyticsRentalRow,
): string | null {
  const md = (rental.metadata || {}) as Record<string, unknown>;
  const client = md["client"];
  return typeof client === "string" && client.trim().length > 0
    ? client.trim()
    : null;
}

export function isClientServiceRental(rental: AnalyticsRentalRow): boolean {
  return isServiceRental(rental) && getServiceClient(rental) !== null;
}

export function isCrewServiceRental(rental: AnalyticsRentalRow): boolean {
  return isServiceRental(rental) && getServiceClient(rental) === null;
}
