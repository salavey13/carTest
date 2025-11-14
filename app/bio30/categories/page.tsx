"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import CategoryFilter, { FilterState } from "../components/CategoryFilter";
import { motion } from "framer-motion";
import { useScrollFadeIn } from "../hooks/useScrollFadeIn";
import { useStaggerFadeIn } from "../hooks/useStaggerFadeIn";
import { useBio30ThemeFix } from "../hooks/useBio30ThemeFix";
import { fetchBio30Products } from "../categories/actions";
import { logger } from "@/lib/logger";
import noUiSlider from "nouislider";
import { useAppToast } from "@/hooks/useAppToast";

interface Product {
  id: string;
  title: string;
  desc: string;
  price: number;
  img: string;
  originalPrice?: number;
}

const CategoriesPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const toast = useAppToast();
  
  const heroTitle = useScrollFadeIn("up", 0.1);
  const heroSubtitle = useScrollFadeIn("up", 0.2);
  const productGrid = useStaggerFadeIn(filteredProducts.length, 0.1);
  useBio30ThemeFix();

  const [filters, setFilters] = useState<FilterState>({
    category: 'Все категории',
    search: '',
    minPrice: 0,
    maxPrice: 5000,
    purposes: [],
    inStockOnly: false,
    hasDiscount: false
  });

  useEffect(() => {
    // Initialize price slider
    const slider = document.getElementById('price-slider');
    if (slider && !slider.noUiSlider) {
      const sliderInstance = noUiSlider.create(slider, {
        start: [0, 5000],
        connect: true,
        range: {
          'min': 0,
          'max': 5000
        }
      });

      sliderInstance.on('update', (values) => {
        const min = parseInt(values[0]);
        const max = parseInt(values[1]);
        setFilters(prev => ({
          ...prev,
          minPrice: min,
          maxPrice: max
        }));
      });

      // Store instance for cleanup
      (slider as any).noUiSliderInstance = sliderInstance;
    }

    return () => {
      // Cleanup slider
      const slider = document.getElementById('price-slider');
      if (slider && (slider as any).noUiSliderInstance) {
        (slider as any).noUiSliderInstance.destroy();
      }
    };
  }, []);

  useEffect(() => {
    loadInitialProducts();
  }, []);

  const loadInitialProducts = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      toast.loading("Загрузка продуктов...", { id: "loading-products" });
      
      const result = await fetchBio30Products();
      
      if (!result.success) {
        throw new Error(result.error || "Failed to fetch products");
      }
      
      toast.dismiss("loading-products");
      
      if (!result.data || result.data.length === 0) {
        toast.info("Продукты не найдены в базе");
        setProducts([]);
        setFilteredProducts([]);
        return;
      }
      
      const uiProducts: Product[] = result.data.map(p => ({
        id: p.id,
        title: p.title,
        desc: p.description,
        price: p.price,
        img: p.image,
        originalPrice: p.originalPrice
      }));
      
      setProducts(uiProducts);
      setFilteredProducts(uiProducts);
      toast.success(`Загружено ${uiProducts.length} продуктов`);
      
    } catch (err) {
      logger.error("Error loading products:", err);
      setError(err instanceof Error ? err.message : "Unknown error occurred");
      toast.error(`Ошибка загрузки: ${err instanceof Error ? err.message : 'Неизвестная ошибка'}`);
    } finally {
      setIsLoading(false);
      toast.dismiss("loading-products");
    }
  };

  const handleFilterChange = useCallback(async (newFilters: FilterState) => {
    setFilters(newFilters);
    
    try {
      toast.loading("Применение фильтров...", { id: "applying-filters" });
      
      const result = await fetchBio30Products(newFilters);
      
      if (!result.success) {
        throw new Error(result.error || "Failed to apply filters");
      }
      
      toast.dismiss("applying-filters");
      
      const uiProducts: Product[] = (result.data || []).map(p => ({
        id: p.id,
        title: p.title,
        desc: p.description,
        price: p.price,
        img: p.image,
        originalPrice: p.originalPrice
      }));
      
      setFilteredProducts(uiProducts);
      toast.success(`Найдено ${uiProducts.length} продуктов`);
      
    } catch (err) {
      logger.error("Error applying filters:", err);
      toast.error("Ошибка применения фильтров");
      // Fallback: show all products
      setFilteredProducts(products);
    }
  }, [products]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-4"></div>
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
        <button 
          onClick={loadInitialProducts}
          className="btn btn--primary"
        >
          Попробовать снова
        </button>
      </div>
    );
  }

  if (filteredProducts.length === 0) {
    return (
      <div className="text-center py-16 bg-background">
        <h2 className="text-2xl font-bold mb-4">Продукты не найдены</h2>
        <p className="text-muted-foreground mb-6">По вашим критериям ничего не найдено</p>
        <button 
          onClick={() => {
            const resetFilters = {
              category: 'Все категории',
              search: '',
              minPrice: 0,
              maxPrice: 5000,
              purposes: [],
              inStockOnly: false,
              hasDiscount: false
            };
            handleFilterChange(resetFilters);
          }}
          className="btn btn--primary"
        >
          Сбросить фильтры
        </button>
      </div>
    );
  }

  return (
    <div className="bio30-wrapper bg-background min-h-screen">
      
      <section className="text-center py-16 px-4">
        <motion.h1 ref={heroTitle.ref} initial="hidden" animate={heroTitle.controls} variants={heroTitle.variants} className="text-3xl md:text-4xl font-bold gradient-text mb-2">
          Продукты — BIO 3.0
        </motion.h1>
        <motion.p ref={heroSubtitle.ref} initial="hidden" animate={heroSubtitle.controls} variants={heroSubtitle.variants} className="text-muted-foreground max-w-xl mx-auto">
          Каталог БАДов BIO 3.0. Широкий выбор для здоровья и красоты.
        </motion.p>
      </section>

      <div className="categories__section flex flex-col md:flex-row gap-6 px-4 md:px-6 max-w-7xl mx-auto">
        <aside className="aside--categories w-full md:w-1/4">
          <div className="sticky top-24">
            <form id="filter-form" className="container grey col rounded-lg border border-border p-4">
              <div className="col gp gp--lg">
                <div className="col gp gp--xs">
                  <div className="row">
                    <h4 className="title fs__sm fw__bd opc opc--50 mg mg__lg--btm">
                      Цена, руб.
                    </h4>
                  </div>
                  <div id="price-slider" className="price-slider mb-6"></div>
                  <div className="row ctr space--between">
                    <span id="slider_min_value" className="subtitle fs__md fw__md">{filters.minPrice}</span>
                    <span id="slider_max_value" className="subtitle fs__md fw__md">{filters.maxPrice}</span>
                  </div>
                </div>
                
                <div className="col gp gp--xs">
                  <div className="row">
                    <h4 className="title fs__sm fw__bd opc opc--50 mg mg__xs--btm">
                      Теги
                    </h4>
                  </div>
                  <div className="filter-tags col gp gp--xs">
                    <div className="row ctr gp gp--xs">
                      <input className="ui-checkbox" type="checkbox" name="tag" value="bestseller" id="tag_bestseller" />
                      <label className="link fs__md fw__md opc opc--50 anmt" htmlFor="tag_bestseller">
                        Бестселлер
                      </label>
                    </div>
                    <div className="row ctr gp gp--xs">
                      <input className="ui-checkbox" type="checkbox" name="tag" value="for_women" id="tag_for_women" />
                      <label className="link fs__md fw__md opc opc--50 anmt" htmlFor="tag_for_women">
                        Для женщин
                      </label>
                    </div>
                    <div className="row ctr gp gp--xs">
                      <input className="ui-checkbox" type="checkbox" name="tag" value="for_men" id="tag_for_men" />
                      <label className="link fs__md fw__md opc opc--50 anmt" htmlFor="tag_for_men">
                        Для мужчин
                      </label>
                    </div>
                    <div className="row ctr gp gp--xs">
                      <input className="ui-checkbox" type="checkbox" name="tag" value="complex" id="tag_complex" />
                      <label className="link fs__md fw__md opc opc--50 anmt" htmlFor="tag_complex">
                        Комплекс
                      </label>
                    </div>
                  </div>
                </div>
                
                <div className="col gp gp--xs">
                  <div className="row">
                    <h4 className="title fs__sm fw__bd opc opc--50 mg mg__xs--btm">
                      Наличие
                    </h4>
                  </div>
                  <div className="row ctr gp gp--xs">
                    <input className="ui-checkbox" type="checkbox" name="in_stock_only" id="in_stock_only" />
                    <label className="link fs__md fw__md opc opc--50 anmt" htmlFor="in_stock_only">
                      Только в наличии
                    </label>
                  </div>
                </div>
                
                <div className="col gp gp--xs">
                  <div className="row">
                    <h4 className="title fs__sm fw__bd opc opc--50 mg mg__xs--btm">
                      Скидки
                    </h4>
                  </div>
                  <div className="row ctr gp gp--xs">
                    <input className="ui-checkbox" type="checkbox" name="has_discount" id="has_discount" />
                    <label className="link fs__md fw__md opc opc--50 anmt" htmlFor="has_discount">
                      Только со скидкой
                    </label>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </aside>

        <section className="bside--categories w-full md:w-3/4">
          <CategoryFilter onFilterChange={handleFilterChange} initialFilters={filters} />
          <motion.div
            ref={productGrid.ref}
            initial="hidden"
            animate={productGrid.controls}
            variants={productGrid.container}
            className="grid grid--cards grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {filteredProducts.map((p) => (
              <motion.div
                key={p.id}
                variants={productGrid.child}
                className="card card__default bg-card shadow-md rounded-xl overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
              >
                <Link href={`/bio30/categories/${p.id}`} className="block">
                  <div className="relative">
                    <img
                      src={p.img}
                      alt={p.title}
                      className="w-full h-64 object-cover image__web"
                      loading="lazy"
                    />
                    {p.originalPrice && p.originalPrice > p.price && (
                      <span className="absolute top-2 right-2 bg-destructive text-destructive-foreground px-2 py-1 rounded-md text-xs font-bold">
                        -{Math.round((1 - p.price / p.originalPrice) * 100)}%
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="text-lg font-semibold mb-1">{p.title}</h3>
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{p.desc}</p>
                    <div className="flex items-center justify-between">
                      <p className="text-xl font-bold text-primary">{p.price} руб.</p>
                      {p.originalPrice && p.originalPrice > p.price && (
                        <p className="text-sm text-muted-foreground line-through">
                          {p.originalPrice} руб.
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
            <Link href="/bio30/categories" className="card card__default card__default--show-all card--link flex items-center justify-center" style={{ backgroundColor: '#0D0D0D', border: '1px solid var(--border)', minHeight: '300px' }}>
              <div className="col pd__xl gp gp--md text-center">
                <h2 className="title fs__md fw__bd">
                  Все продукты
                </h2>
              </div>
            </Link>
          </motion.div>
        </section>
      </div>
      
    </div>
  );
};

export default CategoriesPage;