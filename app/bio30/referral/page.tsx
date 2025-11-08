"use client";

import React from "react";
import { motion } from "framer-motion";
import { useAppContext } from "@/contexts/AppContext";
import PartnerForm from "../components/PartnerForm";
import Dashboard from "../components/Dashboard";
import { useScrollFadeIn } from "../hooks/useScrollFadeIn";
import { useStaggerFadeIn } from "../hooks/useStaggerFadeIn";
import { REFERRAL_STEPS } from "../data/referral";

const ReferalPage: React.FC = () => {
  const { dbUser } = useAppContext();
  const isPartner = dbUser?.metadata?.is_referral_partner || false;

  const heroTitle = useScrollFadeIn("up", 0.1);
  const heroSubtitle = useScrollFadeIn("up", 0.2);
  const stepsGrid = useStaggerFadeIn(REFERRAL_STEPS.length, 0.1);

  return (
    <main>
      {/* Hero Section */}
      <section className="hero-section">
        <div className="container container--hero gp gp--hg" style={{ backgroundColor: "#B2FF00" }}>
          <div className="aside pd__hg ctr ctr--content">
            <motion.h1
              ref={heroTitle.ref}
              initial="hidden"
              animate={heroTitle.controls}
              variants={heroTitle.variants}
              className="text-4xl md:text-5xl font-bold"
              style={{ color: "#000" }}
            >
              Ваш доход растет вместе с нами
            </motion.h1>
            <motion.h2
              ref={heroSubtitle.ref}
              initial="hidden"
              animate={heroSubtitle.controls}
              variants={heroSubtitle.variants}
              className="text-lg md:text-xl opacity-75"
              style={{ color: "#000" }}
            >
              Получайте до 30% с заказов приглашенных (3 уровня). Выгодно и просто!
            </motion.h2>
          </div>
          <div className="bside relative h-full min-h-[300px]">
            {/* Desktop Image */}
            <img 
              className="absolute inset-0 w-full h-full object-cover hidden md:block" 
              src="https://bio30.ru/static/uploads/hero/88824240eaa24c3e878e7e2332f0e208.webp" 
              alt="Ваш доход растет вместе с нами" 
              loading="eager"
            />
            {/* Mobile Image */}
            <img 
              className="absolute inset-0 w-full h-full object-cover md:hidden" 
              src="https://bio30.ru/static/uploads/hero/mobile_0c67bca7d230494f95919847398db740.webp" 
              alt="Ваш доход растет вместе с нами" 
              loading="eager"
            />
          </div>
        </div>
      </section>

      {/* Benefits Grid - Pure Tailwind */}
      <section className="max-w-6xl mx-auto p-6">
        <motion.div
          ref={stepsGrid.ref}
          initial="hidden"
          animate={stepsGrid.controls}
          variants={stepsGrid.container}
          className="grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {REFERRAL_STEPS.map((step, i) => (
            <motion.div
              key={i}
              variants={stepsGrid.child}
              className="rounded-xl overflow-hidden shadow-md bg-black text-white"
            >
              <div className="p-6">
                <h2 className="text-lg font-bold mb-2">{step.title}</h2>
                <p className="text-sm opacity-75">{step.description}</p>
              </div>
              <div className="relative h-48 md:h-56">
                <picture>
                  <source media="(max-width: 768px)" srcSet={step.image.mobile} />
                  <img 
                    src={step.image.web} 
                    alt={step.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </picture>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Partner Form or Dashboard */}
      <section className="max-w-4xl mx-auto p-6">
        {isPartner ? <Dashboard /> : <PartnerForm />}
      </section>
    </main>
  );
};

export default ReferalPage;