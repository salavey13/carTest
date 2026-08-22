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
 * SIX INNOVATIONS vs v1:
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
 *      NOW ACTUALLY USED in the resolution path.
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
 *   6. NO HARDCODED RULES: All section ordering is driven by
 *      SECTION_CAPABILITIES scoring + preset composition.
 *      No imperative splice/filter in resolveSectionPriority.
 *      Visibility rules (hideIfNotSurveyed) are declarative.
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
 * Experience lock writeback is the COMPONENT's responsibility.
 */

import type {
  VipBikeUserProfile,
  VipBikeExperienceConfig,
  VipBikeSegment,
  VipBikeIntent,
  VipBikeExperience,
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
 * bump this version.
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
    complexity: "low",
    emotionalTone: "energetic",
    tags: ["universal", "entry"],
    weight: 100, // Always first
  },
  bikeShowcase: {
    relevantSegments: ["sport", "touring"],
    relevantIntents: ["explore", "rent"],
    complexity: "medium",
    emotionalTone: "energetic",
    tags: ["discovery", "catalog"],
    weight: 60,
  },
  conversionPilot: {
    relevantSegments: [],
    relevantIntents: ["buy", "rent"],
    relevantExperience: ["beginner"],
    complexity: "low",
    emotionalTone: "playful",
    tags: ["decision", "funnel"],
    weight: 80,
  },
  electroShowcase: {
    relevantSegments: ["electro"],
    relevantIntents: ["explore", "buy"],
    complexity: "medium",
    emotionalTone: "premium",
    tags: ["electro", "featured", "catalog"],
    weight: 85,
  },
  mapPreview: {
    relevantSegments: ["mixed", "urban"],
    relevantIntents: ["community"],
    complexity: "low",
    emotionalTone: "playful",
    tags: ["social", "map", "live"],
    weight: 75,
  },
  gearSection: {
    relevantExperience: ["beginner"],
    complexity: "low",
    emotionalTone: "calm",
    tags: ["safety", "equipment", "beginner"],
    weight: 50,
  },
  stepsProgress: {
    relevantExperience: ["beginner"],
    relevantIntents: ["rent"],
    complexity: "low",
    emotionalTone: "calm",
    tags: ["onboarding", "steps", "beginner"],
    weight: 40,
  },
  rentalQuickActions: {
    relevantIntents: ["rent"],
    relevantExperience: ["intermediate", "advanced"],
    complexity: "low",
    emotionalTone: "energetic",
    tags: ["rental", "quick-action", "availability"],
    weight: 70,
  },
  companyServiceHub: {
    complexity: "medium",
    emotionalTone: "informational",
    tags: ["info", "services"],
    weight: 30,
  },
  serviceCards: {
    relevantIntents: ["buy", "rent"],
    complexity: "medium",
    emotionalTone: "informational",
    tags: ["pricing", "requirements", "trust"],
    weight: 45,
  },
  howItWorks: {
    relevantExperience: ["beginner"],
    relevantIntents: ["rent", "buy"],
    complexity: "low",
    emotionalTone: "calm",
    tags: ["process", "steps"],
    weight: 35,
  },
  investSection: {
    relevantIntents: ["buy"],
    relevantExperience: ["advanced"],
    complexity: "high",
    emotionalTone: "premium",
    hideIfNotSurveyed: true,
    tags: ["invest", "premium", "monetization"],
    weight: 25,
  },
  faq: {
    complexity: "low",
    emotionalTone: "informational",
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
    name: "urbanCommuter",
    segment: "urban",
    intent: "rent",
    heroMode: "rent",
    sectionOrder: [
      "hero", "rentalQuickActions", "bikeShowcase", "conversionPilot",
      "mapPreview", "electroShowcase", "serviceCards", "gearSection",
      "stepsProgress", "howItWorks", "companyServiceHub", "investSection", "faq",
    ],
    featuredSections: ["rentalQuickActions", "mapPreview"],
    featuredCategory: "all",
    copyTone: "friendly",
    primaryCTA: {
      label: "Выбрать аренду",
      href: "/franchize/vip-bike",
      isExternal: false,
      variant: "accent",
    },
  },
  {
    name: "touringExplorer",
    segment: "touring",
    intent: "explore",
    heroMode: "rent",
    sectionOrder: [
      "hero", "bikeShowcase", "mapPreview", "electroShowcase", "conversionPilot",
      "serviceCards", "gearSection", "rentalQuickActions", "howItWorks",
      "stepsProgress", "companyServiceHub", "investSection", "faq",
    ],
    featuredSections: ["bikeShowcase", "mapPreview"],
    featuredCategory: "all",
    copyTone: "premium",
    primaryCTA: {
      label: "Смотреть подборку",
      href: "/franchize/vip-bike",
      isExternal: false,
      variant: "outline",
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
      href: `https://t.me/${process.env.TELEGRAM_BOT_USERNAME || "oneBikePlsBot"}?start=onboard`,
      isExternal: true,
      variant: "brand-yellow",
    },
  },
];

