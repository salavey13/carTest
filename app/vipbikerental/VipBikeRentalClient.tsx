/**
 * VipBikeRentalClient.tsx
 * ========================
 * THIN ORCHESTRATION SHELL — delegates personalization to the adaptive storefront runtime.
 *
 * ARCHITECTURE: raw signals → profile → experience → composed sections
 *
 * This component does NOT read raw survey signals directly.
 * It goes through resolveVipBikeProfile() → resolveVipBikeExperience() → sectionMap.
 *
 * The sectionMap maps SectionId → JSX, and the experience.sectionOrder
 * determines which sections render and in what order.
 * Featured sections get visual emphasis.
 * Anti-thrashing prevents rapid reshuffling.
 * Behavior tracking enables progressive enrichment.
 *
 * GOLD EXAMPLE PATTERN:
 *   This is the reference implementation for franchise landing pages.
 *   For СварПрофи-НН (metal constructions), you would:
 *     1. Create a different set of SectionIds (catalog, orderForm, about, etc.)
 *     2. Create franchise-specific feature components in features/ directory
 *     3. Create a different survey normalizer for metal construction signals
 *     4. The same pipeline (profile → experience → sections) applies
 *     5. The same anti-thrashing and behavior tracking applies
 *
 * WHAT CHANGED vs previous refactor:
 *   - FIXED: onViewportEnter now uses motion.div (was plain div — tracking was dead)
 *   - FIXED: Hero double-render uses id filter instead of fragile index filter
 *   - EXTRACTED: Hero section into HeroSection.tsx feature component
 *   - REMOVED: Unused PipelineMapRidersOverview import
 *   - CLEANER: sectionMap no longer contains 80+ lines of inline hero JSX
 */

"use client";

import { AnimatePresence, motion, useScroll, useTransform } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { BikeShowcase } from "@/components/BikeShowcase";
import { cn } from "@/lib/utils";
import { useAppContext } from "@/contexts/AppContext";
import type { CatalogItemVM, FranchizeTheme } from "@/app/franchize/actions";

// ── Pipeline imports ──
import { resolveVipBikeProfile } from "@/app/franchize/lib/onboarding/resolve-profile";
import { resolveVipBikeExperience, isExperienceLocked } from "@/app/franchize/lib/onboarding/resolve-experience";
import { useBehaviorTracker } from "@/app/franchize/lib/onboarding/track-behavior";
import type {
  SectionId,
  HeroDisplayMode,
  VipBikeExperienceConfig,
  VipBikeUserProfile,
} from "@/app/franchize/lib/onboarding/experience-types";

// ── Feature component imports ──
import { HeroSection } from "./features/HeroSection";
import { ConversionPilot } from "./features/ConversionPilot";
import { ElectroEnduroShowcase } from "./features/ElectroEnduroShowcase";
import { MapRidersLivePreview } from "./features/MapRidersLivePreview";
import { GearSection } from "./features/GearSection";
import { StepsProgress } from "./features/StepsProgress";
import { RentalQuickActionHub } from "./features/RentalQuickActionHub";
import { VipBikeCompanyServiceHub } from "./features/VipBikeCompanyServiceHub";
import { ServiceCardsSection } from "./features/ServiceCardsSection";
import { HowItWorksSection } from "./features/HowItWorksSection";
import { InvestSection } from "./features/InvestSection";
import { FaqSection } from "./features/FaqSection";

// ── Shared types and constants ──
import type { MapRidersOverview, HeroPanel } from "./features/shared/types";
import {
  isEnabled,
  getSalePriceLabel,
  getBikeGallery,
  formatCompactNumber,
  fallbackElectroItems,
  fallbackMapLocations,
} from "./features/shared/constants";

// ─────────────────────────────────────────────────────
// Hero panel data (stays here — tightly coupled to hero state)
// ─────────────────────────────────────────────────────

