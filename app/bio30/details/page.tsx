// /app/bio30/details/page.tsx
"use client";

import React from 'react';
import Link from 'next/link';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useBioAnimations } from '../hooks/useBioAnimations';

const DetailsPage: React.FC = () => {
  useBioAnimations();

  return (
    <div>
      <Header />
      <div className="messages"></div>
      <div className="hero">
        <span className="title fs__xxl fw__bd gradient" data-anim="lux-up" data-delay="0.1">Детали - BIO 3.0</span>
        <span className="subtitle fs__md fw__rg opc opc--75" data-anim="lux-up" data-delay="0.2">Подробная информация о нашей платформе, технологиях, продуктах и миссии BIO 3.0.</span>
      </div>
      <div className="content" data-stagger="up" data-stagger-delay="0.15">
        <div className="section" data-anim="fade" data-delay="0.1">
          <div className="title fs__lg fw__bd">Что такое BIO 3.0?</div>
          <span className="description">BIO 3.0 - это инновационная платформа, объединяющая передовые биотехнологии и натуральные биопродукты для поддержки здоровья и благополучия. Мы сочетаем научные исследования с традиционными знаниями, чтобы создавать добавки, которые действительно работают. Наша миссия - сделать биопродукты будущего доступными для всех, кто стремится к гармонии тела и ума. Мы фокусируемся на устойчивом развитии, этичном производстве и прозрачности, чтобы каждый продукт был не только эффективным, но и безопасным для планеты.</span>
        </div>
        <div className="section" data-anim="fade" data-delay="0.2">
          <div className="title fs__lg fw__bd">Наши технологии</div>
          <span className="description">Мы используем передовые методы экстракции и наноинкапсуляции для максимальной биодоступности активных веществ. Все продукты проходят строгий контроль качества и клинические испытания. Наша экосистема включает устойчивые источники сырья, экологичную упаковку и прозрачную цепочку поставок. Мы сотрудничаем с ведущими лабораториями, чтобы гарантировать, что каждый ингредиент соответствует самым высоким стандартам. От ферментации до финальной упаковки - каждый шаг оптимизирован для сохранения полезных свойств.</span>
        </div>
        <div className="section" data-anim="fade" data-delay="0.3">
          <div className="title fs__lg fw__bd">Продукты</div>
          <span className="description">Наш ассортимент включает адаптогены, витаминные комплексы, минералы и суперфуды. Каждый продукт разработан для конкретных нужд: от поддержки иммунитета и энергии до улучшения когнитивных функций и детоксикации. Все формулы основаны на научных данных и отзывах пользователей. Например, Lion's Mane для мозга, Cordyceps для энергии, Spirulina Chlorella для детокса, Magnesium Pyridoxine для нервов. Мы предлагаем только проверенные комбинации для синергетического эффекта.</span>
        </div>
        <div className="section" data-anim="fade" data-delay="0.4">
          <div className="title fs__lg fw__bd">Миссия и видение</div>
          <span className="description">Мы верим в биотехнологии как ключ к долгой и здоровой жизни. BIO 3.0 - это не просто магазин, а сообщество единомышленников, стремящихся к гармонии. Присоединяйтесь к нам, чтобы вместе строить будущее здоровья. Наше видение - мир, где каждый может достичь оптимального благополучия через науку и природу. Мы инвестируем в исследования и образование, чтобы продвигать осознанный подход к здоровью.</span>
        </div>
        <div className="section" data-anim="fade" data-delay="0.5">
          <div className="title fs__lg fw__bd">Почему выбирают нас?</div>
          <span className="description">Прозрачность: каждый ингредиент проверен и сертифицирован. Эффективность: результаты подтверждены исследованиями. Доступность: удобная доставка и реферальная программа для всех. Мы предлагаем не только продукты, но и знания - блог, вебинары, персональные рекомендации. Присоединяйтесь к сообществу, где здоровье - это инвестиция в будущее.</span>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default DetailsPage;