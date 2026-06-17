"use client";
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
 * WHAT CHANGED vs old VipBikeRentalClient:
 *   - REMOVED: 60-line vibeProfile memo that read raw survey signals → replaced by deriveBadge/Title/Note
 *   - REMOVED: deriveHeroModeFromSurvey() → replaced by resolve-experience.ts
 *   - REMOVED: TELEGRAM_BOT_START_LINK constant → replaced by START_LINKS.onboard
 *   - REMOVED: surveyResults useMemo → replaced by resolveVipBikeProfile()
 *   - REMOVED: Hardcoded section order → replaced by experience.sectionOrder
 *   - ADDED: resolveVipBikeProfile + resolveVipBikeExperience pipeline
 *   - ADDED: useBehaviorTracker for progressive enrichment
 *   - ADDED: Anti-thrashing with isExperienceLocked + persistExperienceLock
 *   - ADDED: Declarative section rendering via sectionMap + experience.sectionOrder
 *   - ADDED: Featured section highlighting
 *   - EXTRACTED: Feature components into ./features/ directory
 *
 * WHAT DIDN'T CHANGE:
 *   - All existing section component visual designs
 *   - The hero video + tab system
 *   - The data fetching logic (catalog, map overview)
 *   - All helper components (InfoItem, StepItem, ServiceCard)
 */

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion, useScroll, useTransform } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { BikeShowcase } from "@/components/BikeShowcase";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAppContext } from "@/contexts/AppContext";
import { useTheme } from "next-themes";
import type { CatalogItemVM, FranchizeTheme } from "@/app/franchize/actions";
import { crewPaletteWithCssVars, withAlpha } from "@/app/franchize/lib/theme";
import { useFranchizeTheme } from "@/app/franchize/hooks/useFranchizeTheme";

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
  MapRidersOverview as PipelineMapRidersOverview,
} from "@/app/franchize/lib/onboarding/experience-types";

// ── Feature component imports ──
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
  getRussianRiderLabel,
  fallbackElectroItems,
  fallbackMapLocations,
  heroMetrics,
} from "./features/shared/constants";

// ─────────────────────────────────────────────────────
// Flagship bike selector — prioritizes electro-enduro models
// ─────────────────────────────────────────────────────

const ELECTRO_KEYWORDS = /electro|электро|enduro|эндуро|e-moto|emoto/i;
const FLAGSHIP_BIKE_ID = "sequence-zero"; // preferred flagship for hero

function selectFlagshipBike(items: CatalogItemVM[]): CatalogItemVM | undefined {
  // 1. Try exact flagship ID first
  const flagship = items.find((item) => item.id === FLAGSHIP_BIKE_ID && item.availabilityStatus === "available");
  if (flagship) return flagship;
  // 2. Then any available electro-enduro
  const electro = items.find((item) => item.availabilityStatus === "available" && ELECTRO_KEYWORDS.test(`${item.title} ${item.subtitle} ${item.category} ${item.rawSpecs?.bike_subtype ?? ""}`));
  if (electro) return electro;
  // 3. Fallback to first available with price
  return items.find((item) => item.availabilityStatus === "available" && item.pricePerDay > 0);
}

// ─────────────────────────────────────────────────────
// Hero panel data (stays here — tightly coupled to hero state)
// ─────────────────────────────────────────────────────