const fallbackHeroPanels: Record<string, HeroPanel> = {
  rent: {
    mode: "rent",
    label: "Аренда",
    icon: "::FaMotorcycle::",
    eyebrow: "Премиальная бронь сегодня",
    title: "VIP Bike Electro-Enduro S1",
    description: "Контролируемый первый выезд: подготовленный электроэндуро, защитный комплект и сопровождение до уверенного возвращения.",
    imageUrl: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/IMG_bg-cf31dc2b-291b-440b-953b-6e1b4a838e4e.jpg",
    href: "/franchize/vip-bike",
    cta: "Выбрать байк",
    meta: [
      { label: "от", value: "4 900 ₽ / день" },
      { label: "статус", value: "Свободен" },
      { label: "включено", value: "Экип + ОСАГО" },
    ],
  },
  buy: {
    mode: "buy",
    label: "Покупка",
    icon: "::FaCartShopping::",
    eyebrow: "Мини-конфигуратор",
    title: "Соберите электроэндуро под свой стиль",
    description: "Модель, батарея, цвет и опции собираются в понятный заказ — без хаоса в переписке и с прозрачным следующим шагом.",
    imageUrl: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/81Dts9uMBXZXTKC7PjIbBRRRHYGQx_2TPEKFWvaUwDzzgSQPjxUf4GjAiRaDWIcWgwmeaZQTKppFn5VBS6yZeK7R-38bfc7fb-0d5a-4b62-b7e6-ca83950cb265.jpg",
    href: "/franchize/vip-bike/configurator",
    cta: "Конфигуратор",
    meta: [
      { label: "пакеты", value: "Standard / Long Range" },
      { label: "цвет", value: "Black / Lime" },
      { label: "финал", value: "Корзина" },
    ],
  },
  map: {
    mode: "map",
    label: "Карта",
    icon: "::FaMapLocationDot::",
    eyebrow: "Живая карта",
    title: "Живые маршруты и точки сбора",
    description: "Видите активность экипажа, точки встреч и темп группы заранее — поездка ощущается организованной ещё до старта.",
    href: "/franchize/vip-bike/map-riders",
    cta: "Открыть карту",
    meta: [
      { label: "онлайн", value: "3 райдера" },
      { label: "маршруты", value: "речные точки" },
      { label: "встречи", value: "2" },
    ],
  },
  rentals: {
    mode: "rentals",
    label: "Мои аренды",
    icon: "::FaTicket::",
    eyebrow: "Личный контроль",
    title: "Контролируйте активные аренды",
    description: "Статусы, подтверждения, фото до/после и возврат собраны в одном центре, чтобы сделка не зависала в чатах.",
    href: "/rentals",
    cta: "Мои аренды",
    meta: [
      { label: "сценарий", value: "бронь → возврат" },
      { label: "документы", value: "в одном месте" },
      { label: "поддержка", value: "онлайн" },
    ],
  },
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
};

// ─────────────────────────────────────────────────────
// Vibe profile helpers (derived from pipeline, not raw signals)
// ─────────────────────────────────────────────────────

function deriveBadge(profile: VipBikeUserProfile): string {
  if (!profile.onboardingCompleted) return "::FaCompass:: Универсальный подбор";
  switch (profile.segment) {
    case "sport": return "::FaBolt:: Спортивный сценарий";
    case "electro": return "::FaBolt:: Электро-мобильность";
    case "retro": return "::FaWandSparkles:: Neo-retro подборка";
    case "touring": return "::FaRoad:: Туристический маршрут";
    case "urban": return "::FaCity:: Городской поток";
    default: return "::FaRoute:: Персональный маршрут";
  }
}

