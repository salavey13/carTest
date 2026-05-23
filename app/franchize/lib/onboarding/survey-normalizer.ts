/**
 * survey-normalizer.ts
 * ====================
 * Transforms raw signals (survey signals + behavioral signals + payload signals)
 * into a normalized VipBikeUserProfile.
 *
 * THIS IS THE SINGLE SOURCE OF TRUTH for interpreting all raw signals.
 * No other file should read survey signals or behavior counters
 * and try to derive segments/intents. If the survey questions change,
 * you update THIS file and nothing else.
 *
 * ARCHITECTURE (signals terminology):
 *   Raw signals (survey + behavior + payload)
 *       ↓ (this file)
 *   VipBikeUserProfile (segment, intent, experience, confidence)
 *       ↓ (resolve-experience.ts)
 *   VipBikeExperienceConfig (heroMode, sectionOrder, CTAs)
 *       ↓ (VipBikeRentalClient.tsx)
 *   Rendered page
 *
 * FIVE SIGNAL SOURCES, MERGED WITH PRIORITY:
 *
 *   1. Survey signals — strongest signal, but can become stale
 *   2. Behavioral signals — progressive enrichment, reinforces or overrides survey
 *   3. Payload signals — weakest signal, seeds profile before survey
 *   4. Referral signals — from referral codes (future)
 *   5. Geo/seasonal signals — from location and time (future)
 *
 * SIGNALS TERMINOLOGY MATTERS:
 *   - "signals" not "answers" — because we have multiple sources
 *   - "survey signals" not "survey results" — because they're one input among many
 *   - "behavioral signals" not "tracking" — because they inform, not surveil
 *   - "payload signals" not "deep-link data" — because they carry intent
 *
 * The normalizer also implements INTENT DECAY:
 *   - Survey completed 6 months ago with no behavioral signals → confidence decays
 *   - Recent behavioral signals → confidence reinforced
 *   - This prevents permanently locking users into outdated intent
 */

import type {
  VipBikeUserProfile,
  VipBikeSegment,
  VipBikeIntent,
  VipBikeExperience,
  BikeSurveyAnswers,
  BehaviorSignals,
  ParsedPayload,
} from "./experience-types";

// ─────────────────────────────────────────────────────
// Intent decay configuration
// ─────────────────────────────────────────────────────

/**
 * How quickly survey-derived confidence decays without behavioral reinforcement.
 * After this many days, survey confidence is halved.
 */
const DECAY_HALF_LIFE_DAYS = 90;

/**
 * How many behavioral interactions count as "reinforcement"
 * that prevents decay.
 */
const REINFORCEMENT_THRESHOLD = 3;

/**
 * Maximum days before a survey signal is considered "stale"
 * even with reinforcement. After this, only behavior matters.
 */
const MAX_SURVEY_AGE_DAYS = 365;

// ─────────────────────────────────────────────────────
// Answer → Category mapping tables
// ─────────────────────────────────────────────────────

/**
 * Maps bike_style survey signal → VipBikeSegment.
 * This is the PRIMARY segment driver.
 */
const BIKE_STYLE_TO_SEGMENT: Array<{ keywords: string[]; segment: VipBikeSegment }> = [
  { keywords: ["нео-ретро", "neo", "ретро", "харизма"], segment: "retro" },
  { keywords: ["суперспорт", "спорт", "обтекател", "эмбриона"], segment: "sport" },
  { keywords: ["стритфайтер", "нейкед", "агрессивн"], segment: "sport" },
  { keywords: ["спорт-турист", "мощность и комфорт", "тур"], segment: "touring" },
  { keywords: ["электро", "электр", "electro", "enduro"], segment: "electro" },
];

/**
 * Maps purpose survey signal → VipBikeIntent.
 * This is the PRIMARY intent driver.
 */
const PURPOSE_TO_INTENT: Array<{ keywords: string[]; intent: VipBikeIntent }> = [
  { keywords: ["город", "между рядами", "комфорт"], intent: "rent" },
  { keywords: ["трек", "гоночн", "прокат", "аренд"], intent: "rent" },
  { keywords: ["дальн", "покупк", "купить", "сво"], intent: "buy" },
  { keywords: ["групп", "карт", "вместе", "компани", "друз"], intent: "community" },
  { keywords: ["загород", "извилист", "маршрут"], intent: "explore" },
];