// ─────────────────────────────────────────────────────
// 3. Preset composition (ACTUALLY USED in resolution)
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

/**
 * Finds supplementary presets to compose with the primary preset.
 * This is where combinePresets actually gets used.
 *
 * Rules:
 *   - Beginner experience → compose with safeBeginner (promotes gearSection, stepsProgress)
 *   - Low confidence → compose with universal (ensures all sections present)
 *   - Only one supplementary preset composed at a time to avoid over-complexity
 */
function findSupplementaryPreset(profile: VipBikeUserProfile): ExperiencePreset | null {
  // Beginners always get the safe beginner composition
  if (profile.experience === "beginner" && profile.onboardingCompleted) {
    const beginner = PRESETS.find((p) => p.name === "safeBeginner")!;
    // Don't compose safeBeginner with itself
    if (findBestPreset(profile).name === "safeBeginner") return null;
    return beginner;
  }

  // Low confidence users get universal composition to avoid missing sections
  if (profile.confidence < 0.5 && profile.confidence >= 0.3) {
    return PRESETS.find((p) => p.name === "universal")!;
  }

  return null;
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

  // Segment-specific hero for explore/rent intent
  if (profile.segment === "electro") return "electro-enduro";

  // Default
  return "rent";
}

/**
 * Resolves section priority order from profile.
 * This is the scoring engine — sections self-describe capabilities,
 * and this function ranks them against the profile.
 *
 * NO HARDCODED RULES: All ordering is driven by:
 *   1. Preset composition (combinePresets with primary + supplementary)
 *   2. Capability scoring (scoreSection)
 *   3. Declarative visibility (hideIfNotSurveyed)
 *
 * No imperative splice/filter for specific sections.
 */
export function resolveSectionPriority(profile: VipBikeUserProfile): SectionId[] {
  // Low confidence → universal order (no personalization)
  if (profile.confidence < 0.3) {
    const universal = PRESETS.find((p) => p.name === "universal")!;
    return applyVisibilityRules(universal.sectionOrder, profile);
  }

  // Find primary preset and optional supplementary preset
  const primaryPreset = findBestPreset(profile);
  const supplementaryPreset = findSupplementaryPreset(profile);

  // Compose presets — THIS IS WHERE combinePresets IS ACTUALLY USED
  let sectionOrder = supplementaryPreset
    ? combinePresets([primaryPreset, supplementaryPreset])
    : primaryPreset.sectionOrder;

  // Refine with capability scoring
  sectionOrder = refineSectionOrder(sectionOrder, profile);

  // Apply declarative visibility rules
  sectionOrder = applyVisibilityRules(sectionOrder, profile);

  return sectionOrder;
}

/**
 * Applies declarative visibility rules from SECTION_CAPABILITIES.
 * Replaces the old imperative "if (!profile.onboardingCompleted) filter(investSection)".
 */
function applyVisibilityRules(sectionOrder: SectionId[], profile: VipBikeUserProfile): SectionId[] {
  return sectionOrder.filter((id) => {
    const caps = SECTION_CAPABILITIES[id];
    if (!caps) return true;

    // Hide sections marked as requiring survey completion
    if (caps.hideIfNotSurveyed && !profile.onboardingCompleted) {
      return false;
    }

    return true;
  });
}

