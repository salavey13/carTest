/**
 * experience-types.ts
 * ===================
 * Canonical type definitions for the VipBike adaptive storefront runtime.
 *
 * ARCHITECTURE CONTRACT:
 *   Telegram /start → survey → raw signals in metadata → resolve-profile → resolve-experience → UI
 *
 * CRITICAL PRINCIPLE:
 *   Metadata stores RAW SIGNALS ONLY. Never derived/interpreted state.
 *   Profile is ALWAYS derived at runtime by resolve-profile.ts.
 *   Experience is ALWAYS derived at runtime by resolve-experience.ts.
 *
 *   Why? Because:
 *     - Resolver logic evolves → profileResolverVersion tracks which logic produced a profile
 *     - Segmentation evolves → experienceResolverVersion tracks which logic composed an experience
 *     - Confidence evolves → intent decay recalculates from timestamps at runtime
 *     - Onboarding taxonomy evolves → survey version tracks which question set was used
 *   If profile is persisted, old users get stale logic.
 *   Persist raw signals. Derive profile at runtime.
 *   Track resolver versions for OBSERVABILITY, not logic.
 *
 * These types are the ONLY shared contract between:
 *   - start.ts (server: writes raw signals to metadata)
 *   - survey-normalizer.ts (shared: interprets survey signals)
 *   - resolve-profile.ts (client: builds runtime profile from raw signals)
 *   - resolve-experience.ts (client: derives UI composition)
 *   - VipBikeRentalClient.tsx (client: renders sections)
 *
 * RULE: Components NEVER read raw survey signals directly.
 *       They always go through VipBikeUserProfile → VipBikeExperienceConfig.
 */

// ─────────────────────────────────────────────────────
// 1. USER PROFILE — The normalized runtime view of who this user is
//    NEVER PERSISTED. ALWAYS DERIVED AT RUNTIME.
// ─────────────────────────────────────────────────────

/**
 * Segment: WHAT kind of rider are they?
 * Derived primarily from bike_style + purpose survey signals.
 * This is NOT a theme — it's a behavioral segment that drives
 * section ordering, copy tone, and CTA priority.
 */
export type VipBikeSegment =
  | "electro"      // Electric-first: quiet, modern, eco mobility
  | "sport"        // Performance: speed, adrenaline, track
  | "urban"        // City riding: commute, convenience, short trips
  | "retro"        // Neo-retro: style, charisma, photo-worthy
  | "touring"      // Long distance: comfort, reliability, gear
  | "mixed";       // No clear segment — universal/default

/**
 * Intent: WHY are they here?
 * Derived from purpose + priority survey signals + behavioral signals.
 * This is MORE important than segment for CTA and flow design.
 * "Intent routing, not theme routing."
 */
export type VipBikeIntent =
  | "buy"          // Wants to purchase — fast purchase flow, financing, specs
  | "rent"         // Wants to try — rental flow, availability, scheduling
  | "explore"      // Browsing — discovery flow, categories, comparison
  | "community";   // Social — map, group rides, meetups, leaderboard

/**
 * Experience level: HOW comfortable are they?
 * Derived from the experience survey signal.
 * Affects copy tone, safety emphasis, and first-ride guidance.
 */
export type VipBikeExperience =
  | "beginner"     // < 1 year / just got license
  | "intermediate" // 1-3 years
  | "advanced";    // 3+ years / pro

/**
 * Complete normalized user profile.
 * This is the ONLY object that UI components should consume
 * to make personalization decisions.
 *
 * ⚠️  THIS IS DERIVED AT RUNTIME. NEVER STORED IN THE DATABASE.
 *
 * The profile includes a confidence score because some users:
 *   - skip parts of the survey
 *   - give conflicting signals (e.g., "beginner" + "sport")
 *   - change behavior over time
 * The resolver can use confidence to decide whether to show
 * a strong personalized experience or a softer universal one.
 *
 * Confidence also DECAYS over time. A survey completed 6 months ago
 * is less reliable than one completed yesterday. The resolver
 * factors in intent decay when computing confidence.
 */
export interface VipBikeUserProfile {
  /** Behavioral segment — drives section ordering and featured categories */
  segment: VipBikeSegment;

  /** Primary intent — drives CTA priority and flow design */
  intent: VipBikeIntent;

  /** Experience level — drives copy tone and safety emphasis */
  experience: VipBikeExperience;

  /** Whether the user has completed the onboarding survey */
  onboardingCompleted: boolean;

