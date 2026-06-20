"use client";

import { useMemo } from "react";
import type { FranchizeCartState } from "./useFranchizeCart";
import type { CatalogItemVM } from "../actions";
import { useFranchizeCart } from "./useFranchizeCart";

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

function isBuyFlow(options: { package: string; duration: string; perk: string; auction: string; buyConfigId?: string; buyPriceDelta?: number }): boolean {
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


export type CartFlowType = "rental" | "sale";

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
  };
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

        const basePricePerDay = item?.pricePerDay ?? 0;
        const rentalDays = parseDurationDays(line.options.duration);
        const packageFactor = packageMultiplier[line.options.package.toLowerCase()] ?? 1;
        const durationDiscount = durationDiscountMultiplierByDays[rentalDays] ?? 1;
        const perkFee = perkSurcharge[line.options.perk.toLowerCase()] ?? 0;
        const lineBase = basePricePerDay * packageFactor * rentalDays + perkFee;
        const discountedLineBase = Math.round(lineBase * durationDiscount);
        const effectiveUnitPrice = Math.max(0, Math.round(discountedLineBase / Math.max(1, rentalDays)));

        // Calculate priceBreakdown using shared calculator (when dates are set)
        let priceBreakdown: FranchizeCartLineVM["priceBreakdown"] = undefined;
        const helmetCount = parseHelmetCount(line.options.perk);
        const helmetRub = helmetCount * 1000;

        if (item?.rawSpecs && line.options.rentStartDate && line.options.rentEndDate) {
          try {
            const { calculatePrice } = require("@/lib/rental-pricing-calculator");
            const result = calculatePrice(
              item.rawSpecs,
              line.options.rentStartDate,
              line.options.rentEndDate,
              "10:00",
              "10:00",
              helmetCount
            );
            priceBreakdown = {
              totalRub: discountedLineBase * line.qty + helmetRub,
              basePriceRub: result.basePriceRub,
              helmetRub: result.helmetRub,
              depositRub: result.depositRub,
              savingsRub: result.savingsRub,
              savingsPercent: result.savingsPercent,
              tier: result.tier,
            };
          } catch {
            // Fallback: no priceBreakdown if calculator fails
          }
        }

        return {
          lineId,
          itemId: line.itemId,
          qty: line.qty,
          item,
          pricePerDay: effectiveUnitPrice,
          lineTotal: discountedLineBase * line.qty,
          rentalDays,
          saleAvailable: Boolean(item?.saleAvailable),
          salePrice: null,
          flowType: "rental" as const,
          displayPriceLabel: item?.rentPriceLabel ?? `${effectiveUnitPrice.toLocaleString("ru-RU")} ₽ / день`,
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
