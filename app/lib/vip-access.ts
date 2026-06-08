/**
 * VIP Bike Rental — VIP Access Check Module
 *
 * Server-side module that determines a user's access tier
 * by querying their rental secrets (verified doc data).
 *
 * Uses supabaseAdmin + private schema — server-only.
 */

import "server-only";
import { supabaseAdmin } from "@/lib/supabase-server";
import { deriveUserAccessTier, canAccessTier, type AccessTier } from "./derive-access-tier";
import { logger } from "@/lib/logger";

export interface VipAccessInfo {
  tier: AccessTier;
  categories: string[];
  source: "license_ocr" | "manual" | "none";
  verifiedAt: string | null;
  docSha256: string | null;
}

/**
 * Get a user's VIP access info based on their verified rental secrets.
 * Looks up the most recent verified license data from user_rental_secrets.
 *
 * The license data includes a `renter_driver_license` field which may contain
 * category information if it was OCR'd. For now we derive categories from
 * the driver_license string pattern or from OCR metadata.
 */
export async function getUserVipAccess(
  chatId: string,
  crewSlug: string,
): Promise<VipAccessInfo> {
  try {
    const { data, error } = await supabaseAdmin
      .schema("private")
      .from("user_rental_secrets")
      .select("renter_driver_license, verification_status, created_at, doc_sha256")
      .eq("chat_id", chatId)
      .eq("crew_slug", crewSlug)
      .eq("verification_status", "verified")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      logger.warn("[vip-access] failed to query user_rental_secrets", {
        chatId,
        crewSlug,
        error: error.message,
      });
      return { tier: "none", categories: [], source: "none", verifiedAt: null, docSha256: null };
    }

    if (!data) {
      return { tier: "none", categories: [], source: "none", verifiedAt: null, docSha256: null };
    }

    // Extract categories from the driver_license string
    // Format examples: "1234 567890", "А 1234 567890", or just "567890"
    // Categories are stored in a separate metadata path — for now, derive from OCR
    const categories = extractCategoriesFromLicense(data.renter_driver_license);
    const tier = deriveUserAccessTier(categories);

    return {
      tier,
      categories,
      source: categories.length > 0 ? "license_ocr" : "manual",
      verifiedAt: data.created_at,
      docSha256: data.doc_sha256,
    };
  } catch (error) {
    logger.error("[vip-access] unexpected error", {
      chatId,
      crewSlug,
      error: error instanceof Error ? error.message : String(error),
    });
    return { tier: "none", categories: [], source: "none", verifiedAt: null, docSha256: null };
  }
}

/**
 * Check whether a user can access a specific bike based on the bike's required tier.
 *
 * @param userChatId - Telegram chat_id of the user
 * @param crewSlug   - Franchise slug for crew-scoped lookup
 * @param requiredTier - The bike's minimum access tier (from specs.access_tier)
 */
export async function checkUserCanAccessBike(
  userChatId: string,
  crewSlug: string,
  requiredTier: AccessTier,
): Promise<boolean> {
  const accessInfo = await getUserVipAccess(userChatId, crewSlug);
  return canAccessTier(accessInfo.tier, requiredTier);
}

/**
 * Extract category letters from a driver license string.
 * Russian driver license format: "СССС НННННН" where С=series (4 digits), Н=number (6 digits).
 * Categories are NOT part of the license number — they appear separately on the card.
 *
 * For now, this is a best-effort extraction. When OCR pipeline stores categories
 * explicitly (via /api/ocr returning LicenseOcrResult), we'll read from there.
 */
function extractCategoriesFromLicense(licenseStr: string | null): string[] {
  if (!licenseStr) return [];

  // Check if categories are embedded in the string somehow
  // Pattern: "A" or "A, B, M" or "категории: A B M" embedded in the field
  const categoryPattern = /\b(A1?|B1?|C1?|D1?|M|Tm|Tb)\b/gi;
  const categories: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = categoryPattern.exec(licenseStr)) !== null) {
    // Filter out false positives: "A" in the middle of Cyrillic text
    // Only accept if preceded by space, comma, or start of string
    const idx = match.index;
    if (idx === 0 || /[\s,/.]/.test(licenseStr[idx - 1])) {
      categories.push(match[1].toUpperCase());
    }
  }

  return categories;
}