  /**
   * Confidence score 0-1.
   * 1.0 = full survey completed recently, consistent signals, reinforced by behavior.
   * 0.5 = partial survey or conflicting signals.
   * 0.0 = no survey data at all (anonymous/new user).
   *
   * USE THIS: If confidence < 0.5, prefer universal layout.
   * Only go full-personalized when confidence >= 0.7.
   *
   * Confidence factors:
   *   - Survey completeness (0-0.75)
   *   - Answer consistency (0-0.10)
   *   - Behavioral reinforcement (0-0.15)
   *   - Intent decay (subtracts over time if no behavioral signals)
   */
  confidence: number;

  /** Source tracking — how did they arrive */
  source?: {
    /** The promo/referral code they entered via /start payload */
    promoCode?: string;
    /** The raw /start payload (for debugging/audit) */
    payload?: string;
    /** Which onboarding version produced this profile (for migration) */
    surveyVersion?: string;
  };

  /**
   * Onboarding context — metadata about the survey and resolver versions.
   * Critical for:
   *   - Intent decay: older surveys → lower confidence
   *   - Rerunning onboarding after redesign
   *   - Migrating old users
   *   - A/B testing surveys
   *   - Identifying stale profiles
   *   - OBSERVABILITY: which resolver versions produced this profile/experience
   *
   * VERSION TRACKING IS FOR OBSERVABILITY, NOT LOGIC.
   * The resolvers always run the latest code. Versions exist so you can:
   *   - Compare profile distributions across resolver versions
   *   - Debug: "this user has profileResolverVersion=profile-v1, but v2 would classify differently"
   *   - A/B test: enable new resolver for subset, compare conversion
   *   - Analytics: "after profile-v3, electro segment conversion improved 15%"
   */
  onboardingContext?: {
    /** ISO timestamp of survey completion */
    completedAt?: string;
    /** Survey version identifier (e.g., "bike-v1", "bike-v2-electro") */
    version?: string;
    /** How the user entered the survey: "telegram:start", "web:cta", etc. */
    entryPoint?: string;
    /** Profile resolver version that produced the current profile (e.g., "profile-v1") */
    profileResolverVersion?: string;
    /** Experience resolver version that produced the current experience (e.g., "exp-v1") */
    experienceResolverVersion?: string;
  };

  /**
   * Behavioral signals — progressive enrichment from user actions.
   * These are accumulated over time and REINFORCE or OVERRIDE
   * survey-derived signals.
   *
   * Example: A user who answered "sport" in the survey but has
   * viewed electro bikes 7 times and never looked at sport bikes
   * should gradually shift toward electro segment.
   *
   * These are RAW COUNTERS — the normalizer interprets them.
   * They are PERSISTED in metadata (unlike the profile itself).
   */
  behaviorSignals?: BehaviorSignals;
}

/**
 * Progressive enrichment signals.
 * These accumulate from micro-interactions on the landing page
 * and gradually shift the profile beyond what the survey captured.
 *
 * STORAGE: Persisted in metadata.behavior_signals (raw counts only).
 * INTERPRETATION: Done by survey-normalizer.ts at runtime.
 *
 * This is where the system stops being "survey personalization"
 * and becomes "adaptive storefront intelligence."
 */
export interface BehaviorSignals {
  /** How many times user viewed electro category items */
  viewedElectroCount?: number;
  /** How many times user viewed sport category items */
  viewedSportCount?: number;
  /** How many times user viewed retro category items */
  viewedRetroCount?: number;
  /** How many times user opened the map */
  openedMapCount?: number;
  /** How many times user clicked buy/configure on an item */
  buyIntentClickCount?: number;
  /** How many times user clicked rent on an item */
  rentIntentClickCount?: number;
  /** ISO timestamp of last map interaction (for per-intent decay) */
  lastMapInteractionAt?: string;
  /** ISO timestamp of last buy-flow interaction (for per-intent decay) */
  lastBuyInteractionAt?: string;
  /** ISO timestamp of last rent-flow interaction (for per-intent decay) */
  lastRentInteractionAt?: string;
  /**
   * Models scanned via QR code (from physical world → digital).
   * CAPPED at 20 entries — oldest dropped first.
   */
  scannedQrModels?: string[];
  /** Seconds spent on investment section (proxy for investor interest) */
  investSectionViewSeconds?: number;
  /** ISO timestamp of last activity (for decay calculation) */
  lastActiveAt?: string;
}

/** Maximum entries in scannedQrModels before FIFO eviction */
export const SCANNED_QR_MODELS_CAP = 20;

// ─────────────────────────────────────────────────────
// 2. EXPERIENCE CONFIG — What the UI should show
//    ALWAYS DERIVED AT RUNTIME FROM PROFILE.
// ─────────────────────────────────────────────────────

