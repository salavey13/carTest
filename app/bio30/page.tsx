"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { useScrollFadeIn } from "./hooks/useScrollFadeIn";
import { useStaggerFadeIn } from "./hooks/useStaggerFadeIn";
import { useBio30ThemeFix } from "./hooks/useBio30ThemeFix";
import { ProductCard } from "./components/ui/ProductCard";
import { BenefitCard } from "./components/ui/BenefitCard";
import StoriesSlider from "./components/StoriesSlider";
import PartnerForm from "./components/PartnerForm";
import { BENEFITS, STORIES } from "./data/products";
import { HERO_SLIDES } from "./data/hero";
import { fetchFeaturedBio30Products } from "./categories/actions";
import type { Bio30Product } from "./categories/actions";

const SlickSlider = dynamic(() => import("react-slick"), { ssr: false });

export default function HomePage(): JSX.Element {
  useBio30ThemeFix();
  
  const [products, setProducts] = useState<Bio30Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const heroTitle = useScrollFadeIn("up", 0.1);
  const heroSubtitle = useScrollFadeIn("up", 0.2);
  const productsTitle = useScrollFadeIn("up", 0.1);
  const benefitsTitle = useScrollFadeIn("up", 0.1);
  const storiesTitle = useScrollFadeIn("up", 0.1);
  
  const { ref: productsRef, controls: productsControls, container: productsContainer } = useStaggerFadeIn(products.length || 4, 0.1);
  const { ref: benefitsRef, controls: benefitsControls, container: benefitsContainer } = useStaggerFadeIn(BENEFITS.length, 0.1);

  useEffect(() => {
    loadFeaturedProducts();
  }, []);

  const loadFeaturedProducts = async () => {
    try {
      setIsLoading(true);
      const result = await fetchFeaturedBio30Products(8);
      if (result.success && result.data) {
        setProducts(result.data);
      } else {
        console.error("Failed to load products:", result.error);
      }
    } catch (err) {
      console.error("Error loading products:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const heroSettings = {
    infinite: true,
    slidesToShow: 1,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 5000,
    arrows: false,
    dots: false, // ✅ FIXED: Remove dots that show "1 2 3"
    fade: true,
    speed: 800,
    cssEase: 'ease-out',
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* ✅ FIXED: Герой-слайдер без лишнего пространства */}
      <section className="relative">
        <SlickSlider {...heroSettings}>
          {HERO_SLIDES.map((slide, index) => (
            <div key={index} className="relative min-h-[80vh] md:min-h-[70vh] flex items-center">
              <div 
                className="absolute inset-0" 
                style={{ backgroundColor: slide.theme.bg }}
                aria-hidden="true"
              />
              <div className="container mx-auto grid md:grid-cols-2 items-center px-6 py-20 relative z-10">
                <motion.div 
                  className="p-8 md:p-16"
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6 }}
                >
                  <h1 className="text-4xl md:text-6xl font-bold font-orbitron mb-4" style={{ color: slide.theme.text }}>
                    {slide.title}
                  </h1>
                  <h2 className="text-lg md:text-2xl mb-8 opacity-75" style={{ color: slide.theme.text }}>
                    {slide.subtitle}
                  </h2>
                  <Link 
                    href={slide.cta.link} 
                    className="inline-block px-8 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-colors shadow-lg"
                  >
                    {slide.cta.text}
                  </Link>
                </motion.div>
                <div className="relative h-80 md:h-full min-h-[300px]">
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

      {/* ✅ Динамические продукты */}
      <section className="py-16 px-6" aria-labelledby="products-title">
        <motion.header
          ref={productsTitle.ref}
          initial="hidden"
          animate={productsTitle.controls}
          variants={productsTitle.variants}
          className="text-center mb-12"
        >
          <h2 id="products-title" className="text-3xl md:text-4xl font-bold font-orbitron text-gradient">
            Мультивселенная продуктов
          </h2>
        </motion.header>

        {isLoading ? (
          <div className="flex justify-center items-center py-16">
            <div className="w-16 h-16 border-4 border-muted border-t-primary rounded-full animate-spin"></div>
          </div>
        ) : (
          <motion.div
            ref={productsRef}
            initial="hidden"
            animate={productsControls}
            variants={productsContainer}
            className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-7xl mx-auto"
          >
            {products.map((product, i) => (
              <ProductCard key={product.id} product={product} index={i} />
            ))}
            
            {/* Карточка "Все продукты" */}
            <Link
              href="/bio30/categories"
              className="group relative overflow-hidden rounded-xl border border-border flex items-center justify-center hover:bg-accent transition-colors min-h-[300px]"
              style={{ backgroundColor: "#0D0D0D" }}
            >
              <div className="flex flex-col items-center gap-8 p-8">
                <h2 className="text-xl font-bold group-hover:text-primary transition-colors">
                  Все продукты →
                </h2>
              </div>
            </Link>
          </motion.div>
        )}
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
          <h2 id="benefits-title" className="text-3xl md:text-4xl font-bold font-orbitron text-gradient">
            Наши преимущества
          </h2>
        </motion.header>

        <motion.div
          ref={benefitsRef}
          initial="hidden"
          animate={benefitsControls}
          variants={benefitsContainer}
          className="grid grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto"
        >
          {BENEFITS.map((benefit, i) => (
            <BenefitCard key={benefit.id} benefit={benefit} index={i} />
          ))}
        </motion.div>
      </section>

      {/* Истории успеха */}
      <StoriesSlider stories={STORIES} />

      {/* Партнерская форма */}
      <PartnerForm />
    </div>
  );
}