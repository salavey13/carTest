// /app/franchize/lib/lifecycle-messaging.ts
"use server";

import { supabaseAdmin } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";
import { sendComplexMessage } from "@/app/webhook-handlers/actions/sendComplexMessage";

/**
 * Send a post-rental review request to the renter via Telegram.
 *
 * Called from BOTH rental closure paths:
 *   - Path A: confirmVehicleReturn() in app/rentals/actions.ts
 *   - Path B: updateRentalStatus() in app/franchize/server-actions/rentals-dashboard.ts
 *
 * Conditions (all must be true):
 *   - LIFECYCLE_MESSAGING_ENABLED env var is not 'false' (kill switch)
 *   - rental.user_id is set (renter linked via QR claim or web checkout)
 *   - rental.user_id is NOT a crew member (skip operator test-rentals)
 *   - FranchizeNotificationPreferences.reviewRequests is not false (opt-out)
 *   - rental.metadata.review_request_sent is not set (dedup — 1 per rental)
 *
 * Failure handling:
 *   - Logs the error
 *   - Writes succeeded:false + error to rental.metadata.review_request_sent
 *   - Does NOT retry (visible for manual review)
 *   - Does NOT block the closure receipt (separate sendComplexMessage call)
 *
 * Per PRD v0.4 §4 — see docs/PRD_LIFECYCLE_MESSAGING.md
 */

interface ReviewNudgeRental {
  rental_id: string;
  user_id: string | null;
  crew_id: string | null;
  vehicle_id?: string | null;
  vehicle?: { make?: string | null; model?: string | null } | null;
  metadata?: Record<string, unknown> | null;
}

interface ReviewNudgeContext {
  /** The rental row (must include user_id, crew_id, vehicle) */
  rental: ReviewNudgeRental;
  /** The renter's Telegram chat_id (already resolved by the caller) */
  renterChatId: string;
}

/**
 * Check if a user is a crew member of the given crew.
 * Used to skip review requests for operator test-rentals.
 */
async function isCrewMember(userId: string, crewId: string | null): Promise<boolean> {
  if (!crewId) return false;
  try {
    const { data } = await supabaseAdmin
      .from("crew_members")
      .select("user_id")
      .eq("crew_id", crewId)
      .eq("user_id", userId)
      .maybeSingle();
    return !!data;
  } catch {
    return false;
  }
}

/**
 * Check if the renter has opted out of review request notifications.
 * Reads FranchizeNotificationPreferences from users.metadata.franchizeNotificationPreferences[slug].
 * Uses `!== false` so that undefined/missing field defaults to "send" (backward-compatible).
 */
async function hasOptedOutOfReviewRequests(userId: string, crewSlug: string | null): Promise<boolean> {
  if (!userId) return false;
  try {
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("metadata")
      .eq("user_id", userId)
      .maybeSingle();

    const metadata = (user?.metadata as Record<string, unknown> | null) || {};
    const allPrefs = metadata.franchizeNotificationPreferences as Record<string, unknown> | undefined;
    if (!allPrefs) return false; // no preferences set → default to send

    // Try crew-specific preferences first, fall back to 'default'
    const slugPrefs = (crewSlug ? allPrefs[crewSlug] : null) as Record<string, unknown> | undefined;
    const defaultPrefs = allPrefs.default as Record<string, unknown> | undefined;
    const prefs = slugPrefs || defaultPrefs;

    if (!prefs) return false;
    return prefs.reviewRequests === false; // only true if explicitly set to false
  } catch {
    return false; // on error, default to send (don't block the nudge)
  }
}

/**
 * Resolve the crew's reviewsLink from Supabase crew metadata.
 * Reads from metadata.franchize.catalog.reviewsLink (preferred) or
 * metadata.franchize.reviewsLink (fallback) — matching the pattern in
 * app/franchize/actions-runtime.ts:951-955.
 */
async function resolveCrewReviewsLink(crewId: string | null): Promise<string | null> {
  if (!crewId) return null;
  try {
    const { data: crew } = await supabaseAdmin
      .from("crews")
      .select("metadata, slug")
      .eq("id", crewId)
      .maybeSingle();
    if (!crew) return null;

    const metadata = (crew.metadata as Record<string, unknown> | null) || {};
    const franchize = metadata.franchize as Record<string, unknown> | undefined;
    if (!franchize) return null;

    const catalog = franchize.catalog as Record<string, unknown> | undefined;
    const reviewsLink =
      (catalog?.reviewsLink as string | undefined) ||
      (franchize.reviewsLink as string | undefined) ||
      null;

    return reviewsLink || null;
  } catch {
    return null;
  }
}

/**
 * Resolve the crew slug from crew_id. Needed to look up notification preferences
 * (which are keyed by slug in users.metadata.franchizeNotificationPreferences).
 */
async function resolveCrewSlug(crewId: string | null): Promise<string | null> {
  if (!crewId) return null;
  try {
    const { data: crew } = await supabaseAdmin
      .from("crews")
      .select("slug")
      .eq("id", crewId)
      .maybeSingle();
    return crew?.slug || null;
  } catch {
    return null;
  }
}

