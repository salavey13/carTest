"use client";

import { useMemo } from "react";
import type { CatalogItemVM } from "../actions";
import { useFranchizeCart } from "../hooks/useFranchizeCart";
import { FloatingCartIconLink } from "./FloatingCartIconLink";

interface FloatingCartIconLinkBySlugProps {
  slug: string;
  href: string;
  items: CatalogItemVM[];
  accentColor: string;
  textColor: string;
  borderColor: string;
}

export function FloatingCartIconLinkBySlug({ slug, href, items, accentColor, textColor, borderColor }: FloatingCartIconLinkBySlugProps) {
  const { cart } = useFranchizeCart(slug);

  const itemCount = useMemo(() => Object.values(cart).reduce((sum, qty) => sum + qty, 0), [cart]);

  const totalPrice = useMemo(() => {
    const itemsById = new Map(items.map((item) => [item.id, item]));

    return Object.entries(cart).reduce((sum, [itemId, qty]) => {
      const item = itemsById.get(itemId);
      return sum + (item ? item.pricePerDay * qty : 0);
    }, 0);
  }, [cart, items]);

  return (
    <FloatingCartIconLink
      href={href}
      itemCount={itemCount}
      totalPrice={totalPrice}
      accentColor={accentColor}
      textColor={textColor}
      borderColor={borderColor}
    />
  );
}
