"use client";

import { Bike, Calendar, FileText, Info, Swords, X, Phone, Clock } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CatalogItemVM, FranchizeTheme } from "../actions";
import { hasRentPrice, hasSalePrice, ruPluralDays } from "../lib/catalog-utils";
import { getDisplayPriceTier, type BikePricingSpecs } from "../lib/pricing-calculator";
import {
  CATALOG_VS_SPECS,
  VsSpecRow,
  getCatalogVsSpecValue,
} from "@/components/franchize/VsSpecRow";
import {
  getCatalogPropulsionLabel,
  getCatalogPropulsionSegment,
  isSameCatalogPropulsion,
} from "@/app/franchize/lib/catalog-propulsion";
import { ItemGallery } from "../components/ItemGallery";
import { buildCatalogRentalStrip } from "../lib/catalog-rental-strip";
import { readableTextOnColor, withAlpha } from "../lib/theme";
import { FRANCHIZE_MODAL_CLOSE_SAFE_AREA_STYLE } from "../lib/route-cta-policy";
import { encodeStartappState, type StartappState } from "@/lib/startapp-state";
import { getTelegramWebAppAdaptiveHref } from "@/app/franchize/lib/telegram-links";
import { upsertFranchizeLead } from "@/app/franchize/lib/leads";
import { useCrewTokens, type CrewTokens } from "@/app/franchize/lib/use-crew-tokens";
import { addDaysISO, formatRuDateFromISO, todayISO, durationDaysFromDateTime } from "@/app/franchize/lib/date-utils";

// ── Russian Label Helper (VIP Bike Landing & Catalog Improvements) ──
// Helper to get Russian label from spec_labels in rawSpecs
// NOTE: item.specs may already contain Russian labels (populated server-side).
// Use this helper when directly accessing rawSpecs fields for display.
function getRussianLabel(key: string, item: CatalogItemVM): string {
  const specLabels = (item.rawSpecs as Record<string, unknown> | undefined)?.spec_labels as Record<string, string> | undefined;
  return specLabels?.[key] || key;
}

// ─────────────────────────────────────────────────────
// Item Modal — generalized for rental & order flows
// ─────────────────────────────────────────────────────
// flowType controls which sections appear:
//   "rental" → full rental UI (packages, duration, perks, auction,
//              rental strip, deposit/tariff info, "Забронировать" CTA)
//   "order"  → order-only UI (no rental options, simple "Выбрать" CTA,
//              no rental strip, no deposit info)
//
// Default is "rental" for backward compatibility with vip-bike.
// ─────────────────────────────────────────────────────

export type FlowType = "rental" | "order";

interface ItemModalProps {
  item: CatalogItemVM | null;
  items: CatalogItemVM[];
  slug: string;
  theme: FranchizeTheme;
  pickupAddress?: string;
  workingHours?: string;
  /** Crew business flow type — "rental" shows rental options, "order" hides them */
  flowType?: FlowType;
  options: {
    package: string;
    duration: string;
    perk: string;
    auction: string;
    /** Rental start date (ISO string yyyy-MM-dd) */
    rentStartDate?: string;
    /** Rental end date (ISO string yyyy-MM-dd) */
    rentEndDate?: string;
    /** Rental start time (HH:mm) — defaults to "10:00" */
    rentStartTime?: string;
    /** Rental end time (HH:mm) — defaults to "10:00" */
    rentEndTime?: string;
    /** Pre-selected additional items (jacket, boots, backpack, charger, gloves, net, bag). */
    extrasSelection?: AdditionalItemsSelection;
  };
  auctionOptions: string[];
  onChangeOption: (
    key: "package" | "duration" | "perk" | "auction" | "rentStartDate" | "rentEndDate" | "rentStartTime" | "rentEndTime",
    value: string,
  ) => void;
  onClose: () => void;
  /**
   * Called when "Добавить в корзину" CTA is clicked.
   * Receives the computed extras string so the parent can pass it directly
   * to addItem() instead of relying on stale React state closure.
   */
  onAddToCart: (extrasStr?: string) => void | Promise<void>;
  /** Called when "Купить" (buy) CTA is clicked for sale-only flow */
  onBuyItem?: () => void | Promise<void>;
  /** Called when "Тест-драйв" CTA is clicked — adds to cart with testdrive flow */
  onTestdrive?: () => void | Promise<void>;
  /** Shows "С возвращением!" badge for returning users */
  isReturningUser?: boolean;
}

const packageOptions = ["Базовый", "Комфорт", "Максимум"];
const durationOptions = ["1 день", "3 дня", "7 дней"];
const perkOptions = ["Стандарт", "Шлем + GoPro", "Полный комплект"];
const modalFocusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

// Legacy `--item-*` CSS-var map. Kept so the dozens of existing
// `style={{ color: 'var(--item-text)' }}` attributes in this file keep
// working after the migration to `useCrewTokens`. The actual values
// are populated by the `themeVars` memo inside `ItemModal` below.
const MODAL_CSS_VAR_KEYS = [
  "--item-accent",
  "--item-border",
  "--item-input-bg",
  "--item-muted-text",
  "--item-text",
  "--item-accent-contrast",
  "--item-bg-elevated",
] as const;

