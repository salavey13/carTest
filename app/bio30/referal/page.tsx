// /app/bio30/referal/page.tsx
"use client";

import React from "react";
import { motion } from "framer-motion";
import { useAppContext } from "@/contexts/AppContext";
import PartnerForm from "../components/PartnerForm";
import Dashboard from "../components/Dashboard";
import { useScrollFadeIn } from "../hooks/useScrollFadeIn";
import { useStaggerFadeIn } from "../hooks/useStaggerFadeIn";

const referralBenefits = [
  {
    title: "Моментальный старт",
    desc: "Введите пригласительный код или откройте ссылку — регистрация занимает меньше минуты.",
    imgWeb: "https://bio30.ru/static/uploads/benefits/0b5d6ef89a1948ffbbcb5e5bfb1a3f86.webp",
    imgMobile: "https://bio30.ru/static/uploads/benefits/2bdb6da6fb0742de89691e932433dc59.webp",
  },
  {
    title: "Подтверждение одним кликом",
    desc: "В личном кабинете нажмите «Стать партнёром» — и Вы официально в программе.",
    imgWeb: "https://bio30.ru/static/uploads/benefits/9079c1aa4d714281a5bf4503bfd7e2a7.webp",
    imgMobile: "https://bio30.ru/static/uploads/benefits/fa85e91f1ef047c392fd9e2dc9c41ab0.webp",
  },
  {
    title: "Личный код + ссылка",
    desc: "Сразу после активации Вы получаете уникальный код и короткую ссылку.",
    imgWeb: "https://bio30.ru/static/uploads/benefits/d0b0ab2862c64eec86f949657c550d2e.webp",
    imgMobile: "https://bio30.ru/static/uploads/benefits/d77704f9f8844ee092c9c1aa8eb58d57.webp",
  },
  {
    title: "Приглашайте, где удобно",
    desc: "Делитесь ссылкой в мессенджерах, соцсетях или e-mail — каждый новый клиент автоматически закрепляется за Вами.",
    imgWeb: "https://bio30.ru/static/uploads/benefits/20fdf1a0d8924c1c81cc12e419e1bb3a.webp",
    imgMobile: "https://bio30.ru/static/uploads/benefits/b6b3bdc09d504aa098936211fe2baa47.webp",
  },
  {
    title: "Авто-бонусы с заказов",
    desc: "Когда приглашённые оформляют покупку, процент от суммы мгновенно падает на Ваш баланс.",
    imgWeb: "https://bio30.ru/static/uploads/benefits/f82299e623d742a1b499cfa778464d3b.webp",
    imgMobile: "https://bio30.ru/static/uploads/benefits/238f245f33044593925eb239d0fe9be4.webp",
  },
  {
    title: "До 30 % с трёх уровней",
    desc: "Зарабатывайте 30 % с прямых продаж, 10 % со 2-го и 10 % с 3-го уровня; статистика и баланс обновляются онлайн.",
    imgWeb: "https://bio30.ru/static/uploads/benefits/54c2b200ea6640f18a890cea20fda387.webp",
    imgMobile: "https://bio30.ru/static/uploads/benefits/f58334e5bdbe4f8a8d8ea75a3da7239a.webp",
  },
];

const ReferalPage: React.FC = () => {
  const { dbUser } = useAppContext();
  const isPartner = dbUser?.metadata?.is_referral_partner || false;

  const heroTitle = useScrollFadeIn("up", 0.1);
  const heroSubtitle = useScrollFadeIn("up", 0.2);
  const stepsGrid = useStaggerFadeIn(referralBenefits.length, 0.1);

  return (
    <main>
      {/* Hero Section */}
      <section className="hero-section">
        <div className="container container--hero gp gp--hg" style={{ backgroundColor: "#B2FF00" }}>
          <div className="aside pd__hg ctr ctr--content">
            <motion.h1
              ref={heroTitle.ref}
              initial="hidden"
              animate={heroTitle.controls}
              variants={heroTitle.variants}
              className="title fs__xxl fw__bd"
              style={{ color: "#000" }}
            >
              Ваш доход растет вместе с нами
            </motion.h1>
            <motion.h2
              ref={heroSubtitle.ref}
              initial="hidden"
              animate={heroSubtitle.controls}
              variants={heroSubtitle.variants}
              className="subtitle fs__lg fw__rg opc opc--75"
              style={{ color: "#000" }}
            >
              Получайте до 30% с заказов приглашенных (3 уровня). Выгодно и просто!
            </motion.h2>
          </div>
          <div className="bside">
            <img className="image__web img--hero" src="https://bio30.ru/static/uploads/hero/88824240eaa24c3e878e7e2332f0e208.webp" alt="Ваш доход растет вместе с нами" />
            <img className="image__mobile img--hero" src="https://bio30.ru/static/uploads/hero/mobile_0c67bca7d230494f95919847398db740.webp" alt="Ваш доход растет вместе с нами" />
          </div>
        </div>
      </section>

      {/* Benefits Grid */}
<section className="max-w-5xl mx-auto p-6">
  <motion.div
    ref={stepsGrid.ref}
    initial="hidden"
    animate={stepsGrid.controls}
    variants={stepsGrid.container}
    className="grid grid-cols-2 gap-6"
  >
    {referralBenefits.map((b, i) => (
      <motion.div
        key={i}
        variants={stepsGrid.child}
        className="benefit overflow-hidden bg-black text-white rounded-xl shadow-md p-6 flex flex-col md:flex-row w-full"
      >
        <div className="aside flex flex-col justify-between w-full md:w-1/2 pr-4">
          <h2 className="title fs__md fw__bd">{b.title}</h2>
          <h3 className="subtitle fs__md fw__md opc opc--50">{b.desc}</h3>
        </div>
        <div className="bside flex justify-center items-end w-full md:w-1/2 mt-4 md:mt-0">
          <img
            className="image__web hidden md:block w-full h-auto object-cover"
            src={b.imgWeb}
            alt={b.title}
          />
          <img
            className="image__mobile block md:hidden w-full h-auto object-cover"
            src={b.imgMobile}
            alt={b.title}
          />
        </div>
      </motion.div>
    ))}
  </motion.div>
</section>


      {/* Partner Form or Dashboard */}
      <section className="max-w-4xl mx-auto p-6">
        {isPartner ? <Dashboard /> : <PartnerForm />}
      </section>
    </main>
  );
};

export default ReferalPage;