/**
 * VipBikeRentalClient-integration.tsx
 * ====================================
 * Integration pattern for making VipBikeRentalClient data-driven.
 *
 * This file shows the MINIMAL changes needed to transform the current
 * 1984-line component from "scattered if/else personalization" into
 * "declarative section composition driven by resolve-experience".
 *
 * KEY CHANGES vs current VipBikeRentalClient.tsx:
 *   1. Replace raw survey access with resolveVipBikeProfile()
 *   2. Replace deriveHeroModeFromSurvey() with resolve-experience.ts
 *   3. Replace vibeProfile memo with experience config
 *   4. Replace hardcoded section order with experience.sectionOrder
 *   5. Render sections via a sectionMap → sections.map(renderSection)
 *   6. Add useBehaviorTracker() for progressive enrichment
 *   7. Add anti-thrashing with experience lock writeback
 *
 * WHAT DOESN'T CHANGE:
 *   - All existing section components (ConversionPilot, ElectroEnduroShowcase, etc.)
 *   - The visual design of each section
 *   - The hero video + tab system (still works the same way)
 *   - The data fetching logic (catalog, map overview)
 *
 * This is a REFACTOR, not a rewrite. The goal is to make the component
 * a thin orchestration shell that delegates personalization to the pipeline.
 */

"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion, useScroll, useTransform } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { BikeShowcase } from "@/components/BikeShowcase";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";

// VipBike section components
import { HeroSection } from "@/app/vipbikerental/features/HeroSection";
import { ConversionPilot } from "@/app/vipbikerental/features/ConversionPilot";
import { ElectroEnduroShowcase } from "@/app/vipbikerental/features/ElectroEnduroShowcase";
import { MapRidersLivePreview } from "@/app/vipbikerental/features/MapRidersLivePreview";
import { GearSection } from "@/app/vipbikerental/features/GearSection";
import { StepsProgress } from "@/app/vipbikerental/features/StepsProgress";
import { RentalQuickActionHub } from "@/app/vipbikerental/features/RentalQuickActionHub";
import { VipBikeCompanyServiceHub } from "@/app/vipbikerental/features/VipBikeCompanyServiceHub";
import { ServiceCardsSection } from "@/app/vipbikerental/features/ServiceCardsSection";
import { HowItWorksSection } from "@/app/vipbikerental/features/HowItWorksSection";
import { InvestSection } from "@/app/vipbikerental/features/InvestSection";
import { FaqSection } from "@/app/vipbikerental/features/FaqSection";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useAppContext } from "@/contexts/AppContext";
import type { CatalogItemVM, FranchizeTheme } from "@/app/franchize/actions";
import {
  DEFAULT_COLOR_OPTIONS,
  DEFAULT_CONFIG_OPTIONS,
  resolveBuyColorOptions,
  resolveBuyConfigOptions,
} from "@/app/franchize/lib/sale-config";

// ── Pipeline imports ──
import { resolveVipBikeProfile } from "@/app/franchize/lib/onboarding/resolve-profile";
import { resolveVipBikeExperience, isExperienceLocked } from "@/app/franchize/lib/onboarding/resolve-experience";
import { START_LINKS } from "@/app/franchize/lib/onboarding/payload-parser";
import { useBehaviorTracker } from "@/app/franchize/lib/onboarding/track-behavior";
import type {
  SectionId,
  HeroDisplayMode,
  VipBikeExperienceConfig,
  VipBikeUserProfile,
} from "@/app/franchize/lib/onboarding/experience-types";

// ── Existing types (unchanged) ──
type ServiceItem = { icon: string; text: string };
type MapRidersOverview = {
  stats?: {
    activeRiders?: number;
    meetupCount?: number;
    totalWeeklyDistanceKm?: number;
  };
  liveLocations?: Array<{
    lat?: number;
    lng?: number;
    speed_kmh?: number;
    updated_at?: string;
    user_id?: string;
  }>;
  meetups?: Array<{
    lat?: number;
    lng?: number;
    title?: string;
    comment?: string;
    scheduled_at?: string;
  }>;
  latestCompleted?: Array<{
    rider_name?: string;
    total_distance_km?: number;
    duration_seconds?: number;
    avg_speed_kmh?: number;
    max_speed_kmh?: number;
  }>;
};

