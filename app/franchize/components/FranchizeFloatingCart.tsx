"use client";

import type { CatalogItemVM, FranchizeTheme } from "../actions";
import { FloatingCartIconLinkBySlug } from "./FloatingCartIconLinkBySlug";

interface FranchizeFloatingCartProps {
  slug: string;
  href: string;
  items: CatalogItemVM[];
  accentColor: string;
  textColor: string;
  borderColor: string;
  theme: FranchizeTheme;
}

export function FranchizeFloatingCart({ slug, href, items, accentColor, textColor, borderColor, theme }: FranchizeFloatingCartProps) {
  return (
    <FloatingCartIconLinkBySlug
      slug={slug}
      href={href}
      items={items}
      accentColor={accentColor}
      textColor={textColor}
      borderColor={borderColor}
      theme={theme}
    />
  );
}