function deriveTitle(profile: VipBikeUserProfile): string {
  if (!profile.onboardingCompleted) return "Подберём байк под задачу за 2 минуты";
  switch (profile.intent) {
    case "buy": return "Ваш сценарий: быстрый выбор и покупка";
    case "rent": return profile.experience === "beginner" ? "Ваш сценарий: безопасный первый выезд" : "Ваш сценарий: скорость и адреналин";
    case "community": return "Ваш сценарий: карта, райдеры, групповые выезды";
    case "explore": return "Ваш сценарий: открытие и подбор";
    default: return "Ваш сценарий: персональный маршрут";
  }
}

function deriveNote(profile: VipBikeUserProfile, experience: VipBikeExperienceConfig): string {
  if (!profile.onboardingCompleted) return "Пройди /start в Telegram, чтобы открыть персональные рекомендации на этой странице.";
  switch (experience.copyTone) {
    case "aggressive": return "Рекомендуем Supersport и быстрые слоты выдачи — система уже подобрала варианты.";
    case "premium": return "Для вас выделили подборку с маршрутами, которые выглядят хорошо и в поездке, и на фото.";
    case "friendly": return profile.experience === "beginner" ? "Рекомендуем начать с контролируемого первого выезда — экип и сопровождение включены." : "Персональный фильтр: меньше случайных карточек, быстрее уверенное решение.";
    case "discovery": return "Загляните в каталог — система настроила фильтры под ваши интересы.";
    default: return "Персональный фильтр: меньше случайных карточек, быстрее уверенное решение.";
  }
}

function getStartCommandLink(profile: VipBikeUserProfile): string | undefined {
  if (!profile.onboardingCompleted) return "https://t.me/oneBikePlsBot?start";
  return undefined;
}

// ═══════════════════════════════════════════════════════
// MAIN COMPONENT — thin orchestration shell
// ═══════════════════════════════════════════════════════

