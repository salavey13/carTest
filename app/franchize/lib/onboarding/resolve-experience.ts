/**
 * resolve-experience.ts
 * =====================
 * Resolves a VipBikeExperienceConfig from a VipBikeUserProfile.
 *
 * This is where INTENT becomes UX. The profile tells us WHO the user is;
 * this function decides WHAT they see.
 *
 * DESIGN PRINCIPLE: "Intent routing, not theme routing."
 *   - Buyers see fast purchase flow
 *   - Explorers see discovery flow
 *   - Community users see map/social flow
 *   - Renters see availability/scheduling flow
 *
 * FIVE INNOVATIONS vs v1:
 *
 *   1. SECTION CAPABILITIES: Sections self-describe what they help with.
 *      Instead of hardcoding "if beginner -> gearSection early", sections
 *      declare capabilities, and the resolver scores them dynamically.
 *      This unlocks AI ranking, A/B tests, analytics-driven ordering.
 *
 *   2. EXPERIENCE PRESETS: Named composable configs for common profiles.
 *      Makes debugging easier ("this user has electroExplorer preset").
 *      Enables feature flags, analytics, product discussions.
 *      The resolver composes from presets and refines.
 *
 *   3. COMBINE PRESETS: Instead of a single if/else chain that grows
 *      into 1500 lines, the resolver composes multiple small presets
 *      and merges them. This prevents resolver entropy.
 *
 *   4. ANTI-THRASHING: Behavioral signals change rapidly (view electro,
 *      view retro, view map, view electro). Without stabilization,
 *      the landing constantly reshuffles. The resolver locks the
 *      experience for a minimum duration after it changes.
 *
 *   5. RESOLVER VERSIONING: Every resolver output includes its version
 *      for observability. NOT used for logic — always runs latest code.
 *      Used for: analytics, A/B testing, debugging.
 *
 * MODULAR ARCHITECTURE:
 *   resolveVipBikeExperience(profile)
 *     = resolveHero(profile)
 *     + resolveSectionPriority(profile)
 *     + resolveCTA(profile)
 *     + resolveFeaturedSections(profile)
 *
 *   Each resolver is independently testable and replaceable.
 *   This prevents the "1500-line condition jungle" problem.
 *
 * CRITICAL: This function is PURE. No side effects, no I/O.
 * It should be called inside useMemo in the component.
 */

import type {
  VipBikeUserProfile,
  VipBikeExperienceConfig,
  VipBikeSegment,
  VipBikeIntent,
  HeroDisplayMode,
  SectionId,
  SectionCapabilities,
  PrimaryCTA,
} from "./experience-types";

// ─────────────────────────────────────────────────────
// 0. Resolver versioning
// ─────────────────────────────────────────────────────

/**
 * Experience resolver version — bump when the experience composition logic changes.
 *
 * NOT used for logic (the resolver always runs latest code).
 * It's for OBSERVABILITY:
 *   - Analytics: "exp-v2 increased conversion on electro segment by 12%"
 *   - Debugging: "this user's experience was composed by exp-v1"
 *   - A/B testing: enable new resolver for a subset, compare conversion
 *
 * When you change section ordering logic, preset definitions, or CTA resolution,
 * bump this version. The version is included in the experience config so
 * downstream systems (analytics, logging) can attribute UX decisions.
 */
export const EXPERIENCE_RESOLVER_VERSION = "exp-v1" as const;

// ─────────────────────────────────────────────────────
// 1. Section Capability Registry
// ─────────────────────────────────────────────────────

/**
 * Each section declares what it's good for.
 * The resolver uses these to dynamically score and order sections
 * based on the user's profile, instead of hardcoding rules.
 *
 * Adding a new section = add capabilities here + add to sectionMap.
 * The resolver picks it up automatically.
 */
