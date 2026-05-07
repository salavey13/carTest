"use client";

import type { CatalogItemVM, FranchizeTheme } from "../actions";
import { useFranchizeCartLines } from "../hooks/useFranchizeCartLines";
import { floatingCartOverlayBackground } from "../lib/theme";
import { FloatingCartIconLink } from "./FloatingCartIconLink";

interface FloatingCartIconLinkBySlugProps {
  slug: string;
  href: string;
  items: CatalogItemVM[];
  accentColor: string;
  textColor: string;
  borderColor: string;
  theme: FranchizeTheme;
  className?: string;
}

export function FloatingCartIconLinkBySlug({ slug, href, items, accentColor, textColor, borderColor, theme, className }: FloatingCartIconLinkBySlugProps) {
  const { itemCount, subtotal } = useFranchizeCartLines(slug, items);

  return (
    <FloatingCartIconLink
      href={href}
      itemCount={itemCount}
      totalPrice={subtotal}
      accentColor={accentColor}
      textColor={textColor}
      borderColor={borderColor}
      backgroundColor={floatingCartOverlayBackground(theme)}
      className={className}
    />
  );
}