const fallbackHeroPanels: Record<string, HeroPanel> = {
  rent: {
    mode: "rent",
    label: "Аренда",
    icon: "::FaMotorcycle::",
    eyebrow: "Премиальная бронь сегодня",
    title: "Sequence Zero",
    description: "Контролируемый первый выезд: подготовленный электроэндуро, защитный комплект и сопровождение до уверенного возвращения.",
    imageUrl: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/IMG_bg-cf31dc2b-291b-440b-953b-6e1b4a838e4e.jpg",
    // href will be dynamically replaced with crewSlug below
    href: "/franchize/{slug}",
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
    href: "/franchize/{slug}/configurator",
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
    href: "/franchize/{slug}/map-riders",
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
    href: "/franchize/{slug}/rentals",
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
    title: "Sequence Zero",
    description: "Премиальный электромотоцикл: центральный двигатель 30 кВт, разгон 0–100 за 2.8 секунды, запас хода до 300 км. Тихая мощь нового поколения.",
    imageUrl: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/sequence-zero/image_1.jpg",
    href: "/franchize/{slug}/electro-enduro",
    cta: "Изучить электро",
    meta: [
      { label: "тип", value: "Electric Sport" },
      { label: "запас хода", value: "до 300 км" },
      { label: "разгон", value: "0–100 за 2.8 с" },
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
    case "aggressive": return "Рекомендуем Электроспорт и быстрые слоты выдачи — система уже подобрала варианты.";
    case "premium": return "Для вас выделили подборку с маршрутами, которые выглядят хорошо и в поездке, и на фото.";
    case "friendly": return profile.experience === "beginner" ? "Рекомендуем начать с контролируемого первого выезда — экип и сопровождение включены." : "Персональный фильтр: меньше случайных карточек, быстрее уверенное решение.";
    case "discovery": return "Загляните в каталог — система настроила фильтры под ваши интересы.";
    default: return "Персональный фильтр: меньше случайных карточек, быстрее уверенное решение.";
  }
}

// ═══════════════════════════════════════════════════════
// MAIN COMPONENT — thin orchestration shell
// ═══════════════════════════════════════════════════════

export function VipBikeRentalClient({
  crew,
  items,
  theme,
}: {
  crew?: { slug?: string; name?: string; header?: { brandName?: string } };
  items: CatalogItemVM[];
  theme: FranchizeTheme;
}) {
  // Extract crewSlug for dynamic routing - fallback to vip-bike for backward compatibility
  const crewSlug = crew?.slug || "vip-bike";
  const { dbUser } = useAppContext();

  // Apply franchize theme CSS variables for proper light/dark mode support
  useFranchizeTheme(theme);

  // Get theme-based surface colors for proper text/background contrast
  const surface = crewPaletteWithCssVars(theme);
  const { scrollYProgress } = useScroll();
  const { setTheme, resolvedTheme } = useTheme();
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
  const heroContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasManualHeroChoice.current) {
      setHeroMode(experience.heroMode);
    }
  }, [experience.heroMode]);

  const handleHeroModeChange = useCallback((mode: HeroDisplayMode) => {
    hasManualHeroChoice.current = true;
    setHeroMode(mode);
    // Smooth scroll to hero content panel so user sees the changed content
    requestAnimationFrame(() => {
      heroContentRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, []);

  // ══════════════════════════════════════════════════════
  // VIBE PROFILE: Derived from pipeline (not raw signals)
  // ══════════════════════════════════════════════════════
  const vibeProfile = useMemo(() => ({
    badge: deriveBadge(profile),
    title: deriveTitle(profile),
    note: deriveNote(profile, experience),
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
      fetch(`/api/franchize/catalog?slug=${crewSlug}`)
        .then((response) => (response.ok ? response.json() : null))
        .then((payload) => {
          if (isMounted && payload?.success && Array.isArray(payload.data?.items)) {
            setCatalogItems(payload.data.items as CatalogItemVM[]);
          }
        })
        .catch(() => { if (isMounted) setCatalogItems([]); })
        .finally(() => { if (isMounted) setIsCatalogLoading(false); });
    }
    fetch(`/api/map-riders/overview?slug=${crewSlug}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => { if (isMounted && payload?.success) setMapOverview(payload.data as MapRidersOverview); })
      .catch(() => { if (isMounted) setMapOverview(null); });
    return () => { isMounted = false; };
  }, [items.length, crewSlug]);

  // ══════════════════════════════════════════════════════
  // HERO PANELS: Catalog-driven overrides
  // ══════════════════════════════════════════════════════
  const heroPanels = useMemo<Record<string, HeroPanel>>(() => {
    const rentItem = selectFlagshipBike(catalogItems) ?? catalogItems.find((item) => item.pricePerDay > 0);
    const saleItem = catalogItems.find((item) => item.saleAvailable || isEnabled(item.rawSpecs?.sale));
    // Helper to replace {slug} placeholder with actual crewSlug
    const resolveHref = (href: string) => href.replace("{slug}", crewSlug);
    const basePanels = {
      ...fallbackHeroPanels,
      rent: { ...fallbackHeroPanels.rent, href: resolveHref(fallbackHeroPanels.rent.href) },
      buy: { ...fallbackHeroPanels.buy, href: resolveHref(fallbackHeroPanels.buy.href) },
      map: { ...fallbackHeroPanels.map, href: resolveHref(fallbackHeroPanels.map.href) },
      rentals: { ...fallbackHeroPanels.rentals, href: resolveHref(fallbackHeroPanels.rentals.href) },
      "electro-enduro": { ...fallbackHeroPanels["electro-enduro"], href: resolveHref(fallbackHeroPanels["electro-enduro"].href) },
    };
    return {
      ...basePanels,
      rent: rentItem ? {
        ...basePanels.rent,
        title: rentItem.title,
        description: rentItem.description || basePanels.rent.description,
        imageUrl: getBikeGallery(rentItem)[0] || basePanels.rent.imageUrl,
        href: `/franchize/${crewSlug}?vehicle=${rentItem.id}`,
        meta: [
          { label: "аренда", value: rentItem.rentPriceLabel || `${rentItem.pricePerDay.toLocaleString("ru-RU")} ₽ / день` },
          { label: "статус", value: rentItem.availabilityLabel },
          { label: "категория", value: rentItem.category || "Electro-Enduro" },
        ],
      } : basePanels.rent,
      buy: saleItem ? {
        ...basePanels.buy,
        title: saleItem.title,
        description: saleItem.description || basePanels.buy.description,
        imageUrl: getBikeGallery(saleItem)[0] || basePanels.buy.imageUrl,
        href: `/franchize/${crewSlug}/market/${saleItem.id}/buy`,
        meta: [
          { label: "покупка", value: getSalePriceLabel(saleItem) },
          { label: "аренда", value: saleItem.rentPriceLabel || `${saleItem.pricePerDay.toLocaleString("ru-RU")} ₽ / день` },
          { label: "категория", value: saleItem.category || "Electro-Enduro" },
        ],
      } : basePanels.buy,
      map: {
        ...basePanels.map,
        meta: [
          { label: "онлайн", value: `${formatCompactNumber(mapOverview?.stats?.activeRiders, 3)} райдера` },
          { label: "за неделю", value: `${formatCompactNumber(mapOverview?.stats?.totalWeeklyDistanceKm, 127)} км` },
          { label: "встречи", value: formatCompactNumber(mapOverview?.stats?.meetupCount, 2) },
        ],
      },
    };
  }, [catalogItems, mapOverview, crewSlug]);

  const activeHeroPanel = heroPanels[heroMode] ?? heroPanels.rent;

  // ══════════════════════════════════════════════════════
  // SECTION MAP: SectionId → JSX with behavior tracking
  // ══════════════════════════════════════════════════════
  const sectionMap = useMemo<Record<SectionId, React.ReactNode>>(() => ({
    hero: (
      <section className="relative flex min-h-[760px] items-center justify-center overflow-hidden px-4 pb-14 pt-28 text-white sm:pt-32">
        <div className="absolute inset-0 z-0">
          <video autoPlay muted loop playsInline className="absolute inset-0 h-full w-full object-cover brightness-[0.5] saturate-125">
            <source src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/2_5219998213838247718.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/70 to-black/60" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,106,0,0.15),transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_40%,rgba(217,154,0,0.12),transparent_45%)]" />
        </div>
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }} className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center text-center">
          <div className="mb-4 flex items-center justify-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-black/60 px-4 py-2 text-sm text-amber-400 backdrop-blur-md shadow-[0_0_20px_rgba(217,154,0,0.3)] transition-all hover:border-amber-400/50 hover:shadow-[0_0_30px_rgba(217,154,0,0.5)]">
              <VibeContentRenderer content="::FaBolt::" className="text-amber-400" />
              <span>{crew?.header?.brandName || crew?.name || "VIP BIKE"} · ПРЕМИАЛЬНЫЙ ПРОКАТ И МАРШРУТЫ</span>
            </div>
            <button
              type="button"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-amber-400/30 bg-black/60 text-amber-400 backdrop-blur-md shadow-[0_0_20px_rgba(217,154,0,0.3)] transition-all hover:border-amber-400/50 hover:bg-black/80 hover:shadow-[0_0_30px_rgba(217,154,0,0.5)]"
              aria-label="Toggle theme"
            >
              <VibeContentRenderer content={resolvedTheme === "dark" ? "::FaSun::" : "::FaMoon::"} className="text-amber-400" />
            </button>
          </div>
          <div className="mb-5 w-full max-w-2xl rounded-2xl border border-amber-400/20 bg-black/60 p-4 text-left text-sm backdrop-blur-xl shadow-[0_4px_20px_rgba(0,0,0,0.4),0_0_40px_rgba(217,154,0,0.1)] transition-all hover:border-amber-400/30 hover:shadow-[0_4px_30px_rgba(0,0,0,0.5),0_0_60px_rgba(217,154,0,0.15)]">
            <div className="mb-1 font-medium text-amber-400"><VibeContentRenderer content={vibeProfile.badge} /></div>
            <p className="font-orbitron text-lg text-white">{vibeProfile.title}</p>
            <p className="mt-1 text-white/80">{vibeProfile.note}</p>
          </div>
          <h1 className="font-orbitron text-5xl font-black uppercase leading-[0.9] tracking-tight text-white drop-shadow-[0_8px_22px_rgba(0,0,0,0.75)] sm:text-6xl md:text-7xl lg:text-8xl">
            <span className="block">Скорость. Контроль.</span>
            <span className="block text-amber-400 drop-shadow-[0_0_30px_rgba(217,154,0,0.6)]">Ваш выезд организован заранее.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-base font-light text-white/90 sm:text-lg md:text-xl">
            Премиальный прокат в Нижнем Новгороде: от выбора модели до возврата — единый управляемый поток, где клиент понимает цену, слот, защиту и следующий шаг.
          </p>
          <div className="mt-9 w-full max-w-5xl rounded-3xl border border-amber-400/20 bg-black/60 p-3 text-left shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-4">
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4" role="tablist" aria-label="VIP Bike quick scenario selector">
              {(Object.values(heroPanels) as HeroPanel[]).map((panel) => {
                const isActive = heroMode === panel.mode;
                return (
                  <button key={panel.mode} type="button" role="tab" aria-selected={isActive} onClick={() => handleHeroModeChange(panel.mode as HeroDisplayMode)} className={cn(
                    "rounded-2xl border px-3 py-3 text-left transition-all duration-300",
                    isActive
                      ? "border-amber-400 bg-amber-400/20 text-white shadow-[0_0_25px_rgba(217,154,0,0.4)] ring-2 ring-amber-400/60"
                      : "border-white/15 bg-white/5 text-white/75 hover:border-amber-400/40 hover:bg-white/10 hover:text-white hover:shadow-[0_0_15px_rgba(217,154,0,0.2)]"
                  )}>
                    <span className="mb-1 flex items-center gap-2 text-xs uppercase tracking-[0.22em]"><VibeContentRenderer content={panel.icon} className={isActive ? "text-amber-400" : ""} />{panel.label}</span>
                    <span className="block font-orbitron text-sm sm:text-base">{panel.cta}</span>
                  </button>
                );
              })}
            </div>
            <AnimatePresence mode="wait">
              <motion.div ref={heroContentRef} key={activeHeroPanel.mode} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }} className="mt-4 grid gap-4 overflow-hidden rounded-2xl border border-amber-400/15 bg-black/40 p-4 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-xl sm:grid-cols-[1.1fr_0.9fr] sm:p-5">
                <div className="flex min-h-[260px] flex-col justify-between gap-5">
                  <div>
                    <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-black/50 px-3 py-1 text-xs uppercase tracking-[0.22em] text-amber-400 shadow-[0_0_15px_rgba(217,154,0,0.3)]"><VibeContentRenderer content={activeHeroPanel.icon} />{activeHeroPanel.eyebrow}</div>
                    <h2 className="font-orbitron text-2xl font-bold text-white sm:text-3xl drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">{activeHeroPanel.title}</h2>
                    <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/80 sm:text-base">{activeHeroPanel.description}</p>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {activeHeroPanel.meta.map((item) => (
                      <div key={`${activeHeroPanel.mode}-${item.label}`} className="rounded-xl border border-amber-400/20 bg-black/40 p-3 backdrop-blur-sm transition-all hover:border-amber-400/40 hover:bg-black/50">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-amber-400/70">{item.label}</p>
                        <p className="mt-1 font-orbitron text-sm text-white">{item.value}</p>
                      </div>
                    ))}
                  </div>
                  <Button asChild size="lg" variant={activeHeroPanel.mode === "rent" ? "accent" : "outline"} className="w-full font-orbitron sm:w-fit transition-all hover:scale-105">
                    <Link href={activeHeroPanel.href} className="inline-flex items-center gap-2"><VibeContentRenderer content={activeHeroPanel.icon} />{activeHeroPanel.cta}</Link>
                  </Button>
                </div>
                <div className="relative min-h-[260px] overflow-hidden rounded-2xl border border-amber-400/20 bg-black/50 shadow-[0_0_30px_rgba(217,154,0,0.2)]">
                  {activeHeroPanel.imageUrl ? <Image src={activeHeroPanel.imageUrl} alt={activeHeroPanel.title} fill className="object-cover opacity-90" /> : <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,210,80,0.30),transparent_32%),radial-gradient(circle_at_70%_65%,rgba(64,255,190,0.18),transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.01))]" />}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="mt-8 grid w-full max-w-4xl grid-cols-1 gap-3 text-left sm:grid-cols-2 lg:grid-cols-4">
            {heroMetrics.map((chip) => (
              <div key={chip} className="rounded-xl border border-amber-400/20 bg-black/50 px-3 py-2 text-sm backdrop-blur-md transition-all hover:border-amber-400/40 hover:bg-black/60 hover:shadow-[0_0_15px_rgba(217,154,0,0.2)]">
                <VibeContentRenderer content={chip} className="text-white/90 hover:text-white" />
              </div>
            ))}
          </div>
        </motion.div>
      </section>
    ),
    bikeShowcase: (
      <motion.section style={{ y }} className="relative w-full">
        <BikeShowcase edgeToEdge />
      </motion.section>
    ),
    conversionPilot: <ConversionPilot items={catalogItems} overview={mapOverview} isCatalogLoading={isCatalogLoading} crewSlug={crewSlug} />,
    electroShowcase: (
      <div onViewportEnter={() => tracker.trackViewCategory("electro")}>
        <ElectroEnduroShowcase items={catalogItems} isCatalogLoading={isCatalogLoading} crewSlug={crewSlug} />
      </div>
    ),
    mapPreview: (
      <div onViewportEnter={() => tracker.trackMapOpen()}>
        <MapRidersLivePreview overview={mapOverview} crewSlug={crewSlug} />
      </div>
    ),
    gearSection: <GearSection />,
    stepsProgress: <StepsProgress items={catalogItems} crewSlug={crewSlug} />,
    rentalQuickActions: <RentalQuickActionHub items={catalogItems} overview={mapOverview} isCatalogLoading={isCatalogLoading} crewSlug={crewSlug} />,
    companyServiceHub: <VipBikeCompanyServiceHub crewSlug={crewSlug} />,
    serviceCards: <ServiceCardsSection />,
    howItWorks: <HowItWorksSection crewSlug={crewSlug} />,
    investSection: <InvestSection onDwellTime={(seconds) => tracker.trackSectionDwell("investSection", seconds)} />,
    faq: <FaqSection />,
  }), [catalogItems, mapOverview, isCatalogLoading, heroMode, vibeProfile, tracker, y, handleHeroModeChange, heroPanels, crewSlug]);

  // ══════════════════════════════════════════════════════
  // DECLARATIVE SECTION RENDERING
  // ══════════════════════════════════════════════════════
  const renderedSections = useMemo(() => {
    return experience.sectionOrder
      .filter((id) => id !== "hero")          // hero rendered separately above
      .filter((id) => sectionMap[id] !== undefined)
      .map((id) => {
        const isFeatured = experience.featuredSections.includes(id);
        const isFullBleed = id === "bikeShowcase";

        return (
          <div
            key={id}
            className={cn(
              isFullBleed && "relative left-1/2 w-screen -translate-x-1/2",
              isFeatured && !isFullBleed && "ring-2 ring-brand-yellow/20 rounded-2xl",
            )}
          >
            {sectionMap[id]}
          </div>
        );
      });
  }, [experience.sectionOrder, experience.featuredSections, sectionMap]);

  // ══════════════════════════════════════════════════════
  // RENDER: Hero always first, dynamic sections follow
  // ══════════════════════════════════════════════════════
  return (
    <div className="relative min-h-screen overflow-hidden" style={surface.page}>
      {/* Background gradients - use theme-based colors with CSS variable support */}
      <div className="pointer-events-none fixed inset-0 z-[-2]" style={{
        background: theme.isAuto
          ? `radial-gradient(circle at top, ${withAlpha("var(--franchize-accent-main)", 0.14)} 0%, transparent 35%), radial-gradient(circle at 80% 20%, ${withAlpha("var(--franchize-border-soft)", 0.10)} 0%, transparent 42%)`
          : `radial-gradient(circle at top, ${withAlpha(theme.palette.accentMain, 0.14)} 0%, transparent 35%), radial-gradient(circle at 80% 20%, ${withAlpha(theme.palette.borderSoft, 0.10)} 0%, transparent 42%)`
      }} />
      <div className="pointer-events-none fixed inset-0 z-[-3] bg-[linear-gradient(to_bottom,rgba(0,0,0,0.45),transparent_35%)]" />

      {/* Hero is always first */}
      {sectionMap.hero}

      {/* Dynamic sections — ordered and filtered by experience config */}
      <div className="container mx-auto max-w-7xl space-y-20 px-4 py-16 sm:space-y-24 sm:py-24">
        {renderedSections}
      </div>
    </div>
  );
}