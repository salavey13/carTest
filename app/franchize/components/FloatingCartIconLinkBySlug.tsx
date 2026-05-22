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
  const itemCount = cartState.itemCount;

  // Derive subtotal from cart lines — useFranchizeCart does not expose .subtotal directly.
  // The hook returns a lines/items array with per-line price and quantity info.
  const cartLines: Array<{ price?: number; total?: number; quantity?: number }> =
    (cartState as Record<string, unknown>).lines ?? (cartState as Record<string, unknown>).items ?? [];
  const subtotal = Array.isArray(cartLines)
    ? cartLines.reduce((sum: number, line) => {
        const lineTotal = line.total ?? (line.price ?? 0) * (line.quantity ?? 1);
        return sum + lineTotal;
      }, 0)
    : 0;

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
