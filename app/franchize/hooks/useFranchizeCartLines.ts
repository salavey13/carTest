"use client";

import { useMemo } from "react";
import type { FranchizeCartState } from "./useFranchizeCart";
import type { CatalogItemVM } from "../actions";
import { useFranchizeCart } from "./useFranchizeCart";
import { hasServicePrice } from "../lib/catalog-utils";

const packageMultiplier: Record<string, number> = {
  base: 1,
  "базовый": 1,
  pro: 1.18,
  "комфорт": 1.18,
  ultra: 1.35,
  "максимум": 1.35,
};

const durationDiscountMultiplierByDays: Record<number, number> = {
  1: 1,
  3: 0.93,
  7: 0.89,
};

const perkSurcharge: Record<string, number> = {
  "стандарт": 0,
  "шлем+gopro": 850,
  "шлем + gopro": 850,
  "полный комплект": 1800,
  "full gear": 1800,
};



function resolveSalePrice(item: CatalogItemVM | null): number {
  if (!item) return 0;
  const specs = item.rawSpecs ?? {};
  const raw = Number(
    specs.price_rub ?? specs.sale_price ?? specs.purchase_price ?? specs.total_price ?? specs.price ?? 0,
  );
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return Math.round(raw);
}

function isBuyFlow(options: { package: string; duration: string; perk: string; auction: string; action?: string; buyConfigId?: string; buyPriceDelta?: number }): boolean {
  if (options.action === "buy") return true;
  if (typeof options.buyConfigId === "string" && options.buyConfigId.trim().length > 0) return true;
  if (typeof options.buyPriceDelta === "number" && options.buyPriceDelta > 0) return true;

  const duration = String(options.duration ?? "").trim().toLowerCase();
  const auction = String(options.auction ?? "").trim().toLowerCase();
  return duration === "покупка" || duration === "buy" || auction === "покупка" || auction === "buy";
}
function parseDurationDays(rawDuration: string): number {
  const normalized = rawDuration.toLowerCase();
  const numericMatch = normalized.match(/\d+/);
  const days = numericMatch ? Number(numericMatch[0]) : 1;
  if (!Number.isFinite(days) || days <= 0) {
    return 1;
  }
  return days;
}

// Parse helmet count from perk string (e.g., "шлем×2" → 2, "стандарт" → 0)
function parseHelmetCount(perk: string): number {
  const match = perk.match(/шлем×(\d+)/i);
  if (!match) return 0;
  const count = Number(match[1]);
  return Math.max(0, Math.min(2, Number.isFinite(count) ? count : 0));
}


export type CartFlowType = "rental" | "sale" | "service";

export type FranchizeCartLineVM = {
  lineId: string;
  itemId: string;
  qty: number;
  item: CatalogItemVM | null;
  pricePerDay: number;
  lineTotal: number;
  rentalDays: number;
  saleAvailable: boolean;
  /** Resolved sale price from rawSpecs — null if item has no sale price or item is null */
  salePrice: number | null;
  /** Per-line flow type: "sale" when in buy flow with valid sale price, "rental" otherwise */
  flowType: CartFlowType;
  /** Human-readable price label for display: rental → "X ₽ / день", sale → "Покупка: X ₽" */
  displayPriceLabel: string;
  /** Price breakdown from shared calculator (for passing to contract builder) */
  priceBreakdown?: {
    totalRub: number;
    basePriceRub: number;
    helmetRub: number;
    depositRub: number;
    savingsRub: number;
    savingsPercent: number;
    tier: string;
  };
  options: {
    package: string;
    duration: string;
    perk: string;
    auction: string;
    rentStartDate?: string;
    rentEndDate?: string;
    rentStartTime?: string;
    rentEndTime?: string;
  };
  /** Human-readable rental length, e.g. "3 часа" or "1 день". */
  rentalPeriod?: string;
};

