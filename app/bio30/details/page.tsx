// /app/bio30/details/page.tsx
"use client";

import React from "react";


import { motion } from "framer-motion";
import { useScrollFadeIn } from "../hooks/useScrollFadeIn";

const sections = [
  { title: "Что такое BIO 3.0?", text: "Инновационная платформа, объединяющая биотехнологии и натуральные продукты." },
  { title: "Наши технологии", text: "Экстракция, наноинкапсуляция и устойчивое производство." },
  { title: "Продукты", text: "Адаптогены, витамины, минералы и суперфуды." },
  { title: "Миссия и видение", text: "Создаём будущее здоровья через науку и природу." },
  { title: "Почему выбирают нас?", text: "Прозрачность, эффективность, доступность и поддержка сообщества." },
];

const DetailCard: React.FC<{ title: string; text: string; delay: number }> = ({ title, text, delay }) => {
  const anim = useScrollFadeIn("up", delay);

  return (
    <motion.div
      ref={anim.ref}
      initial="hidden"
      animate={anim.controls}
      variants={anim.variants}
      className="p-6 bg-card rounded-xl shadow-md"
    >
      <div className="text-lg font-bold mb-2">{title}</div>
      <div className="text-muted-foreground">{text}</div>
    </motion.div>
  );
};

const DetailsPage: React.FC = () => {
  const heroTitle = useScrollFadeIn("up", 0.1);
  const heroSubtitle = useScrollFadeIn("up", 0.2);

  return (
    <div>
      
      <section className="text-center py-16">
        <motion.h1 ref={heroTitle.ref} initial="hidden" animate={heroTitle.controls} variants={heroTitle.variants} className="text-3xl font-bold gradient-text mb-2">
          Детали — BIO 3.0
        </motion.h1>
        <motion.p ref={heroSubtitle.ref} initial="hidden" animate={heroSubtitle.controls} variants={heroSubtitle.variants} className="text-muted-foreground max-w-xl mx-auto">
          Узнайте больше о нашей миссии, технологиях и продуктах.
        </motion.p>
      </section>

      <section className="max-w-4xl mx-auto p-6 grid gap-8">
        {sections.map((s, i) => (
          <DetailCard key={s.title} title={s.title} text={s.text} delay={i * 0.1} />
        ))}
      </section>
      
    </div>
  );
};

export default DetailsPage;