"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ShoppingCart } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { toCategoryId } from "../lib/navigation";
import type { FranchizeRouteCtaPolicy } from "../lib/route-cta-policy";
import { shouldShowFloatingCart } from "../lib/route-cta-policy";
import { catalogCardVariantStyles, crewPaletteForSurface, interactionRingStyle } from "../lib/theme";
import type { CatalogItemVM, FranchizeCrewVM } from "../actions";
import { upsertFranchizeIntent } from "../actions";
import { FloatingCartIconLinkBySlug } from "./FloatingCartIconLinkBySlug";
import { ItemModal } from "../modals/Item";
import { useFranchizeCart } from "../hooks/useFranchizeCart";
import { buildCatalogRentalStrip } from "../lib/catalog-rental-strip";

interface CatalogClientProps {
  crew: FranchizeCrewVM;
  slug: string;
  items: CatalogItemVM[];
  mode?: "rental" | "electro";
  ctaPolicy?: FranchizeRouteCtaPolicy;
}

type QuickFilterKey = "all" | "budget" | "premium" | "newbie" | "topRated";

const QUICK_FILTERS: Array<{ key: QuickFilterKey; label: string }> = [
  { key: "all", label: "Все" },
  { key: "budget", label: "До 5000" },
  { key: "premium", label: "Премиум 7000+" },
  { key: "newbie", label: "Для новичка" },
  { key: "topRated", label: "Лучшие отзывы" },
];

const sortWbItemLast = <T extends { category: string }>(groups: T[]) => {
  const regular = groups.filter((group) => !group.category.toLowerCase().includes("wbitem"));
  const wbItems = groups.filter((group) => group.category.toLowerCase().includes("wbitem"));
  return [...regular, ...wbItems];
};

const hasRentPrice = (item: CatalogItemVM) => item.pricePerDay > 0;
const hasSalePrice = (item: CatalogItemVM) => item.saleAvailable && Boolean(item.salePrice && item.salePrice > 0);

function CatalogCardSkeleton({ index }: { index: number }) {
  return (
    <article className="overflow-hidden rounded-3xl border border-[var(--catalog-border)] bg-[var(--catalog-card-bg)]" aria-hidden="true">
      <div className="relative aspect-[9/16] overflow-hidden bg-black/20">
        <div
          className="absolute inset-y-0 w-1/2 animate-shimmer bg-gradient-to-r from-transparent via-white/15 to-transparent"
          style={{ animationDelay: `${index * 120}ms` }}
        />
      </div>
      <div className="space-y-3 p-3">
        <div className="h-4 w-2/3 rounded-full bg-[var(--catalog-muted)]/25" />
        <div className="h-3 w-full rounded-full bg-[var(--catalog-muted)]/20" />
        <div className="h-3 w-4/5 rounded-full bg-[var(--catalog-muted)]/20" />
        <div className="h-10 rounded-xl bg-[var(--catalog-accent)]/25" />
      </div>
    </article>
  );
}

