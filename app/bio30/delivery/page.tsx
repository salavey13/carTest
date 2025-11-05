"use client";

import React from "react";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { motion } from "framer-motion";
import { useScrollFadeIn } from "../hooks/useScrollFadeIn";

const deliveryInfo = [
  { title: "Способы доставки", desc: "Курьер, почта, самовывоз." },
  { title: "Стоимость доставки", desc: "От 300 ₽, бесплатно от 5000 ₽." },
  { title: "Сроки доставки", desc: "Москва — 1-2 дня, регионы — 3-7 дней." },
  { title: "Оплата", desc: "Онлайн или при получении." },
];

const DeliveryPage: React.FC = () => {
  const heroTitle = useScrollFadeIn("up", 0.1);
  const heroSubtitle = useScrollFadeIn("up", 0.2);

  return (
    <div>
      <Header />
      <section className="text-center py-16">
        <motion.h1 ref={heroTitle.ref} initial="hidden" animate={heroTitle.controls} variants={heroTitle.variants} className="text-3xl font-bold gradient-text mb-2">
          Доставка — BIO 3.0
        </motion.h1>
        <motion.p ref={heroSubtitle.ref} initial="hidden" animate={heroSubtitle.controls} variants={heroSubtitle.variants} className="text-muted-foreground max-w-xl mx-auto">
          Условия, сроки и стоимость доставки биопродуктов.
        </motion.p>
      </section>

      <section className="grid gap-6 p-6 max-w-4xl mx-auto">
        {deliveryInfo.map((d, i) => {
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
              <div className="text-lg font-bold mb-1">{d.title}</div>
              <div className="text-muted-foreground">{d.desc}</div>
            </motion.div>
          );
        })}
      </section>
      <Footer />
    </div>
  );
};

export default DeliveryPage;