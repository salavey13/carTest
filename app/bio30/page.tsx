// /app/bio30/page.tsx
"use client";

import React from 'react';
import Link from 'next/link';
import Header from './components/Header';
import Footer from './components/Footer';
import { useBioAnimations } from './hooks/useBioAnimations';

const HomePage: React.FC = () => {
  useBioAnimations();

  return (
    <div>
      <Header />
      <div className="messages"></div>
      <div className="hero">
        <div className="row ctr gp gp--xl" data-anim="fade" data-delay="0.1">
          <span className="title fs__xxl fw__bd gradient" data-anim="lux-up" data-delay="0.1">BIO 3.0 - Биопродукты будущего</span>
          <span className="subtitle fs__md fw__rg opc opc--75" data-anim="lux-up" data-delay="0.2">BIO 3.0 - передовые биопродукты и технологии для здоровья и будущего. Откройте новые возможности с нами.</span>
        </div>
        <Link href="/bio30/details" className="btn btn--primary mt-4" data-anim="fade" data-delay="0.3">Узнать больше</Link>
      </div>
      <div className="stories">
        <div className="story" data-anim="fade" data-delay="0.1">
          <div className="title fs__lg fw__bd">История успеха 1</div>
          <span className="description">Клиент поделился, как наши продукты изменили его жизнь.</span>
        </div>
        <div className="story" data-anim="fade" data-delay="0.2">
          <div className="title fs__lg fw__bd">История успеха 2</div>
          <span className="description">Еще один отзыв о пользе биопродуктов.</span>
        </div>
        <div className="story" data-anim="fade" data-delay="0.3">
          <div className="title fs__lg fw__bd">История успеха 3</div>
          <span className="description">Как BIO 3.0 помогает в повседневной жизни.</span>
        </div>
        <div className="story" data-anim="fade" data-delay="0.4">
          <div className="title fs__lg fw__bd">История успеха 4</div>
          <span className="description">Отзыв от известного клиента.</span>
        </div>
      </div>
      <div className="grid grid--benefit" data-stagger="up" data-stagger-delay="0.15">
        <div className="benefit benefit__default" data-anim="fade" data-delay="0.1">
          <img src="https://bio30.ru/static/uploads/benefits/mobile_74ed8b708e0245aeb2a4211a6b1b104c.webp" alt="Натуральные ингредиенты" className="image__mobile" />
          <img src="https://bio30.ru/static/uploads/benefits/6a317041578644d1b283abeaf781bf36.webp" alt="Натуральные ингредиенты" className="image__web" />
          <div className="title fs__lg fw__bd">Натуральные ингредиенты</div>
          <span className="description">Наши продукты сделаны из натуральных ингредиентов, полученных из устойчивых источников.</span>
        </div>
        <div className="benefit benefit__default" data-anim="fade" data-delay="0.2">
          <img src="https://bio30.ru/static/uploads/benefits/mobile_image2.webp" alt="Инновационные технологии" className="image__mobile" />
          <img src="https://bio30.ru/static/uploads/benefits/image2.webp" alt="Инновационные технологии" className="image__web" />
          <div className="title fs__lg fw__bd">Инновационные технологии</div>
          <span className="description">Используем передовые технологии для производства, обеспечивая максимальную биодоступность.</span>
        </div>
        <div className="benefit benefit__default" data-anim="fade" data-delay="0.3">
          <img src="https://bio30.ru/static/uploads/benefits/mobile_image3.webp" alt="Здоровье и благополучие" className="image__mobile" />
          <img src="https://bio30.ru/static/uploads/benefits/image3.webp" alt="Здоровье и благополучие" className="image__web" />
          <div className="title fs__lg fw__bd">Здоровье и благополучие</div>
          <span className="description">Продукты для вашего здоровья и благополучия, проверенные клиническими исследованиями.</span>
        </div>
      </div>
      <div className="categories">
        <span className="title fs__xl fw__bd" data-anim="lux-up" data-delay="0.1">Категории</span>
        <div className="grid grid--categories" data-stagger="up" data-stagger-delay="0.15">
          <div className="card card__horizontal" data-anim="fade" data-delay="0.1">
            <div className="aside">
              <span className="title fs__lg fw__bd">Витамины</span>
              <span className="description">Витамины для ежедневного употребления и укрепления здоровья.</span>
            </div>
            <div className="bside">
              <img src="https://bio30.ru/static/uploads/categories/vitamins.webp" alt="Витамины" className="image__web" />
            </div>
          </div>
          <div className="card card__horizontal" data-anim="fade" data-delay="0.2">
            <div className="aside">
              <span className="title fs__lg fw__bd">Минералы</span>
              <span className="description">Минералы для поддержания баланса и общего благополучия.</span>
            </div>
            <div className="bside">
              <img src="https://bio30.ru/static/uploads/categories/minerals.webp" alt="Минералы" className="image__web" />
            </div>
          </div>
          <div className="card card__horizontal" data-anim="fade" data-delay="0.3">
            <div className="aside">
              <span className="title fs__lg fw__bd">Иммунитет</span>
              <span className="description">Добавки для укрепления иммунной системы.</span>
            </div>
            <div className="bside">
              <img src="https://bio30.ru/static/uploads/categories/immunity.webp" alt="Иммунитет" className="image__web" />
            </div>
          </div>
          <div className="card card__horizontal" data-anim="fade" data-delay="0.4">
            <div className="aside">
              <span className="title fs__lg fw__bd">Красота</span>
              <span className="description">Продукты для кожи, волос и общего благополучия.</span>
            </div>
            <div className="bside">
              <img src="https://bio30.ru/static/uploads/categories/beauty.webp" alt="Красота" className="image__web" />
            </div>
          </div>
        </div>
      </div>
      <div className="faq">
        <span className="title fs__xl fw__bd" data-anim="lux-up" data-delay="0.1">Часто задаваемые вопросы</span>
        <div className="faq-item" data-anim="fade" data-delay="0.1">
          <div className="question fs__md fw__bd">Что такое BIO 3.0?</div>
          <span className="answer">BIO 3.0 - это платформа для передовых биопродуктов и технологий для здоровья и будущего.</span>
        </div>
        <div className="faq-item" data-anim="fade" data-delay="0.2">
          <div className="question fs__md fw__bd">Как заказать продукт?</div>
          <span className="answer">Добавьте товар в корзину и оформите заказ на сайте.</span>
        </div>
        <div className="faq-item" data-anim="fade" data-delay="0.3">
          <div className="question fs__md fw__bd">Есть ли доставка?</div>
          <span className="answer">Да, по всей России с быстрой доставкой.</span>
        </div>
        <div className="faq-item" data-anim="fade" data-delay="0.4">
          <div className="question fs__md fw__bd">Можно ли вернуть товар?</div>
          <span className="answer">Да, в соответствии с нашей политикой возврата.</span>
        </div>
        <div className="faq-item" data-anim="fade" data-delay="0.5">
          <div className="question fs__md fw__bd">Как присоединиться к реферальной программе?</div>
          <span className="answer">Зарегистрируйтесь и получите уникальную реферальную ссылку.</span>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default HomePage;