/**
 * Write the review_request_sent dedup + failure-tracking metadata.
 * Merges with existing rental.metadata (doesn't overwrite other fields).
 */
async function markReviewRequestSent(
  rentalId: string,
  result: { succeeded: boolean; error?: string; reviewsLink?: string | null },
): Promise<void> {
  try {
    // Read current metadata
    const { data: rental } = await supabaseAdmin
      .from("rentals")
      .select("metadata")
      .eq("rental_id", rentalId)
      .maybeSingle();

    const currentMeta = (rental?.metadata as Record<string, unknown> | null) || {};
    const reviewRequestSent = {
      sent_at: new Date().toISOString(),
      succeeded: result.succeeded,
      ...(result.error ? { error: result.error.slice(0, 200) } : {}),
      ...(result.reviewsLink ? { yandex_url: result.reviewsLink } : {}),
    };

    await supabaseAdmin
      .from("rentals")
      .update({
        metadata: {
          ...currentMeta,
          review_request_sent: reviewRequestSent,
        },
      })
      .eq("rental_id", rentalId);
  } catch (err) {
    logger.error("[review-nudge] Failed to write dedup metadata:", err);
  }
}

/**
 * Send the review nudge TG message.
 *
 * @returns true if sent, false if skipped or failed (failure is logged + recorded in metadata)
 */
export async function sendReviewNudge({ rental, renterChatId }: ReviewNudgeContext): Promise<boolean> {
  // ── Kill switch ──
  if (process.env.LIFECYCLE_MESSAGING_ENABLED === "false") {
    logger.info("[review-nudge] Skipped: LIFECYCLE_MESSAGING_ENABLED=false");
    return false;
  }

  // ── Dedup: already sent (or attempted) for this rental ──
  const existingMeta = (rental.metadata as Record<string, unknown> | null) || {};
  if (existingMeta.review_request_sent) {
    logger.info(`[review-nudge] Skipped: review_request_sent already set for rental ${rental.rental_id}`);
    return false;
  }

  // ── Need a renter chat_id ──
  if (!renterChatId) {
    logger.info(`[review-nudge] Skipped: no renterChatId for rental ${rental.rental_id}`);
    return false;
  }

  // ── Need crew_id to resolve reviewsLink + check crew membership ──
  if (!rental.crew_id) {
    logger.info(`[review-nudge] Skipped: no crew_id for rental ${rental.rental_id}`);
    return false;
  }

  // ── Skip crew members (operator test-rentals) ──
  const isOperator = await isCrewMember(renterChatId, rental.crew_id);
  if (isOperator) {
    logger.info(`[review-nudge] Skipped: renter ${renterChatId} is a crew member of crew ${rental.crew_id}`);
    return false;
  }

  // ── Check opt-out preference ──
  const crewSlug = await resolveCrewSlug(rental.crew_id);
  const optedOut = await hasOptedOutOfReviewRequests(renterChatId, crewSlug);
  if (optedOut) {
    logger.info(`[review-nudge] Skipped: renter ${renterChatId} opted out of reviewRequests`);
    return false;
  }

  // ── Resolve reviewsLink ──
  const reviewsLink = await resolveCrewReviewsLink(rental.crew_id);
  if (!reviewsLink) {
    logger.warn(`[review-nudge] Skipped: no reviewsLink found for crew ${rental.crew_id} — hydrate via crewDocs SQL`);
    await markReviewRequestSent(rental.rental_id, { succeeded: false, error: "no reviewsLink for crew", reviewsLink: null });
    return false;
  }

  // ── Build message ──
  const vehicle = rental.vehicle as { make?: string | null; model?: string | null } | null;
  const bikeName = vehicle ? `${vehicle.make || ""} ${vehicle.model || ""}`.trim() : "байк";
  const renterFirstName = renterChatId; // we don't have the name here — TG user_id only

  const messageText =
    `👋 Спасибо за аренду ${bikeName}!\n\n` +
    `Если понравилось — оставь отзыв на Яндекс Картах. Это помогает другим райдерам найти нас, а нам — расти:\n\n` +
    `⭐ Оставить отзыв: ${reviewsLink}\n\n` +
    `Занимает 30 секунд. Спасибо! 🙏`;

  // ── Send via inline keyboard button (better mobile UX) ──
  const inlineKeyboard = [[{ text: "⭐ Оставить отзыв", url: reviewsLink }]];

  // ── Send ──
  try {
    await sendComplexMessage(
      renterChatId,
      messageText,
      inlineKeyboard as any,
      { parseMode: "HTML" },
    );
    logger.info(`[review-nudge] Sent to ${renterChatId} for rental ${rental.rental_id}`);
    await markReviewRequestSent(rental.rental_id, { succeeded: true, reviewsLink });
    return true;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error(`[review-nudge] Send failed for rental ${rental.rental_id}:`, err);
    await markReviewRequestSent(rental.rental_id, { succeeded: false, error: errorMsg, reviewsLink });
    return false;
  }
}
