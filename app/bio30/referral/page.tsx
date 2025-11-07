"use client";

import React from "react";
import { motion } from "framer-motion";
import { useAppContext } from "@/contexts/AppContext";
import PartnerForm from "../components/PartnerForm";
import Dashboard from "../components/Dashboard";
import { useScrollFadeIn } from "../hooks/useScrollFadeIn";
import { useBio30ThemeFix } from "../hooks/useBio30ThemeFix";

export default function ReferralPage(): JSX.Element {
  useBio30ThemeFix();
  const { dbUser } = useAppContext();
  const isPartner = dbUser?.metadata?.is_referral_partner || false;

  const heroTitle = useScrollFadeIn("up", { delay: 0.1, duration: 1.2 });
  const heroSubtitle = useScrollFadeIn("up", { delay: 0.25, duration: 1.2 });

  return (
    <main className="page-referral min-h-screen">
      {/* Герой секция с правильным фоном (не черный) */}
      <section 
        className="hero-section py-20 px-6 text-center" 
        style={{ backgroundColor: '#B2FF00' }}
        aria-labelledby="referral-hero-title"
      >
        <motion.h1
          {...heroTitle.getProps()}
          id="referral-hero-title"
          className="title fs__xxl fw__bd mb-4"
          style={{ color: "#000000" }}
        >
          Ваш доход растет вместе с нами
        </motion.h1>
        <motion.p
          {...heroSubtitle.getProps()}
          className="subtitle fs__lg fw__rg opc opc--75 max-w-2xl mx-auto"
          style={{ color: "#000000" }}
        >
          Получайте до 30% с заказов приглашенных (3 уровня). Выгодно и просто!
        </motion.p>
      </section>

      {/* Удален дублирующий заголовок, PartnerForm рендерит свой собственный */}
      <section className="section section--partner py-16 px-6" aria-labelledby="partner-title">
        {isPartner ? <Dashboard /> : <PartnerForm />}
      </section>
    </main>
  );
}