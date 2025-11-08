// /app/bio30/page.tsx
"use client";

import React from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { useScrollFadeIn } from "./hooks/useScrollFadeIn";
import { useStaggerFadeIn } from "./hooks/useStaggerFadeIn";
import { useBio30ThemeFix } from "./hooks/useBio30ThemeFix";
import { ProductCard } from "./components/ui/ProductCard"; // ИСПРАВЛЕН: путь к ui/
import { BenefitCard } from "./components/ui/BenefitCard"; // ИСПРАВЛЕН: путь к ui/
import { PRODUCTS, BENEFITS } from "./data/products";
import { HERO_SLIDES } from "./data/hero";
import PartnerForm from "./components/PartnerForm";

const SlickSlider = dynamic(() => import("react-slick"), { ssr: false });

export default function HomePage(): JSX.Element {
  useBio30ThemeFix();
  
  const heroTitle = useScrollFadeIn("up", 0.1);
  const heroSubtitle = useScrollFadeIn("up", 0.2);
  const productsTitle = useScrollFadeIn("up", 0.1);
  const benefitsTitle = useScrollFadeIn("up", 0.1);
  
  const { ref: productsRef, controls: productsControls, container: productsContainer } = useStaggerFadeIn(PRODUCTS.length, 0.1);
  const { ref: benefitsRef, controls: benefitsControls, container: benefitsContainer } = useStaggerFadeIn(BENEFITS.length, 0.1);

  const heroSettings = {
    infinite: true,
    slidesToShow: 1,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 5000,
    arrows: false,
    dots: true,
    fade: true,
    speed: 800,
    cssEase: 'ease-out',
  };

  return (
    <div className="bio30-wrapper min-h-screen bg-background text-foreground flex flex-col">
      {/* Герой-слайдер */}
      <section className="hero-section">
        <SlickSlider {...heroSettings}>
          {HERO_SLIDES.map((slide, index) => (
            <div key={index} className="relative h-screen">
              <div 
                className="absolute inset-0" 
                style={{ backgroundColor: slide.theme.bg }}
                aria-hidden="true"
              />
              <div className="container gp gp--hg grid md:grid-cols-2 items-center h-full relative z-10">
                <div className="aside p-8 md:p-16">
                  <h1 className="title fs__xxl fw__bd mb-4" style={{ color: slide.theme.text }}>
                    {slide.title}
                  </h1>
                  <h2 className="subtitle fs__lg fw__rg opc opc--75 mb-8" style={{ color: slide.theme.text }}>
                    {slide.subtitle}
                  </h2>
                  <Link href={slide.cta.link} className="btn btn--wht btn__secondary">
                    {slide.cta.text}
                  </Link>
                </div>
                <div className="bside relative h-full min-h-[300px]">
                  <picture>
                    <source media="(max-width: 768px)" srcSet={slide.images.mobile} />
                    <img
                      src={slide.images.web}
                      alt={slide.title}
                      className="absolute inset-0 w-full h-full object-cover"
                      loading="eager"
                    />
                  </picture>
                </div>
              </div>
            </div>
          ))}
        </SlickSlider>
      </section>

      {/* Продукты */}
      <section className="py-16 px-6" aria-labelledby="products-title">
        <motion.header
          ref={productsTitle.ref}
          initial="hidden"
          animate={productsTitle.controls}
          variants={productsTitle.variants}
          className="text-center mb-12"
        >
          <h2 id="products-title" className="title fs__lg fw__bd gradient">
            Мультивселенная продуктов
          </h2>
        </motion.header>

        <motion.div
          ref={productsRef}
          initial="hidden"
          animate={productsControls}
          variants={productsContainer}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-7xl mx-auto"
        >
          {PRODUCTS.map((product, i) => (
            <ProductCard key={product.id} product={product} index={i} />
          ))}
          
          {/* Карточка "Все продукты" */}
          <Link
            href="/bio30/categories"
            className="group relative overflow-hidden rounded-xl border border-border flex items-center justify-center hover:bg-accent transition-colors min-h-[300px]"
            style={{ backgroundColor: "#0D0D0D" }}
          >
            <div className="col pd__xl gp gp--md">
              <h2 className="title fs__md fw__bd group-hover:text-primary transition-colors">
                Все продукты →
              </h2>
            </div>
          </Link>
        </motion.div>
      </section>

      {/* Преимущества */}
      <section className="py-16 px-6 bg-muted" aria-labelledby="benefits-title">
        <motion.header
          ref={benefitsTitle.ref}
          initial="hidden"
          animate={benefitsTitle.controls}
          variants={benefitsTitle.variants}
          className="text-center mb-12"
        >
          <h2 id="benefits-title" className="title fs__lg fw__bd gradient">
            Наши преимущества
          </h2>
        </motion.header>

        <motion.div
          ref={benefitsRef}
          initial="hidden"
          animate={benefitsControls}
          variants={benefitsContainer}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto"
        >
          {BENEFITS.map((benefit, i) => (
            <BenefitCard key={benefit.id} benefit={benefit} index={i} />
          ))}
        </motion.div>
      </section>

      {/* Партнерская форма */}
      <section className="section section--partner py-16 px-6" aria-labelledby="partner-title">
        <PartnerForm />
      </section>
    </div>
  );
}