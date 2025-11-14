"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import CategoryFilter from "../components/CategoryFilter";
import { motion } from "framer-motion";
import { useScrollFadeIn } from "../hooks/useScrollFadeIn";
import { useStaggerFadeIn } from "../hooks/useStaggerFadeIn";
import { useBio30ThemeFix } from "../hooks/useBio30ThemeFix";
import { fetchCars } from "@/hooks/supabase";
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

// Map Supabase car data to UI product format
function mapCarToProduct(car: any): Product {
  const specs = car.specs || {};
  
  // Extract the display name (remove quantity suffix for cleaner title)
  const model = car.model || '';
  const cleanTitle = model.replace(/(\d+)$/, '').trim();
  
  // Determine the best image URL
  const imgUrl = car.image_url || (specs.photos && specs.photos[0]) || 
    "https://bio30.ru/front/static/uploads/products/default.webp";
  
  // Use price from specs (actual product price), not daily_price
  const price = specs.price || 0;
  
  // Get benefits from purpose field or construct from description
  const desc = specs.purpose || 
    car.description?.substring(0, 100) + (car.description?.length > 100 ? '...' : '') ||
    'Пищевая добавка BIO 3.0';
  
  return {
    id: generateProductId(car.id),
    title: cleanTitle,
    desc: desc,
    price: price,
    img: imgUrl
  };
}

const CategoriesPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const heroTitle = useScrollFadeIn("up", 0.1);
  const heroSubtitle = useScrollFadeIn("up", 0.2);
  const productGrid = useStaggerFadeIn(products.length, 0.1);
  useBio30ThemeFix();

  useEffect(() => {
    const slider = document.getElementById('price-slider');
    if (slider && !slider.noUiSlider) {
      noUiSlider.create(slider, {
        start: [0, 5000],
        connect: true,
        range: {
          'min': 0,
          'max': 5000
        }
      });
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const { success, data, error: fetchError } = await fetchCars();
      
      if (!success) {
        throw new Error(fetchError || "Failed to fetch products");
      }
      
      if (!data || data.length === 0) {
        logger.warn("No products found in database");
        setProducts([]);
        return;
      }
      
      // Filter and map only BIO 3.0 products with valid data
      const validProducts = data
        .filter(car => car.make === 'BIO 3.0' && car.specs && car.specs.price)
        .map(mapCarToProduct)
        .filter(product => product.price > 0); // Ensure valid price
      
      logger.info(`Loaded ${validProducts.length} products from Supabase`);
      setProducts(validProducts);
    } catch (err) {
      logger.error("Error loading products:", err);
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setIsLoading(false);
    }
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
          onClick={loadProducts}
          className="btn btn--primary"
        >
          Попробовать снова
        </button>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-16">
        <h2 className="text-2xl font-bold mb-4">Товары не найдены</h2>
        <p className="text-muted-foreground">В каталоге временно отсутствуют товары</p>
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
                    <span id="slider_min_value" className="subtitle fs__md fw__md">0</span>
                    <span id="slider_max_value" className="subtitle fs__md fw__md">5000</span>
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
          <CategoryFilter />
          <motion.div
            ref={productGrid.ref}
            initial="hidden"
            animate={productGrid.controls}
            variants={productGrid.container}
            className="grid grid--cards"
          >
            {products.map((p, i) => (
              <motion.div
                key={p.id}
                variants={productGrid.child}
                className="card card__default bg-card shadow-md rounded-xl overflow-hidden"
              >
                <Link href={`/bio30/categories/${p.id}`}>
                  <img
                    src={p.img}
                    alt={p.title}
                    className="w-full h-64 object-cover image__web"
                    loading="lazy"
                  />
                  <div className="p-4">
                    <h3 className="text-lg font-semibold">{p.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{p.desc}</p>
                    <p className="text-base font-bold mt-3">{p.price} руб.</p>
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