/**
 * Maps priority survey signal → VipBikeIntent (secondary signal).
 */
const PRIORITY_TO_INTENT: Array<{ keywords: string[]; intent: VipBikeIntent }> = [
  { keywords: ["ускорен", "адреналин", "скорость"], intent: "rent" },
  { keywords: ["управля", "маневр", "остр"], intent: "rent" },
  { keywords: ["внешн", "вниман", "стиль", "дорог"], intent: "explore" },
  { keywords: ["покупк", "купить"], intent: "buy" },
  { keywords: ["удобств", "технолог", "комфорт"], intent: "explore" },
];

/**
 * Maps experience survey signal → VipBikeExperience.
 */
const EXPERIENCE_MAP: Array<{ keywords: string[]; level: VipBikeExperience }> = [
  { keywords: ["новичок", "до 1 год", "только что получ", "прав"], level: "beginner" },
  { keywords: ["опытн", "1-3 год", "средн"], level: "intermediate" },
  { keywords: ["профи", "3+ лет", "3 лет", "эксперт"], level: "advanced" },
];

/**
 * Maps purpose survey signal → VipBikeSegment (secondary signal).
 */
const PURPOSE_TO_SEGMENT: Array<{ keywords: string[]; segment: VipBikeSegment }> = [
  { keywords: ["город", "между рядами"], segment: "urban" },
  { keywords: ["трек", "гоночн"], segment: "sport" },
  { keywords: ["дальн", "загород"], segment: "touring" },
  { keywords: ["групп", "карт"], segment: "mixed" },
];

// ─────────────────────────────────────────────────────
// Behavioral signal interpretation
// ─────────────────────────────────────────────────────

/**
 * Derives segment from behavioral signals.
 * If behavior contradicts survey signals, behavior wins when counts are high enough.
 *
 * "Surveys lie. Behavior doesn't."
 * User says: "I like retro bikes" but viewedElectroCount = 27.
 * The resolver can evolve naturally. That's how mature adaptive systems work.
 */
function deriveSegmentFromBehavior(behavior: BehaviorSignals | undefined): VipBikeSegment | null {
  if (!behavior) return null;

  const electroViews = behavior.viewedElectroCount ?? 0;
  const sportViews = behavior.viewedSportCount ?? 0;
  const retroViews = behavior.viewedRetroCount ?? 0;

  // Need at least 3 views in a category to derive segment
  const total = electroViews + sportViews + retroViews;
  if (total < REINFORCEMENT_THRESHOLD) return null;

  // Dominant category
  if (electroViews > sportViews && electroViews > retroViews && electroViews >= REINFORCEMENT_THRESHOLD) return "electro";
  if (sportViews > electroViews && sportViews > retroViews && sportViews >= REINFORCEMENT_THRESHOLD) return "sport";
  if (retroViews > electroViews && retroViews > sportViews && retroViews >= REINFORCEMENT_THRESHOLD) return "retro";

  return null;
}

/**
 * Derives intent from behavioral signals.
 * Behavioral signals are a STRONGER signal than survey signals for intent
 * because they show what users ACTUALLY do, not what they SAY.
 */
function deriveIntentFromBehavior(behavior: BehaviorSignals | undefined): VipBikeIntent | null {
  if (!behavior) return null;

  const buyClicks = behavior.buyIntentClickCount ?? 0;
  const rentClicks = behavior.rentIntentClickCount ?? 0;
  const mapOpens = behavior.openedMapCount ?? 0;

  // Map interactions → community intent
  if (mapOpens >= REINFORCEMENT_THRESHOLD && mapOpens > buyClicks && mapOpens > rentClicks) {
    return "community";
  }

  // Buy clicks → buy intent
  if (buyClicks >= REINFORCEMENT_THRESHOLD && buyClicks > rentClicks) {
    return "buy";
  }

  // Rent clicks → rent intent
  if (rentClicks >= REINFORCEMENT_THRESHOLD) {
    return "rent";
  }

  return null;
}

/**
 * Checks if behavioral signals are strong enough to override survey signals.
 * Returns true if behavior has enough data points to be authoritative.
 */
