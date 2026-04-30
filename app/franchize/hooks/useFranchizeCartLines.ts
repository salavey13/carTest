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

function isBuyFlow(options: { package: string; duration: string; perk: string; auction: string }): boolean {
  const normalizedValues = [options.package, options.duration, options.perk, options.auction]
    .map((value) => String(value ?? "").trim().toLowerCase());

  const buySentinels = new Set(["покупка", "buy", "flow=buy"]);
  return normalizedValues.some((value) => buySentinels.has(value));
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

export type FranchizeCartLineVM = {
  lineId: string;
  itemId: string;
  qty: number;
  item: CatalogItemVM | null;
  pricePerDay: number;
  lineTotal: number;
  rentalDays: number;
  saleAvailable: boolean;
  options: {
    package: string;
    duration: string;
    perk: string;
    auction: string;
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
        const salePrice = resolveSalePrice(item);

        if (inBuyFlow && salePrice > 0) {
          return {
            lineId,
            itemId: line.itemId,
            qty: line.qty,
            item,
            pricePerDay: salePrice,
            lineTotal: salePrice * line.qty,
            rentalDays: 1,
            saleAvailable: Boolean(item?.saleAvailable),
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

        return {
          lineId,
          itemId: line.itemId,
          qty: line.qty,
          item,
          pricePerDay: effectiveUnitPrice,
          lineTotal: discountedLineBase * line.qty,
          rentalDays,
          saleAvailable: Boolean(item?.saleAvailable),
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
