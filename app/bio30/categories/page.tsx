// /app/bio30/categories/page.tsx
"use client";

import React, { useEffect } from "react";
import Link from "next/link";


import CategoryFilter from "../components/CategoryFilter";
import { motion } from "framer-motion";
import { useScrollFadeIn } from "../hooks/useScrollFadeIn";
import { useStaggerFadeIn } from "../hooks/useStaggerFadeIn";
import { useBio30ThemeFix } from "../hooks/useBio30ThemeFix";
import noUiSlider from "nouislider";

const products = [
  {
    id: "lion-s-mane",
    title: "Lion's Mane",
    desc: "Гриб Львиная грива. Улучшает когнитивные функции.",
    price: 1500,
    img: "https://bio30.ru/front/static/uploads/products/9aeea9dde8f048238a27f43c3997c9fd.webp"
  },
  {
    id: "cordyceps-sinensis",
    title: "Cordyceps Sinensis",
    desc: "Кордицепс китайский. Повышает энергию и выносливость.",
    price: 2000,
    img: "https://bio30.ru/front/static/uploads/products/deab27a3b7834149ad5187c430301f9c.webp"
  },
  {
    id: "spirulina-chlorella",
    title: "Spirulina Chlorella",
    desc: "Спирулина и хлорелла. Детокс и иммунитет.",
    price: 1200,
    img: "https://bio30.ru/front/static/uploads/products/44aa9efb6836449bb10a1f7ac9d42923.webp"
  },
  {
    id: "magnesium-pyridoxine",
    title: "Magnesium Pyridoxine",
    desc: "Магний и витамин B6. Для нервной системы.",
    price: 1800,
    img: "https://bio30.ru/front/static/uploads/products/1552689351894f229843f51efdb813fc.webp"
  },
];

const CategoriesPage: React.FC = () => {
  const heroTitle = useScrollFadeIn("up", 0.1);
  const heroSubtitle = useScrollFadeIn("up", 0.2);
  const productGrid = useStaggerFadeIn(products.length, 0.1);
  useBio30ThemeFix();

  useEffect(() => {
    const slider = document.getElementById('price-slider');
    if (slider) {
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
                      <label className="link fs__md fw__md opc opc--50 anmt" for="tag_bestseller">
                        Бестселлер
                      </label>
                    </div>
                    <div className="row ctr gp gp--xs">
                      <input className="ui-checkbox" type="checkbox" name="tag" value="for_women" id="tag_for_women" />
                      <label className="link fs__md fw__md opc opc--50 anmt" for="tag_for_women">
                        Для женщин
                      </label>
                    </div>
                    <div className="row ctr gp gp--xs">
                      <input className="ui-checkbox" type="checkbox" name="tag" value="for_men" id="tag_for_men" />
                      <label className="link fs__md fw__md opc opc--50 anmt" for="tag_for_men">
                        Для мужчин
                      </label>
                    </div>
                    <div className="row ctr gp gp--xs">
                      <input className="ui-checkbox" type="checkbox" name="tag" value="complex" id="tag_complex" />
                      <label className="link fs__md fw__md opc opc--50 anmt" for="tag_complex">
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
                    <label className="link fs__md fw__md opc opc--50 anmt" for="in_stock_only">
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
                    <label className="link fs__md fw__md opc opc--50 anmt" for="has_discount">
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
                key={i}
                variants={productGrid.child}
                className={p.class || "card card__default bg-card shadow-md rounded-xl overflow-hidden"}
                style={{ backgroundColor: p.bg, color: p.text }}
              >
                <Link href={`/bio30/categories/${p.id}`}>
                  <img
                    src={p.img}
                    alt={p.title}
                    className="w-full h-64 object-cover image__web"
                  />
                  <img
                    src={p.mobileImg || p.img}
                    alt={p.title}
                    className="w-full h-64 object-cover image__mobile"
                  />
                  <div className="p-4">
                    <h3 className="text-lg font-semibold">{p.title}</h3>
                    <p className="text-sm text-muted-foreground">{p.desc}</p>
                    <p className="text-base font-bold mt-2">{p.price} руб.</p>
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