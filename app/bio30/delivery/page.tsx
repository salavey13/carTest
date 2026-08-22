// /app/bio30/delivery/page.tsx
"use client";

import React from "react";


import { motion } from "framer-motion";
import { useStaggerFadeIn } from "../hooks/useStaggerFadeIn";
import { useScrollFadeIn } from "../hooks/useScrollFadeIn";

const deliveryInfo = [
  { title: "Способы доставки", desc: "Курьер, почта, самовывоз." },
  { title: "Стоимость доставки", desc: "От 300 ₽, бесплатно от 5000 ₽." },
  { title: "Сроки доставки", desc: "Москва — 1-2 дня, регионы — 3-7 дней." },
  { title: "Оплата", desc: "Онлайн или при получении." },
  // Add more details from delivery.txt if needed
];

const DeliveryPage: React.FC = () => {
  const heroTitle = useScrollFadeIn("up", 0.1);
  const heroSubtitle = useScrollFadeIn("up", 0.2);
  const infoGrid = useStaggerFadeIn(deliveryInfo.length, 0.1);

  return (
    <div>
      
      <section className="text-center py-16">
        <motion.h1 ref={heroTitle.ref} initial="hidden" animate={heroTitle.controls} variants={heroTitle.variants} className="text-3xl font-bold gradient-text mb-2">
          Доставка — BIO 3.0
        </motion.h1>
        <motion.p ref={heroSubtitle.ref} initial="hidden" animate={heroSubtitle.controls} variants={heroSubtitle.variants} className="text-muted-foreground max-w-xl mx-auto">
          Узнайте об условиях доставки BIO 3.0. Стоимость, сроки и способы доставки ваших заказов.
        </motion.p>
      </section>

      <section className="grid gap-6 p-6 max-w-4xl mx-auto">
        <motion.div
          ref={infoGrid.ref}
          initial="hidden"
          animate={infoGrid.controls}
          variants={infoGrid.container}
          className="grid md:grid-cols-2 gap-6"
        >
          {deliveryInfo.map((d, i) => (
            <motion.div
              key={i}
              variants={infoGrid.child}
              className="p-6 bg-card rounded-xl shadow-md"
            >
              <div className="text-lg font-bold mb-1">{d.title}</div>
              <div className="text-muted-foreground">{d.desc}</div>
            </motion.div>
          ))}
        </motion.div>
      </section>
      
    </div>
  );
};

export default DeliveryPage;