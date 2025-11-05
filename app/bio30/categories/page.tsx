"use client";

import React from "react";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { motion } from "framer-motion";
import { useScrollFadeIn } from "../hooks/useScrollFadeIn";
import { useStaggerFadeIn } from "../hooks/useStaggerFadeIn";

const products = [
  { 
    id: "lions-mane", 
    title: "Lion's Mane", 
    desc: "Гриб Львиная грива. Улучшает когнитивные функции.", 
    price: 1500, 
    img: "https://m.media-amazon.com/images/S/aplus-media-library-service-media/3e47bc7b-0f6f-4d80-8d5b-d673ce2bcae1.__CR0,0,600,450_PT0_SX600_V1___.jpg" // From search [image:0]
  },
  { 
    id: "cordyceps-sinensis", 
    title: "Cordyceps Sinensis", 
    desc: "Кордицепс китайский. Повышает энергию и выносливость.", 
    price: 2000, 
    img: "https://manukahoneyofnz.com/cdn/shop/products/MHprop300b_1200x.png?v=1700610630" // [image:1]
  },
  { 
    id: "spirulina-chlorella", 
    title: "Spirulina Chlorella", 
    desc: "Спирулина и хлорелла. Детокс и иммунитет.", 
    price: 1200, 
    img: "https://pub.mdpi-res.com/ijms/ijms-25-11724/article_deploy/html/images/ijms-25-11724-g001-550.jpg?1730384706" // [image:2] placeholder related
  },
  { 
    id: "magnesium-pyridoxine", 
    title: "Magnesium Pyridoxine", 
    desc: "Магний и витамин B6. Для нервной системы.", 
    price: 1800, 
    img: "https://ars.els-cdn.com/content/image/1-s2.0-S0924224421004155-gr1.jpg" // [image:3]
  },
  // Add more if needed
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
              <Link href={`/bio30/product/${p.id}`}>
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