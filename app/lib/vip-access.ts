/**
 * VIP Bike Rental — VIP Access Tier Resolution
 *
 * Determines a user's access tier from their verified rental secrets.
 * Used in the rental flow to check if a user can rent a given bike.
 *
 * Depends on:
 *   - `app/lib/user-rental-secrets.ts` — getUserRentalSecrets
 *   - `lib/derive-access-tier.ts` — deriveUserAccessTier, canAccessTier, deriveAccessTier
 */

import { getUserRentalSecrets } from "@/app/lib/user-rental-secrets";
import {
  deriveUserAccessTier,
  canAccessTier,
  deriveAccessTier,
  tierRequiredLicenseLabel,
  type AccessTier,
} from "@/lib/derive-access-tier";

/**
 * Resolves the current user's access tier by looking up their verified
 * rental secrets and extracting driver's license category info.
 *
 * Returns "entry" if no verified secrets exist (cold start — safe default).
 */
export async function getUserAccessTier(
  chatId: string,
  crewSlug: string
): Promise<AccessTier> {
  const secrets = await getUserRentalSecrets(chatId, crewSlug);
  if (!secrets) return "entry";

  // Try to extract categories from the renter_driver_license field
  // The field stores something like "99 76 543210 (кат. А, В)" or "99 76 543210"
  const licenseStr = secrets.renter_driver_license || "";
  const categories = parseLicenseCategories(licenseStr);

  return deriveUserAccessTier(categories);
}

/**
 * Parses license categories from the stored `renter_driver_license` string.
 *
 * Expected formats:
 * - "99 76 543210 (кат. А, В)"  → ["А", "В"]
 * - "99 76 543210 (кат. A, B, M)" → ["A", "B", "M"]
 * - "99 76 543210"               → [] (no categories found)
 */
export function parseLicenseCategories(licenseStr: string): string[] {
  if (!licenseStr || typeof licenseStr !== "string") return [];

  // Try to extract "кат. А, В" or "кат.A, B, M" pattern from the string
  const catMatch = licenseStr.match(
    /кат\.?\s*([АA0-9ВBМMСC,\s]+)/i
  );
  if (catMatch) {
    return catMatch[1]
      .split(/[,\s]+/)
      .filter(Boolean)
      .map((c) => c.toUpperCase());
  }

  // If no "кат." pattern found, return empty (entry tier)
  return [];
}

/**
 * Checks whether a user can rent a specific bike based on their access tier.
 *
 * @param userTier - The user's derived access tier
 * @param bikeSpecs - The bike's specs object (must contain `access_tier` or `license_class`)
 * @returns `{ allowed: boolean; message?: string }` — if not allowed, message explains why
 */
export function checkBikeAccess(
  userTier: AccessTier,
  bikeSpecs: { access_tier?: string; license_class?: string }
): { allowed: boolean; message?: string } {
  const bikeTier: AccessTier =
    (bikeSpecs.access_tier as AccessTier) ||
    deriveAccessTier(bikeSpecs.license_class || "");

  if (canAccessTier(userTier, bikeTier)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    message: `Для аренды этого мотоцикла необходимы права ${tierRequiredLicenseLabel(bikeTier)}. Ваши документы позволяют аренду до уровня ${tierRequiredLicenseLabel(userTier)}.`,
  };
}
