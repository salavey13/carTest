/**
 * index.ts
 * ========
 * Barrel export for the adaptive storefront runtime pipeline.
 *
 * Import everything from here:
 *   import { resolveVipBikeProfile, resolveVipBikeExperience, START_LINKS } from "@/app/franchize/lib/onboarding";
 *
 * CRITICAL: This pipeline is franchise-scoped. The vip-bike normalizer
 * and resolver live here. Other franchises should create their own
 * onboarding/ directory with franchise-specific normalizers.
 * Types and payload-parser are shared across franchises.
 */

// Types
export type {
  VipBikeUserProfile,
  VipBikeExperienceConfig,
  VipBikeSegment,
  VipBikeIntent,
  VipBikeExperience,
  HeroDisplayMode,
  SectionId,
  SectionComplexity,
  EmotionalTone,
  SectionCapabilities,
  PrimaryCTA,
  ParsedPayload,
  PayloadType,
  BikeSurveyAnswers,
  BehaviorSignals,
  VipBikeUserMetadata,
} from "./experience-types";

// Constants
export { SCANNED_QR_MODELS_CAP } from "./experience-types";

// Payload parser
export {
  parseStartPayload,
  parsePayload,
  extractPromoCode,
  buildStartLink,
  START_LINKS,
} from "./payload-parser";

// Survey normalizer
export {
  normalizeSurveyToProfile,
  createDefaultProfile,
  decayByAge,
} from "./survey-normalizer";

// Profile resolver (THE entry point for components)
export { resolveVipBikeProfile, PROFILE_RESOLVER_VERSION } from "./resolve-profile";

// Experience resolver (THE entry point for UI composition)
export {
  resolveVipBikeExperience,
  resolveHero,
  resolveSectionPriority,
  resolveCTA,
  resolveFeaturedSections,
  isExperienceLocked,
  combinePresets,
  getAvailablePresets,
  computeExperienceLockUpdate,
  EXPERIENCE_RESOLVER_VERSION,
} from "./resolve-experience";

// Experience lock type (for persisting anti-thrashing state)
export type { ExperienceLockState } from "./resolve-experience";

// Section capability registry (for extending section metadata)
export { SECTION_CAPABILITIES } from "./resolve-experience";

// Experience preset type (for debugging/analytics)
export type { ExperiencePreset } from "./resolve-experience";

// Behavior tracker hook (for progressive enrichment + lock writeback)
export { useBehaviorTracker } from "./track-behavior";