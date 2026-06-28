"use client";

import type { CatalogItemVM, FranchizeTheme } from "../actions";
import { FloatingCartIconLinkBySlug } from "./FloatingCartIconLinkBySlug";
import { SHOW_CART } from "@/lib/feature-flags";

interface FranchizeFloatingCartProps {
  slug: string;
  href: string;
  items: CatalogItemVM[];
  accentColor: string;
  textColor: string;
  borderColor: string;
  theme: FranchizeTheme;
  className?: string;
}

export function FranchizeFloatingCart({ slug, href, items, accentColor, textColor, borderColor, theme, className }: FranchizeFloatingCartProps) {
  // Build-time gate: hide on VPS (no Telegram auth → no cart state).
  // Previously this used runtime `isInTelegramContext`, which also hid the
  // cart on Vercel when opened outside Telegram WebApp (e.g. in a browser).
  // SHOW_CART already encodes the Vercel-vs-VPS distinction at build time,
  // so it is both necessary and sufficient here. Without this guard, the
  // consumer pages (contacts, buy) — whose `showFloatingCart` only checks
  // route CTA policy, not SHOW_CART — would render the cart on VPS.
  if (!SHOW_CART) {
    return null;
  }

  return (
    <FloatingCartIconLinkBySlug
      slug={slug}
      href={href}
      items={items}
      accentColor={accentColor}
      textColor={textColor}
      borderColor={borderColor}
      theme={theme}
      className={className}
    />
  );
}