export const SECTION_CAPABILITIES: Record<SectionId, SectionCapabilities> = {
  hero: {
    relevantSegments: [],
    relevantIntents: [],
    tags: ["universal", "entry"],
    weight: 100, // Always first
  },
  bikeShowcase: {
    relevantSegments: ["sport", "touring"],
    relevantIntents: ["explore", "rent"],
    tags: ["discovery", "catalog"],
    weight: 60,
  },
  conversionPilot: {
    relevantSegments: [],
    relevantIntents: ["buy", "rent"],
    relevantExperience: ["beginner"],
    tags: ["decision", "funnel"],
    weight: 80,
  },
  electroShowcase: {
    relevantSegments: ["electro"],
    relevantIntents: ["explore", "buy"],
    tags: ["electro", "featured", "catalog"],
    weight: 85,
  },
  mapPreview: {
    relevantSegments: ["mixed", "urban"],
    relevantIntents: ["community"],
    tags: ["social", "map", "live"],
    weight: 75,
  },
  gearSection: {
    relevantExperience: ["beginner"],
    tags: ["safety", "equipment", "beginner"],
    weight: 50,
  },
  stepsProgress: {
    relevantExperience: ["beginner"],
    relevantIntents: ["rent"],
    tags: ["onboarding", "steps", "beginner"],
    weight: 40,
  },
  rentalQuickActions: {
    relevantIntents: ["rent"],
    relevantExperience: ["intermediate", "advanced"],
    tags: ["rental", "quick-action", "availability"],
    weight: 70,
  },
  companyServiceHub: {
    tags: ["info", "services"],
    weight: 30,
  },
  serviceCards: {
    relevantIntents: ["buy", "rent"],
    tags: ["pricing", "requirements", "trust"],
    weight: 45,
  },
  howItWorks: {
    relevantExperience: ["beginner"],
    relevantIntents: ["rent", "buy"],
    tags: ["process", "steps"],
    weight: 35,
  },
  investSection: {
    relevantIntents: ["buy"],
    relevantExperience: ["advanced"],
    tags: ["invest", "premium", "monetization"],
    weight: 25,
  },
  faq: {
    tags: ["info", "support"],
    weight: 20,
  },
};

// ─────────────────────────────────────────────────────
// 2. Experience Presets
// ─────────────────────────────────────────────────────

/**
 * Named experience presets for common user profiles.
 * These are composable building blocks — the resolver picks the
 * best preset and refines it based on the specific profile.
 *
 * Benefits:
 *   - Easier debugging: "this user has electroExplorer preset"
 *   - Analytics: track which presets are most common
 *   - Feature flags: enable/disable specific presets
 *   - Product discussions: talk about presets, not code
 *
 * COMPOSABLE: Multiple presets can be combined via combinePresets().
 * This prevents the "giant switch statement in 6 months" problem.
 */
export interface ExperiencePreset {
  name: string;
  segment: VipBikeSegment;
  intent: VipBikeIntent;
  heroMode: HeroDisplayMode;
  sectionOrder: SectionId[];
  featuredSections: SectionId[];
  featuredCategory: VipBikeExperienceConfig["featuredCategory"];
  copyTone: VipBikeExperienceConfig["copyTone"];
  primaryCTA: PrimaryCTA;
}

