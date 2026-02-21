"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import type { CatalogItemVM, FranchizeCrewVM } from "../actions";
import { FloatingCartIconLinkBySlug } from "./FloatingCartIconLinkBySlug";
import { ItemModal } from "../modals/Item";
import { useFranchizeCart } from "../hooks/useFranchizeCart";

interface CatalogClientProps {
  crew: FranchizeCrewVM;
  slug: string;
  items: CatalogItemVM[];
}

const toCategoryId = (category: string) => `category-${category.toLowerCase().replace(/\s+/g, "-")}`;

const sortWbItemLast = <T extends { category: string }>(groups: T[]) => {
  const regular = groups.filter((group) => !group.category.toLowerCase().includes("wbitem"));
  const wbItems = groups.filter((group) => group.category.toLowerCase().includes("wbitem"));
  return [...regular, ...wbItems];
};

const cardVariants = [
  "border border-border bg-card",
  "border border-amber-500/35 bg-gradient-to-b from-card to-background shadow-[0_12px_28px_rgba(217,154,0,0.08)]",
  "border border-border bg-card shadow-[0_0_0_1px_rgba(217,154,0,0.12),0_16px_26px_rgba(0,0,0,0.45)]",
] as const;

export function CatalogClient({ crew, slug, items }: CatalogClientProps) {
  const [selectedItem, setSelectedItem] = useState<CatalogItemVM | null>(null);
  const { addItem } = useFranchizeCart(crew.slug || slug);
  const [selectedOptions, setSelectedOptions] = useState({ package: "Base", duration: "1 day", perk: "Стандарт" });
  const [searchQuery, setSearchQuery] = useState("");

  const orderedCategories = useMemo(
    () => Array.from(new Set([...crew.catalog.categories, ...items.map((item) => item.category).filter(Boolean)])),
    [crew.catalog.categories, items],
  );

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;

    const query = searchQuery.toLowerCase().trim();
    return items.filter((item) => [item.title, item.subtitle, item.description, item.category].join(" ").toLowerCase().includes(query));
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

        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            Каталог пуст. Добавь позиции типов `bike`, `accessories`, `gear` или `wbitem`, чтобы наполнить витрину.
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
                    <article key={item.id} data-catalog-item="true" className={`group overflow-hidden rounded-2xl ${cardVariants[Math.abs(item.id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)) % cardVariants.length]}`}>
                      <button type="button" className="block w-full text-left" onClick={() => openItem(item)}>
                        <div className="relative h-28 w-full">
                          {item.imageUrl ? (
                            <Image src={item.imageUrl} alt={item.title} fill sizes="(max-width: 768px) 50vw, 280px" className="object-cover" unoptimized />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center px-3 text-center text-xs text-muted-foreground">Изображение байка скоро загрузим</div>
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
                          <p className="text-xs text-muted-foreground">{item.description || item.subtitle}</p>
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