function shouldBehaviorOverride(behavior: BehaviorSignals | undefined): boolean {
  if (!behavior) return false;

  const totalInteractions =
    (behavior.viewedElectroCount ?? 0) +
    (behavior.viewedSportCount ?? 0) +
    (behavior.viewedRetroCount ?? 0) +
    (behavior.buyIntentClickCount ?? 0) +
    (behavior.rentIntentClickCount ?? 0) +
    (behavior.openedMapCount ?? 0);

  return totalInteractions >= REINFORCEMENT_THRESHOLD * 2; // 6+ interactions to override
}

// ─────────────────────────────────────────────────────
// Intent decay
// ─────────────────────────────────────────────────────

/**
 * Computes a decay multiplier based on survey age.
 *
 * If the survey was completed recently → multiplier ≈ 1.0
 * If it was completed DECAY_HALF_LIFE_DAYS ago → multiplier ≈ 0.5
 * If it was completed MAX_SURVEY_AGE_DAYS ago → multiplier ≈ 0.0
 *
 * Behavioral reinforcement prevents decay:
 *   If user has recent behavioral signals, decay is reduced.
 *
 * @param completedAt - ISO timestamp of survey completion
 * @param behavior - Current behavioral signals (for reinforcement check)
 * @returns Multiplier 0-1 that scales survey-derived confidence
 */
function computeDecayMultiplier(
  completedAt: string | undefined,
  behavior: BehaviorSignals | undefined,
): number {
  if (!completedAt) return 0.5; // No completion date → assume moderate freshness

  const now = Date.now();
  const completedMs = new Date(completedAt).getTime();
  const ageDays = (now - completedMs) / (1000 * 60 * 60 * 24);

  // Beyond max age → survey is effectively stale
  if (ageDays > MAX_SURVEY_AGE_DAYS) return 0.1;

  // Exponential decay
  const decayMultiplier = Math.pow(0.5, ageDays / DECAY_HALF_LIFE_DAYS);

  // Check for behavioral reinforcement
  const totalBehavior =
    (behavior?.viewedElectroCount ?? 0) +
    (behavior?.viewedSportCount ?? 0) +
    (behavior?.openedMapCount ?? 0) +
    (behavior?.buyIntentClickCount ?? 0) +
    (behavior?.rentIntentClickCount ?? 0);

  const hasReinforcement = totalBehavior >= REINFORCEMENT_THRESHOLD;
  const hasRecentActivity = behavior?.lastActiveAt &&
    (now - new Date(behavior.lastActiveAt).getTime()) < 30 * 24 * 60 * 60 * 1000; // active in last 30 days

  if (hasReinforcement && hasRecentActivity) {
    // Behavioral reinforcement reduces decay by 50%
    return Math.min(1.0, decayMultiplier + (1.0 - decayMultiplier) * 0.5);
  }

  if (hasReinforcement) {
    // Reinforcement exists but not recent → partial reduction
    return Math.min(1.0, decayMultiplier + (1.0 - decayMultiplier) * 0.25);
  }

  return decayMultiplier;
}

// ─────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────

/**
 * Matches a string against a keyword table, returning the first match.
 * Case-insensitive, partial match (includes).
 */
function matchKeywords<T>(
  value: string | undefined,
  table: Array<{ keywords: string[] } & T>,
): (T & { matchedKeyword?: string }) | null {
  if (!value) return null;
  const lower = value.toLowerCase();
  for (const entry of table) {
    for (const kw of entry.keywords) {
      if (lower.includes(kw)) {
        return { ...entry, matchedKeyword: kw };
      }
    }
  }
  return null;
}

/**
 * Computes base confidence score from survey completeness and consistency.
 *
 * FACTORS:
 *   - How many answers are present? (0-5, each +0.15)
 *   - Are the answers consistent with each other? (+0.10)
 *   - terms_agreement = "Да" (+0.15)
 */