const PRESETS: ExperiencePreset[] = [
  {
    name: "electroExplorer",
    segment: "electro",
    intent: "explore",
    heroMode: "electro-enduro",
    sectionOrder: [
      "hero", "electroShowcase", "bikeShowcase", "conversionPilot",
      "mapPreview", "gearSection", "rentalQuickActions", "stepsProgress",
      "serviceCards", "howItWorks", "companyServiceHub", "investSection", "faq",
    ],
    featuredSections: ["electroShowcase", "mapPreview"],
    featuredCategory: "electro",
    copyTone: "premium",
    primaryCTA: {
      label: "Изучить электро",
      href: "/franchize/vip-bike",
      isExternal: false,
      variant: "brand-yellow",
    },
  },
  {
    name: "fastBuyer",
    segment: "sport",
    intent: "buy",
    heroMode: "buy",
    sectionOrder: [
      "hero", "conversionPilot", "electroShowcase", "serviceCards",
      "howItWorks", "bikeShowcase", "gearSection", "stepsProgress",
      "rentalQuickActions", "mapPreview", "companyServiceHub", "investSection", "faq",
    ],
    featuredSections: ["conversionPilot", "rentalQuickActions"],
    featuredCategory: "sport",
    copyTone: "aggressive",
    primaryCTA: {
      label: "Выбрать покупку",
      href: "/franchize/vip-bike",
      isExternal: false,
      variant: "accent",
    },
  },
  {
    name: "retroCruiser",
    segment: "retro",
    intent: "explore",
    heroMode: "rent",
    sectionOrder: [
      "hero", "electroShowcase", "bikeShowcase", "conversionPilot",
      "mapPreview", "serviceCards", "gearSection", "stepsProgress",
      "rentalQuickActions", "howItWorks", "companyServiceHub", "investSection", "faq",
    ],
    featuredSections: ["electroShowcase", "bikeShowcase"],
    featuredCategory: "retro",
    copyTone: "premium",
    primaryCTA: {
      label: "Смотреть подборку",
      href: "/franchize/vip-bike",
      isExternal: false,
      variant: "outline",
    },
  },
  {
    name: "communityRider",
    segment: "mixed",
    intent: "community",
    heroMode: "map",
    sectionOrder: [
      "hero", "mapPreview", "rentalQuickActions", "conversionPilot",
      "electroShowcase", "bikeShowcase", "gearSection", "stepsProgress",
      "serviceCards", "howItWorks", "companyServiceHub", "investSection", "faq",
    ],
    featuredSections: ["mapPreview"],
    featuredCategory: "all",
    copyTone: "friendly",
    primaryCTA: {
      label: "Открыть карту",
      href: "/franchize/vip-bike/map-riders",
      isExternal: false,
      variant: "accent",
    },
  },
  {
    name: "safeBeginner",
    segment: "mixed",
    intent: "rent",
    heroMode: "rent",
    sectionOrder: [
      "hero", "conversionPilot", "gearSection", "stepsProgress",
      "rentalQuickActions", "electroShowcase", "bikeShowcase",
      "mapPreview", "serviceCards", "howItWorks", "companyServiceHub", "faq",
    ],
    featuredSections: ["conversionPilot", "gearSection"],
    featuredCategory: "all",
    copyTone: "friendly",
    primaryCTA: {
      label: "Первый выезд",
      href: "/franchize/vip-bike",
      isExternal: false,
      variant: "accent",
    },
  },
  {
    name: "universal",
    segment: "mixed",
    intent: "explore",
    heroMode: "rent",
    sectionOrder: [
      "hero", "bikeShowcase", "conversionPilot", "electroShowcase",
      "mapPreview", "gearSection", "stepsProgress", "rentalQuickActions",
      "companyServiceHub", "serviceCards", "howItWorks", "investSection", "faq",
    ],
    featuredSections: [],
    featuredCategory: "all",
    copyTone: "friendly",
    primaryCTA: {
      label: "🚀 Начать анкету /start",
      href: "https://t.me/oneBikePlsBot?start=onboard",
      isExternal: true,
      variant: "brand-yellow",
    },
  },
];

// ─────────────────────────────────────────────────────
// 3. Preset composition
// ─────────────────────────────────────────────────────

/**
 * Composes multiple presets by merging their section orders.
 *
 * This is the KEY mechanism to prevent resolver entropy.
 * Instead of one giant function with 50 if/else branches,
 * you compose small, focused presets:
 *
 *   combinePresets([buyerFastLane, beginnerGuided])
 *   → sections from buyerFastLane first, then beginnerGuided additions
 *
 * Rules:
 *   - First preset's order takes priority (its sections appear first)
 *   - Subsequent presets add sections not already present
 *   - hero is ALWAYS first regardless
 *   - Duplicate sections are deduplicated (first occurrence wins)
 *
 * @param presets - Ordered list of presets to compose (first = highest priority)
 * @returns Composed section order
 */
export function combinePresets(presets: ExperiencePreset[]): SectionId[] {
  if (presets.length === 0) return [];
  if (presets.length === 1) return presets[0].sectionOrder;

  const seen = new Set<SectionId>();
  const result: SectionId[] = [];

  for (const preset of presets) {
    for (const section of preset.sectionOrder) {
      if (!seen.has(section)) {
        seen.add(section);
        result.push(section);
      }
    }
  }

  // Ensure hero is always first
  const heroIndex = result.indexOf("hero");
  if (heroIndex > 0) {
    result.splice(heroIndex, 1);
    result.unshift("hero");
  } else if (heroIndex === -1) {
    result.unshift("hero");
  }

  return result;
}

// ─────────────────────────────────────────────────────
// 4. Preset matching
// ─────────────────────────────────────────────────────

/**
 * Finds the best matching preset for a profile.
 * Uses segment + intent matching, with fallback to universal.
 */
