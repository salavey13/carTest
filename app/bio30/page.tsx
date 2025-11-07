"use client";

import React from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { useScrollFadeIn } from "./hooks/useScrollFadeIn";
import { useStaggerFadeIn } from "./hooks/useStaggerFadeIn";
import { useBio30ThemeFix } from "./hooks/useBio30ThemeFix";
import PartnerForm from "./components/PartnerForm";
import { HERO_SLIDES } from "./data/hero";
import { PRODUCTS, BENEFITS, STORIES } from "./data/products";

// Slick-slider импорт
const SlickSlider = dynamic(() => import("react-slick"), { 
  ssr: false,
  loading: () => <div className="h-screen bg-gray-900 animate-pulse" />
});

export default function HomePage(): JSX.Element {
  useBio30ThemeFix();
  
  const heroTitle = useScrollFadeIn("up", 0.1);
  const heroSubtitle = useScrollFadeIn("up", 0.2);
  const productsTitle = useScrollFadeIn("up", 0.1);
  const productGrid = useStaggerFadeIn(PRODUCTS.length, 0.1);
  const advantages = useStaggerFadeIn(BENEFITS.length, 0.1);
  const stories = useStaggerFadeIn(STORIES.length, 0.1);

  // Настройки для slick-slider
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

  const storiesSettings = {
    dots: false,
    arrows: false,
    infinite: false,
    speed: 800,
    slidesToShow: 1,
    slidesToScroll: 1,
    responsive: [
      { breakpoint: 1024, settings: { dots: true } },
      { breakpoint: 600, settings: { slidesToShow: 2, slidesToScroll: 2 } },
      { breakpoint: 480, settings: { slidesToShow: 1, slidesToScroll: 1 } }
    ]
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Герой-слайдер с правильным фоном и изображениями */}
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

      {/* Истории успеха */}
      <section className="section section--stories py-16 px-6" aria-labelledby="stories-title">
        <motion.header
          ref={heroTitle.ref}
          initial="hidden"
          animate={heroTitle.controls}
          variants={heroTitle.variants}
          className="article text-center mb-12"
        >
          <h2 id="stories-title" className="title fs__lg fw__bd gradient">
            Истории успеха
          </h2>
        </motion.header>

        <SlickSlider {...storiesSettings}>
          {STORIES.map((story, index) => (
            <div key={index} className="story-card p-4">
              <div className="col gp gp--xl">
                <img
                  src={story.image}
                  alt={story.name}
                  className="w-full h-64 object-cover rounded-lg mb-4"
                  loading="lazy"
                />
                <div className="content">
                  <span className="quote fs__md fw__md opc opc--75 mb-2">"{story.quote}"</span>
                  <div className="row ctr gp gp--xs mt-4">
                    <span className="title fs__sm fw__bd">{story.name}</span>
                    {story.followers && (
                      <span className="subtitle fs__sm fw__md opc opc--50">{story.followers}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </SlickSlider>
      </section>

      {/* Продукты */}
      <section className="section section--products py-16 px-6" aria-labelledby="products-title">
        <motion.header
          ref={productsTitle.ref}
          initial="hidden"
          animate={productsTitle.controls}
          variants={productsTitle.variants}
          className="article text-center mb-12"
        >
          <h2 id="products-title" className="title fs__lg fw__bd gradient">
            Мультивселенная продуктов
          </h2>
        </motion.header>

        <motion.div
          ref={productGrid.ref}
          initial="hidden"
          animate={productGrid.controls}
          variants={productGrid.container}
          className="grid grid--cards container mx-auto"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1.25rem" }}
        >
          {PRODUCTS.map((product, i) => (
            <motion.div
              key={product.id}
              variants={productGrid.child}
              custom={i}
              className="card card--product hover:scale-[1.02] transition-transform"
              style={{ backgroundColor: product.theme.bg, color: product.theme.text }}
            >
              <Link href={product.link} className="block">
                <div className={`flex flex-col ${product.layout === 'horizontal' ? 'md:flex-row' : ''}`}>
                  {/* Исправлено: Всегда показываем картинку на мобильных */}
                  <div className="bside w-full md:w-1/2 relative">
                    <picture>
                      <source media="(max-width: 768px)" srcSet={product.image.mobile} />
                      <img
                        src={product.image.web}
                        alt={product.title}
                        className="w-full h-64 md:h-full object-cover"
                        loading="lazy"
                      />
                    </picture>
                  </div>
                  <div className="aside w-full md:w-1/2 p-6">
                    <h3 className="title fs__lg fw__bd mb-2">{product.title}</h3>
                    <p className="subtitle fs__md fw__rg opc opc--75 mb-4 line-clamp-3">{product.desc}</p>
                    <span className="price fs__xl fw__bd">{product.price} RUB</span>
                    {product.tags.length > 0 && (
                      <div className="tags mt-3 flex gap-2">
                        {product.tags.map(tag => (
                          <span key={tag} className="tag text-xs px-2 py-1 rounded bg-white/20">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
          
          {/* Карточка "Все продукты" */}
          <Link
            href="/bio30/categories"
            className="card card__default card--link hover:scale-[1.02] transition-transform"
            style={{ backgroundColor: "#0D0D0D", border: "1px solid var(--border)" }}
          >
            <div className="col pd__xl gp gp--md ctr h-full flex items-center justify-center">
              <h2 className="title fs__md fw__bd">Все продукты →</h2>
            </div>
          </Link>
        </motion.div>
      </section>

      {/* Преимущества */}
      <section className="section section--benefits py-16 px-6 bg-muted" aria-labelledby="benefits-title">
        <motion.header
          ref={heroTitle.ref}
          initial="hidden"
          animate={heroTitle.controls}
          variants={heroTitle.variants}
          className="article text-center mb-12"
        >
          <h2 id="benefits-title" className="title fs__lg fw__bd gradient">
            Наши преимущества
          </h2>
        </motion.header>

        <motion.div
          ref={advantages.ref}
          initial="hidden"
          animate={advantages.controls}
          variants={advantages.container}
          className="grid grid--benefit container mx-auto"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "1.25rem" }}
        >
          {BENEFITS.map((benefit, i) => (
            <motion.div
              key={i}
              variants={advantages.child}
              custom={i}
              className="benefit card hover:scale-[1.02] transition-transform"
              style={{ backgroundColor: benefit.theme.bg, color: benefit.theme.text }}
            >
              <div className="col gp gp--md p-6">
                <h3 className="title fs__md fw__bd mb-2">{benefit.title}</h3>
                <p className="subtitle fs__sm fw__rg opc opc--75">{benefit.desc}</p>
              </div>
              <div className="bside">
                <picture>
                  <source media="(max-width: 768px)" srcSet={benefit.image.mobile} />
                  <img
                    src={benefit.image.web}
                    alt={benefit.title}
                    className="w-full h-32 object-cover mt-4"
                    loading="lazy"
                  />
                </picture>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Партнерская форма (без дублирующего заголовка) */}
      <section className="section section--partner py-16 px-6" aria-labelledby="partner-title">
        <PartnerForm />
      </section>
    </div>
  );
}