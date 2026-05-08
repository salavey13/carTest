import { DEFAULT_FRANCHIZE_THEME, type FranchizeTheme } from "@/lib/franchize-config";

export const EARLY_FRANCHIZE_THEME_HINTS = {
  "vip-bike": DEFAULT_FRANCHIZE_THEME,
} satisfies Record<string, FranchizeTheme>;

export function getEarlyFranchizeThemeHint(slug: string): FranchizeTheme {
  const normalizedSlug = slug.trim().toLowerCase();

  return EARLY_FRANCHIZE_THEME_HINTS[normalizedSlug as keyof typeof EARLY_FRANCHIZE_THEME_HINTS] ?? DEFAULT_FRANCHIZE_THEME;
}
