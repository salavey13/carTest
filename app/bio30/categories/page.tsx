"use client";

import React from "react";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { motion } from "framer-motion";
import { useScrollFadeIn } from "../hooks/useScrollFadeIn";

const categories = [
  { title: "Категория 1", desc: "Биопродукты для здоровья", img: "image1.webp" },
  { title: "Категория 2", desc: "Витамины и минералы", img: "image2.webp" },
  { title: "Категория 3", desc: "Добавки для иммунитета", img: "image3.webp" },
  { title: "Категория 4", desc: "Продукты для красоты", img: "image4.webp" },
];

const CategoriesPage: React.FC = () => {
  const heroTitle = useScrollFadeIn("up", 0.1);
  const heroSubtitle = useScrollFadeIn("up", 0.2);

  return (
    <div>
      <Header />
      <section className="text-center py-16">
        <motion.h1 ref={heroTitle.ref} initial="hidden" animate={heroTitle.controls} variants={heroTitle.variants} className="text-3xl font-bold gradient-text mb-2">
          Продукты — BIO 3.0
        </motion.h1>
        <motion.p ref={heroSubtitle.ref} initial="hidden" animate={heroSubtitle.controls} variants={heroSubtitle.variants} className="text-muted-foreground max-w-xl mx-auto">
          Каталог биодобавок для здоровья и красоты.
        </motion.p>
      </section>

      <section className="grid gap-6 p-6 max-w-5xl mx-auto">
        {categories.map((c, i) => {
          const anim = useScrollFadeIn("up", i * 0.1);
          return (
            <motion.div
              key={i}
              ref={anim.ref}
              initial="hidden"
              animate={anim.controls}
              variants={anim.variants}
              className="flex flex-col md:flex-row items-center bg-card rounded-xl shadow-md overflow-hidden"
            >
              <div className="flex-1 p-6">
                <div className="text-lg font-bold mb-2">{c.title}</div>
                <div className="text-muted-foreground">{c.desc}</div>
              </div>
              <img
                src={`https://bio30.ru/static/uploads/categories/${c.img}`}
                alt={c.title}
                className="w-full md:w-1/3 h-48 object-cover"
              />
            </motion.div>
          );
        })}
      </section>
      <Footer />
    </div>
  );
};

export default CategoriesPage;