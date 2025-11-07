"use client";

import React from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { ProductCard } from "./components/ui/ProductCard";
import { BenefitCard } from "./components/ui/BenefitCard";
import { HeroSlider } from "./components/HeroSlider";
import { useScrollFadeIn } from "./hooks/useScrollFadeIn";
import { PRODUCTS, HERO_SLIDES, BENEFITS, STORIES } from "./data";
import { useBio30ThemeFix } from "./hooks/useBio30ThemeFix";

const StoriesSlider = dynamic(() => import("./components/StoriesSlider"), { 
  ssr: false,
  loading: () => <div className="h-64 bg-muted animate-pulse" />
});

export default function HomePage(): JSX.Element {
  useBio30ThemeFix();
  
  const { ref: titleRef, variants: titleVariants } = useScrollFadeIn("up", { delay: 0.1 });
  const { ref: gridRef, variants: gridVariants } = useScrollFadeIn("none", { delay: 0.15 });

  return (
    <main className="page-home">
      <HeroSlider slides={HERO_SLIDES} />
      
      <section className="section section--products" aria-labelledby="products-title">
        <motion.header
          ref={titleRef}
          variants={titleVariants}
          initial="hidden"
          animate="visible"
          className="section-header"
        >
          <h1 id="products-title" className="title fs__lg fw__bd gradient">
            Мультивселенная продуктов
          </h1>
        </motion.header>

        <motion.div
          ref={gridRef}
          variants={gridVariants}
          initial="hidden"
          animate="visible"
          className="grid grid--product2"
        >
          {PRODUCTS.map((product, i) => (
            <ProductCard key={product.title} product={product} index={i} />
          ))}
          
          <Link 
            href="/bio30/categories" 
            className="card card--all"
            aria-label="Все продукты"
          >
            <h2 className="title fs__xl fw__bd">Все продукты</h2>
          </Link>
        </motion.div>
      </section>

      <section className="section section--stories" aria-labelledby="stories-title">
        <StoriesSlider stories={STORIES} />
      </section>

      <section className="section section--benefits" aria-labelledby="benefits-title">
        <motion.header
          ref={useScrollFadeIn("up", { delay: 0.1 }).ref}
          variants={useScrollFadeIn("up", { delay: 0.1 }).variants}
          initial="hidden"
          animate="visible"
          className="section-header"
        >
          <h2 id="benefits-title" className="title fs__lg fw__bd gradient">
            Наши Преимущества
          </h2>
        </motion.header>

        <motion.div 
          className="grid grid--benefit"
          variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
          initial="hidden"
          animate="visible"
        >
          {BENEFITS.map((benefit, i) => (
            <BenefitCard key={benefit.title} benefit={benefit} index={i} />
          ))}
        </motion.div>
      </section>

      <PartnerForm />
    </main>
  );
}