function findBestPreset(profile: VipBikeUserProfile): ExperiencePreset {
  // Try exact segment + intent match
  const exact = PRESETS.find(
    (p) => p.segment === profile.segment && p.intent === profile.intent,
  );
  if (exact) return exact;

  // Try intent match only (more important than segment)
  const intentMatch = PRESETS.find((p) => p.intent === profile.intent);
  if (intentMatch) return intentMatch;

  // Try segment match only
  const segmentMatch = PRESETS.find((p) => p.segment === profile.segment);
  if (segmentMatch) return segmentMatch;

  // Special case: beginner experience
  if (profile.experience === "beginner") {
    return PRESETS.find((p) => p.name === "safeBeginner")!;
  }

  // Fallback to universal
  return PRESETS.find((p) => p.name === "universal")!;
}

// ─────────────────────────────────────────────────────
// 5. Modular resolvers — each independently testable
// ─────────────────────────────────────────────────────

/**
 * Resolves hero display mode from profile.
 * Separated from the main resolver for:
 *   - Independent testing
 *   - A/B testing hero independently
 *   - Replacing hero logic without touching section logic
 *
 * "Intent routing, not theme routing" — the hero drives FIRST IMPRESSION.
 */
export function resolveHero(profile: VipBikeUserProfile): HeroDisplayMode {
  // Low confidence → safest default
  if (profile.confidence < 0.3) return "rent";

  // Intent-first routing
  if (profile.intent === "buy") return "buy";
  if (profile.intent === "community") return "map";

  // Segment-specific hero for explore intent
  if (profile.segment === "electro") return "electro-enduro";

  // Default
  return "rent";
}

/**
 * Resolves section priority order from profile.
 * This is the scoring engine — sections self-describe capabilities,
 * and this function ranks them against the profile.
 *
 * Separated from the main resolver for:
 *   - Independent testing
 *   - Experimentation with different scoring algorithms
 *   - AI-driven ranking later (swap this function, nothing else changes)
 */
export function resolveSectionPriority(profile: VipBikeUserProfile): SectionId[] {
  // Low confidence → universal order
  if (profile.confidence < 0.3) {
    return PRESETS.find((p) => p.name === "universal")!.sectionOrder;
  }

  // Find best preset and refine with capability scoring
  const preset = findBestPreset(profile);
  let sectionOrder = refineSectionOrder(preset.sectionOrder, profile);

  // ── Special rules (these would become preset compositions later) ──

  // Electro segment: ALWAYS show electro showcase early
  if (profile.segment === "electro") {
    const electroIndex = sectionOrder.indexOf("electroShowcase");
    if (electroIndex > 1) {
      sectionOrder = [
        sectionOrder[0], // hero
        "electroShowcase",
        ...sectionOrder.slice(1, electroIndex),
        ...sectionOrder.slice(electroIndex + 1),
      ];
    }
  }

  // Beginners: ensure gearSection is prominent
  if (profile.experience === "beginner" && profile.onboardingCompleted) {
    const gearIndex = sectionOrder.indexOf("gearSection");
    if (gearIndex > 4) {
      sectionOrder = [
        ...sectionOrder.slice(0, 4),
        "gearSection",
        ...sectionOrder.slice(4, gearIndex),
        ...sectionOrder.slice(gearIndex + 1),
      ];
    }
  }

  // Non-surveyed users: hide invest section
  if (!profile.onboardingCompleted) {
    sectionOrder = sectionOrder.filter((s) => s !== "investSection");
  }

  return sectionOrder;
}

/**
 * Resolves the primary CTA from profile.
 * "Intent routing, not theme routing" — the CTA drives BEHAVIOR.
 *
 * Behavioral signals can override survey-derived CTA:
 *   - If user has 5+ buy clicks but survey says "rent" → show buy CTA
 *
 * Separated from the main resolver for:
 *   - Independent testing
 *   - A/B testing CTAs independently
 *   - Analytics: "CTA resolver v2 increased click-through by 20%"
 */
