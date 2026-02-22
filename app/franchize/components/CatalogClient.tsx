"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { toCategoryId } from "../lib/navigation";
import { catalogCardVariantStyles, crewPaletteForSurface, interactionRingStyle } from "../lib/theme";
import type { CatalogItemVM, FranchizeCrewVM } from "../actions";
import { FloatingCartIconLinkBySlug } from "./FloatingCartIconLinkBySlug";
import { ItemModal } from "../modals/Item";
import { useFranchizeCart } from "../hooks/useFranchizeCart";

interface CatalogClientProps {
  crew: FranchizeCrewVM;
  slug: string;
  items: CatalogItemVM[];
}

type QuickFilterKey = "all" | "budget" | "premium" | "newbie";

const QUICK_FILTERS: Array<{ key: QuickFilterKey; label: string }> = [
  { key: "all", label: "Все" },
  { key: "budget", label: "До 5000" },
  { key: "premium", label: "Премиум 7000+" },
  { key: "newbie", label: "Для новичка" },
];

const sortWbItemLast = <T extends { category: string }>(groups: T[]) => {
  const regular = groups.filter((group) => !group.category.toLowerCase().includes("wbitem"));
  const wbItems = groups.filter((group) => group.category.toLowerCase().includes("wbitem"));
  return [...regular, ...wbItems];
};

