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

export function getRenterName(rental: AnalyticsRentalRow): string {
  return rental.user?.full_name || "Без имени";
}

export function getBuyerName(sale: AnalyticsSaleRow): string {
  return sale.buyer_full_name || "Без имени";
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

  // Days active
  const startDate = rental.agreed_start_date || rental.requested_start_date || rental.created_at;
  if (startDate) {
    const days = Math.floor((now - new Date(startDate).getTime()) / 86400000);
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

  // Document status
  const docs = computeDocStatus(rental);
  signals.push({
    key: "docs",
    label: "Документы",
    value: `${docs.count}/${docs.total}`,
    tone: docs.complete ? "good" : docs.count <= 1 ? "danger" : "warning",
    priority: 5,
    detail: docs.missing.length ? `Не хватает: ${docs.missing.slice(0, 2).join(", ")}${docs.missing.length > 2 ? "…" : ""}` : "Все документы загружены",
  });

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

export function getHandoffStatus(rental: AnalyticsRentalRow): { done: boolean; label: string } {
  const md = (rental.metadata || {}) as Record<string, unknown>;
  const handoffAt = md["handoff_at"];
  if (typeof handoffAt === "string" && handoffAt.length > 0) {
    return { done: true, label: "Передан" };
  }
  if (rental.status === "active" || rental.status === "completed") {
    return { done: false, label: "Ожидает" };
  }
  return { done: false, label: "—" };
}

// ── Service detection ────────────────────────────────────────────────────────

export function isServiceRental(rental: AnalyticsRentalRow): boolean {
  return !!rental.vehicle_id && rental.vehicle_id.startsWith("vip-bike-svc-");
}