/**
 * Section identifiers — one per visual block on the landing page.
 * These are the building blocks that resolve-experience.ts can
 * reorder, show, or hide based on the user's profile.
 *
 * CRITICAL: Adding a new section means:
 *   1. Add the ID here
 *   2. Add a renderer in VipBikeRentalClient's sectionMap
 *   3. Add capability tags in SECTION_CAPABILITIES
 *   4. The resolver picks it up automatically
 *
 * That's it. No if/else spaghetti in the component.
 */
export type SectionId =
  | "hero"               // Main hero with video bg + vibeProfile card
  | "bikeShowcase"       // BikeShowcase component
  | "conversionPilot"    // "Find your scenario in 30 seconds" decision router
  | "electroShowcase"    // ElectroEnduroShowcase carousel
  | "mapPreview"         // MapRidersLivePreview
  | "gearSection"        // Helmets, gloves, armor grid
  | "stepsProgress"      // 3-step newbie stepper
  | "rentalQuickActions" // RentalQuickActionHub
  | "companyServiceHub"  // VipBikeCompanyServiceHub
  | "serviceCards"       // Requirements / What client gets / Services
  | "howItWorks"         // 4-step "How it works" section
  | "investSection"      // VIP Invest V2 block
  | "faq";               // Accordion FAQ

/**
 * Section complexity — how much cognitive load this section presents.
 * Used to order sections by complexity for different experience levels.
 * Beginners see low-complexity sections first.
 */
export type SectionComplexity = "low" | "medium" | "high";

/**
 * Emotional tone a section conveys — used for tone matching.
 * Sections that match the user's preferred emotional tone are
 * promoted in the ordering.
 */
export type EmotionalTone = "energetic" | "calm" | "premium" | "playful" | "informational";

/**
 * Section capability tags — sections self-describe what they help with.
 *
 * Instead of hardcoding logic like:
 *   if (beginner) gearSection early
 *
 * Sections declare capabilities, and the resolver scores them
 * against the user's profile dynamically.
 *
 * This unlocks:
 *   - AI ranking later
 *   - Experimentation
 *   - A/B tests
 *   - Analytics-driven ordering
 *   - New sections auto-discovered by resolver
 *
 * WITHOUT rewriting orchestration.
 */
export interface SectionCapabilities {
  /** Which segments this section is most relevant for */
  relevantSegments?: VipBikeSegment[];
  /** Which intents this section serves best */
  relevantIntents?: VipBikeIntent[];
  /** Which experience levels benefit most */
  relevantExperience?: VipBikeExperience[];
  /** Cognitive complexity of this section */
  complexity?: SectionComplexity;
  /** Emotional tone this section conveys */
  emotionalTone?: EmotionalTone;
  /** Free-form tags for custom matching */
  tags?: string[];
  /** Priority weight (higher = more important for its target audience) */
  weight?: number;
  /**
   * Whether this section should be hidden for non-surveyed users.
   * Sections like investSection are irrelevant for users who haven't
   * completed onboarding — they'd just add noise.
   */
  hideIfNotSurveyed?: boolean;
}

/**
 * Hero display mode — which tab is active by default.
 * This is the PRIMARY personalization signal on the landing.
 *
 * MAPPING:
 *   segment=electro + intent=explore  → "electro-enduro"
 *   segment=sport                     → "rent"  (rental experience first)
 *   intent=buy                        → "buy"   (fast purchase flow)
 *   intent=community                  → "map"   (social/routes)
 *   default                           → "rent"  (safest default)
 */
export type HeroDisplayMode =
  | "rent"           // Rental-first: availability, pricing, first ride
  | "buy"            // Purchase-first: specs, financing, comparison
  | "map"            // Community-first: live routes, riders, meetups
  | "rentals"        // My rentals: active bookings, quick rebook
  | "electro-enduro"; // Electric showcase: electro bikes front and center

/**
 * Primary CTA configuration — what the big button does.
 * Derived from intent + segment, NOT hardcoded per section.
 */
export interface PrimaryCTA {
  /** Display label (localized Russian) */
  label: string;
  /** Navigation target: internal path or external URL */
  href: string;
  /** Whether this is an internal route (Link) vs external (anchor) */
  isExternal: boolean;
  /** Visual variant */
  variant: "accent" | "outline" | "brand-yellow";
}

/**
 * The complete experience composition.
 * This is what resolve-experience() returns.
 * The landing page uses this to render — NO other personalization logic.
 */
export interface VipBikeExperienceConfig {
  /** Which hero tab is active by default */
  heroMode: HeroDisplayMode;