export function CatalogClient({ crew, slug, items, mode = "rental", ctaPolicy }: CatalogClientProps) {
  const surface = crewPaletteForSurface(crew.theme);
  const [selectedItem, setSelectedItem] = useState<CatalogItemVM | null>(null);
  const { addItem } = useFranchizeCart(crew.slug || slug);
  const [selectedOptions, setSelectedOptions] = useState({ package: "Базовый", duration: "1 день", perk: "Стандарт", auction: "Без аукциона" });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchCtaFocused, setSearchCtaFocused] = useState(false);
  const [clearFocused, setClearFocused] = useState(false);
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  const [quickFilter, setQuickFilter] = useState<QuickFilterKey>("all");
  const [campaignIndex, setCampaignIndex] = useState(0);
  const [carouselActiveByCategory, setCarouselActiveByCategory] = useState<Record<string, number>>({});
  const searchParams = useSearchParams();
  const { user, dbUser } = useAppContext();
  const lastQueryViewedVehicleRef = useRef<string>("");
  const recordRentIntentRef = useRef<
    (item: CatalogItemVM, stage: "viewed" | "configured", metadata?: Record<string, unknown>) => Promise<unknown>
  >();
  const resolvedSlug = crew.slug || slug;
  const showFloatingCart = ctaPolicy ? shouldShowFloatingCart(ctaPolicy, { cartRelevant: true }) : true;
  const carouselRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const promoModules = useMemo(() => {
    const now = Date.now();
    const parseDate = (value: string) => {
      if (!value) return Number.NaN;
      const ts = Date.parse(value);
      return Number.isNaN(ts) ? Number.NaN : ts;
    };

    const campaignPool = [
      ...(crew.catalog.promoBanners ?? []).map((item, index) => ({
        id: `${item.id}-${index}` ,
        title: item.title,
        subtitle: item.subtitle,
        href: item.href,
        imageUrl: item.imageUrl,
        badge: item.code || "Промо",
        priority: item.priority ?? 50,
        activeFrom: item.activeFrom ?? "",
        activeTo: item.activeTo ?? "",
        ctaLabel: item.ctaLabel || "Открыть",
      })),
      ...(crew.catalog.adCards ?? []).map((item, index) => ({
        id: `${item.id}-${index}` ,
        title: item.title,
        subtitle: item.subtitle,
        href: item.href,
        imageUrl: item.imageUrl,
        badge: item.badge || "Анонс",
        priority: item.priority ?? 40,
        activeFrom: item.activeFrom ?? "",
        activeTo: item.activeTo ?? "",
        ctaLabel: item.ctaLabel || "Подробнее",
      })),
    ];

    const activeCampaigns = campaignPool
      .filter((item) => item.title.trim().length > 0)
      .filter((item) => {
        const fromTs = parseDate(item.activeFrom);
        const toTs = parseDate(item.activeTo);
        const afterFrom = Number.isNaN(fromTs) ? true : now >= fromTs;
        const beforeTo = Number.isNaN(toTs) ? true : now <= toTs;
        return afterFrom && beforeTo;
      })
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

    if (activeCampaigns.length > 0) {
      return activeCampaigns.slice(0, 5).map((item) => ({
        ...item,
        title: item.title.length > 84 ? `${item.title.slice(0, 81)}...` : item.title,
        href: item.href?.trim() || `/franchize/${crew.slug || slug}#catalog-sections`,
      }));
    }

    return crew.catalog.tickerItems.slice(0, 3).map((item, index) => ({
      id: `${item.id}-${index}`,
      title: item.text,
      subtitle: "",
      href: item.href?.trim() || `/franchize/${crew.slug || slug}#catalog-sections`,
      imageUrl: "",
      badge: "Промо",
      priority: 0,
      activeFrom: "",
      activeTo: "",
      ctaLabel: "Открыть",
    }));
  }, [crew.catalog.adCards, crew.catalog.promoBanners, crew.catalog.tickerItems, crew.slug, slug]);

  useEffect(() => {
    if (promoModules.length <= 3) {
      setCampaignIndex(0);
      return;
    }

    const timer = window.setInterval(() => {
      setCampaignIndex((prev) => (prev + 1) % promoModules.length);
    }, 4500);

    return () => window.clearInterval(timer);
  }, [promoModules]);

  const visiblePromoModules = useMemo(() => {
    if (promoModules.length <= 3) return promoModules;
    const windowed = [];
    for (let i = 0; i < 3; i += 1) {
      windowed.push(promoModules[(campaignIndex + i) % promoModules.length]);
    }
    return windowed;
  }, [campaignIndex, promoModules]);

  const auctionTickOptions = useMemo(() => {
    const fromCampaigns = promoModules
      .map((module) => module.badge?.trim() || module.title?.trim())
      .filter((value): value is string => Boolean(value && value.length > 0));

    return ["Без аукциона", ...Array.from(new Set(fromCampaigns)).slice(0, 6)];
  }, [promoModules]);

  const promoGradientByIndex = (index: number) => {
    const gradients = [
      `linear-gradient(130deg, ${crew.theme.palette.accentMain}E0, #FF7F50D0)`,
      `linear-gradient(130deg, #8B5CF6D9, ${crew.theme.palette.accentMain}D8)`,
      `linear-gradient(130deg, #22C55ED1, #06B6D4CC)`,
    ];

    return gradients[index % gradients.length];
  };

  const orderedCategories = useMemo(() => Array.from(new Set(items.map((item) => item.category).filter(Boolean))), [items]);

  const matchesQuickFilter = (item: CatalogItemVM, filter: QuickFilterKey) => {
    if (filter === "budget") {
      return item.pricePerDay <= 5000;
    }
    if (filter === "premium") {
      return item.pricePerDay >= 7000;
    }
    if (filter === "newbie") {
      return /naked|neo|scooter|300|400/i.test(`${item.category} ${item.title}`);
    }
    if (filter === "topRated") {
      return item.reviewSummary.count > 0 && item.reviewSummary.average >= 4.5;
    }
    return true;
  };

  const filteredItems = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return items.filter((item) => {
      const matchesSearch = !query || [item.title, item.subtitle, item.description, item.category].join(" ").toLowerCase().includes(query);
      if (!matchesSearch) return false;
      return matchesQuickFilter(item, quickFilter);
    });
  }, [items, quickFilter, searchQuery]);

  const quickFilterCounts = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    const searchFiltered = items.filter((item) => !query || [item.title, item.subtitle, item.description, item.category].join(" ").toLowerCase().includes(query));
    return QUICK_FILTERS.reduce<Record<QuickFilterKey, number>>(
      (acc, filter) => {
        acc[filter.key] = searchFiltered.filter((item) => matchesQuickFilter(item, filter.key)).length;
        return acc;
      },
      { all: 0, budget: 0, premium: 0, newbie: 0, topRated: 0 },
    );
  }, [items, searchQuery]);

  const itemsByCategory = useMemo(() => {
    const sortedFilteredItems = quickFilter === "topRated"
      ? [...filteredItems].sort((a, b) => (b.reviewSummary.average - a.reviewSummary.average) || (b.reviewSummary.count - a.reviewSummary.count))
      : filteredItems;

    const grouped = orderedCategories
      .map((category) => ({
        category,
        items: sortedFilteredItems.filter((item) => item.category === category),
      }))
      .filter((group) => group.items.length > 0);

    const saleGroup = sortedFilteredItems.filter((item) => item.saleAvailable);
    const saleCategory = mode === "electro" ? "Электроэндуро в продаже" : "Байки на продажу";
    const baseGroups = grouped.filter((group) => group.category !== saleCategory);
    const normalized = sortWbItemLast(baseGroups);
    if (saleGroup.length === 0) return normalized;
    return [{ category: saleCategory, items: saleGroup }, ...normalized];
  }, [filteredItems, mode, orderedCategories, quickFilter]);

  const recordRentIntent = useCallback((item: CatalogItemVM, stage: "viewed" | "configured", metadata: Record<string, unknown> = {}) => {
    const strip = buildCatalogRentalStrip(item, crew);
    return upsertFranchizeIntent({
      slug: resolvedSlug,
      bikeId: item.id,
      intentType: "rent",
      stage,
      sourceRoute: `/franchize/${resolvedSlug}`,
      contactChannel: "catalog_card",
      urgencyScore: stage === "configured" ? 68 : 42,
      telegramUserId: user?.id ? String(user.id) : dbUser?.user_id ? String(dbUser.user_id) : undefined,
      phone: typeof (dbUser as { phone?: unknown } | null)?.phone === "string" ? (dbUser as { phone?: string } | null)?.phone : undefined,
      metadata: {
        itemTitle: item.title,
        availabilityStatus: item.availabilityStatus,
        availabilityLabel: strip.availabilityLabel,
        nearestStartWindow: strip.nearestStartWindow,
        pickupHint: strip.pickupHint,
        priceTeaser: strip.priceTeaser,
        ...metadata,
      },
    }).catch((error) => console.warn("rent intent tracking failed", error));
  }, [crew, dbUser, resolvedSlug, user]);

  useEffect(() => {
    recordRentIntentRef.current = recordRentIntent;
  }, [recordRentIntent]);

  const openItem = (item: CatalogItemVM) => {
    setSelectedItem(item);
    const defaultOptions = {
      package: "Базовый",
      duration: "1 день",
      perk: "Стандарт",
      auction: auctionTickOptions[0] ?? "Без аукциона",
    };
    setSelectedOptions(defaultOptions);
    void recordRentIntent(item, "viewed", { trigger: "catalog_card", options: defaultOptions });
  };

  useEffect(() => {
    const focusedVehicle = (searchParams.get("vehicle") || "").trim().toLowerCase();
    if (!focusedVehicle) return;
    const target = items.find((item) => item.id.toLowerCase() === focusedVehicle);
    if (target && lastQueryViewedVehicleRef.current !== target.id) {
      lastQueryViewedVehicleRef.current = target.id;
      setSelectedItem(target);
      const defaultOptions = {
        package: "Базовый",
        duration: "1 день",
        perk: "Стандарт",
        auction: auctionTickOptions[0] ?? "Без аукциона",
      };
      setSelectedOptions(defaultOptions);
      void recordRentIntentRef.current?.(target, "viewed", { trigger: "vehicle_query", options: defaultOptions });
    }
  }, [auctionTickOptions, items, searchParams]);

  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    const rafIds: number[] = [];
    const cleanupByCategory: Array<() => void> = [];

    itemsByCategory.forEach((group) => {
      if (group.items.length > 8) return;
      const root = carouselRefs.current[group.category];
      if (!root) return;
      const cards = Array.from(root.querySelectorAll<HTMLElement>("[data-carousel-card='true']"));
      if (cards.length === 0) return;

      const observer = new IntersectionObserver(
        (entries) => {
          const visible = entries
            .filter((entry) => entry.isIntersecting)
            .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
          if (!visible) return;
          const nextIndex = Number((visible.target as HTMLElement).dataset.carouselIndex ?? "0");
          setCarouselActiveByCategory((prev) => (prev[group.category] === nextIndex ? prev : { ...prev, [group.category]: nextIndex }));
        },
        { root, threshold: [0.55, 0.75] },
      );

      cards.forEach((card) => observer.observe(card));
      observers.push(observer);

      const onScroll = () => {
        const rafId = window.requestAnimationFrame(() => {
          const slotWidth = cards[0]?.offsetWidth || 1;
          const nextIndex = Math.round(root.scrollLeft / slotWidth);
          setCarouselActiveByCategory((prev) => (prev[group.category] === nextIndex ? prev : { ...prev, [group.category]: nextIndex }));
        });
        rafIds.push(rafId);
      };

      root.addEventListener("scroll", onScroll, { passive: true });
      cleanupByCategory.push(() => root.removeEventListener("scroll", onScroll));
    });

    return () => {
      observers.forEach((observer) => observer.disconnect());
      rafIds.forEach((id) => window.cancelAnimationFrame(id));
      cleanupByCategory.forEach((cleanup) => cleanup());
    };
  }, [itemsByCategory]);

  return (
    <>
      <section
        className="mx-auto w-full max-w-7xl px-4 pb-6 pt-8 2xl:max-w-[1600px]"
        id="catalog-sections"
        style={{
          ["--catalog-accent" as string]: crew.theme.palette.accentMain,
          ["--catalog-border" as string]: crew.theme.palette.borderSoft,
          ["--catalog-text" as string]: crew.theme.palette.textPrimary,
          ["--catalog-muted" as string]: crew.theme.palette.textSecondary,
          ["--catalog-card-bg" as string]: crew.theme.palette.bgCard,
          ["--catalog-accent-contrast" as string]: "#16130A",
          ["--catalog-accent-muted-contrast" as string]: "#2A1A0D",
        }}
      >
        {!crew.isFound && (
          <p className="mb-4 rounded-xl border border-[var(--catalog-accent)] px-3 py-2 text-sm text-[var(--catalog-accent)]">
            Crew slug was not found. Rendering safe fallback shell.
          </p>
        )}

        <div id="catalog-search" className="relative mb-5" role="search" aria-label="Поиск по каталогу байков">
          <label htmlFor="catalog-search-input" className="sr-only">
            Поиск по каталогу байков
          </label>
          <input
            id="catalog-search-input"
            type="text"
            placeholder="Найдите байк по модели или сценарию"
            autoComplete="off"
            aria-describedby="catalog-results-status"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full rounded-full border py-3 pl-5 pr-36 text-sm outline-none transition focus:border-transparent focus:ring-2"
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            style={{
              boxShadow: `0 0 0 1px ${crew.theme.palette.borderSoft}`,
              borderColor: crew.theme.palette.borderSoft,
              backgroundColor: `${crew.theme.palette.bgCard}99`,
              color: crew.theme.palette.textPrimary,
              ...(searchFocused ? interactionRingStyle(crew.theme) : {}),
            }}
          />
          {searchQuery.trim().length > 0 && (
            <button
              type="button"
              aria-label="Очистить поиск по каталогу"
              onClick={() => setSearchQuery("")}
              className="absolute bottom-2 right-24 top-2 rounded-full px-3 text-xs font-medium transition active:scale-95"
              onFocus={() => setClearFocused(true)}
              onBlur={() => setClearFocused(false)}
              style={{
                backgroundColor: `${crew.theme.palette.bgBase}F0`,
                color: crew.theme.palette.textSecondary,
                border: `1px solid ${crew.theme.palette.borderSoft}`,
                ...(clearFocused ? interactionRingStyle(crew.theme) : {}),
              }}
            >
              Сброс
            </button>
          )}
          <button
            type="button"
            aria-label="Перейти к первому найденному байку"
            onClick={() => {
              const firstResult = document.querySelector("[data-catalog-item-button='true']") as HTMLButtonElement | null;
              firstResult?.scrollIntoView({ behavior: "smooth", block: "center" });
              firstResult?.focus({ preventScroll: true });
            }}
            className="absolute bottom-1 right-1 top-1 rounded-full px-5 text-sm font-semibold transition active:scale-95"
            onFocus={() => setSearchCtaFocused(true)}
            onBlur={() => setSearchCtaFocused(false)}
            style={{
              backgroundColor: crew.theme.palette.accentMain,
              color: "#16130A",
              ...(searchCtaFocused ? interactionRingStyle(crew.theme) : {}),
            }}
          >
            Показать
          </button>
        </div>

        {promoModules.length > 0 && (
          <div className="mb-5 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0">
            {visiblePromoModules.map((module, index) => {
              const isExternal = /^(https?:|mailto:|tel:)/.test(module.href);
              return (
                <Link
                  key={module.id}
                  title={module.title}
                  href={module.href}
                  aria-label={`${module.ctaLabel}: ${module.title}`}
                  className="w-[85vw] shrink-0 rounded-2xl border p-3 transition hover:opacity-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--catalog-accent)] sm:w-auto"
                  style={{
                    borderColor: crew.theme.palette.borderSoft,
                    background: promoGradientByIndex(index),
                  }}
                  prefetch={!isExternal}
                  target={isExternal ? "_blank" : undefined}
                  rel={isExternal ? "noreferrer noopener" : undefined}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--catalog-accent-contrast)]">
                    {module.badge}
                  </p>
                  <p className="mt-1 text-sm font-semibold leading-5 text-[var(--catalog-accent-contrast)]">
                    {module.title}
                  </p>
                  {module.subtitle && <p className="mt-1 text-xs text-[var(--catalog-accent-muted-contrast)]">{module.subtitle}</p>}
                  <p className="mt-2 text-xs font-semibold text-[var(--catalog-accent-contrast)]">
                    {module.ctaLabel} →
                  </p>
                </Link>
              );
            })}
          </div>
        )}

        <p id="catalog-results-status" className="sr-only" aria-live="polite">
          Найдено позиций: {filteredItems.length}
        </p>

        <div className="mb-5 flex gap-2 overflow-x-auto pb-1 no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="Быстрые фильтры каталога">
          {QUICK_FILTERS.map((filter) => {
            const active = quickFilter === filter.key;
            return (
              <button
                key={filter.key}
                type="button"
                onClick={() => setQuickFilter(filter.key)}
                aria-pressed={active}
                className="shrink-0 rounded-full bg-[var(--quick-pill-bg)] px-3 py-1.5 text-xs font-medium text-[var(--quick-pill-text)] transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--catalog-accent)]"
                style={{
                  ["--quick-pill-bg" as string]: active ? crew.theme.palette.accentMain : crew.theme.palette.bgCard,
                  ["--quick-pill-text" as string]: active ? "#000000" : crew.theme.palette.textPrimary,
                }}
              >
                {filter.label} · {quickFilterCounts[filter.key]}
              </button>
            );
          })}
          {(quickFilter !== "all" || searchQuery.trim().length > 0) && (
            <button
              type="button"
              onClick={() => {
                setQuickFilter("all");
                setSearchQuery("");
              }}
              aria-label="Сбросить поиск и все быстрые фильтры"
              className="shrink-0 rounded-full bg-[var(--quick-pill-bg)] px-3 py-1.5 text-xs font-medium text-[var(--quick-pill-text)] transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--catalog-accent)]"
              style={{ ["--quick-pill-bg" as string]: crew.theme.palette.bgCard, ["--quick-pill-text" as string]: crew.theme.palette.textPrimary }}
            >
              Сбросить всё
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <section aria-label="Загружаем каталог" className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-2xl font-bold uppercase leading-tight tracking-tight text-[var(--catalog-text)]">Каталог готовых выездов</h2>
              <span className="inline-flex rounded-full bg-[var(--catalog-card-bg)] px-2.5 py-1 text-[11px] font-medium text-[var(--catalog-muted)]">синхронизируем наличие</span>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
              {[0, 1, 2, 3].map((index) => <CatalogCardSkeleton key={index} index={index} />)}
            </div>
          </section>
        ) : itemsByCategory.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-4 text-sm" style={surface.mutedText}>
            По этому запросу нет готового варианта. Попробуйте другую модель, бюджет или сценарий поездки.
          </div>
        ) : (
          <div className="space-y-6">
            {itemsByCategory.map((group) => (
              <section key={group.category} id={toCategoryId(group.category)} data-category={group.category} data-count={group.items.length}>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-2xl font-bold uppercase leading-tight tracking-tight text-[var(--catalog-text)]">
                    {group.category}
                  </h2>
                  <span className="inline-flex shrink-0 items-center rounded-full bg-[var(--catalog-card-bg)] px-2.5 py-1 text-[11px] font-medium text-[var(--catalog-muted)]">
                    {group.items.length} шт.
                  </span>
                </div>
                {group.items.length <= 8 ? (
                  <>
                    <div
                      ref={(node) => {
                        carouselRefs.current[group.category] = node;
                      }}
                      className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                      tabIndex={0}
                      role="region"
                      aria-label={`Карусель категории ${group.category}`}
                      onKeyDown={(event) => {
                        if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
                        const root = carouselRefs.current[group.category];
                        if (!root) return;
                        const step = root.clientWidth * 0.9;
                        root.scrollBy({ left: event.key === "ArrowRight" ? step : -step, behavior: "smooth" });
                      }}
                    >
                      {group.items.map((item, index) => {
                        const rentalStrip = buildCatalogRentalStrip(item, crew);
                        return (
                    <article
                      key={item.id}
                      data-catalog-item="true"
                      data-carousel-card="true"
                      data-carousel-index={index}
                      className="group w-[78vw] max-w-[340px] shrink-0 snap-start overflow-hidden rounded-2xl border transition-shadow hover:shadow-[0_0_0_1px_var(--catalog-accent),0_0_28px_color-mix(in_srgb,var(--catalog-accent)_35%,transparent)] sm:w-[320px]"
                      style={catalogCardVariantStyles(crew.theme, item.id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0))}
                    >
                      <button
                        type="button"
                        aria-label={`Открыть карточку ${item.title}: ${item.rentPriceLabel}`}
                        data-catalog-item-button="true"
                        className="block w-full text-left"
                        onClick={() => openItem(item)}
                        onFocus={() => setFocusedItemId(item.id)}
                        onBlur={() => setFocusedItemId((prev) => (prev === item.id ? null : prev))}
                        style={focusedItemId === item.id ? interactionRingStyle(crew.theme) : undefined}
                      >
                        <div className="relative aspect-[9/16] w-full">
                          {item.imageUrl ? (
                            <Image src={item.imageUrl} alt={item.title} fill sizes="(max-width: 1279px) 78vw, 320px" className="object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center px-3 text-center text-xs" style={surface.mutedText}>Фото байка загружается — карточка уже доступна для брони</div>
                          )}
                        </div>
                        <div className="p-3">
                          <div className="mb-2 flex flex-wrap gap-1.5">
                            {item.isHot && (
                              <span className="inline-flex rounded-full bg-[color:color-mix(in_srgb,var(--catalog-accent)_86%,transparent)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--catalog-accent-contrast)]">
                                Высокий спрос
                              </span>
                            )}
                            <span className="inline-flex rounded-full px-2 py-0.5 text-[9px] font-semibold tracking-[0.02em]" style={{ backgroundColor: rentalStrip.isAvailable ? "#1f7a3a3d" : "#dc262640", color: "#e6f4ea", border: rentalStrip.isAvailable ? "1px solid rgba(46, 160, 67, 0.45)" : "1px solid rgba(220, 38, 38, 0.45)" }}>{rentalStrip.availabilityLabel}</span>
                            {item.saleAvailable && <span className="inline-flex rounded-full border border-amber-300/60 bg-amber-400/25 px-2 py-0.5 text-[9px] font-semibold tracking-[0.02em] text-amber-100">Доступен к покупке</span>}
                          </div>
                          {item.reviewSummary.count > 0 && <span className="inline-flex rounded-full border border-yellow-300/60 bg-yellow-400/20 px-2 py-0.5 text-[9px] font-semibold tracking-[0.02em] text-yellow-100">★ {item.reviewSummary.average.toFixed(1)} · {item.reviewSummary.count}</span>}
                          <h3 className="mt-1 text-sm font-semibold leading-5">{item.title}</h3>
                          <p className="text-xs" style={surface.mutedText}>{item.description || item.subtitle}</p>
                          <div className="mt-2 rounded-2xl border border-white/10 bg-black/15 p-2 text-[10px] leading-4" aria-label={`Аренда ${item.title}: ${rentalStrip.todayLabel}`}>
                            <div className="flex items-center justify-between gap-2 font-semibold text-[var(--catalog-text)]"><span>Слот: {rentalStrip.todayLabel}</span><span className={rentalStrip.isAvailable ? "text-emerald-200" : "text-amber-100"}>{rentalStrip.nearestStartWindow}</span></div>
                            <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5" style={surface.mutedText}><span>Точка: {rentalStrip.pickupHint}</span><span>{rentalStrip.priceTeaser}</span></div>
                          </div>
                          {item.reviewSummary.latest?.text && <p className="mt-2 rounded-xl border border-white/10 px-2 py-1.5 text-[11px] leading-4" style={surface.mutedText}>“{item.reviewSummary.latest.text}”</p>}
                          {hasRentPrice(item) ? <p className="mt-2 text-base font-bold text-[var(--catalog-accent)]">{item.rentPriceLabel}</p> : null}
                          {hasSalePrice(item) ? <p className="mt-1 text-xs font-semibold text-amber-200">Цена покупки: {item.salePrice?.toLocaleString("ru-RU")} ₽</p> : null}
                          {!hasRentPrice(item) && !hasSalePrice(item) ? <p className="mt-2 text-xs font-medium text-white/80">Цена по запросу</p> : null}
                          <div className="mt-2 flex gap-2"><span className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--catalog-accent)] px-2 py-2.5 text-xs font-bold text-[var(--catalog-accent-contrast)] transition-transform active:scale-95"><ShoppingCart className="h-4 w-4" />{item.saleAvailable ? "Закрепить байк" : "Забронировать выезд"}</span></div>
                        </div>
                      </button>
                    </article>
                        );
                      })}
                    </div>
                    <div className="mt-2 flex items-center justify-center gap-2" aria-label={`Пагинация карусели ${group.category}`}>
                      {group.items.map((item, index) => {
                        const isActive = (carouselActiveByCategory[group.category] ?? 0) === index;
                        return (
                          <button
                            key={`${item.id}-dot`}
                            type="button"
                            aria-label={`Показать карточку ${index + 1}`}
                            aria-current={isActive ? "true" : undefined}
                            className="h-2.5 w-2.5 rounded-full transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--catalog-accent)]"
                            style={{ backgroundColor: isActive ? crew.theme.palette.accentMain : `${crew.theme.palette.borderSoft}AA`, transform: isActive ? "scale(1.1)" : "scale(1)" }}
                            onClick={() => {
                              const root = carouselRefs.current[group.category];
                              if (!root) return;
                              const slotWidth = root.querySelector<HTMLElement>("[data-carousel-card='true']")?.offsetWidth || root.clientWidth;
                              root.scrollTo({ left: slotWidth * index, behavior: "smooth" });
                            }}
                          />
                        );
                      })}
                    </div>
                  </>
                ) : (
                <div className="grid grid-cols-2 gap-3 xl:grid-cols-3 2xl:grid-cols-4">
                  {group.items.map((item) => {
                    const rentalStrip = buildCatalogRentalStrip(item, crew);
                    return (
                    <article
                      key={item.id}
                      data-catalog-item="true"
                      className="group overflow-hidden rounded-2xl border transition-shadow hover:shadow-[0_0_0_1px_var(--catalog-accent),0_0_28px_color-mix(in_srgb,var(--catalog-accent)_35%,transparent)]"
                      style={catalogCardVariantStyles(crew.theme, item.id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0))}
                    >
                      <button
                        type="button"
                        aria-label={`Открыть карточку ${item.title}: ${item.rentPriceLabel}`}
                        data-catalog-item-button="true"
                        className="block w-full text-left"
                        onClick={() => openItem(item)}
                        onFocus={() => setFocusedItemId(item.id)}
                        onBlur={() => setFocusedItemId((prev) => (prev === item.id ? null : prev))}
                        style={focusedItemId === item.id ? interactionRingStyle(crew.theme) : undefined}
                      >
                        <div className="relative aspect-[9/16] w-full">
                          {item.imageUrl ? (
                            <Image src={item.imageUrl} alt={item.title} fill sizes="(max-width: 1279px) 50vw, (max-width: 1535px) 33vw, 25vw" className="object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center px-3 text-center text-xs" style={surface.mutedText}>Фото байка загружается — карточка уже доступна для брони</div>
                          )}
                        </div>
                        <div className="p-3">
                          <div className="mb-2 flex flex-wrap gap-1.5">
                            {item.isHot && (
                              <span className="inline-flex rounded-full bg-[color:color-mix(in_srgb,var(--catalog-accent)_86%,transparent)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--catalog-accent-contrast)]">
                                Высокий спрос
                              </span>
                            )}
                            <span
                              className="inline-flex rounded-full px-2 py-0.5 text-[9px] font-semibold tracking-[0.02em]"
                              style={{
                                backgroundColor: rentalStrip.isAvailable ? "#1f7a3a3d" : "#dc262640",
                                color: "#e6f4ea",
                                border: rentalStrip.isAvailable ? "1px solid rgba(46, 160, 67, 0.45)" : "1px solid rgba(220, 38, 38, 0.45)",
                              }}
                            >
                              {rentalStrip.availabilityLabel}
                            </span>
                            {item.saleAvailable && (
                              <span className="inline-flex rounded-full border border-amber-300/60 bg-amber-400/25 px-2 py-0.5 text-[9px] font-semibold tracking-[0.02em] text-amber-100">
                                Доступен к покупке
                              </span>
                            )}
                          </div>
                          {item.reviewSummary.count > 0 && (
                            <span className="inline-flex rounded-full border border-yellow-300/60 bg-yellow-400/20 px-2 py-0.5 text-[9px] font-semibold tracking-[0.02em] text-yellow-100">
                              ★ {item.reviewSummary.average.toFixed(1)} · {item.reviewSummary.count}
                            </span>
                          )}
                          <h3 className="mt-1 text-sm font-semibold leading-5">{item.title}</h3>
                          <p className="text-xs" style={surface.mutedText}>{item.description || item.subtitle}</p>
                          <div
                            className="mt-2 rounded-2xl border border-white/10 bg-black/15 p-2 text-[10px] leading-4"
                            aria-label={`Аренда ${item.title}: ${rentalStrip.todayLabel}`}
                          >
                            <div className="flex items-center justify-between gap-2 font-semibold text-[var(--catalog-text)]">
                              <span>Слот: {rentalStrip.todayLabel}</span>
                              <span className={rentalStrip.isAvailable ? "text-emerald-200" : "text-amber-100"}>
                                {rentalStrip.nearestStartWindow}
                              </span>
                            </div>
                            <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5" style={surface.mutedText}>
                              <span>Точка: {rentalStrip.pickupHint}</span>
                              <span>{rentalStrip.priceTeaser}</span>
                            </div>
                          </div>
                          {item.reviewSummary.latest?.text && (
                            <p className="mt-2 rounded-xl border border-white/10 px-2 py-1.5 text-[11px] leading-4" style={surface.mutedText}>
                              “{item.reviewSummary.latest.text}”
                            </p>
                          )}
                          {hasRentPrice(item) ? (
                            <p className="mt-2 text-base font-bold text-[var(--catalog-accent)]">{item.rentPriceLabel}</p>
                          ) : null}
                          {hasSalePrice(item) ? (
                            <p className="mt-1 text-xs font-semibold text-amber-200">
                              Цена покупки: {item.salePrice?.toLocaleString("ru-RU")} ₽
                            </p>
                          ) : null}
                          {!hasRentPrice(item) && !hasSalePrice(item) ? <p className="mt-2 text-xs font-medium text-white/80">Цена по запросу</p> : null}
                          <div className="mt-2 flex gap-2">
                            <span className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--catalog-accent)] px-2 py-2.5 text-xs font-bold text-[var(--catalog-accent-contrast)] transition-transform active:scale-95">
                              <ShoppingCart className="h-4 w-4" />
                              {item.saleAvailable ? "Закрепить байк" : "Забронировать выезд"}
                            </span>
                          </div>
                        </div>
                      </button>
                    </article>
                    );
                  })}
                </div>
                )}
              </section>
            ))}
          </div>
        )}
      </section>

      {/* 🛒 Floating Cart: Hide when modal is open to avoid z-index overlap */}
      {!selectedItem && showFloatingCart && (
        <FloatingCartIconLinkBySlug
          slug={resolvedSlug}
          href={`/franchize/${resolvedSlug}/cart`}
          items={items}
          accentColor={crew.theme.palette.accentMain}
          textColor={crew.theme.palette.textPrimary}
          borderColor={crew.theme.palette.borderSoft}
          theme={crew.theme}
          className={ctaPolicy?.floatingCartClassName}
        />
      )}

      <ItemModal
        item={selectedItem}
        items={items}
        slug={resolvedSlug}
        theme={crew.theme}
        pickupAddress={crew.contacts.address || crew.hqLocation}
        workingHours={crew.contacts.workingHours}
        options={selectedOptions}
        auctionOptions={auctionTickOptions}
        onChangeOption={(key, value) => setSelectedOptions((prev) => ({ ...prev, [key]: value }))}
        onClose={() => setSelectedItem(null)}
        onAddToCart={() => {
          if (!selectedItem) return;
          void recordRentIntent(selectedItem, "configured", {
            trigger: "modal_cta",
            options: selectedOptions,
          });
          addItem(selectedItem.id, selectedOptions, 1);
          setSelectedItem(null);
        }}
      />
    </>
  );
}
