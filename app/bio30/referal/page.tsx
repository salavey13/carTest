// /app/bio30/referal/page.tsx
"use client";

import React from "react";


import PartnerForm from "../components/PartnerForm";
import Dashboard from "../components/Dashboard";
import { useAppContext } from "@/contexts/AppContext";
import { motion } from "framer-motion";
import { useScrollFadeIn } from "../hooks/useScrollFadeIn";
import { useStaggerFadeIn } from "../hooks/useStaggerFadeIn";

const ReferalPage: React.FC = () => {
  const { dbUser } = useAppContext();
  const isPartner = dbUser?.metadata?.is_referral_partner || false;
  const heroTitle = useScrollFadeIn("up", 0.1);
  const heroSubtitle = useScrollFadeIn("up", 0.2);
  const stepsGrid = useStaggerFadeIn(6, 0.1);

  const steps = [
    "Регистрация в программе",
    "Получите уникальную реферальную ссылку",
    "Пригласите друзей и знакомых",
    "Получайте бонусы за покупки рефералов",
    "Часто задаваемые вопросы",
    "Контакты поддержки",
  ];

  return (
    <div>
      
      <section className="text-center py-16">
        <motion.h1 ref={heroTitle.ref} initial="hidden" animate={heroTitle.controls} variants={heroTitle.variants} className="text-3xl font-bold gradient-text mb-2">
          Реферальная программа — BIO 3.0
        </motion.h1>
        <motion.p ref={heroSubtitle.ref} initial="hidden" animate={heroSubtitle.controls} variants={heroSubtitle.variants} className="text-muted-foreground max-w-xl mx-auto">
          Участвуйте в реферальной программе BIO 3.0! Приглашайте друзей и получайте бонусы и скидки на продукцию.
        </motion.p>
      </section>

      <section className="grid gap-6 max-w-5xl mx-auto p-6">
        <motion.div
          ref={stepsGrid.ref}
          initial="hidden"
          animate={stepsGrid.controls}
          variants={stepsGrid.container}
          className="grid md:grid-cols-2 gap-6"
        >
          {steps.map((s, i) => (
            <motion.div
              key={i}
              variants={stepsGrid.child}
              className="p-6 bg-card rounded-xl shadow-md"
            >
              <div className="text-lg font-bold mb-1">Шаг {i + 1}: {s}</div>
              <div className="text-muted-foreground">Описание шага {i + 1}.</div> {/* Update descriptions from referal.txt */}
            </motion.div>
          ))}
        </motion.div>
      </section>

      <div className="max-w-4xl mx-auto p-6">{isPartner ? <Dashboard /> : <PartnerForm />}</div>
      
    </div>
  );
};

export default ReferalPage;