export function CatalogClient({ crew, slug, items }: CatalogClientProps) {
  const surface = crewPaletteForSurface(crew.theme);
  const [selectedItem, setSelectedItem] = useState<CatalogItemVM | null>(null);
  const { addItem } = useFranchizeCart(crew.slug || slug);
  const [selectedOptions, setSelectedOptions] = useState({ package: "Base", duration: "1 day", perk: "Стандарт" });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchCtaFocused, setSearchCtaFocused] = useState(false);
  const [clearFocused, setClearFocused] = useState(false);
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  const [quickFilter, setQuickFilter] = useState<QuickFilterKey>("all");

  const promoModules = useMemo(() => {
    if (crew.catalog.tickerItems.length === 0) {
      return [];
    }

    return crew.catalog.tickerItems.slice(0, 3).map((item, index) => ({
      id: `${item.id}-${index}`,
      title: item.text,
      href: item.href,
    }));
  }, [crew.catalog.tickerItems]);

  const orderedCategories = useMemo(
    () => Array.from(new Set([...crew.catalog.categories, ...items.map((item) => item.category).filter(Boolean)])),
    [crew.catalog.categories, items],
  );

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

    return true;
  };

  const filteredItems = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    return items.filter((item) => {
      const matchesSearch = !query || [item.title, item.subtitle, item.description, item.category].join(" ").toLowerCase().includes(query);
      if (!matchesSearch) {
        return false;
      }
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
      { all: 0, budget: 0, premium: 0, newbie: 0 },
    );
  }, [items, searchQuery]);

  const itemsByCategory = useMemo(() => {
    const grouped = orderedCategories
      .map((category) => ({
        category,
        items: filteredItems.filter((item) => item.category === category),
      }))
      .filter((group) => group.items.length > 0);

    const showcaseGroups = crew.catalog.showcaseGroups
      .map((group) => {
        const showcaseItems = filteredItems.filter((item) => {
          if (group.mode === "subtype") {
            return item.category.toLowerCase().includes((group.subtype ?? "").toLowerCase());
          }

          const minPrice = group.minPrice ?? Number.NEGATIVE_INFINITY;
          const maxPrice = group.maxPrice ?? Number.POSITIVE_INFINITY;
          return item.pricePerDay >= minPrice && item.pricePerDay <= maxPrice;
        });

        return {
          category: group.label,
          items: showcaseItems,
        };
      })
      .filter((group) => group.items.length > 0);

    return sortWbItemLast([...showcaseGroups, ...grouped]);
  }, [crew.catalog.showcaseGroups, filteredItems, orderedCategories]);

  const openItem = (item: CatalogItemVM) => {
    setSelectedItem(item);
    setSelectedOptions({ package: "Base", duration: "1 day", perk: "Стандарт" });
  };

  return (
    <>
      <section className="mx-auto w-full max-w-4xl px-4 pb-6 pt-8" id="catalog-sections">
        {!crew.isFound && (
          <p className="mb-4 rounded-xl border px-3 py-2 text-sm" style={{ borderColor: crew.theme.palette.accentMain, color: crew.theme.palette.accentMain }}>
            Crew slug was not found. Rendering safe fallback shell.
          </p>
        )}

        <div id="catalog-search" className="relative mb-5">
          <input
            id="catalog-search-input"
            type="text"
            placeholder="Введите название байка"
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
            onClick={() => {
              const firstResult = document.querySelector("[data-catalog-item='true']") as HTMLElement | null;
              firstResult?.scrollIntoView({ behavior: "smooth", block: "center" });
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
            Искать
          </button>
        </div>

        {promoModules.length > 0 && (
          <div className="mb-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {promoModules.map((module) => (
              <a
                key={module.id}
                href={module.href}
                className="rounded-2xl border p-3 transition hover:opacity-95"
                style={{
                  borderColor: crew.theme.palette.borderSoft,
                  background: `linear-gradient(140deg, ${crew.theme.palette.bgCard}, ${crew.theme.palette.bgBase})`,
                }}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: crew.theme.palette.accentMain }}>
                  Promo
                </p>
                <p className="mt-1 text-sm font-medium leading-5" style={{ color: crew.theme.palette.textPrimary }}>
                  {module.title}
                </p>
                <p className="mt-2 text-xs" style={{ color: crew.theme.palette.textSecondary }}>
                  Открыть подборку →
                </p>
              </a>
            ))}
          </div>
        )}

        <div className="mb-5 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {QUICK_FILTERS.map((filter) => {
            const active = quickFilter === filter.key;
            return (
              <button
                key={filter.key}
                type="button"
                onClick={() => setQuickFilter(filter.key)}
                className="shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium"
                style={{
                  borderColor: active ? crew.theme.palette.accentMain : crew.theme.palette.borderSoft,
                  color: active ? "#16130A" : crew.theme.palette.textSecondary,
                  backgroundColor: active ? crew.theme.palette.accentMain : `${crew.theme.palette.bgCard}CC`,
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
              className="shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium"
              style={{ borderColor: crew.theme.palette.borderSoft, color: crew.theme.palette.textSecondary, backgroundColor: `${crew.theme.palette.bgCard}CC` }}
            >
              Сбросить всё
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-4 text-sm" style={surface.mutedText}>
            Каталог пуст. Добавь позиции типов `bike`, `accessories`, `gear` или `wbitem`, чтобы наполнить витрину.
          </div>
        ) : itemsByCategory.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-4 text-sm" style={surface.mutedText}>
            По запросу ничего не найдено. Попробуй другое название или категорию.
          </div>
        ) : (
          <div className="space-y-6">
            {itemsByCategory.map((group) => (
              <section key={group.category} id={toCategoryId(group.category)} data-category={group.category} data-count={group.items.length}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.14em]" style={{ color: crew.theme.palette.accentMain }}>
                    {group.category}
                  </h2>
                  <span
                    className="inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-medium"
                    style={{ borderColor: crew.theme.palette.borderSoft, color: crew.theme.palette.textSecondary }}
                  >
                    {group.items.length} шт.
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {group.items.map((item) => (
                    <article
                      key={item.id}
                      data-catalog-item="true"
                      className="group overflow-hidden rounded-2xl border"
                      style={catalogCardVariantStyles(crew.theme, item.id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0))}
                    >
                      <button
                        type="button"
                        className="block w-full text-left"
                        onClick={() => openItem(item)}
                        onFocus={() => setFocusedItemId(item.id)}
                        onBlur={() => setFocusedItemId((prev) => (prev === item.id ? null : prev))}
                        style={focusedItemId === item.id ? interactionRingStyle(crew.theme) : undefined}
                      >
                        <div className="relative h-28 w-full">
                          {item.imageUrl ? (
                            <Image src={item.imageUrl} alt={item.title} fill sizes="(max-width: 768px) 50vw, 280px" className="object-cover" unoptimized />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center px-3 text-center text-xs" style={surface.mutedText}>Изображение байка скоро загрузим</div>
                          )}
                        </div>
                        <div className="p-3">
                          {item.category.toLowerCase().includes("bobber") && (
                            <span
                              className="mb-2 inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em]"
                              style={{ backgroundColor: `${crew.theme.palette.accentMain}dd`, color: "#16130A" }}
                            >
                              Хит 🔥
                            </span>
                          )}
                          <h3 className="mt-1 text-sm font-semibold leading-5">{item.title}</h3>
                          <p className="text-xs" style={surface.mutedText}>{item.description || item.subtitle}</p>
                          <p className="mt-2 text-sm font-medium">{item.pricePerDay} ₽ / day</p>
                          <span className="mt-2 inline-flex w-full items-center justify-center rounded-full px-2 py-2 text-xs font-semibold" style={{ backgroundColor: crew.theme.palette.accentMain, color: "#16130A" }}>
                            {item.pricePerDay >= 6000 ? "Выбрать" : "Добавить"}
                          </span>
                        </div>
                      </button>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>

      <FloatingCartIconLinkBySlug
        slug={crew.slug || slug}
        href={`/franchize/${crew.slug || slug}/cart`}
        items={items}
        accentColor={crew.theme.palette.accentMain}
        textColor={crew.theme.palette.textPrimary}
        borderColor={crew.theme.palette.borderSoft}
        theme={crew.theme}
      />

      <ItemModal
        item={selectedItem}
        theme={crew.theme}
        options={selectedOptions}
        onChangeOption={(key, value) => setSelectedOptions((prev) => ({ ...prev, [key]: value }))}
        onClose={() => setSelectedItem(null)}
        onAddToCart={() => {
          if (!selectedItem) return;
          addItem(selectedItem.id, selectedOptions, 1);
          setSelectedItem(null);
        }}
      />
    </>
  );
}