/**
 * Resolves the primary CTA from profile.
 * "Intent routing, not theme routing" — the CTA drives BEHAVIOR.
 *
 * Behavioral signals can override survey-derived CTA:
 *   - If user has 3+ recent buy clicks but survey says "rent" → show buy CTA
 *
 * Separated from the main resolver for:
 *   - Independent testing
 *   - A/B testing CTAs independently
 *   - Analytics: "CTA resolver v2 increased click-through by 20%"
 */
export function resolveCTA(profile: VipBikeUserProfile, slug?: string): PrimaryCTA {
  // Build franchise base path with dynamic slug fallback to "vip-bike"
  const f = (path: string) => slug ? `/franchize/${slug}${path}` : `/franchize/vip-bike${path}`;

  // Not surveyed → onboarding CTA
  if (!profile.onboardingCompleted && profile.confidence < 0.3) {
    return {
      label: "🚀 Начать анкету /start",
      href: `https://t.me/${process.env.TELEGRAM_BOT_USERNAME || "oneBikePlsBot"}?start=onboard`,
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
        ? { label: "Подобрать первый байк", href: f(""), isExternal: false, variant: "accent" }
        : { label: "Выбрать покупку", href: f(""), isExternal: false, variant: "accent" };

    case "rent":
      return profile.experience === "beginner"
        ? { label: "Первый выезд", href: f(""), isExternal: false, variant: "accent" }
        : { label: "Выбрать аренду", href: f(""), isExternal: false, variant: "accent" };

    case "community":
      return { label: "Открыть карту", href: f("/map-riders"), isExternal: false, variant: "accent" };

    case "explore":
    default:
      if (profile.segment === "electro") {
        return { label: "Изучить электро", href: f(""), isExternal: false, variant: "brand-yellow" };
      }
      return { label: "Смотреть подборку", href: f(""), isExternal: false, variant: "outline" };
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
 * Scoring breakdown:
 *   Base: caps.weight (20-100)
 *   + Segment match: +20
 *   + Intent match: +25
 *   + Experience match: +15
 *   + Complexity penalty for beginners: -10 for "high" complexity
 *   + Behavioral reinforcement: +10-15
 *   + Emotional tone match: +5
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

  // Complexity penalty for beginners — they don't want high-complexity sections
  if (profile.experience === "beginner" && caps.complexity === "high") {
    score -= 10;
  }

  // Emotional tone match bonus
  const preferredTone = derivePreferredTone(profile);
  if (caps.emotionalTone === preferredTone) {
    score += 5;
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
 * Derives the preferred emotional tone from the profile.
 * Used to match section emotionalTone against user preferences.
 */
function derivePreferredTone(profile: VipBikeUserProfile): string {
  if (profile.segment === "electro" || profile.segment === "retro") return "premium";
  if (profile.intent === "buy") return "energetic";
  if (profile.intent === "community") return "playful";
  if (profile.experience === "beginner") return "calm";
  return "informational";
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
 * Shape of the experience_lock stored in metadata.
 * Extracted as a proper interface (replaces the hacky conditional type).
 * Uses RAW profile signals for stability comparison, not derived preset names.
 */
export interface ExperienceLockState {
  lastChangedAt?: string;
  lastResolvedSegment?: VipBikeSegment;
  lastResolvedIntent?: VipBikeIntent;
  lastResolvedExperience?: VipBikeExperience;
  stabilityCount?: number;
}

/**
 * Default anti-thrashing configuration.
 *
 * Problem: Behavioral signals change frequently (view electro, view retro,
 * view map, view electro). Without stabilization, the landing constantly
 * reshuffles, hero changes too often, and the UX feels schizophrenic.
 *
 * Solution: Lock the experience for a minimum duration after it changes.
 * Netflix/Spotify/YouTube all do variants of this.
 */
const ANTI_THRASHING_DEFAULTS = {
  /** Minimum 4 hours before experience can change */
  MINIMUM_DURATION_MS: 4 * 60 * 60 * 1000,
  /** 3 consecutive same-profiles = stable */
  STABILITY_THRESHOLD: 3,
} as const;

/**
 * Checks if the current profile matches the locked profile.
 * Compares raw profile signals, NOT derived preset names.
 * This is the fix for M6: no derived state in the lock.
 */
function isProfileSameAsLock(
  profile: VipBikeUserProfile,
  lock: ExperienceLockState,
): boolean {
  return (
    profile.segment === lock.lastResolvedSegment &&
    profile.intent === lock.lastResolvedIntent &&
    profile.experience === lock.lastResolvedExperience
  );
}

/**
 * Computes anti-thrashing metadata for an experience config.
 * Uses proper type (no hacky conditional type).
 * Compares raw profile signals for stability detection.
 */
function computeAntiThrashing(
  profile: VipBikeUserProfile,
  experienceLock?: ExperienceLockState,
): VipBikeExperienceConfig["antiThrashing"] {
  const now = new Date();
  const lock = experienceLock;

  // Compute stability by comparing current profile vs locked profile
  const sameProfile = lock ? isProfileSameAsLock(profile, lock) : false;
  const previousStability = lock?.stabilityCount ?? 0;
  const stabilityCount = sameProfile ? previousStability + 1 : 1;

  // Check if the experience just changed (profile is different from lock)
  const justChanged = !sameProfile || !lock?.lastChangedAt;
  const lastChangedAt = justChanged
    ? now.toISOString()
    : lock!.lastChangedAt!;
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

/**
 * Computes the updated experience_lock that should be persisted
 * to metadata after a new experience is resolved.
 *
 * The COMPONENT calls this and persists it. The resolver itself is pure.
 *
 * @param profile - The profile that produced this experience
 * @param experience - The newly resolved experience config
 * @param previousLock - The previous lock state (if any)
 * @returns Updated lock state to persist in metadata.experience_lock
 */
export function computeExperienceLockUpdate(
  profile: VipBikeUserProfile,
  experience: VipBikeExperienceConfig,
  previousLock?: ExperienceLockState,
): ExperienceLockState {
  const sameProfile = previousLock
    ? isProfileSameAsLock(profile, previousLock)
    : false;
  const justChanged = !sameProfile || !previousLock?.lastChangedAt;

  return {
    lastChangedAt: justChanged
      ? new Date().toISOString()
      : previousLock!.lastChangedAt!,
    lastResolvedSegment: profile.segment,
    lastResolvedIntent: profile.intent,
    lastResolvedExperience: profile.experience,
    stabilityCount: experience.antiThrashing?.stabilityCount ?? 1,
  };
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
 * EXPERIENCE LOCK WRITEBACK: After resolving, the component should
 * call computeExperienceLockUpdate() and persist the result to
 * metadata.experience_lock. This resolver is pure and does NOT
 * write to the database.
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
 *
 *   // Persist lock update (component responsibility, not resolver's)
 *   const lockUpdate = computeExperienceLockUpdate(profile, newExperience, dbUser.metadata?.experience_lock);
 *   await updateUserSettings(userId, { experience_lock: lockUpdate });
 *
 *   return newExperience;
 */
export function resolveVipBikeExperience(
  profile: VipBikeUserProfile,
  experienceLock?: ExperienceLockState,
): VipBikeExperienceConfig {
  // ── Low confidence: show universal layout ──
  if (profile.confidence < 0.3) {
    const universal = PRESETS.find((p) => p.name === "universal")!;
    return {
      heroMode: resolveHero(profile),
      primaryCTA: resolveCTA(profile, profile.slug),
      sectionOrder: applyVisibilityRules(universal.sectionOrder, profile),
      featuredSections: [],
      featuredCategory: "all",
      onboardingVariant: "not_surveyed",
      copyTone: "friendly",
      showOnboardingCTA: true,
      showPromoChip: !!profile.source?.promoCode,
      presetName: "universal",
      antiThrashing: computeAntiThrashing(profile, experienceLock),
      experienceResolverVersion: EXPERIENCE_RESOLVER_VERSION,
    };
  }

  // ── Find best preset ──
  const preset = findBestPreset(profile);

  // ── Compose from modular resolvers ──
  const heroMode = resolveHero(profile);
  const sectionOrder = resolveSectionPriority(profile);
  const primaryCTA = resolveCTA(profile, profile.slug);
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
    antiThrashing: computeAntiThrashing(profile, experienceLock),
    experienceResolverVersion: EXPERIENCE_RESOLVER_VERSION,
  };
}

/**
 * Returns all available presets (for debugging / analytics / feature flags).
 */
export function getAvailablePresets(): ExperiencePreset[] {
  return [...PRESETS];
}