type HeroPanel = {
  mode: HeroDisplayMode;
  label: string;
  icon: string;
  eyebrow: string;
  title: string;
  description: string;
  imageUrl?: string;
  href: string;
  cta: string;
  meta: Array<{ label: string; value: string }>;
};

// ── Existing helpers (unchanged) ──
const formatCompactNumber = (value: number | undefined, fallback: number) =>
  Number(value ?? fallback).toLocaleString("ru-RU", { maximumFractionDigits: 1 });

// ... (fallbackHeroPanels, ConversionPilot, StepsProgress, etc. stay EXACTLY as-is)
// ... I'm only showing the CHANGED sections below.

// ═══════════════════════════════════════════════════════
// THE KEY CHANGE: VipBikeRentalClient now uses the pipeline
// ═══════════════════════════════════════════════════════

export function VipBikeRentalClient({ items, theme }: { items: CatalogItemVM[]; theme: FranchizeTheme }) {
  const { dbUser } = useAppContext();
  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 1], [0, -90]);

  // ══════════════════════════════════════════════════════
  // NEW: Resolve profile and experience from pipeline
  // ══════════════════════════════════════════════════════
  const profile = useMemo(() => resolveVipBikeProfile(dbUser), [dbUser]);
  const resolvedExperience = useMemo(
    () => resolveVipBikeExperience(profile, dbUser?.metadata?.experience_lock),
    [profile, dbUser?.metadata?.experience_lock],
  );

  // NEW: Behavior tracker for progressive enrichment + lock writeback
  const tracker = useBehaviorTracker();

  // ══════════════════════════════════════════════════════
  // NEW: Anti-thrashing with experience lock writeback
  // ══════════════════════════════════════════════════════
  // The experience is stored in state. On each profile change,
  // we check if the previous experience is still locked.
  // If locked → keep old experience. If not → apply new one.
  const [currentExperience, setCurrentExperience] = useState<VipBikeExperienceConfig>(resolvedExperience);
  const hasPersistedLock = useRef(false);

  useEffect(() => {
    // Anti-thrashing: if the current experience is still locked, don't change
    if (isExperienceLocked(currentExperience)) {
      return;
    }

    // Apply the new experience
    setCurrentExperience(resolvedExperience);

    // Persist the experience lock update (C2 fix)
    // Only persist after the first experience is established
    if (hasPersistedLock.current) {
      tracker.persistExperienceLock(profile, resolvedExperience);
    }
    hasPersistedLock.current = true;
  }, [resolvedExperience, currentExperience, profile, tracker]);

  // Use the (possibly locked) current experience for rendering
  const experience = currentExperience;

  // Hero mode is now driven by the experience config
  const [heroMode, setHeroMode] = useState<HeroDisplayMode>(experience.heroMode);

  // Sync heroMode when experience changes (e.g., after survey data loads)
  const hasManualHeroChoice = useRef(false);
  useEffect(() => {
    if (!hasManualHeroChoice.current) {
      setHeroMode(experience.heroMode);
    }
  }, [experience.heroMode]);

  const handleHeroModeChange = useCallback((mode: HeroDisplayMode) => {
    hasManualHeroChoice.current = true;
    setHeroMode(mode);
  }, []);

  // ══════════════════════════════════════════════════════
  // NEW: vibeProfile is now derived from the experience config
  // (replaces the 60-line memo that was reading raw survey signals)
  // ══════════════════════════════════════════════════════
  const vibeProfile = useMemo(() => {
    const badge = deriveBadge(profile, experience);
    const title = deriveTitle(profile, experience);
    const note = deriveNote(profile, experience);

    return {
      badge,
      title,
      note,
      ctaHref: experience.primaryCTA.href,
      ctaLabel: experience.primaryCTA.label,
      hasSurvey: profile.onboardingCompleted as boolean,
      promoCode: profile.source?.promoCode || "",
      isExternal: experience.primaryCTA.isExternal,
    };
  }, [profile, experience]);

  // Data fetching (unchanged)
  const [mapOverview, setMapOverview] = useState<MapRidersOverview | null>(null);
  const [catalogItems, setCatalogItems] = useState<CatalogItemVM[]>(items);
  const [isCatalogLoading, setIsCatalogLoading] = useState(items.length === 0);

  // ... (fetch effects unchanged)

  // heroPanels memo (unchanged, just the type adapts)
  const heroPanels = useMemo<Record<HeroDisplayMode, HeroPanel>>(() => {
    // ... same as before, but now includes "electro-enduro" mode
    return {
      ...fallbackHeroPanels,
      // ... catalog-driven overrides
      "electro-enduro": {
        mode: "electro-enduro",
        label: "Электро",
        icon: "::FaBolt::",
        eyebrow: "Тихая мощь нового поколения",
        title: "Electro-Enduro S1",
        description: "Электрический эндуро для города и бездорожья. Тишина, моментальный крутящий момент, нулевые выбросы.",
        imageUrl: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/IMG_bg-cf31dc2b-291b-440b-953b-6e1b4a838e4e.jpg",
        href: "/franchize/vip-bike?category=electro",
        cta: "Изучить электро",
        meta: [
          { label: "тип", value: "Electro-Enduro" },
          { label: "запас хода", value: "до 120 км" },
          { label: "зарядка", value: "2.5 часа" },
        ],
      },
    } as Record<HeroDisplayMode, HeroPanel>;
  }, [catalogItems, mapOverview]);

  // ══════════════════════════════════════════════════════
  // NEW: Section rendering via sectionMap with behavior tracking
  // ══════════════════════════════════════════════════════
  const sectionMap = useMemo(() => ({
    hero: <HeroSection /* ...existing hero JSX... */ />,
    bikeShowcase: <motion.section style={{ y }}><BikeShowcase /></motion.section>,
    conversionPilot: <ConversionPilot items={catalogItems} overview={mapOverview} isCatalogLoading={isCatalogLoading} />,
    electroShowcase: (
      <div onViewportEnter={() => tracker.trackViewCategory("electro")}>
        <ElectroEnduroShowcase items={catalogItems} isCatalogLoading={isCatalogLoading} />
      </div>
    ),
    mapPreview: (
      <div onViewportEnter={() => tracker.trackMapOpen()}>
        <MapRidersLivePreview overview={mapOverview} />
      </div>
    ),
    gearSection: <GearSection />,
    stepsProgress: <StepsProgress items={catalogItems} />,
    rentalQuickActions: <RentalQuickActionHub items={catalogItems} overview={mapOverview} isCatalogLoading={isCatalogLoading} />,
    companyServiceHub: <VipBikeCompanyServiceHub />,
    serviceCards: <ServiceCardsSection />,
    howItWorks: <HowItWorksSection />,
    investSection: (
      <InvestSection onDwellTime={(seconds) => tracker.trackSectionDwell("investSection", seconds)} />
    ),
    faq: <FaqSection />,
  }), [catalogItems, mapOverview, isCatalogLoading, heroMode, vibeProfile, tracker]);

  // ══════════════════════════════════════════════════════
  // NEW: Declarative section rendering with featured highlighting
  // ══════════════════════════════════════════════════════
  const renderedSections = useMemo(() => {
    return experience.sectionOrder
      .filter((id) => sectionMap[id] !== undefined)
      .map((id) => {
        const isFeatured = experience.featuredSections.includes(id);
        return (
          <div
            key={id}
            className={cn(
              isFeatured && "ring-2 ring-brand-yellow/20 rounded-2xl",
            )}
          >
            {sectionMap[id]}
          </div>
        );
      });
  }, [experience.sectionOrder, experience.featuredSections, sectionMap]);

  // ══════════════════════════════════════════════════════
  // RENDER: Same outer shell, sections rendered by pipeline
  // ══════════════════════════════════════════════════════
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      {/* Background gradients (unchanged) */}
      <div className="pointer-events-none fixed inset-0 z-[-2] bg-[radial-gradient(circle_at_top,rgba(255,106,0,0.14),transparent_35%),radial-gradient(circle_at_80%_20%,rgba(119,0,255,0.10),transparent_42%)]" />
      <div className="pointer-events-none fixed inset-0 z-[-3] bg-[linear-gradient(to_bottom,rgba(0,0,0,0.45),transparent_35%)]" />

      {/* Hero section — always first */}
      {sectionMap.hero}

      {/* Dynamic sections — ordered and filtered by experience config */}
      <div className="container mx-auto max-w-7xl space-y-20 px-4 py-16 sm:space-y-24 sm:py-24">
        {renderedSections.filter((_, i) => i > 0)}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// Helper: Derive vibeProfile badge/title/note from pipeline