export function resolveCTA(profile: VipBikeUserProfile): PrimaryCTA {
  // Not surveyed → onboarding CTA
  if (!profile.onboardingCompleted && profile.confidence < 0.3) {
    return {
      label: "🚀 Начать анкету /start",
      href: "https://t.me/oneBikePlsBot?start=onboard",
      isExternal: true,
      variant: "brand-yellow",
    };
  }

  // Check behavioral intent override
  const effectiveIntent = profile.behaviorSignals &&
    shouldBehaviorOverrideCTA(profile)
    ? deriveBehavioralIntent(profile.behaviorSignals)
    : profile.intent;

  switch (effectiveIntent) {
    case "buy":
      return profile.experience === "beginner"
        ? { label: "Подобрать первый байк", href: "/franchize/vip-bike", isExternal: false, variant: "accent" }
        : { label: "Выбрать покупку", href: "/franchize/vip-bike", isExternal: false, variant: "accent" };

    case "rent":
      return profile.experience === "beginner"
        ? { label: "Первый выезд", href: "/franchize/vip-bike", isExternal: false, variant: "accent" }
        : { label: "Выбрать аренду", href: "/franchize/vip-bike", isExternal: false, variant: "accent" };

    case "community":
      return { label: "Открыть карту", href: "/franchize/vip-bike/map-riders", isExternal: false, variant: "accent" };

    case "explore":
    default:
      if (profile.segment === "electro") {
        return { label: "Изучить электро", href: "/franchize/vip-bike", isExternal: false, variant: "brand-yellow" };
      }
      return { label: "Смотреть подборку", href: "/franchize/vip-bike", isExternal: false, variant: "outline" };
  }
}

// ─────────────────────────────────────────────────────
// 6. Dynamic section scoring
// ─────────────────────────────────────────────────────

/**
 * Scores a section based on how well its capabilities match the profile.
 * Higher score = more relevant = should appear earlier.
 *
 * This is used to REFINE the preset's section order based on
 * the specific profile (not just segment/intent, but also
 * experience level and behavioral signals).
 *
 * FUTURE: This is where AI-driven ranking plugs in.
 * Replace this scoring function with an ML model,
 * and nothing else in the architecture changes.
 */
function scoreSection(
  sectionId: SectionId,
  profile: VipBikeUserProfile,
): number {
  const caps = SECTION_CAPABILITIES[sectionId];
  if (!caps) return 0;

  let score = caps.weight ?? 50;

  // Segment match bonus
  if (caps.relevantSegments?.includes(profile.segment)) {
    score += 20;
  }

  // Intent match bonus
  if (caps.relevantIntents?.includes(profile.intent)) {
    score += 25;
  }

  // Experience match bonus
  if (caps.relevantExperience?.includes(profile.experience)) {
    score += 15;
  }

  // Behavioral reinforcement bonus
  if (profile.behaviorSignals) {
    const b = profile.behaviorSignals;
    if (sectionId === "mapPreview" && (b.openedMapCount ?? 0) >= 3) score += 10;
    if (sectionId === "electroShowcase" && (b.viewedElectroCount ?? 0) >= 3) score += 10;
    if (sectionId === "investSection" && (b.investSectionViewSeconds ?? 0) >= 30) score += 15;
  }

  return score;
}

/**
 * Sorts section order by dynamic scores, but keeps hero first.
 * Uses the preset as a base, then adjusts based on profile.
 */
function refineSectionOrder(
  presetOrder: SectionId[],
  profile: VipBikeUserProfile,
): SectionId[] {
  // Hero always first
  const heroIndex = presetOrder.indexOf("hero");
  const withoutHero = heroIndex >= 0
    ? [...presetOrder.slice(0, heroIndex), ...presetOrder.slice(heroIndex + 1)]
    : presetOrder;

  // Score each section
  const scored = withoutHero.map((id) => ({
    id,
    score: scoreSection(id, profile),
  }));

  // Sort by score (highest first), stable sort preserves preset order on ties
  scored.sort((a, b) => b.score - a.score);

  // Reconstruct with hero first
  const result: SectionId[] = heroIndex >= 0 ? ["hero"] : [];
  result.push(...scored.map((s) => s.id));
  return result;
}

// ─────────────────────────────────────────────────────
// 7. CTA helpers
// ─────────────────────────────────────────────────────

function shouldBehaviorOverrideCTA(profile: VipBikeUserProfile): boolean {
  const b = profile.behaviorSignals;
  if (!b) return false;
  const buyClicks = b.buyIntentClickCount ?? 0;
  const rentClicks = b.rentIntentClickCount ?? 0;
  return buyClicks >= 3 || rentClicks >= 3;
}

