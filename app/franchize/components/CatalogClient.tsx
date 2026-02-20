"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CatalogItemVM, FranchizeCrewVM } from "../actions";
import { FloatingCartIconLink } from "./FloatingCartIconLink";
import { ItemModal } from "../modals/Item";

interface CatalogClientProps {
  crew: FranchizeCrewVM;
  slug: string;
  items: CatalogItemVM[];
}

const toCategoryId = (category: string) => `category-${category.toLowerCase().replace(/\s+/g, "-")}`;

export function CatalogClient({ crew, slug, items }: CatalogClientProps) {
  const [selectedItem, setSelectedItem] = useState<CatalogItemVM | null>(null);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [selectedOptions, setSelectedOptions] = useState({ package: "Base", duration: "1 day", perk: "Стандарт" });
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const categoryTabsRef = useRef<Record<string, HTMLAnchorElement | null>>({});

  const orderedCategories = useMemo(
    () => Array.from(new Set([...crew.catalog.categories, ...items.map((item) => item.category).filter(Boolean)])),
    [crew.catalog.categories, items],
  );

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;

    const query = searchQuery.toLowerCase().trim();
    return items.filter((item) => [item.title, item.subtitle, item.description, item.category].join(" ").toLowerCase().includes(query));
  }, [items, searchQuery]);

  const itemsByCategory = useMemo(
    () =>
      orderedCategories
        .map((category) => ({
          category,
          items: filteredItems.filter((item) => item.category === category),
        }))
        .filter((group) => group.items.length > 0),
    [filteredItems, orderedCategories],
  );

  useEffect(() => {
    setActiveCategory(itemsByCategory[0]?.category ?? null);
  }, [itemsByCategory]);

  useEffect(() => {
    if (itemsByCategory.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (visibleEntries.length > 0) {
          const category = visibleEntries[0]?.target.getAttribute("data-category");
          if (category) {
            setActiveCategory(category);
          }
          return;
        }

        const passedEntries = entries
          .filter((entry) => entry.boundingClientRect.top < 0)
          .sort((a, b) => b.boundingClientRect.top - a.boundingClientRect.top);
        const category = passedEntries[0]?.target.getAttribute("data-category");
        if (category) {
          setActiveCategory(category);
        }
      },
      {
        rootMargin: "-120px 0px -55% 0px",
        threshold: [0, 0.2, 0.4, 0.7],
      },
    );

    itemsByCategory.forEach((group) => {
      const node = document.getElementById(toCategoryId(group.category));
      if (node) observer.observe(node);
    });

    return () => observer.disconnect();
  }, [itemsByCategory]);

  useEffect(() => {
    if (!activeCategory) return;
    const activeTab = categoryTabsRef.current[activeCategory];
    activeTab?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeCategory]);

  const { itemCount, totalPrice } = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        const qty = cart[item.id] ?? 0;
        acc.itemCount += qty;
        acc.totalPrice += qty * item.pricePerDay;
        return acc;
      },
      { itemCount: 0, totalPrice: 0 },
    );
  }, [cart, items]);



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
            className="w-full rounded-full border border-border bg-muted/40 py-3 pl-5 pr-28 text-sm outline-none transition focus:border-transparent focus:ring-2"
            style={{ boxShadow: `0 0 0 1px ${crew.theme.palette.borderSoft}` }}
          />
          <button
            type="button"
            onClick={() => {
              const firstResult = document.querySelector("[data-catalog-item='true']") as HTMLElement | null;
              firstResult?.scrollIntoView({ behavior: "smooth", block: "center" });
            }}
            className="absolute bottom-1 right-1 top-1 rounded-full px-5 text-sm font-semibold transition active:scale-95"
            style={{ backgroundColor: crew.theme.palette.accentMain, color: "#16130A" }}
          >
            Искать
          </button>
        </div>

        <div className="sticky top-[max(env(safe-area-inset-top),0.5rem)] z-20 -mx-4 mb-5 border-b border-border/60 bg-background/95 px-4 pb-2 pt-2 backdrop-blur supports-[backdrop-filter]:bg-background/70">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {itemsByCategory.map((group) => (
              <a
                key={group.category}
                ref={(node) => {
                  categoryTabsRef.current[group.category] = node;
                }}
                href={`#${toCategoryId(group.category)}`}
                className="shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
                style={{
                  borderColor: activeCategory === group.category ? crew.theme.palette.accentMain : crew.theme.palette.borderSoft,
                  backgroundColor: activeCategory === group.category ? `${crew.theme.palette.accentMain}22` : "transparent",
                  color: activeCategory === group.category ? crew.theme.palette.accentMain : undefined,
                }}
                onClick={() => setActiveCategory(group.category)}
              >
                {group.category}
              </a>
            ))}
          </div>
        </div>

        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            No bike catalog items yet. Add `type=bike` cars to this crew to hydrate the catalog.
          </div>
        ) : itemsByCategory.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            По запросу ничего не найдено. Попробуй другое название или категорию.
          </div>
        ) : (
          <div className="space-y-6">
            {itemsByCategory.map((group) => (
              <section key={group.category} id={toCategoryId(group.category)} data-category={group.category}>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.14em]" style={{ color: crew.theme.palette.accentMain }}>
                  {group.category}
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  {group.items.map((item) => (
                    <article key={item.id} data-catalog-item="true" className="overflow-hidden rounded-2xl border border-border bg-card">
                      <button type="button" className="block w-full text-left" onClick={() => openItem(item)}>
                        <div className="relative h-28 w-full">
                          {item.imageUrl ? (
                            <Image src={item.imageUrl} alt={item.title} fill sizes="(max-width: 768px) 50vw, 280px" className="object-cover" unoptimized />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center px-3 text-center text-xs text-muted-foreground">Изображение байка скоро загрузим</div>
                          )}
                        </div>
                        <div className="p-3">
                          <h3 className="mt-1 text-sm font-semibold leading-5">{item.title}</h3>
                          <p className="text-xs text-muted-foreground">{item.subtitle}</p>
                          <p className="mt-2 text-sm font-medium">{item.pricePerDay} ₽ / day</p>
                          <span className="mt-2 inline-flex rounded-lg px-2 py-1 text-xs font-medium" style={{ backgroundColor: crew.theme.palette.accentMain, color: "#16130A" }}>
                            Подробнее
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

      <FloatingCartIconLink
        href={`/franchize/${crew.slug || slug}/cart`}
        itemCount={itemCount}
        totalPrice={totalPrice}
        accentColor={crew.theme.palette.accentMain}
        textColor={crew.theme.palette.textPrimary}
        borderColor={crew.theme.palette.borderSoft}
      />

      <ItemModal
        item={selectedItem}
        theme={crew.theme}
        options={selectedOptions}
        onChangeOption={(key, value) => setSelectedOptions((prev) => ({ ...prev, [key]: value }))}
        onClose={() => setSelectedItem(null)}
        onAddToCart={() => {
          if (!selectedItem) return;
          setCart((prev) => ({ ...prev, [selectedItem.id]: (prev[selectedItem.id] ?? 0) + 1 }));
          setSelectedItem(null);
        }}
      />
    </>
  );
}
