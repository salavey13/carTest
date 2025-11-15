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
import { HERO_SLIDES } from "./data/hero"; // Will use fallback if undefined
import { fetchFeaturedBio30Products } from "./categories/actions";
import type { Bio30Product } from "./categories/actions";

const SlickSlider = dynamic(() => import("react-slick"), { ssr: false });

// ✅ Fallback hero data if import fails
const FALLBACK_HERO_SLIDES = [
  {
    title: "BIO 3.0",
    subtitle: "Новая эра здоровья",
    theme: { bg: "#1A1A1A", text: "#F9F9F9" },
    cta: { text: "Каталог", link: "/bio30/categories" },
    images: {
      web: "https://bio30.ru/front/static/uploads/hero/bio30-hero.jpg",
      mobile: "https://bio30.ru/front/static/uploads/hero/bio30-hero-mobile.jpg"
    }
  }
];

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
    dots: false,
    fade: true,
    speed: 800,
    cssEase: 'ease-out',
  };

  // ✅ Ensure heroSlides is always an array
  const heroSlides = Array.isArray(HERO_SLIDES) ? HERO_SLIDES : FALLBACK_HERO_SLIDES;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* ✅ FIXED: Hero slider with defensive checks */}
      <section className="relative">
        {heroSlides.length > 0 ? (
          <SlickSlider {...heroSettings}>
            {heroSlides.map((slide, index) => {
              // ✅ Safety checks for every property
              const theme = slide?.theme || { bg: '#1A1A1A', text: '#F9F9F9' };
              const cta = slide?.cta || { text: 'Узнать больше', link: '/bio30/categories' };
              const images = slide?.images || {
                web: 'https://bio30.ru/front/static/uploads/products/default.webp',
                mobile: 'https://bio30.ru/front/static/uploads/products/default.webp'
              };
              
              return (
                <div key={index} className="relative min-h-[80vh] md:min-h-[70vh] flex items-center">
                  <div 
                    className="absolute inset-0" 
                    style={{ backgroundColor: theme.bg }}
                    aria-hidden="true"
                  />
                  <div className="container mx-auto grid md:grid-cols-2 items-center px-6 py-20 relative z-10">
                    <motion.div 
                      className="p-8 md:p-16"
                      initial={{ opacity: 0, x: -30 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.6 }}
                    >
                      <h1 className="text-4xl md:text-6xl font-bold font-orbitron mb-4" style={{ color: theme.text }}>
                        {slide.title || 'BIO 3.0'}
                      </h1>
                      <h2 className="text-lg md:text-2xl mb-8 opacity-75" style={{ color: theme.text }}>
                        {slide.subtitle || 'Новая эра здоровья'}
                      </h2>
                      <Link 
                        href={cta.link} 
                        className="inline-block px-8 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-colors shadow-lg"
                      >
                        {cta.text}
                      </Link>
                    </motion.div>
                    <div className="relative h-80 md:h-full min-h-[300px]">
                      <picture>
                        <source media="(max-width: 768px)" srcSet={images.mobile} />
                        <img
                          src={images.web}
                          alt={slide.title || 'BIO 3.0'}
                          className="absolute inset-0 w-full h-full object-cover"
                          loading="eager"
                        />
                      </picture>
                    </div>
                  </div>
                </div>
              );
            })}
          </SlickSlider>
        ) : (
          <div className="h-96 bg-muted flex items-center justify-center">
            <p className="text-muted-foreground">Hero content not available</p>
          </div>
        )}
      </section>

      {/* Products section */}
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
            
            {/* "All products" card */}
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

      {/* Benefits */}
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

      {/* Stories */}
      <StoriesSlider stories={STORIES} />

      {/* Partner Form */}
      <PartnerForm />
    </div>
  );
}