  /** Primary call-to-action for the vibeProfile card */
  primaryCTA: PrimaryCTA;

  /** Ordered list of sections to render. Sections NOT in this list are hidden. */
  sectionOrder: SectionId[];

  /**
   * Sections that should be visually emphasized (border, glow, larger).
   * These are the user's "home base" sections — the ones they care most about.
   */
  featuredSections: SectionId[];

  /** Which catalog category to feature in ElectroEnduroShowcase */
  featuredCategory: "electro" | "sport" | "retro" | "all";

  /** Onboarding variant for the vibeProfile card */
  onboardingVariant: "surveyed" | "not_surveyed" | "partial";

  /** Copy tone for generated text */
  copyTone: "aggressive" | "friendly" | "premium" | "discovery";

  /** Whether to show the /start deep-link CTA (non-surveyed users) */
  showOnboardingCTA: boolean;

  /** Whether to show promo code chip */
  showPromoChip: boolean;

  /** The preset name that best matches this config (for analytics/debugging) */
  presetName?: string;

  /**
   * Anti-thrashing metadata — prevents UX from reshuffling too rapidly.
   *
   * Problem: Behavioral signals change frequently (view electro, view retro,
   * view map, view electro). Without stabilization, the landing constantly
   * reshuffles, hero changes too often, and the UX feels schizophrenic.
   *
   * Solution: Lock the experience for a minimum duration after it changes.
   * Netflix, Spotify, and YouTube all do variants of this.
   *
   * These fields are computed by the resolver and consumed by the component
   * to decide whether to apply a new experience or keep the old one.
   */
  antiThrashing?: {
    /** ISO timestamp when this experience was first computed */
    computedAt: string;
    /** Minimum milliseconds before the experience can change again */
    minimumDurationMs: number;
    /** ISO timestamp after which a new experience can be applied */
    lockedUntil: string;
    /** How many consecutive times the same profile produced this experience (stability counter) */
    stabilityCount: number;
  };

  /**
   * Resolver version that produced this experience (for observability).
   * NOT used for logic — always runs latest code.
   * Used for: analytics, A/B testing, debugging.
   */
  experienceResolverVersion?: string;
}

// ─────────────────────────────────────────────────────
// 3. PAYLOAD TYPES — Structured /start deep-link payloads
// ─────────────────────────────────────────────────────

/**
 * Structured payload that can be embedded in Telegram deep-links.
 *
 * CONVENTION: Use dot-notation for structured payloads.
 *
 * Examples:
 *   /start entry.electro          → user enters via electro campaign
 *   /start promo.NEON2026         → user has a promo code
 *   /start buy.surron             → user wants to buy a Surron
 *   /start map.groupride          → user wants group rides
 *   /start ref_ALEX2026           → referral code (legacy format)
 *   /start VIPSTART               → bare code (legacy format)
 *
 * The payload parser handles both new structured format and legacy formats.
 */
export type PayloadType = "entry" | "promo" | "buy" | "map" | "ref" | "invite" | "code" | "bare";

export interface ParsedPayload {
  /** The type of payload (determined by prefix) */
  type: PayloadType;

  /** The code/value after the prefix (uppercased, trimmed, max 64 chars) */
  code: string;

  /** The original raw payload string (for audit/logging) */
  raw: string;

  /**
   * The /start command if present in the original text.
   * Used by start.ts to distinguish "user typed /start with no payload"
   * from "user typed a survey answer while in active survey".
   * Undefined when payload was parsed without a /start prefix.
   */
  command?: "/start";

  /**
   * A hint for the survey normalizer.
   * If the payload contains intent info (e.g., "buy.surron"),
   * the normalizer can use this as a prior even before survey signals arrive.
   */
  intentHint?: VipBikeIntent;

  /**
   * A hint for the segment resolver.
   * If the payload contains segment info (e.g., "entry.electro"),
   * the resolver can pre-seed the segment.
   */
  segmentHint?: VipBikeSegment;
}

// ─────────────────────────────────────────────────────
// 4. SURVEY SIGNAL TYPES — Raw survey data shape
// ─────────────────────────────────────────────────────

/**
 * The shape of survey signals as stored in metadata.survey_results.
 * Keys match the survey question keys from start_survey_questions_bike.ts.
 *
 * IMPORTANT: Components should NEVER read these directly.
 * Always go through resolve-profile.ts → VipBikeUserProfile.
 * These types exist ONLY for the normalizer to consume.
 */
export interface BikeSurveyAnswers {
  /** "Новичок (ещё не пробовал электро)" | "Опытный (1-3 сезона на электротяге)" | "Профи (3+ сезона, уверен в управлении)" | "Только права получил" */
  experience?: string;

