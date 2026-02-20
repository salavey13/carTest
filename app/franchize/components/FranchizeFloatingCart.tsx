"use client";

import type { CatalogItemVM } from "../actions";
import { FloatingCartIconLinkBySlug } from "./FloatingCartIconLinkBySlug";

interface FranchizeFloatingCartProps {
  slug: string;
  href: string;
  items: CatalogItemVM[];
  accentColor: string;
  textColor: string;
  borderColor: string;
}

export function FranchizeFloatingCart({ slug, href, items, accentColor, textColor, borderColor }: FranchizeFloatingCartProps) {
  return (
    <FloatingCartIconLinkBySlug
      slug={slug}
      href={href}
      items={items}
      accentColor={accentColor}
      textColor={textColor}
      borderColor={borderColor}
    />
  );
}
