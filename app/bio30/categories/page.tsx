"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import Header from "../components/Header";
import Footer from "../components/Footer";
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
      <Header />
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
          <h3 className="font-bold mb-4">Цена</h3>
          <div id="price-slider" className="price-slider mb-6"></div>
          <h3 className="font-bold mb-4">Категория</h3>
          <div className="space-y-2">
            <label><input type="checkbox" /> Вегетарианцы</label>
            <label><input type="checkbox" /> Для женщин</label>
            <label><input type="checkbox" /> Для мужчин</label>
            <label><input type="checkbox" /> Комплекс</label>
            <label><input type="checkbox" /> Есть на складе</label>
            <label><input type="checkbox" /> Только в наличии</label>
            <label><input type="checkbox" /> Только со скидкой</label>
          </div>
          <CategoryFilter />
        </aside>

        <section className="bside--categories w-full md:w-3/4">
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
      <Footer />
    </div>
  );
};

export default CategoriesPage;