function computeSurveyConfidence(answers: BikeSurveyAnswers): number {
  const keys = ["experience", "purpose", "bike_style", "priority", "terms_agreement"] as const;
  const filledCount = keys.filter((k) => answers[k] && answers[k]!.trim().length > 0).length;

  let score = filledCount * 0.15;

  // Bonus for affirmative terms
  if (answers.terms_agreement?.toLowerCase().includes("да")) {
    score += 0.15;
  }

  // Consistency check
  const styleSegment = matchKeywords(answers.bike_style, BIKE_STYLE_TO_SEGMENT);
  const purposeSegment = matchKeywords(answers.purpose, PURPOSE_TO_SEGMENT);

  if (styleSegment && purposeSegment) {
    if (styleSegment.segment === purposeSegment.segment) {
      score += 0.10;
    } else if (!areContradictory(styleSegment.segment, purposeSegment.segment)) {
      score += 0.05;
    }
  }

  return Math.min(1.0, score);
}

/**
 * Checks if two segments are contradictory.
 */
function areContradictory(a: VipBikeSegment, b: VipBikeSegment): boolean {
  const contradictions: Array<[VipBikeSegment, VipBikeSegment]> = [
    ["sport", "retro"],
    ["electro", "sport"],
  ];
  return contradictions.some(
    ([x, y]) => (a === x && b === y) || (a === y && b === x),
  );
}

/**
 * Merges signals from multiple sources with priority:
 *   1. Behavioral signals (if strong enough to override)
 *   2. Survey signals (primary)
 *   3. Payload signals (pre-survey seed)
 *   4. Default fallback
 *
 * Future: referral signals, geo signals, seasonal signals
 */
function mergeSegment(
  behaviorSegment: VipBikeSegment | null,
  behaviorOverride: boolean,
  surveySegment: VipBikeSegment | null,
  payloadHint: VipBikeSegment | undefined,
  defaultSegment: VipBikeSegment = "mixed",
): VipBikeSegment {
  // Behavior overrides survey when strong enough AND contradicts
  if (behaviorOverride && behaviorSegment) return behaviorSegment;
  // Survey is primary
  if (surveySegment) return surveySegment;
  // Behavior without override is still better than nothing
  if (behaviorSegment) return behaviorSegment;
  // Payload hint is weakest
  if (payloadHint) return payloadHint;
  return defaultSegment;
}

function mergeIntent(
  behaviorIntent: VipBikeIntent | null,
  behaviorOverride: boolean,
  surveyIntent: VipBikeIntent | null,
  payloadHint: VipBikeIntent | undefined,
  defaultIntent: VipBikeIntent = "explore",
): VipBikeIntent {
  if (behaviorOverride && behaviorIntent) return behaviorIntent;
  if (surveyIntent) return surveyIntent;
  if (behaviorIntent) return behaviorIntent;
  if (payloadHint) return payloadHint;
  return defaultIntent;
}

// ─────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────

/**
 * Normalizes raw signals into a VipBikeUserProfile.
 *
 * This is the ONLY function that should interpret raw signals.
 * All personalization logic flows from the returned profile object.
 *
 * @param answers - Raw survey answers from metadata.survey_results
 * @param behavior - Behavioral signals from metadata.behavior_signals
 * @param payload - Optional parsed /start payload (provides pre-survey hints)
 * @param onboardingCompleted - Whether the user finished the survey
 * @param onboardingContext - Metadata about the onboarding session (for decay)
 *
 * @example
 *   const profile = normalizeSurveyToProfile(
 *     { experience: "Новичок", purpose: "В городе", bike_style: "Нео-ретро", ... },
 *     { viewedRetroCount: 7, openedMapCount: 5, lastActiveAt: "2026-05-20T10:00:00Z" },
 *     { type: "entry", code: "ELECTRO", raw: "entry.electro", segmentHint: "electro" },
 *     true,
 *     { completedAt: "2026-05-24T10:00:00Z", version: "bike-v1", entryPoint: "telegram:start" }
 *   );
 *   // → { segment: "retro", intent: "explore", experience: "beginner", confidence: 0.85, ... }
 *   //    Note: behavior (7 retro views) overrides payload hint (electro)
 */