export function VipBikeRentalClient({ items, theme }: { items: CatalogItemVM[]; theme: FranchizeTheme }) {
  const { dbUser } = useAppContext();
  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 1], [0, -90]);

  // ══════════════════════════════════════════════════════
  // PIPELINE: Resolve profile and experience
  // ══════════════════════════════════════════════════════
  const profile = useMemo(() => resolveVipBikeProfile(dbUser), [dbUser]);
  const resolvedExperience = useMemo(
    () => resolveVipBikeExperience(profile, dbUser?.metadata?.experience_lock),
    [profile, dbUser?.metadata?.experience_lock],
  );

  // Behavior tracker for progressive enrichment + lock writeback
  const tracker = useBehaviorTracker();

  // ══════════════════════════════════════════════════════
  // ANTI-THRASHING: Lock experience for minimum duration
  // ══════════════════════════════════════════════════════
  const [currentExperience, setCurrentExperience] = useState<VipBikeExperienceConfig>(resolvedExperience);
  const hasPersistedLock = useRef(false);

  useEffect(() => {
    if (isExperienceLocked(currentExperience)) return;
    setCurrentExperience(resolvedExperience);
    if (hasPersistedLock.current) {
      tracker.persistExperienceLock(profile, resolvedExperience);
    }
    hasPersistedLock.current = true;
  }, [resolvedExperience, currentExperience, profile, tracker]);

  const experience = currentExperience;

  // ══════════════════════════════════════════════════════
  // HERO MODE: Driven by experience config
  // ══════════════════════════════════════════════════════
  const [heroMode, setHeroMode] = useState<HeroDisplayMode>(experience.heroMode);
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
  // VIBE PROFILE: Derived from pipeline (not raw signals)
  // ══════════════════════════════════════════════════════
  const vibeProfile = useMemo(() => ({
    badge: deriveBadge(profile),
    title: deriveTitle(profile),
    note: deriveNote(profile, experience),
    startCommandHref: getStartCommandLink(profile),
    ctaHref: experience.primaryCTA.href,
    ctaLabel: experience.primaryCTA.label,
    hasSurvey: profile.onboardingCompleted,
    promoCode: profile.source?.promoCode || "",
    isExternal: experience.primaryCTA.isExternal,
  }), [profile, experience]);

  // ══════════════════════════════════════════════════════
  // DATA FETCHING (unchanged)
  // ══════════════════════════════════════════════════════
  const [mapOverview, setMapOverview] = useState<MapRidersOverview | null>(null);
  const [catalogItems, setCatalogItems] = useState<CatalogItemVM[]>(items);
  const [isCatalogLoading, setIsCatalogLoading] = useState(items.length === 0);

  useEffect(() => {
    setCatalogItems(items);
    setIsCatalogLoading(items.length === 0);
  }, [items]);

  useEffect(() => {
    let isMounted = true;
    if (items.length === 0) {
      fetch("/api/franchize/catalog?slug=vip-bike")
        .then((response) => (response.ok ? response.json() : null))
        .then((payload) => {
          if (isMounted && payload?.success && Array.isArray(payload.data?.items)) {
            setCatalogItems(payload.data.items as CatalogItemVM[]);
          }
        })
        .catch(() => { if (isMounted) setCatalogItems([]); })
        .finally(() => { if (isMounted) setIsCatalogLoading(false); });
    }
    fetch("/api/map-riders/overview?slug=vip-bike")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => { if (isMounted && payload?.success) setMapOverview(payload.data as MapRidersOverview); })
      .catch(() => { if (isMounted) setMapOverview(null); });
    return () => { isMounted = false; };
  }, [items.length]);

  // ══════════════════════════════════════════════════════
  // HERO PANELS: Catalog-driven overrides
  // ══════════════════════════════════════════════════════
  const heroPanels = useMemo<Record<string, HeroPanel>>(() => {
    const rentItem = catalogItems.find((item) => item.availabilityStatus === "available" && item.pricePerDay > 0) ?? catalogItems.find((item) => item.pricePerDay > 0);
    const saleItem = catalogItems.find((item) => item.saleAvailable || isEnabled(item.rawSpecs?.sale));
    return {
      ...fallbackHeroPanels,
      rent: rentItem ? {
        ...fallbackHeroPanels.rent,
        title: rentItem.title,
        description: rentItem.description || fallbackHeroPanels.rent.description,
        imageUrl: getBikeGallery(rentItem)[0] || fallbackHeroPanels.rent.imageUrl,
        href: `/franchize/vip-bike?vehicle=${rentItem.id}`,
        meta: [
          { label: "аренда", value: rentItem.rentPriceLabel || `${rentItem.pricePerDay.toLocaleString("ru-RU")} ₽ / день` },
          { label: "статус", value: rentItem.availabilityLabel },
          { label: "категория", value: rentItem.category || "Electro-Enduro" },
        ],
      } : fallbackHeroPanels.rent,
      buy: saleItem ? {
        ...fallbackHeroPanels.buy,
        title: saleItem.title,
        description: saleItem.description || fallbackHeroPanels.buy.description,
        imageUrl: getBikeGallery(saleItem)[0] || fallbackHeroPanels.buy.imageUrl,
        href: `/franchize/vip-bike/market/${saleItem.id}/buy`,
        meta: [
          { label: "покупка", value: getSalePriceLabel(saleItem) },
          { label: "аренда", value: saleItem.rentPriceLabel || `${saleItem.pricePerDay.toLocaleString("ru-RU")} ₽ / день` },
          { label: "категория", value: saleItem.category || "Electro-Enduro" },
        ],
      } : fallbackHeroPanels.buy,
      map: {
        ...fallbackHeroPanels.map,
        meta: [
          { label: "онлайн", value: `${formatCompactNumber(mapOverview?.stats?.activeRiders, 3)} райдера` },
          { label: "за неделю", value: `${formatCompactNumber(mapOverview?.stats?.totalWeeklyDistanceKm, 127)} км` },
          { label: "встречи", value: formatCompactNumber(mapOverview?.stats?.meetupCount, 2) },
        ],
      },
    };
  }, [catalogItems, mapOverview]);

  const activeHeroPanel = heroPanels[heroMode] ?? heroPanels.rent;

  // ══════════════════════════════════════════════════════
  // SECTION MAP: SectionId → JSX with behavior tracking
  //
  // FIX: onViewportEnter requires motion.div (was plain div)
  // FIX: Hero is excluded — rendered separately above container
  // ══════════════════════════════════════════════════════
  const sectionMap = useMemo<Record<SectionId, React.ReactNode>>(() => ({
    hero: (
      <HeroSection
        vibeProfile={vibeProfile}
        heroPanels={heroPanels}
        activeHeroPanel={activeHeroPanel}
        heroMode={heroMode}
        onHeroModeChange={handleHeroModeChange}
      />
    ),
    bikeShowcase: <motion.section style={{ y }} className="relative"><BikeShowcase /></motion.section>,
    conversionPilot: <ConversionPilot items={catalogItems} overview={mapOverview} isCatalogLoading={isCatalogLoading} />,
    electroShowcase: (
      <motion.div onViewportEnter={() => tracker.trackViewCategory("electro")}>
        <ElectroEnduroShowcase items={catalogItems} isCatalogLoading={isCatalogLoading} />
      </motion.div>
    ),
    mapPreview: (
      <motion.div onViewportEnter={() => tracker.trackMapOpen()}>
        <MapRidersLivePreview overview={mapOverview} />
      </motion.div>
    ),
    gearSection: <GearSection />,
    stepsProgress: <StepsProgress items={catalogItems} />,
    rentalQuickActions: <RentalQuickActionHub items={catalogItems} overview={mapOverview} isCatalogLoading={isCatalogLoading} />,
    companyServiceHub: <VipBikeCompanyServiceHub />,
    serviceCards: <ServiceCardsSection />,
    howItWorks: <HowItWorksSection />,
    investSection: <InvestSection onDwellTime={(seconds) => tracker.trackSectionDwell("investSection", seconds)} />,
    faq: <FaqSection />,
  }), [catalogItems, mapOverview, isCatalogLoading, vibeProfile, tracker, y, handleHeroModeChange, heroPanels, activeHeroPanel, heroMode]);

  // ══════════════════════════════════════════════════════
  // DECLARATIVE SECTION RENDERING
  //
  // FIX: Hero excluded from dynamic sections (was fragile index filter)
  // ══════════════════════════════════════════════════════
  const renderedSections = useMemo(() => {
    return experience.sectionOrder
      .filter((id) => id !== "hero" && sectionMap[id] !== undefined)
      .map((id) => {
        const isFeatured = experience.featuredSections.includes(id);
        return (
          <div key={id} className={cn(isFeatured && "ring-2 ring-brand-yellow/20 rounded-2xl")}>
            {sectionMap[id]}
          </div>
        );
      });
  }, [experience.sectionOrder, experience.featuredSections, sectionMap]);

  // ══════════════════════════════════════════════════════
  // RENDER: Hero always first, dynamic sections follow
  // ══════════════════════════════════════════════════════
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      {/* Background gradients */}
      <div className="pointer-events-none fixed inset-0 z-[-2] bg-[radial-gradient(circle_at_top,rgba(255,106,0,0.14),transparent_35%),radial-gradient(circle_at_80%_20%,rgba(119,0,255,0.10),transparent_42%)]" />
      <div className="pointer-events-none fixed inset-0 z-[-3] bg-[linear-gradient(to_bottom,rgba(0,0,0,0.45),transparent_35%)]" />

      {/* Hero is always first — rendered directly, not in the container */}
      {sectionMap.hero}

      {/* Dynamic sections — ordered and filtered by experience config */}
      <div className="container mx-auto max-w-7xl space-y-20 px-4 py-16 sm:space-y-24 sm:py-24">
        {renderedSections}
      </div>
    </div>
  );
}
