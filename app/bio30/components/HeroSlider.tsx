"use client";

import React from 'react';
import { HeroSlide } from '../types';
import { motion } from 'framer-motion';

interface HeroSliderProps {
  slides: HeroSlide[];
}

export const HeroSlider: React.FC<HeroSliderProps> = ({ slides }) => {
  return (
    <section className="hero-section" aria-label="Hero Slider">
      <div className="hero-slider">
        {slides.map((slide, index) => (
          <div
            key={index}
            className="container gp gp--hg container--hero"
            style={{ backgroundColor: slide.theme.bg }}
            data-anim="fade"
            data-delay="0.1"
          >
            <motion.div 
              className="aside pd__hg ctr ctr--content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
            >
              <div className="col gp gp--lg">
                <div className="col gp gp--xs">
                  <motion.h1
                    className="title fs__xxl fw__bd"
                    style={{ color: slide.theme.text }}
                    initial={{ opacity: 0, y: 80 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1.2, ease: "easeOut", delay: 0.1 }}
                  >
                    {slide.title}
                  </motion.h1>
                  <motion.p
                    className="subtitle fs__lg fw__rg opc opc--75"
                    style={{ color: slide.theme.text }}
                    initial={{ opacity: 0, y: 80 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1.2, ease: "easeOut", delay: 0.2 }}
                  >
                    {slide.subtitle}
                  </motion.p>
                </div>
              </div>
            </motion.div>
            <motion.div 
              className="bside"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <picture>
                <source media="(max-width: 768px)" srcSet={slide.images.mobile} />
                <img
                  src={slide.images.web}
                  alt={slide.title}
                  className="image__web img--hero"
                  loading="lazy"
                  decoding="async"
                />
              </picture>
            </motion.div>
          </div>
        ))}
      </div>
    </section>
  );
};