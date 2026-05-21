"use client";

import type { CatalogItemVM, FranchizeTheme } from "../actions";
import { useFranchizeCart } from "../hooks/useFranchizeCart";
import { floatingCartOverlayBackground } from "../lib/theme";
import { FloatingCartIconLink } from "./FloatingCartIconLink";

interface FloatingCartIconLinkBySlugProps {
  slug: string;
  href: string;
  items?: CatalogItemVM[];
  accentColor: string;
  textColor: string;
  borderColor: string;
  theme: FranchizeTheme;
  className?: string;
  mode?: "floating" | "inline-icon";
}

export function FloatingCartIconLinkBySlug({ slug, href, items, accentColor, textColor, borderColor, theme, className, mode }: FloatingCartIconLinkBySlugProps) {
  const cartState = useFranchizeCart(slug);
  const subtotal = 0;
  const itemCount = cartState.itemCount;

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
      mode={mode}
    />
  );
}
