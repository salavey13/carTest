"use client";

import type { CatalogItemVM } from "../actions";
import { useFranchizeCartLines } from "../hooks/useFranchizeCartLines";
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
  const { itemCount, subtotal } = useFranchizeCartLines(slug, items);

  return (
    <FloatingCartIconLink
      href={href}
      itemCount={itemCount}
      totalPrice={subtotal}
      accentColor={accentColor}
      textColor={textColor}
      borderColor={borderColor}
    />
  );
}
