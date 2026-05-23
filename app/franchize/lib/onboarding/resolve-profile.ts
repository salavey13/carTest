/**
 * resolve-profile.ts
 * ==================
 * Resolves a VipBikeUserProfile from dbUser.metadata.
 *
 * This is the SINGLE ENTRY POINT that VipBikeRentalClient (and any other
 * component) should use to get a user profile. It handles:
 *
 *   - Users with completed surveys → full profile from survey + behavior
 *   - Users with partial surveys → partial profile + payload hints + behavior
 *   - Users with only behavioral signals → behavior-derived profile
 *   - Users with only a /start payload → pre-survey profile from hints
 *   - Anonymous users → default universal profile
 *
 * CRITICAL RULE: Components call resolveVipBikeProfile(dbUser).
 *               They NEVER read dbUser.metadata.survey_results directly.
 *               They NEVER read dbUser.metadata.behavior_signals directly.
 *               The resolver is the ONLY source of truth.
 *
 * NO CACHED PROFILE: We do NOT read a cached ui_profile from metadata.
 * The profile is ALWAYS re-derived from raw signals at runtime.
 * This ensures that:
 *   - Resolver logic improvements apply immediately to all users
 *   - Stale profiles don't persist outdated segments/intents
 *   - Behavioral signals are always factored in
 *   - Intent decay is computed with current timestamps
 *
 * PERFORMANCE: This runs client-side on every render via useMemo.
 *   The normalizer is pure computation — no I/O, no side effects.
 *   It should complete in < 1ms. If it ever gets slow, memoize
 *   the result at a higher level (e.g., AppContext).
 */

import type { VipBikeUserMetadata, BikeSurveyAnswers, ParsedPayload, BehaviorSignals } from "./experience-types";
import { normalizeSurveyToProfile, createDefaultProfile } from "./survey-normalizer";
import { parsePayload } from "./payload-parser";

// ─────────────────────────────────────────────────────
// Resolver versioning
// ─────────────────────────────────────────────────────

/**
 * Profile resolver version — bump when the profile derivation logic changes.
 *
 * This is NOT used for logic (the resolver always runs latest code).
 * It's for OBSERVABILITY:
 *   - Analytics: "profile-v2 produces 30% more electro segments"
 *   - Debugging: "this user was classified by profile-v1, but v2 would classify differently"
 *   - A/B testing: enable new resolver for a subset, compare conversion
 *   - Migration tracking: identify users who need re-onboarding
 *
 * When you change the normalizer logic, bump this version.
 * The version is included in the profile's onboardingContext so
 * downstream systems (analytics, logging) can attribute decisions.
 */
export const PROFILE_RESOLVER_VERSION = "profile-v1" as const;

// ─────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────

/**
 * Minimal dbUser shape that the resolver needs.
 * This avoids coupling to the full AppContext dbUser type.
 */
interface DbUserForProfile {
  metadata?: VipBikeUserMetadata | null;
}

// ─────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────

/**
 * Resolves a VipBikeUserProfile from the user's database metadata.
 *
 * ALWAYS derives from raw signals. NEVER reads a cached profile.
 *
 * Resolution strategy (in priority order):
 *
 *   1. If survey_results + behavior_signals → derive from both
 *   2. If survey_results only → derive from survey + payload hints
 *   3. If behavior_signals only → derive from behavior
 *   4. If only onboarding_start_payload → derive from payload hints
 *   5. Otherwise → return default profile
 *
 * @param dbUser - The user object from AppContext (or null for anonymous)
 * @returns A fully resolved VipBikeUserProfile
 *
 * @example
 *   // In VipBikeRentalClient:
 *   const { dbUser } = useAppContext();
 *   const profile = resolveVipBikeProfile(dbUser);
 *
 *   // Now use profile.segment, profile.intent, profile.confidence
 *   // NEVER access dbUser.metadata.survey_results directly
 */
export function resolveVipBikeProfile(dbUser: DbUserForProfile | null | undefined): VipBikeUserProfile {
  if (!dbUser?.metadata) {
    return createDefaultProfile();
  }

  const meta = dbUser.metadata;
  const surveyResults = meta.survey_results as BikeSurveyAnswers | undefined;
  const behaviorSignals = meta.behavior_signals as BehaviorSignals | undefined;
  const hasSurveyAnswers = surveyResults && Object.values(surveyResults).some(
    (v) => v && typeof v === "string" && v.trim().length > 0,
  );
  const hasBehavior = behaviorSignals && (
    (behaviorSignals.viewedElectroCount ?? 0) +
    (behaviorSignals.viewedSportCount ?? 0) +
    (behaviorSignals.openedMapCount ?? 0) +
    (behaviorSignals.buyIntentClickCount ?? 0) +
    (behaviorSignals.rentIntentClickCount ?? 0)
  ) > 0;

  // Parse the /start payload for hints
  let parsedPayload: ParsedPayload | null = null;
  if (meta.onboarding_start_payload) {
    parsedPayload = parsePayload(meta.onboarding_start_payload);
  }

  // ── Strategy 1: Survey + Behavior → richest profile ──
  if (hasSurveyAnswers) {
    const onboardingCompleted = !!(
      surveyResults!.terms_agreement &&
      (surveyResults!.terms_agreement as string).toLowerCase().includes("да")
    );

    const profile = normalizeSurveyToProfile(
      surveyResults!,
      behaviorSignals,
      parsedPayload,
      onboardingCompleted,
      meta.onboarding_context,
    );

    // Attach resolver version for observability
    return {
      ...profile,
      onboardingContext: {
        ...profile.onboardingContext,
        profileResolverVersion: PROFILE_RESOLVER_VERSION,
      },
    };
  }

  // ── Strategy 2: Behavior only → behavior-derived profile ──
  if (hasBehavior) {
    const profile = normalizeSurveyToProfile(
      {}, // no survey answers
      behaviorSignals,
      parsedPayload,
      false, // no survey completed
      undefined, // no onboarding context
    );

    return {
      ...profile,
      onboardingContext: {
        ...profile.onboardingContext,
        profileResolverVersion: PROFILE_RESOLVER_VERSION,
      },
    };
  }

  // ── Strategy 3: Only /start payload → pre-survey profile ──
  if (parsedPayload && parsedPayload.code) {
    return {
      segment: parsedPayload.segmentHint ?? "mixed",
      intent: parsedPayload.intentHint ?? "explore",
      experience: "beginner",
      onboardingCompleted: false,
      confidence: 0.15, // Low confidence — payload hint only
      source: {
        promoCode: extractPromoFromPayload(parsedPayload),
        payload: parsedPayload.raw,
      },
      onboardingContext: {
        profileResolverVersion: PROFILE_RESOLVER_VERSION,
      },
    };
  }

  // ── Strategy 4: Nothing → default profile ──
  const defaultProfile = createDefaultProfile();
  return {
    ...defaultProfile,
    onboardingContext: {
      ...defaultProfile.onboardingContext,
      profileResolverVersion: PROFILE_RESOLVER_VERSION,
    },
  };
}

// ─────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────

/**
 * Extracts a promo code from a parsed payload, if applicable.
 */
function extractPromoFromPayload(payload: ParsedPayload): string | undefined {
  if (["promo", "ref", "invite", "code", "bare"].includes(payload.type)) {
    return payload.code || undefined;
  }
  return undefined;
}