function OptionChips({
  title,
  options,
  selected,
  onSelect,
}: {
  title: string;
  options: string[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-[var(--item-muted-text)]">
        {title}
      </p>
      <div className="flex flex-wrap gap-2" role="group" aria-label={title}>
        {options.map((option) => {
          const isActive = option === selected;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={isActive}
              onClick={() => onSelect(option)}
              className={`rounded-full border px-3 py-1.5 text-xs transition hover:opacity-90 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--item-accent)] ${
                isActive
                  ? "border-[var(--item-accent)] bg-[var(--item-accent)] text-[var(--item-accent-contrast)]"
                  : "border-[var(--item-border)] text-[var(--item-text)]"
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Date + time pickers for rental start/end — this is the SINGLE
 *  source of truth for the rental window. The order page reads the
 *  values from the cart line and shows them passively, it does not
 *  ask the user to re-pick. */
function RentalDatePickers({
  startDate,
  endDate,
  startTime,
  endTime,
  onStartChange,
  onEndChange,
  onStartTimeChange,
  onEndTimeChange,
  T,
}: {
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
  onStartTimeChange: (v: string) => void;
  onEndTimeChange: (v: string) => void;
  T: CrewTokens;
}) {
  const today = todayISO();
  const endMin = startDate || today;

  const dayCount = (() => {
    if (!startDate || !endDate) return null;
    try {
      return durationDaysFromDateTime(startDate, startTime || "10:00", endDate, endTime || "10:00");
    } catch {
      return null;
    }
  })();

  const baseInputStyle: React.CSSProperties = {
    backgroundColor: T.bgElevated,
    borderColor: T.border,
    color: T.text,
  };

  return (
    <div
      className="rounded-2xl border p-3"
      style={{ borderColor: T.borderSoft, backgroundColor: T.bgElevated }}
    >
      <p
        className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.12em]"
        style={{ color: T.textMuted }}
      >
        <Calendar className="h-3.5 w-3.5" />
        Период аренды
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            className="mb-1 block text-[10px] uppercase tracking-[0.08em]"
            style={{ color: T.textMuted }}
          >
            Дата начала
          </label>
          <input
            type="date"
            value={startDate}
            min={today}
            onChange={(e) => onStartChange(e.target.value)}
            className="w-full rounded-lg border px-2.5 py-2 text-sm transition focus:outline-none focus:ring-2"
            style={{ ...baseInputStyle, colorScheme: T.isLight ? "light" : "dark" }}
            aria-label="Дата начала аренды"
          />
        </div>
        <div>
          <label
            className="mb-1 block text-[10px] uppercase tracking-[0.08em]"
            style={{ color: T.textMuted }}
          >
            Время выдачи
          </label>
          <input
            type="time"
            value={startTime}
            onChange={(e) => onStartTimeChange(e.target.value)}
            className="w-full rounded-lg border px-2.5 py-2 text-sm transition focus:outline-none focus:ring-2"
            style={{ ...baseInputStyle, colorScheme: T.isLight ? "light" : "dark" }}
            aria-label="Время выдачи"
          />
        </div>
        <div>
          <label
            className="mb-1 block text-[10px] uppercase tracking-[0.08em]"
            style={{ color: T.textMuted }}
          >
            Дата возврата
          </label>
          <input
            type="date"
            value={endDate}
            min={endMin}
            onChange={(e) => onEndChange(e.target.value)}
            className="w-full rounded-lg border px-2.5 py-2 text-sm transition focus:outline-none focus:ring-2"
            style={{ ...baseInputStyle, colorScheme: T.isLight ? "light" : "dark" }}
            aria-label="Дата возврата"
          />
        </div>
        <div>
          <label
            className="mb-1 block text-[10px] uppercase tracking-[0.08em]"
            style={{ color: T.textMuted }}
          >
            Время возврата
          </label>
          <input
            type="time"
            value={endTime}
            onChange={(e) => onEndTimeChange(e.target.value)}
            className="w-full rounded-lg border px-2.5 py-2 text-sm transition focus:outline-none focus:ring-2"
            style={{ ...baseInputStyle, colorScheme: T.isLight ? "light" : "dark" }}
            aria-label="Время возврата"
          />
        </div>
      </div>
      {dayCount && (
        <p className="mt-2 text-[11px]" style={{ color: T.textMuted }}>
          {dayCount === 1 ? "Аренда на 1 день" : `Аренда на ${dayCount} ${ruPluralDays(dayCount)}`}
          {" · "}
          <span className="font-semibold" style={{ color: T.text }}>
            {formatRuDateFromISO(startDate)} {startTime} → {formatRuDateFromISO(endDate)} {endTime}
          </span>
        </p>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Duration Shortcuts — quick date/time selection with prices
// ───────────────────────────────────────────────────────────────────────────────
function DurationShortcuts({
  startDate,
  endDate,
  startTime,
  endTime,
  onStartDateChange,
  onEndDateChange,
  onStartTimeChange,
  onEndTimeChange,
  T,
  specs,
}: {
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  onStartDateChange: (v: string) => void;
  onEndDateChange: (v: string) => void;
  onStartTimeChange: (v: string) => void;
  onEndTimeChange: (v: string) => void;
  T: CrewTokens;
  specs?: Record<string, unknown>;
}) {
  const fmt = (n: number) => n.toLocaleString("ru-RU");
  const today = todayISO();

  const addHours = (timeStr: string, hours: number): string => {
    const [h, m] = timeStr.split(":").map(Number);
    const totalMinutes = (h * 60 + m) + hours * 60;
    const newH = Math.floor(totalMinutes / 60) % 24;
    const newM = totalMinutes % 60;
    return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
  };

  /** Check if an ISO date string falls on a weekend */
  const isWeekendDay = (dateStr: string): boolean => {
    if (!dateStr) return false;
    const d = new Date(dateStr + "T12:00:00");
    const day = d.getDay();
    return day === 0 || day === 6;
  };

  const getDailyPrice = (): number => {
    // Weekend override: rent_weekend when it's a Saturday/Sunday
    if (isWeekendDay(startDate)) {
      return Number(specs.rent_weekend) || Number(specs.dailyPrice) || Number(specs.rent_weekday) || 0;
    }
    return Number(specs.dailyPrice) || Number(specs.rent_weekday) || 0;
  };

  const getPrice = (hours: number): number => {
    if (!specs) return 0;
    if (hours <= 1) return Number(specs.price_per_hour) || 0;
    if (hours === 2) return Number(specs.price_per_2h) || Math.round((Number(specs.price_per_hour) || 0) + ((Number(specs.price_per_3h) || 0) - (Number(specs.price_per_hour) || 0)) / 2) || (Number(specs.price_per_hour) || 0) * 2;
    if (hours <= 3) return Number(specs.price_per_3h) || (Number(specs.price_per_hour) || 0) * 3;
    if (hours <= 6) return Number(specs.price_per_6h) || (Number(specs.price_per_hour) || 0) * 6;
    if (hours <= 12) return Number(specs.price_per_12h) || (Number(specs.price_per_hour) || 0) * 12;
    const days = Math.ceil(hours / 24);
    const dailyPrice = getDailyPrice();
    if (days === 1) return dailyPrice;
    if (days <= 4) return (Number(specs.rent_2_4d) || dailyPrice) * days;
    if (days <= 10) return (Number(specs.rent_5_10d) || dailyPrice) * days;
    return (Number(specs.rent_11_30d) || dailyPrice) * days;
  };

  const hourOptions = [
    { label: "1 час", hours: 1 },
    { label: "2 часа", hours: 2 },
    { label: "3 часа", hours: 3 },
    { label: "6 часов", hours: 6 },
    { label: "12 часов", hours: 12 },
  ];

  const dayOptions = [
    { label: "1 день", days: 1 },
    { label: "3 дня", days: 3 },
    { label: "7 дней", days: 7 },
    { label: "2 недели", days: 14 },
    { label: "1 месяц", days: 30 },
  ];

  const handleHourClick = (hours: number) => {
    const effectiveStart = startDate || today;
    onStartDateChange(effectiveStart);
    onEndDateChange(effectiveStart);
    onStartTimeChange(startTime);
    onEndTimeChange(addHours(startTime, hours));
  };

  const handleDayClick = (days: number) => {
    const effectiveStart = startDate || today;
    onStartDateChange(effectiveStart);
    onEndDateChange(addDaysISO(effectiveStart, days));
    onStartTimeChange(startTime);
    onEndTimeChange(startTime);
  };

  const buttonStyle = (isActive: boolean): React.CSSProperties => ({
    borderColor: isActive ? T.accent : T.border,
    color: isActive ? T.accent : T.text,
    backgroundColor: isActive ? T.accentSoft : "transparent",
  });

  // FIX: Mutual exclusion between hour and day balloons. Previously
  // `isDayActive(1)` returned `true` for a same-day rental because
  // `diffDaysISO` is inclusive (it counts both the start and end day,
  // so a same-day rental resolves to 1). That made both "3 часа" and
  // "1 день" light up at the same time when the user clicked either
  // one — the user reported this as "3 hours and 12 hours both get
  // selected" because the day balloon was visually next to the
  // hour balloons and they read it as a second hour option.
  //
  // The fix is twofold:
  //   1. `isHourActive` — unchanged, but now ONLY fires on same-day
  //      rentals. The minute math already guarantees mutual exclusion
  //      between 3/6/12 because their minute counts (180/360/720) are
  //      pairwise different.
  //   2. `isDayActive` — now refuses to fire on same-day rentals
  //      (those are the hour balloons' territory) and uses a NON-
  //      inclusive day count so a 1-day rental (endDate = startDate
  //      + 1) resolves to `d === 1`, not `d === 2`.
  const isHourActive = (h: number): boolean => {
    if (!endDate || !startDate || endDate !== startDate) return false;
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    const minutes = (eh * 60 + em) - (sh * 60 + sm);
    return Number.isFinite(minutes) && minutes === h * 60;
  };

  const isDayActive = (d: number): boolean => {
    if (!startDate || !endDate) return false;
    // Same-day rentals belong to the hour balloons, not the day ones.
    if (endDate === startDate) return false;
    try {
      const { diffDaysISO } = require("@/app/franchize/lib/date-utils");
      // Non-inclusive day count: a 1-day rental is endDate = startDate
      // + 1, so `diffDaysISO - 1 === 1`. Without the -1 we'd hit
      // `diffDaysISO === 1` which a 0-day (same-day) rental also
      // satisfies — that's the bug that was lighting up "1 день"
      // whenever the user picked any hour option.
      return diffDaysISO(startDate, endDate) - 1 === d;
    } catch {
      return false;
    }
  };

  const hasDates = !!startDate;

  // Compute total price for the currently selected period
  const totalPrice = (() => {
    if (!hasDates || !endDate) return null;
    try {
      const { durationDaysFromDateTime } = require("@/app/franchize/lib/date-utils");
      const days = durationDaysFromDateTime(startDate, startTime || "10:00", endDate, endTime || "10:00");
      const totalHours = Math.round(days * 24);
      const p = getPrice(totalHours);
      if (p > 0) return p;
    } catch {}
    return null;
  })();

  return (
    <div
      className="rounded-2xl border p-3"
      style={{ borderColor: T.borderSoft, backgroundColor: T.bgElevated }}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p
          className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.12em]"
          style={{ color: T.textMuted }}
        >
          <Clock className="h-3.5 w-3.5" />
          Быстрый выбор
        </p>
        {hasDates && totalPrice !== null && (
          <p className="text-sm font-bold" style={{ color: T.accent }}>
            ≈ {fmt(totalPrice)} ₽
          </p>
        )}
      </div>

      {hasDates && (
        <p className="mb-2 text-[10px] tracking-wide" style={{ color: T.textMuted }}>
          <span className="font-semibold" style={{ color: T.text }}>
            {formatRuDateFromISO(startDate)} {startTime}
          </span>
          {" → "}
          <span className="font-semibold" style={{ color: T.text }}>
            {formatRuDateFromISO(endDate)} {endTime}
          </span>
        </p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {hourOptions.map((opt) => {
          const price = getPrice(opt.hours);
          const active = isHourActive(opt.hours);
          return (
            <button
              key={opt.label}
              type="button"
              onClick={() => handleHourClick(opt.hours)}
              className="flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition hover:opacity-90 active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={buttonStyle(active)}
            >
              <span>{opt.label}</span>
              {price > 0 && (
                <span className="font-bold">{fmt(price)} ₽</span>
              )}
            </button>
          );
        })}
        <span className="mx-0.5 self-center text-[10px]" style={{ color: T.textMuted }}>|</span>
        {dayOptions.map((opt) => {
          const price = getPrice(opt.days * 24);
          const active = isDayActive(opt.days);
          return (
            <button
              key={opt.label}
              type="button"
              onClick={() => handleDayClick(opt.days)}
              className="flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition hover:opacity-90 active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={buttonStyle(active)}
            >
              <span>{opt.label}</span>
              {price > 0 && (
                <span className="font-bold">{fmt(price)} ₽</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Pricing Table — compact multi-day prices (hourly/daily covered by DurationShortcuts)
// ───────────────────────────────────────────────────────────────────────────────
function PricingTable({
  specs,
  borderColor,
  accentColor,
}: {
  specs: Record<string, unknown>;
  borderColor: string;
  accentColor: string;
}) {
  const fmt = (n: number) => n.toLocaleString("ru-RU");

  // Only multi-day prices — hourly/1d covered by DurationShortcuts balloons
  const multiDay = [
    { label: "2–4 дня", value: Number(specs.rent_2_4d) || 0, suffix: "₽/сутки" },
    { label: "5–10 дней", value: Number(specs.rent_5_10d) || 0, suffix: "₽/сутки" },
    { label: "11–30 дней", value: Number(specs.rent_11_30d) || 0, suffix: "₽/сутки" },
  ].filter((t) => t.value > 0);

  if (multiDay.length === 0) return null;

  return (
    <div
      className="rounded-2xl border bg-[var(--item-border)]/15 p-3"
      style={{ borderColor }}
    >
      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.12em] text-[var(--item-muted-text)]">
        Долгосрочная аренда
      </p>
      <div className="flex flex-wrap gap-1.5">
        {multiDay.map((tier, i) => (
          <div
            key={i}
            className="flex items-center gap-1.5 rounded-full border px-3 py-1"
            style={{ borderColor: `${borderColor}60` }}
          >
            <span className="text-[11px] text-[var(--item-muted-text)]">{tier.label}</span>
            <span className="text-xs font-bold" style={{ color: accentColor }}>
              {fmt(tier.value)} {tier.suffix}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Additional Items — helmets, gloves, net, bag, coat
// ───────────────────────────────────────────────────────────────────────────────

/** All rentable extras with their prices (per rental, not per day).
 *  Helmet price is dynamic: 500₽ for hourly (<24h), 1000₽ for daily+ (≥24h).
 *  The `price` field here is the daily rate (used as fallback). */
export const ADDITIONAL_ITEMS = [
  { key: "helmet", label: "Шлем", icon: "🪖", price: 1000, hourlyPrice: 500, type: "count" as const, max: 2 },
  { key: "gloves", label: "Перчатки", icon: "🧤", price: 500, type: "toggle" as const },
  { key: "jacket", label: "Куртка", icon: "🧥", price: 500, type: "toggle" as const },
  { key: "boots", label: "Боты/Сапоги", icon: "👢", price: 500, type: "toggle" as const },
  { key: "net", label: "Сетка", icon: "🌐", price: 500, type: "toggle" as const },
  { key: "backpack", label: "Рюкзак", icon: "🎒", price: 500, type: "toggle" as const },
  { key: "bag", label: "Багажная сумка", icon: "👜", price: 500, type: "toggle" as const },
  { key: "charger", label: "Зарядка", icon: "🔌", price: 0, type: "toggle" as const },
];

export type AdditionalItemsSelection = Record<string, number | boolean>;

/** Get the effective price for an additional item based on rental duration. */
function getAdditionalItemPrice(item: typeof ADDITIONAL_ITEMS[number], rentalHours?: number): number {
  if (item.key === "helmet" && rentalHours !== undefined) {
    return rentalHours < 24 ? (item.hourlyPrice ?? 500) : item.price;
  }
  return item.price;
}

/** Calculate total extras cost from selection.
 *  @param rentalHours - if provided, helmet price is dynamic (500₽ for <24h, 1000₽ for ≥24h) */
export function calcExtrasTotal(sel: AdditionalItemsSelection, rentalHours?: number): number {
  return ADDITIONAL_ITEMS.reduce((sum, item) => {
    const val = sel[item.key];
    const unitPrice = getAdditionalItemPrice(item, rentalHours);
    if (item.type === "count") return sum + (typeof val === "number" ? val : 0) * unitPrice;
    return sum + (val === true ? unitPrice : 0);
  }, 0);
}

/** Build a human-readable summary of selected extras. */
export function extrasSummary(sel: AdditionalItemsSelection): string {
  const parts: string[] = [];
  for (const item of ADDITIONAL_ITEMS) {
    const val = sel[item.key];
    if (item.type === "count" && typeof val === "number" && val > 0) {
      parts.push(`${item.icon} ${item.label} ×${val}`);
    } else if (val === true) {
      parts.push(`${item.icon} ${item.label}`);
    }
  }
  return parts.join(", ");
}

function AdditionalItems({
  selection,
  onChange,
  rentalHours,
}: {
  selection: AdditionalItemsSelection;
  onChange: (sel: AdditionalItemsSelection) => void;
  rentalHours?: number;
}) {
  return (
    <div className="rounded-2xl border border-[var(--item-border)] bg-[var(--item-border)]/15 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.12em] text-[var(--item-muted-text)]">
        🎒 Доп. оборудование
      </p>
      <div className="space-y-2">
        {ADDITIONAL_ITEMS.map((item) => {
          const effectivePrice = getAdditionalItemPrice(item, rentalHours);
          if (item.type === "count") {
            const count = (selection[item.key] as number) || 0;
            return (
              <div key={item.key} className="flex items-center justify-between">
                <span className="text-xs">
                  {item.icon} {item.label}
                  {effectivePrice > 0 && <span className="opacity-50"> +{effectivePrice}₽</span>}
                  {effectivePrice === 0 && <span className="opacity-50"> бесплатно</span>}
                </span>
                <div className="flex gap-1.5">
                  {[0, 1, 2].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => onChange({ ...selection, [item.key]: n })}
                      aria-pressed={count === n}
                      className={`h-7 w-7 rounded-full border text-xs font-bold transition hover:opacity-90 active:scale-[0.95] ${
                        count === n
                          ? "border-[var(--item-accent)] bg-[var(--item-accent)] text-[var(--item-accent-contrast)]"
                          : "border-[var(--item-border)] text-[var(--item-text)]"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            );
          }
          // toggle
          const checked = selection[item.key] === true;
          return (
            <label
              key={item.key}
              className="flex cursor-pointer items-center justify-between rounded-lg border px-2.5 py-1.5 transition hover:opacity-80"
              style={{ borderColor: checked ? "var(--item-accent)" : "var(--item-border)" }}
            >
              <span className="text-xs">
                {item.icon} {item.label}
                {effectivePrice > 0 && <span className="opacity-50"> +{effectivePrice}₽</span>}
                {effectivePrice === 0 && <span className="opacity-50"> бесплатно</span>}
              </span>
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange({ ...selection, [item.key]: e.target.checked })}
                className="h-4 w-4 accent-[var(--item-accent)]"
              />
            </label>
          );
        })}
      </div>
      {/* Total extras cost */}
      {calcExtrasTotal(selection, rentalHours) > 0 && (
        <p className="mt-2 text-right text-xs font-bold text-[var(--item-accent)]">
          +{calcExtrasTotal(selection, rentalHours).toLocaleString("ru-RU")} ₽
        </p>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Helmet Balloons — DEPRECATED, replaced by AdditionalItems above
// Kept for backward compatibility with existing cart code
// ───────────────────────────────────────────────────────────────────────────────
function HelmetBalloons({
  selected,
  onSelect,
}: {
  selected: number;
  onSelect: (count: number) => void;
}) {
  const options = [
    { count: 1, label: "+1 шлем" },
    { count: 2, label: "+2 шлема" },
  ];

  return (
    <div className="rounded-2xl border border-[var(--item-border)] bg-[var(--item-border)]/15 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.12em] text-[var(--item-muted-text)]">
        🪖 Шлемы
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt.count}
            type="button"
            onClick={() => onSelect(opt.count === selected ? 0 : opt.count)}
            aria-pressed={selected === opt.count}
            className={`rounded-full border px-3 py-1.5 text-xs transition hover:opacity-90 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--item-accent)] ${
              selected === opt.count
                ? "border-[var(--item-accent)] bg-[var(--item-accent)] text-[var(--item-accent-contrast)]"
                : "border-[var(--item-border)] text-[var(--item-text)]"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {selected === 0 && (
        <p className="mt-2 text-[10px] text-[var(--item-muted-text)]">
          (ни один не выбран = есть свой)
        </p>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Price Card — displays calculated pricing with breakdown
// ───────────────────────────────────────────────────────────────────────────────
function PriceCard({
  specs,
  startDate,
  endDate,
  startTime,
  endTime,
  helmetCount,
  extrasSelection,
  isExpanded,
  onToggleExpand,
  borderColor,
}: {
  specs: Record<string, unknown>;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  helmetCount: number;
  extrasSelection?: AdditionalItemsSelection;
  isExpanded: boolean;
  onToggleExpand: () => void;
  borderColor: string;
}) {
  if (!startDate || !endDate) return null;

  // Dynamic import of calculatePrice (client-side only)
  const { calculatePrice, getHelmetPrice } = require("@/lib/rental-pricing-calculator");
  const result = calculatePrice(
    specs as any,
    startDate,
    endDate,
    startTime || "10:00",
    endTime || "10:00",
    helmetCount
  );

  // Calculate rental hours for dynamic helmet pricing
  const rentalHours = (() => {
    try {
      const start = new Date(`${startDate}T${startTime || "10:00"}`);
      const end = new Date(`${endDate}T${endTime || "10:00"}`);
      return Math.max(1, (end.getTime() - start.getTime()) / (1000 * 60 * 60));
    } catch {
      return 24; // default to daily pricing if dates are invalid
    }
  })();
  const helmetUnitPrice = getHelmetPrice(rentalHours);

  // Add non-helmet extras to the total
  const extrasTotal = extrasSelection ? calcExtrasTotal(extrasSelection, rentalHours) : 0;
  // Subtract helmet cost from extrasTotal (already counted in result.helmetRub)
  const helmetFromExtras = extrasSelection ? (typeof extrasSelection.helmet === "number" ? (extrasSelection.helmet as number) * helmetUnitPrice : 0) : 0;
  const nonHelmetExtras = extrasTotal - helmetFromExtras;
  const grandTotal = result.totalRub + nonHelmetExtras;

  const fmt = (n: number) => n.toLocaleString("ru-RU");

  return (
    <div
      className="rounded-2xl border border-[var(--item-border)] bg-[var(--item-border)]/15 p-3"
      style={{ borderColor }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">💰</span>
          <span className="text-lg font-bold text-[var(--item-accent)]">
            {fmt(grandTotal)} ₽
          </span>
        </div>
        {result.savingsPercent > 0 && (
          <span className="text-xs text-[var(--item-muted-text)]">
            Экономия {result.savingsPercent}% vs посуточно
          </span>
        )}
      </div>

      {!isExpanded && (
        <button
          type="button"
          onClick={onToggleExpand}
          className="mt-2 text-xs text-[var(--item-accent)] transition hover:opacity-90"
        >
          Детали стоимости
        </button>
      )}

      {isExpanded && (
        <div className="mt-3 space-y-2 text-xs">
          <p className="font-medium text-[var(--item-accent)]">📊 Детали стоимости</p>
          <div className="space-y-1">
            <p>• Период: {result.breakdown.period}</p>
            <p>• Тариф: {result.breakdown.ratePerPeriod}</p>
            <p>• Аренда: {fmt(result.basePriceRub)} ₽</p>
            {result.helmetRub > 0 && <p>• Шлем ×{helmetCount}: {fmt(result.helmetRub)} ₽ ({fmt(helmetUnitPrice)} ₽/шт{rentalHours < 24 ? ", почасово" : ""})</p>}
            {nonHelmetExtras > 0 && extrasSelection && (
              <>
                {ADDITIONAL_ITEMS.filter((i) => i.key !== "helmet").map((item) => {
                  const val = extrasSelection[item.key];
                  if (val !== true && val !== 1) return null;
                  return (
                    <p key={item.key}>
                      • {item.icon} {item.label}: {item.price > 0 ? `${fmt(item.price)} ₽` : "бесплатно"}
                    </p>
                  );
                })}
              </>
            )}
            <p>• Залог: {fmt(result.depositRub)} ₽</p>
          </div>
          <div className="border-t border-[var(--item-border)] pt-2">
            <p className="font-semibold">
              Итого: {fmt(grandTotal)} ₽ (аренда
              {result.helmetRub > 0 ? " + шлем" : ""}
              {nonHelmetExtras > 0 ? " + доп." : ""})
            </p>
            {result.savingsRub > 0 && (
              <p className="text-[var(--item-muted-text)]">
                Экономия {fmt(result.savingsRub)} ₽ против{
                  result.tier === "multi-day-2-4" ? " трёх" :
                  result.tier === "multi-day-5-10" ? " семи" :
                  result.tier === "multi-day-11-30" ? " нескольких" :
                  " отдельных"
                } дней
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Callback Request Form — lead capture for users not ready to commit
// ───────────────────────────────────────────────────────────────────────────────
function CallbackRequestForm({
  bikeTitle,
  accentColor,
  onSubmit,
}: {
  bikeTitle: string;
  accentColor: string;
  onSubmit: (name: string, phone: string) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2 || phone.trim().length < 6) return;
    onSubmit(name.trim(), phone.trim());
    setSubmitted(true);
  };

  // Theme-aware input style — explicit color/background/pointerEvents so
  // the input is actually focusable and typeable inside the modal (Telegram
  // WebApp and some mobile browsers previously failed to receive keystrokes
  // because the color-mix background collapsed to transparent and/or
  // touch-action="manipulation" on the form intercepted events).
  const inputStyle: React.CSSProperties = {
    backgroundColor: "var(--item-input-bg, var(--franchize-bg-base, #111217))",
    color: "var(--item-text, var(--franchize-text-primary, #fff))",
    borderColor: "var(--item-accent)",
    borderWidth: "1.5px",
    pointerEvents: "auto",
    // Make sure iOS/Telegram don't auto-zoom or override font
    fontSize: 16,
  };

  if (submitted) {
    return (
      <div className="rounded-2xl border px-3 py-3 text-center" style={{ borderColor: "var(--item-accent)", backgroundColor: "color-mix(in srgb, var(--item-accent) 10%, transparent)" }}>
        <p className="text-sm font-semibold text-[var(--item-accent)]">✅ Заявка отправлена!</p>
        <p className="mt-1 text-xs text-[var(--item-muted-text)]">
          Менеджер перезвонит в течение 15 минут.
          Документы можно показать при встрече.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      onKeyDown={(e) => e.stopPropagation()}
      style={{
        borderColor: "var(--item-border)",
        backgroundColor: "color-mix(in srgb, var(--item-border) 15%, transparent)",
        pointerEvents: "auto",
      }}
      className="rounded-2xl border p-3"
    >
      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.12em] text-[var(--item-muted-text)]">
        <Phone className="h-3.5 w-3.5" /> Запросить звонок
      </p>
      <p className="mb-2 text-[11px] text-[var(--item-muted-text)]">
        Оставьте контакты — менеджер перезвонит, ответит на вопросы и поможет с оформлением.
        Документы можно показать при встрече.
      </p>
      <div className="space-y-2">
        <input
          type="text"
          inputMode="text"
          autoComplete="name"
          placeholder="Имя"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          className="w-full rounded-lg border px-3 py-2 text-sm transition focus:outline-none focus:ring-2 focus:ring-[var(--item-accent)]"
          style={inputStyle}
          aria-label="Ваше имя"
          required
          minLength={2}
        />
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="Телефон (+7 999 123-45-67)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          className="w-full rounded-lg border px-3 py-2 text-sm transition focus:outline-none focus:ring-2 focus:ring-[var(--item-accent)]"
          style={inputStyle}
          aria-label="Номер телефона"
          required
          minLength={6}
        />
        <button
          type="submit"
          className="w-full rounded-lg px-3 py-2 text-sm font-bold transition hover:brightness-110 active:scale-[0.99]"
          style={{ backgroundColor: "var(--item-accent)", color: "var(--item-accent-contrast)" }}
        >
          Перезвоните мне
        </button>
      </div>
    </form>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Rounding Warning — shows when hours are messy (4-5h → 6h, 7-11h → 12h)
// ───────────────────────────────────────────────────────────────────────────────
function RoundingWarning({
  rounded,
  displayHours,
  startTime,
  onFixClick,
}: {
  rounded: boolean;
  displayHours?: number;
  startTime: string;
  onFixClick: () => void;
}) {
  if (!rounded || !displayHours) return null;

  // Calculate rounded end time
  const [h, m] = startTime.split(":").map(Number);
  const totalMinutes = h * 60 + m + displayHours * 60;
  const newH = Math.floor(totalMinutes / 60) % 24;
  const newM = totalMinutes % 60;
  const roundedEndTime = `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;

  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
      <div className="flex items-center justify-between gap-3">
        <span className="text-amber-300">⚠️ Округляем до {displayHours} ч</span>
        <button
          type="button"
          onClick={onFixClick}
          className="shrink-0 rounded-full border border-amber-500/40 px-2 py-1 text-amber-300 hover:bg-amber-500/20 transition"
        >
          До {roundedEndTime}
        </button>
      </div>
    </div>
  );
}

export function ItemModal({
  item,
  items,
  slug,
  theme,
  pickupAddress = "",
  workingHours = "",
  flowType = "rental",
  options,
  auctionOptions,
  onChangeOption,
  onClose,
  onAddToCart,
  onBuyItem,
  onTestdrive,
  isReturningUser = false,
}: ItemModalProps) {
  const isRental = flowType === "rental";
  const modalRef = useRef<HTMLDivElement>(null);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [isAdding, setIsAdding] = useState(false);
  const [isBuying, setIsBuying] = useState(false);
  // Shows a friendly "продолжаем из Telegram" banner when the user came via
  // a bot deep-link. Consumed from sessionStorage (set by CatalogClient).
  const [startappBanner, setStartappBanner] = useState<string | null>(null);
  const [vsBike, setVsBike] = useState<CatalogItemVM | null>(null);

  // New state for dynamic pricing
  const [helmetCount, setHelmetCount] = useState(0);
  // Additional items: helmet count + gloves/net/bag/coat toggles
  const [extrasSelection, setExtrasSelection] = useState<AdditionalItemsSelection>({ helmet: 0 });
  const [priceCardExpanded, setPriceCardExpanded] = useState(false);
  const [rentStartTime, setRentStartTime] = useState("10:00");
  const [rentEndTime, setRentEndTime] = useState("10:00");
  // Dynamic calculated price from franchize pricing calculator
  const [calculatedPrice, setCalculatedPrice] = useState<{ label: string; price: string; period: string } | null>(null);

  // ── Browser vs Telegram context detection ──
  // Default to false (browser) — corrected to true on mount if Telegram SDK is present.
  // This prevents a flash of Telegram-mode buttons on first render in a browser.
  const [isInTelegram, setIsInTelegram] = useState(false);
  // Callback request form
  const [showCallbackForm, setShowCallbackForm] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const tg = (window as any).Telegram?.WebApp;
    // If no Telegram WebApp SDK or no initData → user is in a regular browser
    const inTg = !!(tg && tg.initData && tg.initData.length > 0);
    setIsInTelegram(inTg);
  }, [item?.id]);

  // Sync pre-filled options from deep-link / parent into local modal state.
  useEffect(() => {
    if (!item) return;
    if (options.rentStartTime) setRentStartTime(options.rentStartTime);
    if (options.rentEndTime) setRentEndTime(options.rentEndTime);
    if (options.extrasSelection && typeof options.extrasSelection === "object") {
      setExtrasSelection((prev) => ({ ...prev, ...options.extrasSelection }));
      if (typeof options.extrasSelection.helmet === "number") {
        setHelmetCount(options.extrasSelection.helmet);
      }
    }
  }, [item?.id, options.rentStartTime, options.rentEndTime, options.extrasSelection]);

  // Determine which CTAs to show (safe optional chaining — item may be null during close transition)
  // Only show CTAs for flows that are explicitly enabled via rent=1/sale=1 specs
  const showRentCta = isRental && (item ? hasRentPrice(item) : false);
  const showBuyCta = item ? hasSalePrice(item) : false;

  const gallery = useMemo(() => {
    if (!item) return [];
    const urls = item.mediaUrls?.length
      ? item.mediaUrls
      : item.imageUrl
        ? [item.imageUrl]
        : [];
    return Array.from(new Set(urls.filter(Boolean) as string[]));
  }, [item]);

  const descriptionText = useMemo(() => {
    if (item?.description) return item.description;
    // Generalized fallback — no bike-specific language
    return isRental
      ? "Позиция готова к аренде: технический чек выполнен, документы готовы, выдача без очереди."
      : "Позиция доступна для заказа. Оставьте заявку, и менеджер свяжется с вами для уточнения деталей.";
  }, [item?.description, isRental]);

  const T = useCrewTokens(theme);
  // Map the new tokens back onto the legacy `--item-*` CSS variables
  // so the rest of the modal (gallery, badges, footer buttons, etc.)
  // can keep using its existing CSS-var indirection. This avoids
  // touching 200+ style attributes while we migrate the visual
  // primitives to `T` one component at a time.
  const themeVars: React.CSSProperties = useMemo(
    () => ({
      "--item-accent": T.accent,
      "--item-border": T.borderSoft,
      "--item-input-bg": T.bg,
      "--item-muted-text": T.textMuted,
      "--item-text": T.text,
      "--item-accent-contrast": T.accentContrast,
      "--item-bg-elevated": T.bgElevated,
    }),
    [T],
  );
  // Backward-compat shim so the dozens of existing `surface.card` /
  // `surface.mutedText` / `surface.subtleCard` attributes keep working.
  const surface = T.styles;

  useEffect(() => {
    setDescriptionExpanded(false);
    setActiveMediaIndex(0);
    setVsBike(null);
    setStartappBanner(null);
    // Detect deep-link from bot (set by CatalogClient) and show a banner.
    if (typeof window !== "undefined") {
      try {
        const raw = sessionStorage.getItem("franchize-startapp-banner");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.bikeId && parsed.bikeId === item?.id) {
            setStartappBanner("Продолжаем подбор из Telegram — часть данных уже заполнена");
          }
          sessionStorage.removeItem("franchize-startapp-banner");
        }
      } catch {
        sessionStorage.removeItem("franchize-startapp-banner");
      }
    }
  }, [item?.id]);

  // Recalculate price when dates change
  useEffect(() => {
    if (!item || !item.rawSpecs) {
      setCalculatedPrice(null);
      return;
    }

    const specs = item.rawSpecs as BikePricingSpecs;
    const result = getDisplayPriceTier(specs, options.rentStartDate, options.rentEndDate);
    setCalculatedPrice(result);
  }, [item, options.rentStartDate, options.rentEndDate]);

  useEffect(() => {
    if (!item) return;

    const originalOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key !== "Tab") return;

      const focusable = Array.from(modalRef.current?.querySelectorAll<HTMLElement>(modalFocusableSelector) ?? [])
        .filter((element) => element.offsetParent !== null || element === document.activeElement);
      if (focusable.length === 0) {
        e.preventDefault();
        modalRef.current?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    const focusDialog = window.requestAnimationFrame(() => modalRef.current?.focus());

    return () => {
      window.cancelAnimationFrame(focusDialog);
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [item, onClose]);

  const handleAddToCart = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (isAdding) return;

      setIsAdding(true);
      try {
        // Store extras selection in perk field for cart
        // Format: "шлем×2,перчатки,сумка" or "стандарт" if nothing selected
        const extrasStr = extrasSummary(extrasSelection);
        const perkValue = extrasStr || "стандарт";
        // Update parent React state for next render
        onChangeOption("perk", perkValue);
        // Pass extras string DIRECTLY to onAddToCart — bypasses stale closure issue
        // where addItem reads selectedOptions.perk before React flushes state update.
        // The parent (CatalogClient) must use this parameter to override perk in addItem().
        const result = onAddToCart(perkValue);
        if (result instanceof Promise) {
          result.finally(() => setIsAdding(false));
        } else {
          setIsAdding(false);
        }
      } catch {
        setIsAdding(false);
      }
    },
    [isAdding, onAddToCart, helmetCount, onChangeOption, extrasSelection],
  );

  const handleBuyItem = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (isBuying) return;

      setIsBuying(true);
      try {
        const result = onBuyItem?.();
        if (result instanceof Promise) {
          result.finally(() => setIsBuying(false));
        } else {
          setIsBuying(false);
        }
      } catch {
        setIsBuying(false);
      }
    },
    [isBuying, onBuyItem],
  );

  const changeMedia = useCallback(
    (direction: -1 | 1) => {
      setActiveMediaIndex(
        (prev) => (prev + direction + gallery.length) % gallery.length,
      );
    },
    [gallery.length],
  );

  const propulsionSegment = useMemo(
    () => (item ? getCatalogPropulsionSegment(item) : "unknown"),
    [item],
  );
  const propulsionLabel = getCatalogPropulsionLabel(propulsionSegment);

  const rentalStrip = useMemo(() => {
    if (!item || !isRental) return null;
    return buildCatalogRentalStrip(item, {
      hqLocation: pickupAddress,
      contacts: { address: pickupAddress, workingHours },
    });
  }, [item, isRental, pickupAddress, workingHours]);

  // Dynamic pricing result (computed from dates, times, helmet count)
  const pricingResult = useMemo(() => {
    if (!item || !options.rentStartDate || !options.rentEndDate) return null;

    try {
      const { calculatePrice } = require("@/lib/rental-pricing-calculator");
      return calculatePrice(
        item.rawSpecs ?? {},
        options.rentStartDate,
        options.rentEndDate,
        rentStartTime,
        rentEndTime,
        helmetCount
      );
    } catch {
      return null;
    }
  }, [item, options.rentStartDate, options.rentEndDate, rentStartTime, rentEndTime, helmetCount]);

  // Rounding fix handler — sets end time to rounded value
  const handleFixRounding = useCallback(() => {
    if (!pricingResult?.displayHours || !pricingResult.rounded) return;

    const [h, m] = rentStartTime.split(":").map(Number);
    const totalMinutes = h * 60 + m + pricingResult.displayHours * 60;
    const newH = Math.floor(totalMinutes / 60) % 24;
    const newM = totalMinutes % 60;
    const roundedEndTime = `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;

    setRentEndTime(roundedEndTime);
    onChangeOption("rentEndTime", roundedEndTime);
    onChangeOption("rentEndDate", options.rentStartDate || ""); // Same day for hourly
  }, [pricingResult, rentStartTime, options.rentStartDate, onChangeOption]);

  const comparableBikes = useMemo(() => {
    if (!item) return [];
    return items
      .filter(
        (candidate) =>
          candidate.id !== item.id &&
          candidate.availabilityStatus === "available" &&
          isSameCatalogPropulsion(item, candidate),
      )
      .slice(0, 6);
  }, [item, items]);

  // ── Bot username for deep-links (from crew config) ──
  const botUsername = (theme as any)?.telegramBotUsername || "oneBikePlsBot";

  // Track a browser user who clicked "continue in Telegram" as a lead.
  const trackContinueInTgLead = useCallback(
    (flowType: "rental" | "sale") => {
      void upsertFranchizeLead({
        slug,
        userId: item?.id ? `${flowType}-${item.id}-${Date.now()}` : `browser-${Date.now()}`,
        intentType: flowType === "rental" ? "rent" : "sale",
        stage: "configured",
        bikeId: item?.id,
        bikeTitle: item?.title,
        sourceRoute: `/franchize/${slug}?continue_in_tg=${flowType}`,
        contactChannel: "web_app",
        urgencyScore: flowType === "rental" ? 75 : 85,
        metadata: {
          flowType,
          startDate: options.rentStartDate,
          endDate: options.rentEndDate,
          startTime: rentStartTime,
          endTime: rentEndTime,
          helmetCount,
          extrasSelection,
          package: options.package,
          perk: options.perk,
        },
        ensureUser: true,
      });
    },
    [slug, item?.id, item?.title, options.rentStartDate, options.rentEndDate, rentStartTime, rentEndTime, helmetCount, extrasSelection, options.package, options.perk]
  );

  // ── buildStartappLink — MUST be before early return (it's a hook) ──
  const buildStartappLink = useCallback(
    (flowType: "rental" | "sale"): string | null => {
      if (!item) return null;
      try {
        const state: StartappState = {
          type: flowType === "rental" ? "rental" : "sale",
          bikeId: item.id,
          startDate: options.rentStartDate || undefined,
          endDate: options.rentEndDate || undefined,
          startTime: rentStartTime || undefined,
          endTime: rentEndTime || undefined,
          helmetCount: helmetCount > 0 ? helmetCount : undefined,
          extrasGloves: extrasSelection.gloves === true || undefined,
          extrasNet: extrasSelection.net === true || undefined,
          extrasBag: extrasSelection.bag === true || undefined,
          extrasJacket: extrasSelection.jacket === true || undefined,
          extrasBoots: extrasSelection.boots === true || undefined,
          extrasBackpack: extrasSelection.backpack === true || undefined,
          extrasCharger: extrasSelection.charger === true || undefined,
          package: options.package || undefined,
          perk: options.perk || undefined,
        };
        const startappParam = encodeStartappState(state);
        return getTelegramWebAppAdaptiveHref(startappParam, botUsername);
      } catch {
        return getTelegramWebAppAdaptiveHref("", botUsername);
      }
    },
    [item, options.rentStartDate, options.rentEndDate, options.package, options.perk, rentStartTime, rentEndTime, helmetCount, extrasSelection, botUsername],
  );

  // ── handleCallbackSubmit — MUST be before early return (it's a hook) ──
  const handleCallbackSubmit = useCallback(
    (name: string, phone: string) => {
      fetch("/api/franchize/callback-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          bikeId: item?.id,
          bikeTitle: item?.title,
          name,
          phone,
        }),
      }).catch(() => {});
    },
    [item?.id, item?.title, slug],
  );

  if (!item) return null;

  // Generalized fallback specs — rental vs order
  // Use dynamic pricing when dates are selected, otherwise fallback to rentPriceLabel
  // Only show prices that are explicitly enabled via rent=1/sale=1 specs
  const rentalPriceDisplay = calculatedPrice
    ? `${calculatedPrice.price} ${calculatedPrice.period}`
    : item.rentPriceLabel;

  const showRentInSpecs = hasRentPrice(item);
  const showSaleInSpecs = hasSalePrice(item);

  // Compact multi-day price reference (not shown in DurationShortcuts hourly balloons).
  // Only 2-4d, 5-10d, 11-30d — hourly/1d prices are covered by DurationShortcuts + PriceCard.
  const specs = item.rawSpecs as BikePricingSpecs | undefined;
  const multiDayPrices = [
    specs?.rent_2_4d ? { label: "2-4 дня", value: `${Number(specs.rent_2_4d).toLocaleString("ru-RU")} ₽/день` } : null,
    specs?.rent_5_10d ? { label: "5-10 дней", value: `${Number(specs.rent_5_10d).toLocaleString("ru-RU")} ₽/день` } : null,
    specs?.rent_11_30d ? { label: "11-30 дней", value: `${Number(specs.rent_11_30d).toLocaleString("ru-RU")} ₽/день` } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  const fallbackSpecs = isRental
    ? [
        { label: "Категория", value: item.category },
        // Multi-day prices compact reference (hourly/1d shown in DurationShortcuts)
        ...multiDayPrices,
        ...(showSaleInSpecs
          ? [
              {
                label: "Цена покупки",
                value: `${item.salePrice!.toLocaleString("ru-RU")} ₽`,
              },
            ]
          : []),
        { label: "Статус", value: "Готов к выдаче" },
      ]
    : [
        { label: "Категория", value: item.category },
        ...(showSaleInSpecs
          ? [
              {
                label: "Цена",
                value: `${item.salePrice!.toLocaleString("ru-RU")} ₽`,
              },
            ]
          : []),
        { label: "Статус", value: "Доступно для заказа" },
      ];

  const normalizedSpecs = (item.specs.length > 0 ? item.specs : fallbackSpecs)
    // Filter out internal fields like "id" and "rent" that shouldn't be shown to customers
    .filter((s) => {
      const excludeKeys = new Set(["id", "rent"]);
      const key = s.label?.toLowerCase().trim();
      return !excludeKeys.has(key);
    });

  // ── CTA labels (browser vs Telegram) ──
  const rentCtaLabel = isInTelegram
    ? (isAdding ? "Бронируем..." : "Забронировать")
    : "⚡ Забронировать в Telegram";
  const buyCtaLabel = isInTelegram
    ? (isBuying ? "Покупаем..." : "Купить")
    : "⚡ Купить в Telegram";
  const singleCtaLabel = isInTelegram
    ? (isAdding ? "Добавляем..." : showRentCta ? "Забронировать" : "Выбрать")
    : "⚡ Продолжить в Telegram";

  // Determine footer grid layout
  const footerCols = showRentCta && showBuyCta ? 3 : 2;

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-hidden bg-[var(--item-border)]/60 p-2 pb-4 outline-none sm:items-center sm:p-3"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`item-modal-title-${item.id}`}
      aria-describedby={`item-modal-description-${item.id}`}
      tabIndex={-1}
      style={themeVars}
    >
      <div
        className="flex w-full max-w-4xl flex-col overflow-hidden rounded-[1.75rem] border shadow-[0_30px_80px_rgba(0,0,0,0.35)] sm:my-auto sm:rounded-3xl max-h-[calc(100dvh-1.5rem)]"
        style={surface.card}
      >
        <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain [scrollbar-gutter:stable]">
          {/* Gallery Component — rentalbikes-style portrait hero */}
          <ItemGallery
            images={gallery}
            activeIndex={activeMediaIndex}
            onNavigate={changeMedia}
            onSelect={setActiveMediaIndex}
            altText={item.title}
            borderColor="var(--item-border)"
            accentColor="var(--item-accent)"
            bgColor="color-mix(in srgb, var(--item-border) 15%, transparent)"
            mainAspectRatio="16/11"
            prefer4x3
            disableKeyboardNav={false}
            closeButton={
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition hover:bg-black/75 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                aria-label="Закрыть"
              >
                <X className="h-4 w-4" />
              </button>
            }
          />

          {/* Content — rentalbikes-inspired layout */}
          <div className="space-y-4 p-4 sm:p-5">
            {/* Deep-link banner — shown when arriving from a Telegram bot */}
            {startappBanner && (
              <div
                className="flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs"
                  style={{
                    borderColor: "color-mix(in srgb, var(--item-accent) 25%, transparent)",
                    backgroundColor: "color-mix(in srgb, var(--item-accent) 8%, transparent)",
                    color: "var(--item-accent)",
                  }}
                role="status"
              >
                <span aria-hidden>⚡</span>
                <span>{startappBanner}</span>
              </div>
            )}
            {/* Title + characteristics row (rentalbikes-style) */}
            <div>
              <h3
                id={`item-modal-title-${item.id}`}
                className="text-lg font-bold sm:text-xl"
              >
                {item.title}
              </h3>
              <p className="text-sm" style={surface.mutedText}>
                {item.subtitle}
              </p>

              {/* Spec chips row — rentalbikes-style inline icons (speed, engine, weight) */}
              {normalizedSpecs.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {normalizedSpecs.slice(0, 4).map((spec) => (
                    <span
                      key={`${spec.label}-${spec.value}`}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--item-border)]/40 px-2.5 py-1.5 text-xs font-semibold text-[var(--item-accent)]"
                    >
                      <span className="text-[10px] opacity-70">{spec.label}</span>
                      <span className="text-[var(--item-text)]">{spec.value}</span>
                    </span>
                  ))}
                </div>
              )}

              {/* Availability badge + sale badge */}
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span
                  className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-semibold"
                  style={
                    (rentalStrip?.isAvailable ?? item.availabilityStatus === "available")
                      ? T.styles.successBadge
                      : { backgroundColor: T.accentSoft, color: T.accent, borderColor: T.accent }
                  }
                >
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{
                      backgroundColor:
                        (rentalStrip?.isAvailable ?? item.availabilityStatus === "available")
                          ? (T.isLight ? "#059669" : "#34d399")
                          : T.accent,
                    }}
                  />
                  {isRental
                    ? `Сегодня: ${rentalStrip?.todayLabel ?? "Уточним в Telegram"}`
                    : item.availabilityStatus === "available"
                      ? "Доступно для заказа"
                      : "Уточните наличие"}
                </span>
                {showBuyCta && (
                  <span
                    className="inline-flex rounded-full border px-2.5 py-1 font-semibold"
                    style={{ backgroundColor: T.accentSoft, color: T.accent, borderColor: T.accent }}
                  >
                    {isRental ? "Аренда + покупка" : "Доступно к покупке"}
                  </span>
                )}
                {isReturningUser && (
                  <span
                    className="inline-flex rounded-full border px-2.5 py-1 font-semibold"
                    style={T.styles.successBadge}
                  >
                    С возвращением!
                  </span>
                )}
              </div>
            </div>

            {/* Rental strip — only for rental flow */}
            {isRental && rentalStrip ? (
              <div
                className="grid gap-2 rounded-2xl border border-[var(--item-border)] bg-[var(--item-border)]/15 p-3 text-xs sm:grid-cols-3"
                aria-label={`Быстрая аренда ${item.title}`}
              >
                <div>
                  <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--item-muted-text)]">Ближайшее окно</p>
                  <p className="mt-1 font-semibold text-[var(--item-text)]">{rentalStrip.nearestStartWindow}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--item-muted-text)]">Выдача</p>
                  <p className="mt-1 font-semibold text-[var(--item-text)]">{rentalStrip.pickupHint}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--item-muted-text)]">Залог / тариф</p>
                  <p className="mt-1 font-semibold text-[var(--item-text)]">{rentalStrip.priceTeaser}</p>
                </div>
              </div>
            ) : null}

              <p
                id={`item-modal-description-${item.id}`}
                className={`mt-2 text-sm leading-6 ${descriptionExpanded ? "" : "line-clamp-4"}`}
                style={surface.mutedText}
              >
                {descriptionText}
              </p>
              {descriptionText.length > 200 && (
                <button
                  type="button"
                  className="mt-1 text-sm font-medium text-[var(--item-accent)] transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--item-accent)]"
                  aria-expanded={descriptionExpanded}
                  aria-controls={`item-modal-description-${item.id}`}
                  onClick={() => setDescriptionExpanded((prev) => !prev)}
                >
                  {descriptionExpanded ? "Скрыть" : "Показать ещё..."}
                </button>
              )}

            {/* Full specs grid — rentalbikes-style dark cards */}
            <div
              className="rounded-2xl border p-3 text-xs"
              style={surface.subtleCard}
            >
              <p className="inline-flex items-center gap-1 font-medium text-[var(--item-accent)]">
                <Info className="h-3.5 w-3.5" /> Характеристики{isRental ? " и условия" : ""}
              </p>
              <div
                className="mt-2 grid grid-cols-1 gap-2 text-[11px] sm:grid-cols-2"
                style={surface.mutedText}
              >
                {normalizedSpecs.map((spec) => (
                  <div
                    key={`${spec.label}-${spec.value}`}
                    className="min-w-0 rounded-lg border px-2.5 py-2"
                    style={surface.subtleCard}
                  >
                    <p className="text-[10px] uppercase tracking-[0.08em]">
                      {spec.label}
                    </p>
                    <p className="mt-1 break-words text-sm text-[var(--item-text)]">
                      {spec.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            {item.reviewSummary.count > 0 && (
              <section
                className="rounded-2xl border p-3"
                style={surface.subtleCard}
                aria-label={isRental ? "Отзывы арендаторов" : "Отзывы"}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[var(--item-text)]">Отзывы</p>
                  <span className="rounded-full bg-[var(--item-accent)] px-2.5 py-1 text-xs font-bold text-[var(--item-accent-contrast)]">
                    ★ {item.reviewSummary.average.toFixed(1)} · {item.reviewSummary.count}
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  {item.reviewSummary.reviews.slice(0, 6).map((review) => (
                    <article key={review.id} className="rounded-xl border px-3 py-2" style={surface.subtleCard}>
                      <p className="text-xs font-semibold text-[var(--item-accent)]">{`★`.repeat(review.rating)}<span className="text-[var(--item-muted-text)]"> / 5</span></p>
                      {review.text && <p className="mt-1 text-sm leading-5" style={surface.mutedText}>{review.text}</p>}
                    </article>
                  ))}
                </div>
              </section>
            )}

            {showBuyCta && (
              <Link
                href={`/franchize/${slug}/market/${item.id}/buy`}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-[var(--item-accent)] bg-[var(--item-accent)] px-4 py-3 text-sm font-bold uppercase tracking-wide text-[var(--item-accent-contrast)] shadow-lg shadow-[var(--item-accent)]/20 transition hover:brightness-110 hover:scale-[1.01] active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--item-accent)]"
                aria-label={`Перейти на страницу покупки ${item.title}`}
              >
                Перейти на страницу покупки
              </Link>
            )}

            {/* ── Test-drive CTA ── */}
            {showRentCta && (
              <button
                type="button"
                onClick={() => onTestdrive?.()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold uppercase tracking-wide transition hover:brightness-110 hover:scale-[1.01] active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{
                  borderColor: "color-mix(in srgb, var(--item-accent) 40%, transparent)",
                  color: "var(--item-accent)",
                  backgroundColor: "color-mix(in srgb, var(--item-accent) 8%, transparent)",
                }}
                aria-label={`Записаться на тест-драйв ${item.title}`}
              >
                <Bike className="h-4 w-4" />
                Записаться на тест-драйв
              </button>
            )}

            {/* Callback request — alternative to direct booking, placed before rental config */}
            {!showCallbackForm && (
              <button
                type="button"
                onClick={() => setShowCallbackForm(true)}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-medium transition hover:opacity-80 active:scale-[0.99]"
                style={{ borderColor: "color-mix(in srgb, var(--item-accent) 25%, transparent)", color: "var(--item-accent)" }}
              >
                <Phone className="h-3 w-3" />
                Запросить звонок
              </button>
            )}

            {/* ── Rental-only options (hidden for order flow) ── */}
            {isRental && (
              <>
                {/* ── Date + time pickers for rental window (SINGLE source of truth) ── */}
                <RentalDatePickers
                  startDate={options.rentStartDate ?? ""}
                  endDate={options.rentEndDate ?? ""}
                  startTime={options.rentStartTime ?? rentStartTime}
                  endTime={options.rentEndTime ?? rentEndTime}
                  onStartChange={(v) => onChangeOption("rentStartDate", v)}
                  onEndChange={(v) => onChangeOption("rentEndDate", v)}
                  onStartTimeChange={(v) => {
                    setRentStartTime(v);
                    onChangeOption("rentStartTime", v);
                  }}
                  onEndTimeChange={(v) => {
                    setRentEndTime(v);
                    onChangeOption("rentEndTime", v);
                  }}
                  T={T}
                />

                {/* Full pricing table — shows ALL available rates (before quick selection) */}
                <PricingTable
                  specs={item.rawSpecs ?? {}}
                  borderColor="var(--item-border)"
                  accentColor="var(--item-accent)"
                />

                {/* Quick duration selection with prices */}
                <DurationShortcuts
                  startDate={options.rentStartDate ?? ""}
                  endDate={options.rentEndDate ?? ""}
                  startTime={options.rentStartTime ?? rentStartTime}
                  endTime={options.rentEndTime ?? rentEndTime}
                  onStartDateChange={(v) => onChangeOption("rentStartDate", v)}
                  onEndDateChange={(v) => onChangeOption("rentEndDate", v)}
                  onStartTimeChange={(v) => {
                    setRentStartTime(v);
                    onChangeOption("rentStartTime", v);
                  }}
                  onEndTimeChange={(v) => {
                    setRentEndTime(v);
                    onChangeOption("rentEndTime", v);
                  }}
                  T={T}
                  specs={item.rawSpecs ?? {}}
                />

                <AdditionalItems
                  selection={extrasSelection}
                  rentalHours={pricingResult?.displayHours}
                  onChange={(sel) => {
                    setExtrasSelection(sel);
                    // Sync helmetCount for backward compat with cart/pricing
                    setHelmetCount(typeof sel.helmet === "number" ? sel.helmet : 0);
                  }}
                />

                {pricingResult && (
                  <>
                    <PriceCard
                      specs={item.rawSpecs ?? {}}
                      startDate={options.rentStartDate ?? ""}
                      endDate={options.rentEndDate ?? ""}
                      startTime={rentStartTime}
                      endTime={rentEndTime}
                      helmetCount={helmetCount}
                      extrasSelection={extrasSelection}
                      isExpanded={priceCardExpanded}
                      onToggleExpand={() => setPriceCardExpanded((v) => !v)}
                  borderColor="var(--item-border)"
                    />

                    {pricingResult.rounded && (
                      <RoundingWarning
                        rounded={pricingResult.rounded}
                        displayHours={pricingResult.displayHours}
                        startTime={rentStartTime}
                        onFixClick={handleFixRounding}
                      />
                    )}
                  </>
                )}

              </>
            )}

            {comparableBikes.length ? (
              <details
                className="rounded-2xl border p-3"
                style={surface.subtleCard}
              >
                <summary className="cursor-pointer list-none text-sm font-semibold">
                  Сравнить с другой моделью
                  <span className="ml-2 text-xs font-normal opacity-60">
                    {propulsionLabel}
                  </span>
                </summary>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {comparableBikes.map((bike) => (
                    <button
                      key={bike.id}
                      type="button"
                      onClick={() => setVsBike(bike)}
                      aria-pressed={vsBike?.id === bike.id}
                      className="rounded-xl border p-2 text-left text-xs transition hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--item-accent)]"
                      style={surface.subtleCard}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="line-clamp-2">{bike.title}</span>
                        <Swords className="h-3.5 w-3.5 shrink-0" />
                      </span>
                    </button>
                  ))}
                </div>
                {vsBike ? (
                  <div
                    className="mt-3 rounded-2xl border border-white/10 p-3"
                    style={surface.subtleCard}
                  >
                    <div className="mb-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center text-xs font-semibold text-[var(--item-text)]">
                      <span>
                        {item.title}
                        <span className="mt-0.5 block text-[10px] uppercase tracking-[0.12em] opacity-55">
                          {propulsionLabel}
                        </span>
                      </span>
                      <Swords className="h-5 w-5 text-[var(--item-accent)]" />
                      <span>{vsBike.title}</span>
                    </div>
                    <div className="space-y-2">
                      {CATALOG_VS_SPECS.map((spec) => (
                        <VsSpecRow
                          key={spec.label}
                          label={spec.label}
                          valueA={getCatalogVsSpecValue(
                            item.rawSpecs,
                            spec.keys,
                          )}
                          valueB={getCatalogVsSpecValue(
                            vsBike.rawSpecs,
                            spec.keys,
                          )}
                          unit={spec.unit}
                          lowerIsBetter={spec.lowerIsBetter}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
              </details>
            ) : null}

          </div>

          {/* Footer Buttons — dual CTA when both rent + sale available */}
          {/* In browser mode (no TG), CTAs become deep-links to the Telegram bot */}
          {!isInTelegram && (
            <div className="shrink-0 border-t p-2 text-center" style={{ ...surface.card, borderColor: "var(--item-border)" }}>
              <p className="mb-1 text-[10px] text-[var(--item-muted-text)]">
                ⚡ Бронирование и оплата — в Telegram-боте
              </p>
              <a
                href={`https://t.me/${botUsername}?start=sample`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 transition hover:opacity-70 text-[10px]"
                style={{ color: "var(--item-accent)" }}
              >
                <FileText className="h-3 w-3" />
                Образец договора
              </a>
            </div>
          )}
          <div
            className={`grid shrink-0 gap-2 border-t p-3 grid-cols-2 ${footerCols === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}
            style={{ ...surface.card, borderColor: "var(--item-border)" }}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть карточку товара"
              className="rounded-xl border-2 border-white/20 px-2.5 py-1.5 text-xs font-medium transition hover:border-white/40 hover:opacity-90 active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--item-accent)]"
              style={surface.subtleCard}
            >
              Закрыть
            </button>

            {/* Rent CTA — in TG: add to cart. In browser: deep-link to TG bot. */}
            {showRentCta && (
              isInTelegram ? (
                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={isAdding}
                  aria-busy={isAdding}
                  aria-label="Забронировать аренду"
                  className="rounded-xl border-2 border-[var(--item-accent)] bg-[var(--item-accent)] px-2.5 py-1.5 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--item-accent-contrast)] transition hover:brightness-110 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--item-accent)]"
                >
                  {rentCtaLabel}
                </button>
              ) : (
                <a
                  href={buildStartappLink("rental") || `https://t.me/${botUsername}/app`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackContinueInTgLead("rental")}
                  aria-label="Продолжить бронирование в Telegram"
                  className="flex items-center justify-center gap-1 rounded-xl border-2 border-[var(--item-accent)] bg-[var(--item-accent)] px-2.5 py-1.5 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--item-accent-contrast)] transition hover:brightness-110 active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--item-accent)]"
                >
                  {rentCtaLabel}
                </a>
              )
            )}

            {/* Buy CTA — same dual mode */}
            {showBuyCta && (
              isInTelegram ? (
                <button
                  type="button"
                  onClick={handleBuyItem}
                  disabled={isBuying}
                  aria-busy={isBuying}
                  aria-label="Купить"
                  className={`rounded-xl border-2 px-2.5 py-1.5 text-xs font-semibold uppercase tracking-[0.06em] transition hover:brightness-110 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--item-accent)] ${
                    showRentCta
                      ? "border-[var(--item-accent)] text-[var(--item-accent)] hover:bg-[var(--item-accent)] hover:text-[var(--item-accent-contrast)]"
                      : "border-[var(--item-accent)] bg-[var(--item-accent)] text-[var(--item-accent-contrast)]"
                  }`}
                >
                  {buyCtaLabel}
                </button>
              ) : (
                <a
                  href={buildStartappLink("sale") || `https://t.me/${botUsername}/app`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackContinueInTgLead("sale")}
                  aria-label="Продолжить покупку в Telegram"
                  className={`flex items-center justify-center gap-1 rounded-xl border-2 px-2.5 py-1.5 text-xs font-semibold uppercase tracking-[0.06em] transition hover:brightness-110 active:scale-[0.99] ${
                    showRentCta
                      ? "border-[var(--item-accent)] text-[var(--item-accent)] hover:bg-[var(--item-accent)] hover:text-[var(--item-accent-contrast)]"
                      : "border-[var(--item-accent)] bg-[var(--item-accent)] text-[var(--item-accent-contrast)]"
                  }`}
                >
                  {buyCtaLabel}
                </a>
              )
            )}

            {/* Fallback CTA — when neither rent nor sale is flagged */}
            {!showRentCta && !showBuyCta && (
              isInTelegram ? (
                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={isAdding}
                  aria-busy={isAdding}
                  className="rounded-xl border-2 border-[var(--item-accent)] bg-[var(--item-accent)] px-2.5 py-1.5 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--item-accent-contrast)] transition hover:brightness-110 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--item-accent)]"
                >
                  {singleCtaLabel}
                </button>
              ) : (
                <a
                  href={`https://t.me/${botUsername}/app`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1 rounded-xl border-2 border-[var(--item-accent)] bg-[var(--item-accent)] px-2.5 py-1.5 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--item-accent-contrast)] transition hover:brightness-110 active:scale-[0.99]"
                >
                  {singleCtaLabel}
                </a>
              )
            )}
          </div>

          {/* Callback form — shown when user toggles it OR always in browser mode */}
          {showCallbackForm && (
            <CallbackRequestForm
              bikeTitle={item.title}
              accentColor="var(--item-accent)"
              onSubmit={handleCallbackSubmit}
            />
          )}
        </div>
      </div>
    </div>
  );
}