export function normalizeSurveyToProfile(
  answers: BikeSurveyAnswers,
  behavior?: BehaviorSignals | null,
  payload?: ParsedPayload | null,
  onboardingCompleted?: boolean,
  onboardingContext?: VipBikeUserProfile["onboardingContext"],
): VipBikeUserProfile {
  // ── Derive segment from survey ──
  const styleMatch = matchKeywords(answers.bike_style, BIKE_STYLE_TO_SEGMENT);
  const purposeSegMatch = matchKeywords(answers.purpose, PURPOSE_TO_SEGMENT);

  let surveySegment: VipBikeSegment | null = null;
  if (styleMatch) {
    surveySegment = styleMatch.segment;
  } else if (purposeSegMatch) {
    surveySegment = purposeSegMatch.segment;
  }

  // ── Derive intent from survey ──
  const purposeMatch = matchKeywords(answers.purpose, PURPOSE_TO_INTENT);
  const priorityMatch = matchKeywords(answers.priority, PRIORITY_TO_INTENT);

  let surveyIntent: VipBikeIntent | null = null;
  if (purposeMatch) {
    surveyIntent = purposeMatch.intent;
  } else if (priorityMatch) {
    surveyIntent = priorityMatch.intent;
  }

  // ── Derive experience level ──
  const expMatch = matchKeywords(answers.experience, EXPERIENCE_MAP);
  const surveyExperience: VipBikeExperience = expMatch?.level ?? "beginner";

  // ── Derive from behavioral signals ──
  const behaviorSegment = deriveSegmentFromBehavior(behavior);
  const behaviorIntent = deriveIntentFromBehavior(behavior);
  const behaviorOverride = shouldBehaviorOverride(behavior);

  // ── Merge all signals ──
  const segment = mergeSegment(behaviorSegment, behaviorOverride, surveySegment, payload?.segmentHint);
  const intent = mergeIntent(behaviorIntent, behaviorOverride, surveyIntent, payload?.intentHint);

  // ── Compute confidence ──
  const hasAnswers = Object.values(answers).some((v) => v && v.trim().length > 0);
  let confidence = 0;

  if (hasAnswers) {
    const baseConfidence = computeSurveyConfidence(answers);
    const decayMultiplier = computeDecayMultiplier(
      onboardingContext?.completedAt,
      behavior,
    );
    confidence = baseConfidence * decayMultiplier;

    // Behavioral reinforcement bonus (up to +0.15)
    if (behavior) {
      const totalBehavior =
        (behavior.viewedElectroCount ?? 0) +
        (behavior.viewedSportCount ?? 0) +
        (behavior.viewedRetroCount ?? 0) +
        (behavior.openedMapCount ?? 0) +
        (behavior.buyIntentClickCount ?? 0) +
        (behavior.rentIntentClickCount ?? 0);
      const behaviorBonus = Math.min(0.15, totalBehavior * 0.02);
      confidence += behaviorBonus;
    }
  } else if (behavior) {
    // No survey but has behavioral signals → low but non-zero confidence
    const totalBehavior =
      (behavior.viewedElectroCount ?? 0) +
      (behavior.viewedSportCount ?? 0) +
      (behavior.openedMapCount ?? 0) +
      (behavior.buyIntentClickCount ?? 0) +
      (behavior.rentIntentClickCount ?? 0);
    confidence = Math.min(0.4, totalBehavior * 0.03);
  } else if (payload?.code) {
    // Only payload → very low confidence
    confidence = 0.15;
  }

  confidence = Math.min(1.0, Math.max(0, confidence));

  // ── Determine onboarding status ──
  const completed = onboardingCompleted ?? (
    !!answers.terms_agreement && answers.terms_agreement.toLowerCase().includes("да")
  );

  return {
    segment,
    intent,
    experience: surveyExperience,
    onboardingCompleted: completed,
    confidence,
    source: payload
      ? {
          promoCode: ["promo", "ref", "invite", "code", "bare"].includes(payload.type)
            ? payload.code
            : undefined,
          payload: payload.raw,
          surveyVersion: onboardingContext?.version,
        }
      : undefined,
    onboardingContext,
    behaviorSignals: behavior,
  };
}

/**
 * Creates a default profile for users with no signals at all.
 * This ensures the landing always has a valid profile to work with.
 */
export function createDefaultProfile(): VipBikeUserProfile {
  return {
    segment: "mixed",
    intent: "explore",
    experience: "beginner",
    onboardingCompleted: false,
    confidence: 0,
  };
}