function deriveBehavioralIntent(b: NonNullable<VipBikeUserProfile["behaviorSignals"]>): VipBikeIntent {
  if ((b.buyIntentClickCount ?? 0) >= 3) return "buy";
  if ((b.rentIntentClickCount ?? 0) >= 3) return "rent";
  if ((b.openedMapCount ?? 0) >= 3) return "community";
  return "explore";
}

// ─────────────────────────────────────────────────────
// 8. Featured sections from capabilities
// ─────────────────────────────────────────────────────

/**
 * Resolves which sections should be visually emphasized.
 * A section is "featured" if it matches 2+ profile dimensions.
 *
 * Separated from the main resolver for:
 *   - Independent testing
 *   - Experimentation with featured section logic
 *   - Analytics: "featuring gearSection increased safety purchases by 8%"
 */
export function resolveFeaturedSections(profile: VipBikeUserProfile): SectionId[] {
  const featured: SectionId[] = [];

  for (const [id, caps] of Object.entries(SECTION_CAPABILITIES) as [SectionId, SectionCapabilities][]) {
    if (id === "hero") continue; // Hero is always first, not "featured"

    const segmentMatch = caps.relevantSegments?.includes(profile.segment);
    const intentMatch = caps.relevantIntents?.includes(profile.intent);
    const expMatch = caps.relevantExperience?.includes(profile.experience);

    // Feature if section matches 2+ profile dimensions
    const matchCount = [segmentMatch, intentMatch, expMatch].filter(Boolean).length;
    if (matchCount >= 2) {
      featured.push(id);
    }
  }

  return featured;
}

// ─────────────────────────────────────────────────────
// 9. Anti-thrashing
// ─────────────────────────────────────────────────────

/**
 * Default anti-thrashing configuration.
 *
 * Problem: Behavioral signals change frequently (view electro, view retro,
 * view map, view electro). Without stabilization, the landing constantly
 * reshuffles, hero changes too often, and the UX feels schizophrenic.
 *
 * Solution: Lock the experience for a minimum duration after it changes.
 * Netflix/Spotify/YouTube all do variants of this.
 *
 * Configuration:
 *   - MINIMUM_DURATION_MS: How long before the experience can change (4 hours)
 *   - STABILITY_THRESHOLD: How many consecutive same-presets before we're "confident"
 */
const ANTI_THRASHING_DEFAULTS = {
  /** Minimum 4 hours before experience can change */
  MINIMUM_DURATION_MS: 4 * 60 * 60 * 1000,
  /** 3 consecutive same-presets = stable */
  STABILITY_THRESHOLD: 3,
} as const;

/**
 * Computes anti-thrashing metadata for an experience config.
 *
 * @param presetName - The preset that was resolved
 * @param experienceLock - The persisted lock state from metadata (if any)
 * @returns Anti-thrashing metadata to include in the experience config
 */
function computeAntiThrashing(
  presetName: string,
  experienceLock?: VipBikeUserProfile["behaviorSignals"] extends any ? {
    lastChangedAt?: string;
    lastPresetName?: string;
    stabilityCount?: number;
  } : never,
): VipBikeExperienceConfig["antiThrashing"] {
  const now = new Date();
  const lock = experienceLock as {
    lastChangedAt?: string;
    lastPresetName?: string;
    stabilityCount?: number;
  } | undefined;

  // Compute stability count
  const previousStability = lock?.stabilityCount ?? 0;
  const samePresetAsBefore = lock?.lastPresetName === presetName;
  const stabilityCount = samePresetAsBefore ? previousStability + 1 : 1;

  // Check if we should lock (i.e., if the experience just changed)
  const justChanged = !samePresetAsBefore || !lock?.lastChangedAt;
  const lastChangedAt = justChanged ? now.toISOString() : lock!.lastChangedAt!;
  const lockedUntil = new Date(
    new Date(lastChangedAt).getTime() + ANTI_THRASHING_DEFAULTS.MINIMUM_DURATION_MS,
  ).toISOString();

  return {
    computedAt: now.toISOString(),
    minimumDurationMs: ANTI_THRASHING_DEFAULTS.MINIMUM_DURATION_MS,
    lockedUntil,
    stabilityCount,
  };
}

