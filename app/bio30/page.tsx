"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import Header from "./components/Header";
import Footer from "./components/Footer";
import { useScrollFadeIn } from "./hooks/useScrollFadeIn";
import { useStaggerFadeIn } from "./hooks/useStaggerFadeIn";

const HomePage: React.FC = () => {
  const heroTitle = useScrollFadeIn("up", 0.1);
  const heroSubtitle = useScrollFadeIn("up", 0.2);
  const benefits = useStaggerFadeIn(3, 0.2);
  const categories = useStaggerFadeIn(4, 0.15);
  const faq = useStaggerFadeIn(5, 0.15);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header />

      {/* HERO */}
      <section className="hero text-center py-20">
        <motion.h1
          ref={heroTitle.ref}
          initial="hidden"
          animate={heroTitle.controls}
          variants={heroTitle.variants}
          className="text-4xl sm:text-5xl font-bold mb-4 gradient-text"
        >
          BIO 3.0 — Биопродукты будущего
        </motion.h1>

        <motion.p
          ref={heroSubtitle.ref}
          initial="hidden"
          animate={heroSubtitle.controls}
          variants={heroSubtitle.variants}
          className="text-base text-muted-foreground max-w-2xl mx-auto mb-6"
        >
          МАГАЗИН БИОЛОГИЧЕСКИ АКТИВНЫХ ДОБАВОК
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8 }}
        >
          <Link href="/bio30/categories" className="btn btn--primary">
            Каталог продуктов
          </Link>
        </motion.div>
      </section>

      {/* BENEFITS */}
      <section className="py-16 px-6">
        <motion.div
          ref={benefits.ref}
          initial="hidden"
          animate={benefits.controls}
          variants={benefits.container}
          className="grid md:grid-cols-3 gap-6"
        >
          {[
            {
              img: "mobile_74ed8b708e0245aeb2a4211a6b1b104c.webp",
              title: "Натуральные ингредиенты",
              desc: "Наши продукты создаются из природных компонентов, собранных в экологически чистых регионах.",
            },
            {
              img: "6a317041578644d1b283abeaf781bf36.webp",
              title: "Инновационные технологии",
              desc: "Используем современные биотехнологии для максимальной эффективности и биодоступности.",
            },
            {
              img: "image3.webp", // Placeholder, update if actual image found
              title: "Здоровье и благополучие",
              desc: "Формулы разработаны для поддержки здоровья, энергии и долголетия.",
            },
          ].map((b, i) => (
            <motion.div
              key={i}
              variants={benefits.child}
              className="benefit benefit__default bg-card shadow-md p-6 rounded-xl text-center"
            >
              <img
                src={`https://bio30.ru/static/uploads/benefits/${b.img}`}
                alt={b.title}
                className="w-full h-52 object-cover rounded-lg mb-4"
              />
              <h3 className="text-lg font-semibold mb-2">{b.title}</h3>
              <p className="text-sm text-muted-foreground">{b.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* CATEGORIES TEASER */}
      <section className="py-16 bg-muted/30 px-6">
        <h2 className="text-center text-2xl font-bold mb-8">Категории</h2>
        <motion.div
          ref={categories.ref}
          initial="hidden"
          animate={categories.controls}
          variants={categories.container}
          className="grid md:grid-cols-2 gap-8"
        >
          {[
            {
              title: "Витамины",
              desc: "Ежедневная поддержка здоровья и энергии.",
              img: "vitamins.webp", // Update with actual if available
            },
            {
              title: "Минералы",
              desc: "Баланс микроэлементов для устойчивости организма.",
              img: "minerals.webp",
            },
            {
              title: "Иммунитет",
              desc: "Укрепление защитных функций организма.",
              img: "immunity.webp",
            },
            {
              title: "Красота",
              desc: "Продукты для кожи, волос и внутреннего сияния.",
              img: "beauty.webp",
            },
          ].map((c, i) => (
            <motion.div
              key={i}
              variants={categories.child}
              className="flex flex-col md:flex-row bg-card shadow-sm rounded-xl overflow-hidden"
            >
              <img
                src={`https://bio30.ru/static/uploads/categories/${c.img}`}
                alt={c.title}
                className="w-full md:w-1/2 object-cover"
              />
              <div className="p-6 flex flex-col justify-center">
                <h3 className="text-lg font-semibold mb-2">{c.title}</h3>
                <p className="text-sm text-muted-foreground">{c.desc}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* FAQ */}
      <section className="py-16 px-6">
        <h2 className="text-center text-2xl font-bold mb-8">
          Часто задаваемые вопросы
        </h2>
        <motion.div
          ref={faq.ref}
          initial="hidden"
          animate={faq.controls}
          variants={faq.container}
          className="space-y-6 max-w-3xl mx-auto"
        >
          {[
            ["Что такое BIO 3.0?", "Передовые биопродукты и технологии для здоровья и будущего."],
            ["Как заказать продукт?", "Добавьте в корзину, проверьте и оформите заказ."],
            ["Есть ли доставка?", "Да, быстрая доставка по России."],
            ["Можно ли вернуть товар?", "Да, согласно условиям возврата."],
            [
              "Как присоединиться к реферальной программе?",
              "Зарегистрируйтесь и получите реферальную ссылку в кабинете.",
            ],
          ].map(([q, a], i) => (
            <motion.div
              key={i}
              variants={faq.child}
              className="p-4 rounded-lg bg-card shadow-sm"
            >
              <h4 className="font-semibold mb-1">{q}</h4>
              <p className="text-sm text-muted-foreground">{a}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      <Footer />
    </div>
  );
};

export default HomePage;