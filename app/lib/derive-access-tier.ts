/**
 * VIP Bike Rental — Access Tier Derivation
 *
 * Derives a bike's access tier from its `specs.license_class` field,
 * and a user's access tier from their verified driver's license categories.
 *
 * Tier definitions (based on Russian driver's license categories):
 * - "entry": Category M/М1 — moped-class, no motorcycle license needed.
 *   Car license (B) sufficient or no license at all for electric under 4 kW nominal.
 * - "mid": Category A1/B — 125cc equivalent, limited power.
 *   Requires A1 or B-category license with motorcycle confirmation.
 * - "pro": Category A — full motorcycle license required.
 *   ICE or high-power electric (30+ kW).
 *
 * Trickle-down: Pro users can rent Mid + Entry, Mid users can rent Entry + Mid.
 * Entry users can only rent Entry bikes.
 */

export type AccessTier = "entry" | "mid" | "pro";

const TIER_LEVEL: Record<AccessTier, number> = { entry: 1, mid: 2, pro: 3 };

/**
 * Derives a bike's access tier from its `specs.license_class` string.
 *
 * The `license_class` field in the gold seed is human-readable Russian text,
 * e.g. "М (49 сс), подходят права В или А1" or "А (электро 30 кВт, экв. 125 сс+)".
 *
 * Mapping logic:
 * - "А " or "А/" at start → Pro  (full motorcycle category A)
 * - Contains "A1" or "125 сс"   → Mid  (125cc equivalent)
 * - Everything else              → Entry (moped-class)
 */
export function deriveAccessTier(licenseClass: string): AccessTier {
  if (!licenseClass || typeof licenseClass !== "string") return "entry";

  const lc = licenseClass.toUpperCase();

  // Pro: starts with Russian "А " or "А/" (А = Cyrillic category A motorcycle)
  // Matches: "А (электро 30 кВт...)", "А / L3"
  // Also handles Latin "A" just in case
  if (/^[АA]\s*[\/(]/.test(lc) || /^[АA]$/.test(lc.trim())) return "pro";

  // Mid: contains A1 or "125 СС" pattern
  // Matches: "125 сс (A1 / B)"
  if (/A1/.test(lc) || /125\s*СС/.test(lc)) return "mid";

  // Entry: everything else (М category, moped-class)
  // Matches: "М (49 сс)", "М (49 сс), подходят права В или А1"
  return "entry";
}

/**
 * Returns the access tier for a user based on their verified driver's license categories.
 * The highest category determines the tier: A > A1/B > M > none.
 *
 * @param categories - Array of license categories, e.g. ["A", "B", "M"]
 *   These come from OCR'd driver's license: `renter_driver_license` parsed or
 *   stored explicitly in `user_secrets.sensitive_metadata.license_categories`.
 */
export function deriveUserAccessTier(categories: string[]): AccessTier {
  if (!categories || categories.length === 0) return "entry";

  const upper = categories.map((c) => c.toUpperCase().trim());

  // Pro: has category A (full motorcycle, not just A1)
  if (upper.some((c) => c === "A" || c === "А")) return "pro";

  // Mid: has A1, B, B1, or M
  if (upper.some((c) => ["A1", "B", "M", "B1", "А1", "В", "В1", "М"].includes(c)))
    return "mid";

  // Entry: only has lesser categories or none
  return "entry";
}

/**
 * Checks if a user with the given tier can access a bike with the required tier.
 * Trickle-down: Pro > Mid > Entry.
 */
export function canAccessTier(userTier: AccessTier, requiredTier: AccessTier): boolean {
  return TIER_LEVEL[userTier] >= TIER_LEVEL[requiredTier];
}

/**
 * Returns a human-readable Russian label for the tier.
 */
export function tierLabel(tier: AccessTier): string {
  switch (tier) {
    case "entry":
      return "Entry (М/М1 — скутеры и электро)";
    case "mid":
      return "Mid (A1/B — 125 сс)";
    case "pro":
      return "Pro (А — мотоциклы и мощное электро)";
  }
}

/**
 * Returns the required license category label for a tier (for error messages).
 */
export function tierRequiredLicenseLabel(tier: AccessTier): string {
  switch (tier) {
    case "entry":
      return "не требуются (достаточно паспорта)";
    case "mid":
      return "категории A1 или B";
    case "pro":
      return "категории А";
  }
}
