"use client";

import { useMemo } from "react";
import type { CatalogItemVM } from "../actions";
import { useFranchizeCart } from "./useFranchizeCart";

export type FranchizeCartLineVM = {
  itemId: string;
  qty: number;
  item: CatalogItemVM | null;
  pricePerDay: number;
  lineTotal: number;
};

export function useFranchizeCartLines(slug: string, items: CatalogItemVM[]) {
  const { cart, changeItemQty, removeItem, itemCount } = useFranchizeCart(slug);

  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  const cartLines = useMemo<FranchizeCartLineVM[]>(() => {
    return Object.entries(cart)
      .filter(([, qty]) => qty > 0)
      .map(([itemId, qty]) => {
        const item = itemById.get(itemId) ?? null;
        const pricePerDay = item?.pricePerDay ?? 0;

        return {
          itemId,
          qty,
          item,
          pricePerDay,
          lineTotal: pricePerDay * qty,
        };
      });
  }, [cart, itemById]);

  const subtotal = useMemo(() => cartLines.reduce((sum, line) => sum + line.lineTotal, 0), [cartLines]);

  return {
    cartLines,
    subtotal,
    itemCount,
    changeItemQty,
    removeItem,
  };
}