  /** "Городские поездки и коммутика" | "Эндуро и бездорожье" | "Загородные маршруты и дальние поездки" | "Прокатить и понять — стоит ли покупать" */
  purpose?: string;

  /** "Электроэндуро (лёгкий, внедорожный)" | "Электроспорт (мощный, быстрый, обтекаемый)" | "Электро-турист (комфорт, дальнобой, багаж)" | "Нео-ретро электро (стиль, харизма, фотогеничный)" */
  bike_style?: string;

  /** "Запас хода и автономность" | "Динамика и ускорение" | "Внешний вид и внимание на дороге" | "Комфорт посадки и тишина хода" */
  priority?: string;

  /** "Да, я готов(а)!" | "Нужно подумать" */
  terms_agreement?: string;
}

// ─────────────────────────────────────────────────────
// 5. METADATA SHAPE — What gets persisted in the database
//    RAW SIGNALS ONLY. NO DERIVED STATE.
// ─────────────────────────────────────────────────────

/**
 * The shape of user metadata as stored in the database.
 * This is what dbUser.metadata looks like.
 *
 * ⚠️  CRITICAL: Only raw signals are persisted here.
 *     NO derived/interpreted state (ui_profile, landing_mode, etc.)
 *     Everything derived is computed at runtime by resolve-profile.ts.
 *
 * Why? Because:
 *   - Resolver logic evolves → old persisted profiles become stale
 *   - Segmentation evolves → old profiles get wrong segments
 *   - Confidence evolves → old profiles have wrong confidence
 *   - Impossible to re-interpret users globally if profile is persisted
 *
 * Persist raw signals. Derive profile at runtime.
 */
export interface VipBikeUserMetadata {
  /** Raw survey signals — the normalizer reads these */
  survey_results?: BikeSurveyAnswers;

  /** Promo code captured at /start time */
  onboarding_promo_code?: string;

  /** Raw /start payload captured at /start time */
  onboarding_start_payload?: string;

  /**
   * Onboarding context — when/how the survey was completed.
   * Used for intent decay calculation (older surveys → lower confidence).
   */
  onboarding_context?: {
    /** ISO timestamp of survey completion */
    completedAt?: string;
    /** Survey version identifier (e.g., "bike-v1") */
    version?: string;
    /** How the user entered the survey: "telegram:start", "web:cta", etc. */
    entryPoint?: string;
    /** Profile resolver version (e.g., "profile-v1") — for observability */
    profileResolverVersion?: string;
    /** Experience resolver version (e.g., "exp-v1") — for observability */
    experienceResolverVersion?: string;
  };

  /**
   * Behavioral signals — progressive enrichment from user actions.
   * Accumulated over time. The normalizer uses these to reinforce
   * or override survey-derived signals.
   *
   * These are RAW COUNTERS — no interpretation, just facts.
   * The normalizer decides what they mean at runtime.
   */
  behavior_signals?: BehaviorSignals;

  /**
   * Anti-thrashing state — persisted so experience stability
   * survives across page navigations and refreshes.
   * This stores RAW profile signals (segment/intent/experience) at the
   * time of the last experience change, NOT derived preset names.
   * The resolver compares current profile vs stored profile to
   * determine stability, re-deriving the preset at runtime.
   */
  experience_lock?: {
    /** ISO timestamp of when the experience was last changed */
    lastChangedAt?: string;
    /**
     * Raw profile signals at time of last experience resolution.
     * These are NOT derived — they're the same raw signals that
     * the profile resolver would use. By storing them here, the
     * anti-thrashing system can detect profile changes without
     * persisting a derived preset name.
     */
    lastResolvedSegment?: VipBikeSegment;
    lastResolvedIntent?: VipBikeIntent;
    lastResolvedExperience?: VipBikeExperience;
    /** Consecutive stability count — how many times the same profile resolved */
    stabilityCount?: number;
  };

  // ═══════════════════════════════════════════════════
  // ⚠️  DO NOT ADD DERIVED FIELDS HERE.
  //
  // NO ui_profile, NO landing_mode, NO segment_cache,
  // NO lastPresetName (that's a derived classification).
  // The profile is ALWAYS derived at runtime from raw signals.
  // If you need to cache, cache in React state / useMemo,
  // never in the database.
  //
  // Exception: experience_lock stores raw profile signals
  // (segment/intent/experience) that happen to also exist in
  // the derived profile. These are raw timing + comparison
  // metadata, not derived state — they record WHAT the profile
  // WAS at a point in time, not what the resolver DID with it.
  // ═══════════════════════════════════════════════════
}