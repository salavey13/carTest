"use client";

import type { CatalogItemVM } from "../actions";
import { useFranchizeCart } from "../hooks/useFranchizeCart";
import { FloatingCartIconLink } from "./FloatingCartIconLink";

interface FranchizeFloatingCartProps {
  slug: string;
  href: string;
  items: CatalogItemVM[];
  accentColor: string;
  textColor: string;
  borderColor: string;
}

export function FranchizeFloatingCart({ slug, href, items, accentColor, textColor, borderColor }: FranchizeFloatingCartProps) {
  const { cart } = useFranchizeCart(slug);

  const itemCount = Object.values(cart).reduce((sum, qty) => sum + qty, 0);
  const totalPrice = Object.entries(cart).reduce((sum, [itemId, qty]) => {
    const item = items.find((candidate) => candidate.id === itemId);
    return sum + (item ? item.pricePerDay * qty : 0);
  }, 0);

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
