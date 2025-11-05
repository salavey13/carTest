"use client";

import React from "react";
import Header from "../components/Header";
import Footer from "../components/Footer";
import PartnerForm from "../components/PartnerForm";
import Dashboard from "../components/Dashboard";
import { useAppContext } from "@/contexts/AppContext";
import { motion } from "framer-motion";
import { useScrollFadeIn } from "../hooks/useScrollFadeIn";

const ReferalPage: React.FC = () => {
  const { dbUser } = useAppContext();
  const isPartner = dbUser?.metadata?.is_referral_partner || false;
  const heroTitle = useScrollFadeIn("up", 0.1);
  const heroSubtitle = useScrollFadeIn("up", 0.2);

  const steps = [
    "Регистрация",
    "Получите ссылку",
    "Пригласите друзей",
    "Получите бонусы",
    "FAQ",
    "Контакты поддержки",
  ];

  return (
    <div>
      <Header />
      <section className="text-center py-16">
        <motion.h1 ref={heroTitle.ref} initial="hidden" animate={heroTitle.controls} variants={heroTitle.variants} className="text-3xl font-bold gradient-text mb-2">
          Реферальная программа — BIO 3.0
        </motion.h1>
        <motion.p ref={heroSubtitle.ref} initial="hidden" animate={heroSubtitle.controls} variants={heroSubtitle.variants} className="text-muted-foreground max-w-xl mx-auto">
          Приглашайте друзей и получайте бонусы и скидки.
        </motion.p>
      </section>

      <section className="grid gap-6 max-w-5xl mx-auto p-6">
        {steps.map((s, i) => {
          const anim = useScrollFadeIn("up", i * 0.1);
          return (
            <motion.div
              key={i}
              ref={anim.ref}
              initial="hidden"
              animate={anim.controls}
              variants={anim.variants}
              className="p-6 bg-card rounded-xl shadow-md"
            >
              <div className="text-lg font-bold mb-1">Шаг {i + 1}: {s}</div>
              <div className="text-muted-foreground">Описание шага {i + 1}.</div>
            </motion.div>
          );
        })}
      </section>

      <div className="max-w-4xl mx-auto p-6">{isPartner ? <Dashboard /> : <PartnerForm />}
      </div>
      <Footer />
    </div>
  );
};

export default ReferalPage;