// ═══════════════════════════════════════════════════════

function deriveBadge(profile: VipBikeUserProfile, experience: VipBikeExperienceConfig): string {
  if (!profile.onboardingCompleted) {
    return "::FaCompass:: Универсальный подбор";
  }
  switch (profile.segment) {
    case "sport": return "::FaBolt:: Спортивный сценарий";
    case "electro": return "::FaBolt:: Электро-мобильность";
    case "retro": return "::FaWandSparkles:: Neo-retro подборка";
    case "touring": return "::FaRoad:: Туристический маршрут";
    case "urban": return "::FaCity:: Городской поток";
    default: return "::FaRoute:: Персональный маршрут";
  }
}

function deriveTitle(profile: VipBikeUserProfile, experience: VipBikeExperienceConfig): string {
  if (!profile.onboardingCompleted) {
    return "Подберём байк под задачу за 2 минуты";
  }
  switch (profile.intent) {
    case "buy": return "Ваш сценарий: быстрый выбор и покупка";
    case "rent": return profile.experience === "beginner"
      ? "Ваш сценарий: безопасный первый выезд"
      : "Ваш сценарий: скорость и адреналин";
    case "community": return "Ваш сценарий: карта, райдеры, групповые выезды";
    case "explore": return "Ваш сценарий: открытие и подбор";
    default: return "Ваш сценарий: персональный маршрут";
  }
}

