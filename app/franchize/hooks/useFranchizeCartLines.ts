"use client";

import { useMemo } from "react";
import type { CatalogItemVM } from "../actions";
import { useFranchizeCart } from "./useFranchizeCart";

const packageMultiplier: Record<string, number> = {
  base: 1,
  pro: 1.18,
  ultra: 1.35,
};

const durationMultiplier: Record<string, number> = {
  "1 day": 1,
  "3 days": 2.8,
  "7 days": 6.2,
};

const perkSurcharge: Record<string, number> = {
  "стандарт": 0,
  "шлем+gopro": 850,
  "full gear": 1800,
};

export type FranchizeCartLineVM = {
  lineId: string;
  itemId: string;
  qty: number;
  item: CatalogItemVM | null;
  pricePerDay: number;
  lineTotal: number;
  options: {
    package: string;
    duration: string;
    perk: string;
    auction: string;
  };
};

export function useFranchizeCartLines(slug: string, items: CatalogItemVM[]) {
  const { cart, changeLineQty, removeLine, itemCount } = useFranchizeCart(slug);

  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  const cartLines = useMemo<FranchizeCartLineVM[]>(() => {
    return Object.entries(cart)
      .filter(([, line]) => line.qty > 0)
      .map(([lineId, line]) => {
        const item = itemById.get(line.itemId) ?? null;
        const pricePerDay = item?.pricePerDay ?? 0;
        const packageFactor = packageMultiplier[line.options.package.toLowerCase()] ?? 1;
        const durationFactor = durationMultiplier[line.options.duration.toLowerCase()] ?? 1;
        const perkFee = perkSurcharge[line.options.perk.toLowerCase()] ?? 0;
        const effectiveUnitPrice = Math.round(pricePerDay * packageFactor * durationFactor + perkFee);

        return {
          lineId,
          itemId: line.itemId,
          qty: line.qty,
          item,
          pricePerDay: effectiveUnitPrice,
          lineTotal: effectiveUnitPrice * line.qty,
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