/**
 * Checks if the experience is currently locked (anti-thrashing).
 * If locked, the component should keep the previous experience
 * instead of applying the newly resolved one.
 *
 * @param currentExperience - The currently rendered experience (from React state)
 * @param now - Current timestamp (injectable for testing)
 * @returns true if the experience is locked and should NOT change
 */
export function isExperienceLocked(
  currentExperience: VipBikeExperienceConfig | null,
  now: Date = new Date(),
): boolean {
  if (!currentExperience?.antiThrashing) return false;

  const lockedUntil = new Date(currentExperience.antiThrashing.lockedUntil).getTime();
  return now.getTime() < lockedUntil;
}

// ─────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────

/**
 * Resolves the complete experience configuration from a user profile.
 *
 * This is the MAIN function that VipBikeRentalClient should call
 * to determine what to render. It returns a declarative config
 * that the component translates into section rendering.
 *
 * Resolution strategy (composed from modular resolvers):
 *   1. resolveHero(profile)       → which hero tab
 *   2. resolveSectionPriority(profile) → which sections in what order
 *   3. resolveCTA(profile)        → which primary CTA
 *   4. resolveFeaturedSections(profile) → which sections to emphasize
 *   5. computeAntiThrashing()     → lock metadata
 *
 * ANTI-THRASHING: If the previous experience is still locked,
 * the COMPONENT is responsible for checking isExperienceLocked()
 * and keeping the old experience. This resolver always computes
 * the LATEST experience — the lock check happens at the call site.
 *
 * @param profile - The resolved user profile (from resolve-profile.ts)
 * @param experienceLock - Persisted lock state from metadata (for anti-thrashing)
 * @returns Complete experience configuration
 *
 * @example
 *   const profile = resolveVipBikeProfile(dbUser);
 *   const newExperience = resolveVipBikeExperience(profile, dbUser.metadata?.experience_lock);
 *
 *   // Anti-thrashing: keep old experience if locked
 *   if (isExperienceLocked(currentExperience)) {
 *     return currentExperience; // keep old
 *   }
 *   return newExperience;
 *
 *   // In the render:
 *   experience.sectionOrder.map(renderSection)
 */
export function resolveVipBikeExperience(
  profile: VipBikeUserProfile,
  experienceLock?: {
    lastChangedAt?: string;
    lastPresetName?: string;
    stabilityCount?: number;
  },
): VipBikeExperienceConfig {
  // ── Low confidence: show universal layout ──
  if (profile.confidence < 0.3) {
    const universal = PRESETS.find((p) => p.name === "universal")!;
    return {
      heroMode: resolveHero(profile),
      primaryCTA: resolveCTA(profile),
      sectionOrder: universal.sectionOrder,
      featuredSections: [],
      featuredCategory: "all",
      onboardingVariant: "not_surveyed",
      copyTone: "friendly",
      showOnboardingCTA: true,
      showPromoChip: !!profile.source?.promoCode,
      presetName: "universal",
      antiThrashing: computeAntiThrashing("universal", experienceLock),
      experienceResolverVersion: EXPERIENCE_RESOLVER_VERSION,
    };
  }

  // ── Find best preset ──
  const preset = findBestPreset(profile);

  // ── Compose from modular resolvers ──
  const heroMode = resolveHero(profile);
  const sectionOrder = resolveSectionPriority(profile);
  const primaryCTA = resolveCTA(profile);
  const featuredSections = resolveFeaturedSections(profile);

  // ── Determine onboarding variant ──
  const onboardingVariant = !profile.onboardingCompleted
    ? "not_surveyed"
    : profile.confidence < 0.7
      ? "partial"
      : "surveyed";

  return {
    heroMode,
    primaryCTA,
    sectionOrder,
    featuredSections,
    featuredCategory: preset.featuredCategory,
    onboardingVariant,
    copyTone: preset.copyTone,
    showOnboardingCTA: !profile.onboardingCompleted,
    showPromoChip: !!profile.source?.promoCode,
    presetName: preset.name,
    antiThrashing: computeAntiThrashing(preset.name, experienceLock),
    experienceResolverVersion: EXPERIENCE_RESOLVER_VERSION,
  };
}

/**
 * Returns all available presets (for debugging / analytics / feature flags).
 */
export function getAvailablePresets(): ExperiencePreset[] {
  return [...PRESETS];
}