function deriveNote(profile: VipBikeUserProfile, experience: VipBikeExperienceConfig): string {
  if (!profile.onboardingCompleted) {
    return "Пройди анкету в Telegram, чтобы увидеть персональные рекомендации.";
  }
  switch (experience.copyTone) {
    case "aggressive":
      return "Рекомендуем Supersport и быстрые слоты выдачи — система уже подобрала варианты.";
    case "premium":
      return "Для вас выделили подборку с маршрутами, которые выглядят хорошо и в поездке, и на фото.";
    case "friendly":
      return profile.experience === "beginner"
        ? "Рекомендуем начать с контролируемого первого выезда — экип и сопровождение включены."
        : "Персональный фильтр: меньше случайных карточек, быстрее уверенное решение.";
    case "discovery":
      return "Загляните в каталог — система настроила фильтры под ваши интересы.";
    default:
      return "Персональный фильтр: меньше случайных карточек, быстрее уверенное решение.";
  }
}

// ═══════════════════════════════════════════════════════
// REMOVED: deriveHeroModeFromSurvey() — replaced by resolve-experience.ts
// REMOVED: TELEGRAM_BOT_START_LINK constant — replaced by START_LINKS.onboard
// REMOVED: 60-line vibeProfile memo — replaced by deriveBadge/Title/Note helpers
// REMOVED: surveyResults useMemo — replaced by resolveVipBikeProfile()
// REMOVED: manual experience lock — now handled by useBehaviorTracker().persistExperienceLock()
// ═══════════════════════════════════════════════════════