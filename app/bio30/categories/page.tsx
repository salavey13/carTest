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

interface Product {
  id: string;
  title: string;
  desc: string;
  price: number;
  img: string;
}

// Helper to transliterate Cyrillic to Latin for URLs
function transliterate(text: string): string {
  const map: Record<string, string> = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh', 'з': 'z',
    'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r',
    'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch',
    'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
    'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'Yo', 'Ж': 'Zh', 'З': 'Z',
    'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M', 'Н': 'N', 'О': 'O', 'П': 'P', 'Р': 'R',
    'С': 'S', 'Т': 'T', 'У': 'U', 'Ф': 'F', 'Х': 'H', 'Ц': 'Ts', 'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Shch',
    'Ъ': '', 'Ы': 'Y', 'Ь': '', 'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya'
  };
  
  return text.split('').map(char => map[char] || char).join('');
}

// Generate URL-friendly product ID
function generateProductId(carId: string): string {
  return transliterate(carId)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Map Supabase product data to UI format
function mapProductToUI(product: any): Product {
  return {
    id: generateProductId(product.id),
    title: product.title,
    desc: product.description,
    price: product.price,
    img: product.image
  };
}

const CategoriesPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
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
    }
  }, []);

  useEffect(() => {
    loadInitialProducts();
  }, []);

  const loadInitialProducts = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const { success, data, error: fetchError } = await fetchBio30Products();
      
      if (!success) {
        throw new Error(fetchError || "Failed to fetch products");
      }
      
      const uiProducts = (data || []).map(mapProductToUI);
      setProducts(uiProducts);
      setFilteredProducts(uiProducts);
    } catch (err) {
      logger.error("Error loading products:", err);
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFilterChange = useCallback(async (newFilters: FilterState) => {
    setFilters(newFilters);
    
    try {
      // Apply server-side filtering
      const { success, data, error: filterError } = await fetchBio30Products(newFilters);
      
      if (!success) {
        throw new Error(filterError || "Failed to apply filters");
      }
      
      const uiProducts = (data || []).map(mapProductToUI);
      setFilteredProducts(uiProducts);
    } catch (err) {
      logger.error("Error applying filters:", err);
      // Fallback to client-side filtering
      applyClientSideFilters(newFilters);
    }
  }, [products]);

  const applyClientSideFilters = (newFilters: FilterState) => {
    // This is a backup in case server-side filtering fails
    const filtered = products.filter(product => {
      // Category filter
      if (newFilters.category !== 'Все категории') {
        // Filter logic would go here if needed
      }
      
      // Search filter
      if (newFilters.search) {
        const searchTerm = newFilters.search.toLowerCase();
        const matches = product.title.toLowerCase().includes(searchTerm) ||
                       product.desc.toLowerCase().includes(searchTerm);
        if (!matches) return false;
      }
      
      // Price filter
      if (product.price < newFilters.minPrice || product.price > newFilters.maxPrice) {
        return false;
      }
      
      return true;
    });
    
    setFilteredProducts(filtered);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
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
      <div className="text-center py-16">
        <h2 className="text-2xl font-bold mb-4">Продукты не найдены</h2>
        <p className="text-muted-foreground mb-6">По вашим критериям ничего не найдено</p>
        <button 
          onClick={() => handleFilterChange({
            category: 'Все категории',
            search: '',
            minPrice: 0,
            maxPrice: 5000,
            purposes: [],
            inStockOnly: false,
            hasDiscount: false
          })}
          className="btn btn--primary"
        >
          Сбросить фильтры
        </button>
      </div>
    );
  }

  return (
    <div>
      
      <section className="text-center py-16">
        <motion.h1 ref={heroTitle.ref} initial="hidden" animate={heroTitle.controls} variants={heroTitle.variants} className="text-3xl font-bold gradient-text mb-2">
          Продукты — BIO 3.0
        </motion.h1>
        <motion.p ref={heroSubtitle.ref} initial="hidden" animate={heroSubtitle.controls} variants={heroSubtitle.variants} className="text-muted-foreground max-w-xl mx-auto">
          Каталог БАДов BIO 3.0. Широкий выбор для здоровья и красоты.
        </motion.p>
      </section>

      <div className="categories__section flex flex-col md:flex-row gap-6 px-6">
        <aside className="aside--categories w-full md:w-1/4">
          <div className="sticky">
            <form id="filter-form" className="container grey col" data-anim="fade" data-delay="0.1">
              <div className="col pd pd__lg gp gp--lg" data-stagger="fade" data-stagger-delay="0.12">
                <div className="col gp gp--xs">
                  <div className="row">
                    <h4 className="title fs__sm fw__bd opc opc--50 mg mg__lg--btm">
                      Цена
                    </h4>
                  </div>
                  <div id="price-slider" className="price-slider mb-6"></div>
                  <div className="row ctr space--between">
                    <span id="slider_min_value" className="subtitle fs__md fw__md">{filters.minPrice}</span>
                    <span id="slider_max_value" className="subtitle fs__md fw__md">{filters.maxPrice}</span>
                  </div>
                </div>
                
                {/* Legacy filters kept for visual consistency */}
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
            className="grid grid--cards"
          >
            {filteredProducts.map((p) => (
              <motion.div
                key={p.id}
                variants={productGrid.child}
                className="card card__default bg-card shadow-md rounded-xl overflow-hidden hover:shadow-lg transition-shadow"
              >
                <Link href={`/bio30/categories/${p.id}`}>
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
                      <p className="text-xl font-bold">{p.price} руб.</p>
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
            <Link href="/bio30/categories" className="card card__default card__default--show-all card--link" style={{ backgroundColor: '#0D0D0D', border: '1px solid var(--border)' }}>
              <div className="col pd__xl gp gp--md">
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