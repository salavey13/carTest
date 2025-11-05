"use client";

import React from "react";
import Link from "next/link";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { motion } from "framer-motion";
import { useScrollFadeIn } from "../hooks/useScrollFadeIn";
import { useStaggerFadeIn } from "../hooks/useStaggerFadeIn";

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

      <section className="py-16 px-6">
        <motion.div
          ref={productGrid.ref}
          initial="hidden"
          animate={productGrid.controls}
          variants={productGrid.container}
          className="grid md:grid-cols-3 gap-6"
        >
          {products.map((p, i) => (
            <motion.div
              key={i}
              variants={productGrid.child}
              className="card card__default bg-card shadow-md rounded-xl overflow-hidden"
            >
              <Link href={`/bio30/categories/${p.id}`}>
                <img
                  src={p.img}
                  alt={p.title}
                  className="w-full h-64 object-cover"
                />
                <div className="p-4">
                  <h3 className="text-lg font-semibold">{p.title}</h3>
                  <p className="text-sm text-muted-foreground">{p.desc}</p>
                  <p className="text-base font-bold mt-2">{p.price} руб.</p>
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </section>
      <Footer />
    </div>
  );
};

export default CategoriesPage;