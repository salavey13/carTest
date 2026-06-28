"use client";

import { useAppContext } from "@/contexts/AppContext";
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
  className?: string;
}

export function FranchizeFloatingCart({ slug, href, items, accentColor, textColor, borderColor, theme, className }: FranchizeFloatingCartProps) {
  const { isInTelegramContext } = useAppContext();
  
  if (!isInTelegramContext) {
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
