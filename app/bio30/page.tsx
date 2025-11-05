"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import Header from "./components/Header";
import Footer from "./components/Footer";
import { useScrollFadeIn } from "./hooks/useScrollFadeIn";

const HomePage: React.FC = () => {
  const heroTitle = useScrollFadeIn("up", 0.1);
  const heroSubtitle = useScrollFadeIn("up", 0.2);
  const benefit1 = useScrollFadeIn("up", 0.1);
  const benefit2 = useScrollFadeIn("up", 0.2);
  const benefit3 = useScrollFadeIn("up", 0.3);

  return (
    <div>
      <Header />

      <section className="hero text-center py-20">
        <motion.h1
          ref={heroTitle.ref}
          initial="hidden"
          animate={heroTitle.controls}
          variants={heroTitle.variants}
          className="text-4xl font-bold mb-4 gradient-text"
        >
          BIO 3.0 — Биопродукты будущего
        </motion.h1>

        <motion.p
          ref={heroSubtitle.ref}
          initial="hidden"
          animate={heroSubtitle.controls}
          variants={heroSubtitle.variants}
          className="text-base text-muted-foreground max-w-xl mx-auto mb-6"
        >
          Передовые технологии и натуральные компоненты для здоровья и
          долголетия.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8 }}
        >
          <Link href="/bio30/details" className="btn btn--primary">
            Узнать больше
          </Link>
        </motion.div>
      </section>

      {/* Блок преимуществ */}
      <section className="grid grid--benefit gap-6 p-6">
        {[benefit1, benefit2, benefit3].map((anim, i) => (
          <motion.div
            key={i}
            ref={anim.ref}
            initial="hidden"
            animate={anim.controls}
            variants={anim.variants}
            className="benefit benefit__default p-4 rounded-xl bg-card shadow-lg"
          >
            <img
              src={`https://bio30.ru/static/uploads/benefits/image${i + 1}.webp`}
              alt={`benefit-${i}`}
              className="w-full h-48 object-cover rounded-lg mb-4"
            />
            <div className="title fs__lg fw__bd">Преимущество {i + 1}</div>
            <span className="description text-muted-foreground">
              Натуральные ингредиенты и инновационные технологии.
            </span>
          </motion.div>
        ))}
      </section>

      <Footer />
    </div>
  );
};

export default HomePage;