"use client";

import React from "react";
import { motion } from "framer-motion";
import { useAppContext } from "@/contexts/AppContext";
import PartnerForm from "../components/PartnerForm";
import Dashboard from "../components/Dashboard";
import { BenefitCard } from "../components/ui/BenefitCard";
import { useScrollFadeIn } from "../hooks/useScrollFadeIn";
import { REFERRAL_STEPS } from "../data/referral";
import { useBio30ThemeFix } from "../hooks/useBio30ThemeFix";

export default function ReferralPage(): JSX.Element {
  useBio30ThemeFix();
  const { dbUser } = useAppContext();
  const isPartner = dbUser?.metadata?.is_referral_partner || false;

  const heroTitle = useScrollFadeIn("up", { delay: 0.1, duration: 1.2 });
  const heroSubtitle = useScrollFadeIn("up", { delay: 0.25, duration: 1.2 });
  const stepsTitle = useScrollFadeIn("up", { delay: 0.15 });
  const stepsGrid = useScrollFadeIn("none", { delay: 0.1 });

  return (
    <main className="page-referral">
      {/* Hero Section */}
      <section className="hero-section" aria-labelledby="referral-hero-title">
        <div 
          className="container container--hero gp gp--hg" 
          style={{ backgroundColor: "#B2FF00" }}
        >
          <div className="aside pd__hg ctr ctr--content">
            <motion.h1
              {...heroTitle.getProps()}
              id="referral-hero-title"
              className="title fs__xxl fw__bd"
              style={{ color: "#000000" }}
            >
              Ваш доход растет вместе с нами
            </motion.h1>
            <motion.p
              {...heroSubtitle.getProps()}
              className="subtitle fs__lg fw__rg opc opc--75"
              style={{ color: "#000000" }}
            >
              Получайте до 30% с заказов приглашенных (3 уровня). Выгодно и просто!
            </motion.p>
          </div>
          <div className="bside">
            <picture>
              <source 
                media="(max-width: 768px)" 
                srcSet="https://bio30.ru/static/uploads/hero/mobile_0c67bca7d230494f95919847398db740.webp "
              />
              <img
                className="image__web img--hero"
                src="https://bio30.ru/static/uploads/hero/88824240eaa24c3e878e7e2332f0e208.webp "
                alt="Ваш доход растет вместе с нами"
                loading="lazy"
                decoding="async"
              />
            </picture>
          </div>
        </div>
      </section>

      {/* Steps Section */}
      <section className="section section--steps" aria-labelledby="steps-title">
        <motion.header
          {...stepsTitle.getProps()}
          className="article"
        >
          <div className="row">
            <h2 id="steps-title" className="title fs__lg fw__bd gradient">
              Как начать зарабатывать
            </h2>
          </div>
        </motion.header>

        <motion.div
          {...stepsGrid.getProps()}
          className="grid grid--benefit"
          variants={{
            visible: {
              transition: {
                staggerChildren: 0.1,
                delayChildren: 0.2
              }
            }
          }}
        >
          {REFERRAL_STEPS.map((step, i) => (
            <BenefitCard 
              key={step.title} 
              benefit={{
                ...step,
                variant: i % 2 === 0 ? 'default' : 'center',
                theme: { bg: "#000000", text: "#ffffff" }
              }} 
              index={i} 
            />
          ))}
        </motion.div>
      </section>

      {/* Partner Form or Dashboard */}
      <section className="section section--partner" aria-labelledby="partner-title">
        <div className="container container--welcome pd pd__hg gp gp--hg ctr">
          <div className="aside" data-anim="fade" data-delay="0.1">
            <div className="col gp gp--xs">
              <h2 
                id="partner-title"
                className="title fs__xxl fw__bd bw0" 
                data-anim="lux-up" 
                data-delay="0.1"
              >
                {isPartner ? "Ваш партнерский кабинет" : "Станьте частью большой семьи"}
              </h2>
              <p 
                className="subtitle fs__lg fw__rg opc opc--50 bw0" 
                data-anim="lux-up" 
                data-delay="0.2"
              >
                {isPartner 
                  ? "Управляйте своими рефералами и отслеживайте доход" 
                  : "Приглашайте партнёров и получайте бонусы с каждой сделки"}
              </p>
            </div>
          </div>
          <div className="bside bside--welcome" data-anim="fade" data-delay="0.2">
            {isPartner ? <Dashboard /> : <PartnerForm />}
          </div>
        </div>
      </section>
    </main>
  );
}