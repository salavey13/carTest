// /app/bio30/page.tsx
"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import Header from "./components/Header";
import Footer from "./components/Footer";
import { useScrollFadeIn } from "./hooks/useScrollFadeIn";
import { useStaggerFadeIn } from "./hooks/useStaggerFadeIn";
import { useBio30ThemeFix } from "./hooks/useBio30ThemeFix";

const HomePage: React.FC = () => {
  const heroTitle = useScrollFadeIn("up", 0.1);
  const heroSubtitle = useScrollFadeIn("up", 0.2);
  const features = useStaggerFadeIn(3, 0.2);
  const products = useStaggerFadeIn(4, 0.15);
  const advantages = useStaggerFadeIn(6, 0.1);
  const partner = useScrollFadeIn("up", 0.1);
  useBio30ThemeFix();

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
          Новый уровень заботы о себе
        </motion.h1>

        <motion.p
          ref={heroSubtitle.ref}
          initial="hidden"
          animate={heroSubtitle.controls}
          variants={heroSubtitle.variants}
          className="text-base text-muted-foreground max-w-2xl mx-auto mb-6"
        >
          Откройте лучшие добавки для Вашего здоровья на нашем сайте.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8 }}
        >
          <Link href="/bio30/categories" className="btn btn--primary">
            Узнать больше
          </Link>
        </motion.div>
      </section>

      {/* FEATURES */}
      <section className="py-16 px-6">
        <motion.div
          ref={features.ref}
          initial="hidden"
          animate={features.controls}
          variants={features.container}
          className="grid md:grid-cols-3 gap-6"
        >
          {[
            {
              title: "Ваши добавки – в любой точке мира",
              desc: "Быстрая и надежная доставка СДЭК для Вашего удобства.",
              link: "/delivery",
            },
            {
              title: "Ваш доход растет вместе с нами",
              desc: "Получайте до 30% с заказов приглашенных (3 уровня). Выгодно и просто!",
              link: "/referal",
            },
            {
              title: "Мультивселенная продуктов",
              desc: "Откройте лучшие добавки для Вашего здоровья.",
              link: "/categories",
            },
          ].map((f, i) => (
            <motion.div
              key={i}
              variants={features.child}
              className="p-6 bg-card rounded-xl shadow-md text-center"
            >
              <h3 className="text-lg font-bold mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground mb-4">{f.desc}</p>
              <Link href={`/bio30${f.link}`} className="btn btn--primary">
                Узнать больше
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* PRODUCTS */}
      <section className="py-16 px-6 bg-muted/30">
        <h2 className="text-center text-2xl font-bold mb-8">Мультивселенная продуктов</h2>
        <motion.div
          ref={products.ref}
          initial="hidden"
          animate={products.controls}
          variants={products.container}
          className="grid md:grid-cols-2 gap-6"
        >
          {[
            {
              title: "Cordyceps Sinensis",
              desc: "Адаптоген, помогает справляться со стрессом. Содержит кордицепин и полисахариды для поддержки иммунитета, улучшения выносливости, общего укрепления. Идеален для спортсменов, активных людей и стремящихся к здоровью.",
              price: 2500,
              img: "https://bio30.ru/static/uploads/products/8ccf8585e93949cea7c79b9a9410489f.webp",
              link: "/categories/cordyceps-sinensis",
              color: "bg-yellow-500",
            },
            {
              title: "Spirulina Chlorella",
              desc: "Spirulina Chlorella — это уникальное сочетание двух суперфудов: спирулины и хлореллы. Спирулина — это сине-зеленая водоросль, богатая белками, витаминами и минералами. Хлорелла — это одноклеточная зеленая водоросль, известная своими детоксикационными свойствами и высоким содержанием хлорофилла. Этот продукт помогает укрепить иммунную систему, улучшить пищеварение и поддерживать общее здоровье организма. Рекомендуется для вегетарианцев, спортсменов и всех, кто стремится к здоровому образу жизни.",
              price: 2500,
              img: "https://bio30.ru/static/uploads/products/f21a69b0e62f4dee8b9f231985024282.webp",
              link: "/categories/spirulina-chlorella",
              color: "bg-green-500",
            },
            {
              title: "Lion's Mane",
              desc: "Lion's Mane, также известный как грива льва или гриб-геркулес, является популярным биологически активным добавкой (БАД), используемой в традиционной китайской медицине. Этот гриб известен своими нейропротекторными свойствами, которые помогают улучшить когнитивные функции, память и концентрацию. Lion's Mane также поддерживает нервную систему и способствует общему укреплению организма. Рекомендуется для людей, стремящихся улучшить свою умственную активность и общее здоровье.",
              price: 100,
              img: "	https://bio30.ru/static/uploads/products/d99d3385cd3f42d6aa1389adb7a719ce.webp",
              link: "/categories/lion-s-mane",
              color: "bg-blue-500",
            },
            {
              title: "MAGNESIUM PYRIDOXINE",
              desc: "Синергетический комплекс магния и витамина B6 для здоровья нервной системы и полноценного восстановления. Высокобиодоступные формы магния цитрата и пиридоксина обеспечивают глубокое расслабление, качественный сон и защиту от стресса.",
              price: 1600,
              img: "https://bio30.ru/static/uploads/products/74faf744a03e4f1c83e24ace9ac7582b.webp",
              link: "/categories/magnesium-pyridoxine",
              color: "bg-purple-500",
            },
          ].map((p, i) => (
            <motion.div
              key={i}
              variants={products.child}
              className={`p-6 ${p.color} rounded-xl shadow-md`}
            >
              <h3 className="text-lg font-bold mb-2 text-white">{p.title}</h3>
              <p className="text-sm text-white mb-4">{p.desc}</p>
              <p className="text-base font-bold text-white">{p.price} RUB</p>
              <img src={p.img} alt={p.title} className="w-full h-48 object-cover mt-4" />
            </motion.div>
          ))}
        </motion.div>
        <div className="text-center mt-8">
          <Link href="/bio30/categories" className="btn btn--primary">
            Все продукты
          </Link>
        </div>
      </section>

      {/* ADVANTAGES */}
      <section className="py-16 px-6">
        <h2 className="text-center text-2xl font-bold mb-8">Наши Преимущества</h2>
        <motion.div
          ref={advantages.ref}
          initial="hidden"
          animate={advantages.controls}
          variants={advantages.container}
          className="grid md:grid-cols-3 gap-6"
        >
          {[
            "Качество, подтвержденное стандартами",
            "Доверие в 7+ странах мира",
            "Поддержка 24/7 для вас",
            "Решение для всех и каждого",
            "Щедрые выплаты партнерам",
            "Сила только натуральных компонентов",
          ].map((adv, i) => (
            <motion.div
              key={i}
              variants={advantages.child}
              className="p-6 bg-card rounded-xl shadow-md text-center"
            >
              <h3 className="text-lg font-bold mb-2">{adv}</h3>
              <p className="text-sm text-muted-foreground">Описание преимущества.</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* PARTNER */}
      <section className="py-16 px-6 bg-muted/30 text-center">
        <motion.h2
          ref={partner.ref}
          initial="hidden"
          animate={partner.controls}
          variants={partner.variants}
          className="text-2xl font-bold mb-4"
        >
          Станьте частью большой и дружной семьи
        </motion.h2>
        <p className="text-muted-foreground mb-6">Приглашайте партнёров и зарабатывайте процент с каждой их сделки — больше партнёров, выше доход.</p>
        <Link href="/bio30/referal" className="btn btn--primary mb-8">
          Стать партнером
        </Link>
        {/* Form would be in referal page */}
      </section>

      <Footer />
    </div>
  );
};

export default HomePage;