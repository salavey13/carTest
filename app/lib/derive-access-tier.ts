/**
 * VIP Bike Rental — Derive Access Tier from Driver's License Category
 *
 * Pure utility: maps Russian driver's license categories → access tier.
 * No side effects, no database calls. Reusable across API routes, bot commands, and UI.
 *
 * Tier hierarchy:  entry < mid < pro
 *   - entry:  Falcon GT, Falcon Pro, Ducati Panigale S (49cc / M-category electric)
 *   - mid:    + HORWIN SK3 Plus (125cc / A1+B)
 *   - pro:    + Sequence Zero, Y-VOLT, Kawasaki EX650K (A-category, high-power electric/ICE)
 */

import { LICENSE_CATEGORY_TIER_MAP, type AccessTier } from "./ocr-constants";

const TIER_PRIORITY: Record<AccessTier, number> = {
  none: 0,
  entry: 1,
  mid: 2,
  pro: 3,
};

/**
 * Derive a single access tier from an array of license categories.
 * Returns the HIGHEST tier that any category grants.
 *
 * Example:
 *   deriveUserAccessTier(["M", "B"])  → "mid"   (M→entry, B→mid → max=mid)
 *   deriveUserAccessTier(["A"])       → "pro"   (A→pro)
 *   deriveUserAccessTier(["M"])       → "entry" (M→entry)
 *   deriveUserAccessTier([])          → "none"  (no categories)
 */
export function deriveUserAccessTier(categories: string[]): AccessTier {
  if (!categories || categories.length === 0) return "none";

  let maxTier: AccessTier = "none";
  for (const raw of categories) {
    // Normalize: uppercase, trim, remove digits that aren't part of known categories
    const cat = raw.trim().toUpperCase();

    // Try exact match first (A, A1, B, B1, M, etc.)
    const tier = LICENSE_CATEGORY_TIER_MAP[cat];
    if (tier && TIER_PRIORITY[tier] > TIER_PRIORITY[maxTier]) {
      maxTier = tier;
    }
  }

  return maxTier;
}

/**
 * Check whether a user's tier grants access to a bike's required tier.
 *
 * Example:
 *   canAccessTier("mid", "entry")  → true   (mid ≥ entry)
 *   canAccessTier("entry", "pro")  → false  (entry < pro)
 *   canAccessTier("pro", "pro")    → true   (pro ≥ pro)
 */
export function canAccessTier(userTier: AccessTier, requiredTier: AccessTier): boolean {
  return TIER_PRIORITY[userTier] >= TIER_PRIORITY[requiredTier];
}

/**
 * Derive access tier from a single license class string (as found in bike specs).
 * Handles Russian text like "М (49 сс)", "125 сс (A1/B)", "А (электро 30 кВт)".
 *
 * Extracts all category letters found in the string and returns the highest tier.
 */
export function deriveAccessTierFromLicenseClass(licenseClassStr: string): AccessTier {
  if (!licenseClassStr) return "none";

  // Extract category-like tokens: standalone A, A1, B, B1, M, etc.
  const categoryPattern = /\b(A1?|B1?|C1?|D1?|M|Tm|Tb)\b/gi;
  const categories: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = categoryPattern.exec(licenseClassStr)) !== null) {
    categories.push(match[1]);
  }

  // Special case: if the string mentions "49 сс" or "49сс" without categories → M
  if (categories.length === 0 && /49\s*сс/i.test(licenseClassStr)) {
    categories.push("M");
  }

  return deriveUserAccessTier(categories);
}

/**
 * Get a human-readable Russian label for an access tier.
 */
export function getAccessTierLabel(tier: AccessTier): string {
  switch (tier) {
    case "entry": return "Базовый";
    case "mid":   return "Средний";
    case "pro":   return "Профессиональный";
    case "none":  return "Без допуска";
  }
}

/**
 * Get a description of which bike categories are accessible at this tier.
 */
export function getAccessTierDescription(tier: AccessTier): string {
  switch (tier) {
    case "entry": return "Электроскутеры до 50 сс эквивалент (категория М)";
    case "mid":   return "Скутеры до 125 сс, электроэндуро до 11 кВт (категории A1, B)";
    case "pro":   return "Все мотоциклы без ограничений (категория A)";
    case "none":  return "Требуется verification водительского удостоверения";
  }
}

export { TIER_PRIORITY };