export function useFranchizeCartLines(
  slug: string,
  items: CatalogItemVM[],
  externalCart?: {
    cart: FranchizeCartState;
    itemCount: number;
    changeLineQty: (lineId: string, delta: number) => void;
    removeLine: (lineId: string) => void;
  },
) {
  const internalCart = useFranchizeCart(slug);
  const { cart, changeLineQty, removeLine, itemCount } = externalCart ?? internalCart;

  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  const cartLines = useMemo<FranchizeCartLineVM[]>(() => {
    return Object.entries(cart)
      .filter(([, line]) => line.qty > 0)
      .map(([lineId, line]) => {
        const item = itemById.get(line.itemId) ?? null;
        const inBuyFlow = isBuyFlow(line.options);
        const resolvedSalePrice = resolveSalePrice(item);
        const hasSalePrice = inBuyFlow && resolvedSalePrice > 0;

        if (hasSalePrice) {
          const buyDelta = Math.max(0, line.options.buyPriceDelta ?? 0);
          const effectiveSalePrice = resolvedSalePrice + buyDelta;
          return {
            lineId,
            itemId: line.itemId,
            qty: line.qty,
            item,
            pricePerDay: effectiveSalePrice,
            lineTotal: effectiveSalePrice * line.qty,
            rentalDays: 1,
            saleAvailable: Boolean(item?.saleAvailable),
            salePrice: effectiveSalePrice,
            flowType: "sale" as const,
            displayPriceLabel: `Покупка: ${effectiveSalePrice.toLocaleString("ru-RU")} ₽`,
            options: line.options,
          };
        }

        // ── Testdrive flow: flat 0 ₽ (test is free, only deposit is held) ──
      const isTestdrive = line.options.action === "testdrive" || (line.options as any).duration === "10 минут";
      if (isTestdrive) {
        return {
          lineId,
          itemId: line.itemId,
          qty: line.qty,
          item,
          pricePerDay: 0,
          lineTotal: 0,
          rentalDays: 1,
          saleAvailable: false,
          salePrice: null,
          flowType: "rental" as const,
          displayPriceLabel: "Тест-драйв · 0 ₽ (только залог)",
          rentalPeriod: "10 минут",
          options: line.options,
        };
      }

      // ── Service flow: flat price from item specs / rentPriceLabel ──
      const isServiceAction = line.options.action === "service" || (item && hasServicePrice(item));
      if (isServiceAction) {
        // Resolve service price: try rawSpecs.service_price, then rentPriceLabel, fallback 0
        const servicePrice = resolveSalePrice(item); // reuse — reads first numeric price
        const unitPrice = servicePrice > 0 ? servicePrice : 0;
        // RentPriceLabel may contain formatted price text (e.g. "2 000 ₽")
        // but we prefer a clean numeric display
        const displayLabel = unitPrice > 0
          ? `${unitPrice.toLocaleString("ru-RU")} ₽`
          : (item?.rentPriceLabel ?? "0 ₽");
        return {
          lineId,
          itemId: line.itemId,
          qty: line.qty,
          item,
          pricePerDay: unitPrice,
          lineTotal: unitPrice * line.qty,
          rentalDays: 1,
          saleAvailable: false,
          salePrice: null,
          flowType: "service" as const,
          displayPriceLabel: displayLabel,
          rentalPeriod: undefined,
          options: line.options,
        };
      }

      const basePricePerDay = item?.pricePerDay ?? 0;
        // Prefer real date arithmetic when the user picked explicit
        // YYYY-MM-DD dates — this matches the selected period exactly
        // instead of relying on the duration dropdown's coarse bucket
        // (1/3/7 days). Falls back to the duration string otherwise.
        const dateRangeDays =
          line.options.rentStartDate && line.options.rentEndDate
            ? (() => {
                try {
                  const { durationDaysFromDateTime } = require("@/app/franchize/lib/date-utils");
                  return durationDaysFromDateTime(
                    line.options.rentStartDate,
                    line.options.rentStartTime || "10:00",
                    line.options.rentEndDate,
                    line.options.rentEndTime || "10:00",
                  );
                } catch {
                  return parseDurationDays(line.options.duration);
                }
              })()
            : parseDurationDays(line.options.duration);
        // `rentalDays` is now the *calendar* day count (1 for same-day,
        // 2 for a 1-day rental, etc.). It is NO LONGER used to compute
        // the line price — that comes from the shared pricing
        // calculator which understands hour tiers (3h / 6h / 12h).
        // Keeping it as calendar days lets the cart and order page
        // still display "1 день" / "3 дня" / "2 недели" as a
        // human-readable rental length, but the actual charge is
        // hour-aware.
        const rentalDays = dateRangeDays;
        const packageFactor = packageMultiplier[line.options.package.toLowerCase()] ?? 1;
        const durationDiscount = durationDiscountMultiplierByDays[rentalDays] ?? 1;
        const perkFee = perkSurcharge[line.options.perk.toLowerCase()] ?? 0;
        // Legacy day-rate-based subtotal. Used as a FALLBACK only — when
        // the pricing calculator can't run (missing specs / no dates),
        // the cart falls back to this so the user still sees *some*
        // number. Once dates+time are picked, `lineTotal` below uses
        // the calculator's `totalRub` instead.
        const lineBase = basePricePerDay * packageFactor * rentalDays + perkFee;
        const discountedLineBase = Math.round(lineBase * durationDiscount);
        const effectiveUnitPrice = Math.max(0, Math.round(discountedLineBase / Math.max(1, rentalDays)));

        // FIX: Use the shared pricing calculator to compute the REAL
        // line total. Previously `lineTotal` always used the day-rate
        // formula above (`basePricePerDay * rentalDays`), which charged
        // the full day rate for a 3-hour rental. The pricing
        // calculator returns an hour-aware `totalRub` (including the
        // 3h / 6h / 12h tiers, weekend-day blending, etc.) and that's
        // what now drives the cart subtotal + order total.
        let priceBreakdown: FranchizeCartLineVM["priceBreakdown"] = undefined;
        let lineTotal = discountedLineBase * line.qty;
        // Human-readable period string for the cart and order summary,
        // e.g. "3 часа" / "12 часов" / "1 день" / "3 дня". We derive it
        // from the calculator's `breakdown.period` when available,
        // otherwise fall back to a day-bucket label.
        let rentalPeriod = `${rentalDays} ${rentalDays === 1 ? "день" : rentalDays < 5 ? "дня" : "дней"}`;

        if (item?.rawSpecs && line.options.rentStartDate && line.options.rentEndDate) {
          try {
            const { calculatePrice } = require("@/lib/rental-pricing-calculator");
            const result = calculatePrice(
              item.rawSpecs,
              line.options.rentStartDate,
              line.options.rentEndDate,
              line.options.rentStartTime || "10:00",
              line.options.rentEndTime || "10:00",
              parseHelmetCount(line.options.perk)
            );
            priceBreakdown = {
              totalRub: result.totalRub,
              basePriceRub: result.basePriceRub,
              helmetRub: result.helmetRub,
              depositRub: result.depositRub,
              savingsRub: result.savingsRub,
              savingsPercent: result.savingsPercent,
              tier: result.tier,
            };
            // The line total now follows the pricing calculator, NOT
            // the day-rate × days formula. This is what makes a
            // 3-hour rental cost 3 000 ₽ instead of 12 000 ₽.
            lineTotal = result.totalRub * line.qty;
            rentalPeriod = result.breakdown.period;
          } catch {
            // Fallback to day-rate total if the calculator throws —
            // we still want the cart to show *something* rather than 0.
          }
        }

        // Build the display label. For hour rentals we say
        //   "3 часа · 3 000 ₽"
        // For multi-day rentals we say
        //   "1 день · 12 000 ₽"
        // The fallback (no dates set) keeps the catalog's static
        // "X ₽ / день" label so empty carts still look sensible.
        const displayPriceLabel = priceBreakdown
          ? `${rentalPeriod} · ${lineTotal.toLocaleString("ru-RU")} ₽`
          : (item?.rentPriceLabel ?? `${effectiveUnitPrice.toLocaleString("ru-RU")} ₽ / день`);

        return {
          lineId,
          itemId: line.itemId,
          qty: line.qty,
          item,
          // `pricePerDay` is kept for backward compatibility with the
          // cart card's "Цена за 1 день" label. For hour rentals it
          // is 0 so we know to show the per-hour price instead.
          pricePerDay: priceBreakdown?.tier && /hour/.test(priceBreakdown.tier) ? 0 : effectiveUnitPrice,
          lineTotal,
          rentalDays,
          rentalPeriod,
          saleAvailable: Boolean(item?.saleAvailable),
          salePrice: null,
          flowType: "rental" as const,
          displayPriceLabel,
          priceBreakdown,
          options: line.options,
        };
      });
  }, [cart, itemById]);

  const subtotal = useMemo(() => cartLines.reduce((sum, line) => sum + line.lineTotal, 0), [cartLines]);

  return {
    cartLines,
    subtotal,
    itemCount,
    changeLineQty,
    removeLine,
  };
}
