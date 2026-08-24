"use client";

import Image from "next/image";
import { Search, Package, Send, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { FranchizeTheme } from "@/lib/franchize-config";
import { catalogCardVariantStyles, crewPaletteForSurface, getContrastingGlowStyle, interactionRingStyle, readableTextOnColor, withAlpha } from "../lib/theme";
import { localImageSrc, handleImageError } from "@/lib/image-fallback";
import { useFranchizeTheme } from "../hooks/useFranchizeTheme";
import { useResolvedPalette } from "../lib/useResolvedPalette";

// ─────────────────────────────────────────────────────────────────────────────
// Types (view model — serialized from the server page)
// ─────────────────────────────────────────────────────────────────────────────

export interface SparePartVM {
  id: string;           // part number, e.g. "97040001"
  name: string;         // e.g., "Ручка тормоза (левая)"
  partNumber: string;   // e.g., "DMNSGEC19003"
  category: string;     // e.g., "Тормоза и цепь"
  price: number;        // final price in RUB; 0 = price on request
  image?: string;       // relative path to image
  description?: string; // optional description/specs
}

export interface PartsCategoryVM {
  id: string;           // e.g., "braking-chain"
  name: string;         // e.g., "Тормоза и цепь"
  parts: SparePartVM[];
}

interface PartsCatalogClientProps {
  initialParts: PartsCategoryVM[];
  theme: FranchizeTheme;
  telegramBotUsername?: string;
}

/** Pickup point shown in the UI (per PRD contacts update). */
const PICKUP_ADDRESS = "Комсомольская площадь";

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function PartsCatalogClient({ initialParts, theme, telegramBotUsername }: PartsCatalogClientProps) {
  // Apply franchize theme CSS variables
  useFranchizeTheme(theme);

  const palette = useResolvedPalette(theme);
  const surface = crewPaletteForSurface(theme);
  const accentColor = palette.accentMain;
  const priceGlowStyle = getContrastingGlowStyle(accentColor);
  const botUsername = telegramBotUsername || "oneBikePlsBot";

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchCtaFocused, setSearchCtaFocused] = useState(false);
  const [clearFocused, setClearFocused] = useState(false);
  const [focusedPartId, setFocusedPartId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedPart, setSelectedPart] = useState<SparePartVM | null>(null);

  const isAuto = theme.isAuto;

  // Flatten all parts for filtering
  const allParts = useMemo(() => {
    return initialParts.flatMap((category) => category.parts);
  }, [initialParts]);

  // Get unique categories with part counts
  const categoriesWithCounts = useMemo(() => {
    const baseCategories = initialParts.map((cat) => ({
      id: cat.id,
      name: cat.name,
      count: cat.parts.length,
    }));

    // Add "All" option at the start
    return [
      { id: "all", name: "Все", count: allParts.length },
      ...baseCategories,
    ];
  }, [initialParts, allParts.length]);

  // Filter parts based on search query and category selection
  const filteredParts = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    return allParts.filter((part) => {
      // Search by name OR part number
      const matchesSearch = !query ||
        part.name.toLowerCase().includes(query) ||
        part.partNumber.toLowerCase().includes(query);

      if (!matchesSearch) return false;

      // Filter by selected category
      if (selectedCategory && selectedCategory !== "all") {
        const category = initialParts.find((cat) => cat.id === selectedCategory);
        if (!category) return false;
        return category.parts.some((p) => p.id === part.id);
      }

      return true;
    });
  }, [allParts, searchQuery, selectedCategory, initialParts]);

  // Group filtered parts by category for display
  const partsByCategory = useMemo(() => {
    const selectedCatId = selectedCategory === "all" || !selectedCategory ? null : selectedCategory;

    if (selectedCatId) {
      // Show only selected category
      const category = initialParts.find((cat) => cat.id === selectedCatId);
      if (!category) return [];
      return [{
        id: category.id,
        name: category.name,
        parts: category.parts.filter((part) =>
          filteredParts.some((p) => p.id === part.id)
        ),
      }];
    }

    // Group all parts by their original categories
    return initialParts
      .map((category) => ({
        id: category.id,
        name: category.name,
        parts: category.parts.filter((part) =>
          filteredParts.some((p) => p.id === part.id)
        ),
      }))
      .filter((group) => group.parts.length > 0);
  }, [filteredParts, initialParts, selectedCategory]);

  // Accessibility: Escape closes modal, body scroll lock
  useEffect(() => {
    if (!selectedPart) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePartDetail();
    };
    document.addEventListener("keydown", handleKey);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Focus the modal's close button after it renders
    const timer = setTimeout(() => {
      const closeButton = document.querySelector('[data-part-modal-close="true"]') as HTMLElement;
      closeButton?.focus();
    }, 100);

    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = prevOverflow;
      clearTimeout(timer);
    };
  }, [selectedPart]);

  const openPartDetail = (part: SparePartVM) => {
    setSelectedPart(part);
  };

  const closePartDetail = () => {
    setSelectedPart(null);
  };

  const formatPrice = (price: number) => {
    return price > 0 ? `${new Intl.NumberFormat("ru-RU").format(price)} ₽` : "Цена по запросу";
  };

  const orderHref = (part: SparePartVM) =>
    `https://t.me/${botUsername}?start=part_${part.partNumber}`;

  return (
    <>
      <section
        className="relative mx-auto min-w-0 w-full max-w-7xl overflow-x-clip px-4 pb-6 pt-8 xl:max-w-[1440px] 2xl:max-w-[1800px]"
        style={{
          ["--parts-accent" as string]: isAuto ? "var(--franchize-accent-main)" : palette.accentMain,
          ["--parts-accent-hover" as string]: isAuto ? "var(--franchize-accent-hover)" : palette.accentMainHover,
          ["--parts-border" as string]: isAuto ? "var(--franchize-border-soft)" : palette.borderSoft,
          ["--parts-text" as string]: isAuto ? "var(--franchize-text-primary)" : palette.textPrimary,
          ["--parts-muted" as string]: isAuto ? "var(--franchize-text-secondary)" : palette.textSecondary,
          ["--parts-card-bg" as string]: isAuto ? "var(--franchize-bg-card)" : palette.bgCard,
          ["--parts-bg" as string]: isAuto ? "var(--franchize-bg-base)" : palette.bgBase,
          ["--parts-accent-contrast" as string]: readableTextOnColor(palette.accentMain),
          ["--parts-accent-muted-contrast" as string]: withAlpha(readableTextOnColor(palette.accentMain), 0.7),
          ["--parts-accent-subtle" as string]: isAuto
            ? "var(--franchize-accent-main)"
            : withAlpha(palette.accentMain, 0.12),
        }}
      >
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold uppercase leading-tight tracking-tight text-[var(--parts-text)] sm:text-3xl">
            Запчасти
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--parts-muted)]">
            Оригинальные запчасти Surge. Самовывоз: {PICKUP_ADDRESS}. Заказ и вопросы — в Telegram.
          </p>
        </div>

        {/* Search bar */}
        <div className="relative mb-5" role="search" aria-label="Поиск по запчастям">
          <label htmlFor="parts-search-input" className="sr-only">
            Поиск по запчастям
          </label>
          <input
            id="parts-search-input"
            type="text"
            placeholder="Поиск по названию или номеру детали"
            autoComplete="off"
            aria-describedby="parts-results-status"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full rounded-full border py-3 pl-5 pr-24 text-sm outline-none transition focus:border-transparent focus:ring-2 md:pr-36"
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            style={{
              boxShadow: `0 0 0 1px ${isAuto ? "var(--franchize-border-soft)" : palette.borderSoft}`,
              borderColor: isAuto ? "var(--franchize-border-soft)" : palette.borderSoft,
              backgroundColor: isAuto ? "var(--franchize-bg-card)" : `${palette.bgCard}99`,
              color: isAuto ? "var(--franchize-text-primary)" : palette.textPrimary,
              ...(searchFocused ? interactionRingStyle(theme) : {}),
            }}
          />
          {searchQuery.trim().length > 0 && (
            <button
              type="button"
              aria-label="Очистить поиск"
              onClick={() => setSearchQuery("")}
              className="absolute bottom-1 right-24 top-1 min-h-11 rounded-full px-3 text-xs font-medium transition active:scale-95"
              onFocus={() => setClearFocused(true)}
              onBlur={() => setClearFocused(false)}
              style={{
                backgroundColor: isAuto ? "var(--franchize-bg-base)" : `${palette.bgBase}F0`,
                color: isAuto ? "var(--franchize-text-secondary)" : palette.textSecondary,
                border: `1px solid ${isAuto ? "var(--franchize-border-soft)" : palette.borderSoft}`,
                ...(clearFocused ? interactionRingStyle(theme) : {}),
              }}
            >
              Сброс
            </button>
          )}
          <button
            type="button"
            aria-label="Перейти к первому результату"
            onClick={() => {
              const firstResult = document.querySelector("[data-part-card='true']") as HTMLButtonElement | null;
              firstResult?.scrollIntoView({ behavior: "smooth", block: "center" });
              firstResult?.focus({ preventScroll: true });
            }}
            className="absolute bottom-1 right-1 top-1 min-h-11 rounded-full px-5 text-sm font-semibold transition active:scale-95"
            onFocus={() => setSearchCtaFocused(true)}
            onBlur={() => setSearchCtaFocused(false)}
            style={{
              backgroundColor: isAuto ? "var(--franchize-accent-main)" : palette.accentMain,
              color: readableTextOnColor(palette.accentMain),
              ...(searchCtaFocused ? interactionRingStyle(theme) : {}),
            }}
          >
            Найти
          </button>
        </div>

        <p id="parts-results-status" className="sr-only" aria-live="polite">
          Найдено запчастей: {filteredParts.length}
        </p>

        {/* Category rail */}
        <div className="mb-5 flex min-w-0 max-w-full gap-2 overflow-x-auto [overflow-y:clip] [touch-action:pan-y_pan-x] overscroll-behavior-x-contain pb-1 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track:bg-transparent] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb:bg-current/20] [&::-webkit-scrollbar-thumb:hover:bg-current/30]" role="group" aria-label="Категории запчастей">
          {categoriesWithCounts.map((category) => {
            const isActive = selectedCategory === category.id || (!selectedCategory && category.id === "all");
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => setSelectedCategory(category.id === "all" ? "all" : category.id)}
                aria-pressed={isActive}
                className="min-h-11 shrink-0 rounded-full bg-[var(--category-pill-bg)] px-3 py-1.5 text-xs font-medium text-[var(--category-pill-text)] transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--parts-accent)]"
                style={{
                  ["--category-pill-bg" as string]: isActive
                    ? (isAuto ? "var(--franchize-accent-main)" : palette.accentMain)
                    : (isAuto ? "var(--franchize-bg-card)" : palette.bgCard),
                  ["--category-pill-text" as string]: isActive
                    ? readableTextOnColor(palette.accentMain)
                    : (isAuto ? "var(--franchize-text-primary)" : palette.textPrimary),
                }}
              >
                {category.name} · {category.count}
              </button>
            );
          })}
        </div>

        {/* Empty state */}
        {filteredParts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Search className="mb-4 h-14 w-14 text-[var(--parts-muted)]" aria-hidden />
            <h3 className="mb-2 text-lg font-semibold text-[var(--parts-text)]">
              Нет запчастей
            </h3>
            <p className="mb-4 text-sm text-[var(--parts-muted)]">
              {searchQuery || selectedCategory
                ? "Попробуйте изменить поисковый запрос или выбрать другую категорию"
                : "Каталог запчастей пока пуст"}
            </p>
            {(searchQuery || selectedCategory) && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("all");
                }}
                className="min-h-11 rounded-full bg-[var(--parts-accent)] px-6 py-2 text-sm font-semibold text-[var(--parts-accent-contrast)] transition hover:opacity-90"
              >
                Сбросить фильтры
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {partsByCategory.map((group) => (
              <section key={group.id} id={`category-${group.id}`} data-category={group.name} data-count={group.parts.length}>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-2xl font-bold uppercase leading-tight tracking-tight text-[var(--parts-text)]">
                    {group.name}
                  </h2>
                  <span className="inline-flex shrink-0 items-center rounded-full bg-[var(--parts-card-bg)] px-2.5 py-1 text-[11px] font-medium text-[var(--parts-muted)]">
                    {group.parts.length} шт.
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                  {group.parts.map((part) => {
                    return (
                      <article
                        key={part.id}
                        data-part-card="true"
                        className="group overflow-hidden rounded-2xl border border-[var(--parts-border)] transition-[border-color] duration-300 hover:!border-[var(--parts-accent)]"
                        style={catalogCardVariantStyles(theme, part.id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0))}
                      >
                        <button
                          type="button"
                          aria-label={`Открыть деталь ${part.name}: ${part.partNumber}`}
                          className="flex h-full w-full flex-col text-left"
                          onClick={() => openPartDetail(part)}
                          onFocus={() => setFocusedPartId(part.id)}
                          onBlur={() => setFocusedPartId((prev) => (prev === part.id ? null : prev))}
                          style={focusedPartId === part.id ? interactionRingStyle(theme) : undefined}
                        >
                          {/* Image area */}
                          <div className="relative aspect-square w-full overflow-hidden">
                            {part.image ? (
                              <Image
                                src={localImageSrc(part.image)}
                                alt={part.name}
                                fill
                                sizes="(max-width: 767px) 50vw, (max-width: 1023px) 33vw, (max-width: 1279px) 25vw, (max-width: 1535px) 20vw, 16vw"
                                className="object-cover"
                                onError={handleImageError(part.image)}
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center" style={surface.mutedText}>
                                <Package className="h-12 w-12 opacity-30" />
                              </div>
                            )}
                          </div>

                          {/* Info + CTA area */}
                          <div className="flex flex-1 flex-col rounded-b-2xl bg-[var(--parts-card-bg)] p-3 transition-colors duration-300 group-hover:bg-[var(--parts-accent)]">
                            {/* Part number */}
                            <p className="mb-1 text-[10px] font-mono uppercase text-[var(--parts-muted)] transition-colors duration-300 group-hover:text-[var(--parts-accent-contrast)]">
                              {part.partNumber}
                            </p>

                            {/* Title */}
                            <h3 className="text-sm font-bold leading-5 text-[var(--parts-text)] transition-colors duration-300 group-hover:text-[var(--parts-accent-contrast)] line-clamp-2">
                              {part.name}
                            </h3>

                            {/* Price */}
                            <div className="mt-1.5">
                              <p className="text-base font-semibold text-[var(--parts-accent)] transition-colors duration-300 group-hover:text-[var(--parts-accent-contrast)]" style={priceGlowStyle}>
                                {formatPrice(part.price)}
                              </p>
                            </div>

                            {/* CTA button */}
                            <div className="mt-3">
                              <span className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-[var(--parts-accent)] px-2 py-2.5 text-xs font-bold uppercase tracking-[0.04em] text-[var(--parts-accent)] transition-colors duration-300 group-hover:bg-[var(--parts-accent)] group-hover:text-[var(--parts-accent-contrast)] active:scale-95">
                                Подробнее
                              </span>
                            </div>
                          </div>
                        </button>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>

      {/* Part Detail Modal */}
      {selectedPart && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={closePartDetail}
          role="dialog"
          aria-modal="true"
          aria-labelledby="part-detail-title"
        >
          <div
            className="relative max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl border bg-[var(--parts-card-bg)] shadow-2xl"
            style={{
              borderColor: isAuto ? "var(--franchize-border-soft)" : palette.borderSoft,
              backgroundColor: isAuto ? "var(--franchize-bg-card)" : palette.bgCard,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              type="button"
              data-part-modal-close="true"
              onClick={closePartDetail}
              className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--parts-bg)] text-[var(--parts-text)] transition hover:bg-[var(--parts-accent)] hover:text-[var(--parts-accent-contrast)]"
              aria-label="Закрыть"
              style={{
                backgroundColor: isAuto ? "var(--franchize-bg-base)" : palette.bgBase,
                color: isAuto ? "var(--franchize-text-primary)" : palette.textPrimary,
              }}
            >
              <X className="h-4 w-4" />
            </button>

            {/* Content */}
            <div className="p-6">
              {/* Image */}
              {selectedPart.image && (
                <div className="relative aspect-square w-full overflow-hidden rounded-xl mb-4">
                  <Image
                    src={localImageSrc(selectedPart.image)}
                    alt={selectedPart.name}
                    fill
                    sizes="(max-width: 640px) 100vw, 512px"
                    className="object-cover"
                    onError={handleImageError(selectedPart.image)}
                  />
                </div>
              )}

              {/* Part number */}
              <p className="text-xs font-mono uppercase text-[var(--parts-muted)] mb-1">
                {selectedPart.partNumber}
              </p>

              {/* Title */}
              <h2
                id="part-detail-title"
                className="text-xl font-bold text-[var(--parts-text)] mb-2"
              >
                {selectedPart.name}
              </h2>

              {/* Category */}
              <p className="text-sm text-[var(--parts-muted)] mb-4">
                Категория: {selectedPart.category}
              </p>

              {/* Description */}
              {selectedPart.description && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-[var(--parts-text)] mb-2">Описание</h3>
                  <p className="text-sm text-[var(--parts-muted)] leading-relaxed">
                    {selectedPart.description}
                  </p>
                </div>
              )}

              {/* Price */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-[var(--parts-text)] mb-2">Цена</h3>
                <p className="text-2xl font-bold text-[var(--parts-accent)]" style={priceGlowStyle}>
                  {formatPrice(selectedPart.price)}
                </p>
              </div>

              {/* Contacts */}
              <p className="mb-4 text-xs text-[var(--parts-muted)]">
                Самовывоз: {PICKUP_ADDRESS}. Для заказа напишите нам в Telegram — менеджер подтвердит наличие и стоимость.
              </p>

              {/* CTA */}
              <a
                href={orderHref(selectedPart)}
                target="_blank"
                rel="noreferrer noopener"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--parts-accent)] px-4 py-3 text-sm font-semibold text-[var(--parts-accent-contrast)] transition hover:opacity-90 active:scale-95"
                style={{
                  backgroundColor: isAuto ? "var(--franchize-accent-main)" : palette.accentMain,
                  color: readableTextOnColor(palette.accentMain),
                }}
              >
                <Send className="h-4 w-4" />
                Заказать в Telegram
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
