"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { CategoryFilter } from "../components/CategoryFilter";
import { useBio30 } from "../categories/hooks/useBio30";
import { useScrollFadeIn } from "../hooks/useScrollFadeIn";
import { useBio30ThemeFix } from "../hooks/useBio30ThemeFix";
import { useAppToast } from "@/hooks/useAppToast";
import noUiSlider from "nouislider";
import "nouislider/dist/nouislider.css";

export default function CategoriesPage() {
  const {
    filteredProducts,
    categories,
    purposes,
    isLoading,
    error,
    filters,
    applyFilters,
    updatePriceRange
  } = useBio30();

  const toast = useAppToast();
  const heroTitle = useScrollFadeIn("up", 0.1);
  const heroSubtitle = useScrollFadeIn("up", 0.2);
  useBio30ThemeFix();

  // Initialize price slider
  useEffect(() => {
    const sliderEl = document.getElementById('price-slider');
    if (!sliderEl || (sliderEl as any).noUiSlider) return;

    const slider = noUiSlider.create(sliderEl, {
      start: [filters.minPrice, filters.maxPrice],
      connect: true,
      step: 50,
      range: {
        'min': 0,
        'max': 5000
      },
      tooltips: true,
      format: {
        to: (value) => Math.round(value) + '₽',
        from: (value) => parseInt(value.toString().replace('₽', ''))
      }
    });

    slider.on('update', (values) => {
      const min = parseInt(values[0].toString().replace('₽', ''));
      const max = parseInt(values[1].toString().replace('₽', ''));
      updatePriceRange(min, max);
    });

    (sliderEl as any).noUiSlider = slider;

    return () => {
      slider.destroy();
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-background">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-muted border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Загрузка продуктов...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16 bg-background">
        <h2 className="text-2xl font-bold text-destructive mb-4">Ошибка загрузки</h2>
        <p className="text-muted-foreground mb-6">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-20 pb-16">
      {/* Hero Section */}
      <section className="text-center py-16 px-4">
        <motion.h1
          ref={heroTitle.ref}
          initial="hidden"
          animate={heroTitle.controls}
          variants={heroTitle.variants}
          className="text-4xl md:text-6xl font-bold font-orbitron text-gradient mb-4"
        >
          Продукты BIO 3.0
        </motion.h1>
        <motion.p
          ref={heroSubtitle.ref}
          initial="hidden"
          animate={heroSubtitle.controls}
          variants={heroSubtitle.variants}
          className="text-lg text-muted-foreground max-w-2xl mx-auto"
        >
          Каталог БАДов для здоровья и красоты. Премиум качество, научный подход.
        </motion.p>
      </section>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar Filters */}
          <aside className="lg:w-1/4">
            <div className="sticky top-24 space-y-6">
              {/* Price Range */}
              <div className="bg-card border border-border rounded-xl p-4">
                <h3 className="text-sm font-semibold mb-3 text-foreground">Цена, ₽</h3>
                <div id="price-slider" className="mb-4"></div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0₽</span>
                  <span>5000₽</span>
                </div>
              </div>

              {/* Tags Filter */}
              <div className="bg-card border border-border rounded-xl p-4">
                <h3 className="text-sm font-semibold mb-3 text-foreground">Теги</h3>
                <div className="space-y-2">
                  {[
                    { id: 'tag_bestseller', label: 'Бестселлер', value: 'bestseller' },
                    { id: 'tag_for_women', label: 'Для женщин', value: 'for_women' },
                    { id: 'tag_for_men', label: 'Для мужчин', value: 'for_men' },
                    { id: 'tag_complex', label: 'Комплекс', value: 'complex' }
                  ].map(tag => (
                    <label
                      key={tag.id}
                      className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        id={tag.id}
                        checked={filters.tags.includes(tag.value)}
                        onChange={(e) => {
                          const newTags = e.target.checked
                            ? [...filters.tags, tag.value]
                            : filters.tags.filter(t => t !== tag.value);
                          applyFilters({ ...filters, tags: newTags });
                        }}
                        className="w-4 h-4 accent-primary"
                      />
                      <span className="text-sm">{tag.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Stock Filter */}
              <div className="bg-card border border-border rounded-xl p-4">
                <h3 className="text-sm font-semibold mb-3 text-foreground">Наличие</h3>
                <label className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer">
                  <input
                    type="checkbox"
                    id="in_stock_only"
                    checked={filters.inStockOnly}
                    onChange={(e) => applyFilters({ ...filters, inStockOnly: e.target.checked })}
                    className="w-4 h-4 accent-primary"
                  />
                  <span className="text-sm">Только в наличии</span>
                </label>
              </div>

              {/* Discount Filter */}
              <div className="bg-card border border-border rounded-xl p-4">
                <h3 className="text-sm font-semibold mb-3 text-foreground">Скидки</h3>
                <label className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer">
                  <input
                    type="checkbox"
                    id="has_discount"
                    checked={filters.hasDiscount}
                    onChange={(e) => applyFilters({ ...filters, hasDiscount: e.target.checked })}
                    className="w-4 h-4 accent-primary"
                  />
                  <span className="text-sm">Только со скидкой</span>
                </label>
              </div>
            </div>
          </aside>

          {/* Products Section */}
          <section className="lg:w-3/4">
            {/* Top Filter Bar */}
            <CategoryFilter
              filters={filters}
              onFilterChange={applyFilters}
              categories={categories}
              purposes={purposes}
              isLoading={isLoading}
            />

            {/* Products Grid */}
            {filteredProducts.length === 0 ? (
              <div className="text-center py-16 bg-card border border-border rounded-xl">
                <h3 className="text-xl font-semibold mb-2">Продукты не найдены</h3>
                <p className="text-muted-foreground mb-6">Попробуйте изменить фильтры</p>
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6"
              >
                {filteredProducts.map((product, index) => (
                  <motion.article
                    key={product.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="group relative bg-card border border-border rounded-xl overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
                  >
                    <Link href={`/bio30/categories/${product.id}`} className="block">
                      <div className="relative">
                        <img
                          src={product.image}
                          alt={product.title}
                          className="w-full h-64 object-cover bg-muted"
                          loading="lazy"
                        />
                        {product.hasDiscount && product.originalPrice && (
                          <span className="absolute top-2 right-2 bg-destructive text-destructive-foreground px-2 py-1 rounded-md text-xs font-bold">
                            -{Math.round((1 - product.price / product.originalPrice) * 100)}%
                          </span>
                        )}
                      </div>
                      <div className="p-4">
                        <h3 className="font-semibold text-foreground mb-1">{product.title}</h3>
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                          {product.description}
                        </p>
                        <div className="flex items-center justify-between">
                          <p className="text-xl font-bold text-primary">{product.price} ₽</p>
                          {product.originalPrice && (
                            <p className="text-sm text-muted-foreground line-through">
                              {product.originalPrice} ₽
                            </p>
                          )}
                        </div>
                      </div>
                    </Link>
                  </motion.article>
                ))}
              </motion.div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}