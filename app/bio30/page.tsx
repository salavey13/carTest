"use client";

import React from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import Link from "next/link";
import { ProductCard } from "./components/ui/ProductCard";
import { BenefitCard } from "./components/ui/BenefitCard";
import { HeroSlider } from "./components/HeroSlider";
import { useScrollFadeIn } from "./hooks/useScrollFadeIn";
import { PRODUCTS, HERO_SLIDES, BENEFITS, STORIES } from "./data";
import { useBio30ThemeFix } from "./hooks/useBio30ThemeFix";
import PartnerForm from "./components/PartnerForm";

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
          className="article"
        >
          <div className="row">
            <h1 id="products-title" className="title fs__lg fw__bd gradient">
              Мультивселенная продуктов
            </h1>
          </div>
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
            <div className="col gp gp--md ctr">
              <h2 className="title fs__xl fw__bd">Все продукты</h2>
              <span className="subtitle fs__md opc opc--75">→</span>
            </div>
          </Link>
        </motion.div>
      </section>

      <section className="section section--stories" aria-labelledby="stories-title">
        <StoriesSlider stories={STORIES} />
      </section>

      <section className="section section--benefits" aria-labelledby="benefits-title">
        <motion.header
          className="article"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="row">
            <h2 id="benefits-title" className="title fs__lg fw__bd gradient">
              Наши Преимущества
            </h2>
          </div>
        </motion.header>

        <motion.div 
          className="grid grid--benefit"
          variants={{
            visible: { transition: { staggerChildren: 0.1 } }
          }}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          {BENEFITS.map((benefit, i) => (
            <BenefitCard key={benefit.title} benefit={benefit} index={i} />
          ))}
        </motion.div>
      </section>

      <section className="section section--partner" aria-labelledby="partner-title">
        <div className="container container--welcome pd pd__hg gp gp--hg ctr">
          <div className="aside" data-anim="fade" data-delay="0.1">
            <div className="col gp gp--xs">
              <h2 id="partner-title" className="title fs__xxl fw__bd bw0">
                Станьте частью большой и крепкой семьи
              </h2>
              <p className="subtitle fs__lg fw__rg opc opc--50 bw0">
                Приглашайте партнёров и получайте бонусы с каждой сделки.
              </p>
            </div>
          </div>
          <div className="bside bside--welcome" data-anim="fade" data-delay="0.2">
            <PartnerForm />
          </div>
        </div>
      </section>
    </main>
  );
}