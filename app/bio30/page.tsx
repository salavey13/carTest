// /app/bio30/page.tsx
"use client";

import React, { useEffect } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import './styles.css';
import { useBioAnimations } from 'hooks/useBioAnimations';

const HomePage: React.FC = () => {
  useBioAnimations();

  return (
    <div>
      <Header />
      <div className="messages"></div>
      <div className="hero">
        <div className="row ctr gp gp--xl" data-anim="fade" data-delay="0.1">
          <span className="title fs__xxl fw__bd gradient" data-anim="lux-up" data-delay="0.1">BIO 3.0 - Биопродукты будущего</span>
          <span className="subtitle fs__md fw__rg opc opc--75" data-anim="lux-up" data-delay="0.2">Передовые биопродукты и технологии для здоровья и будущего. Откройте новые возможности с нами.</span>
        </div>
      </div>
      <div className="stories">
        <div className="story" data-anim="fade" data-delay="0.1">
          <div className="title fs__lg fw__bd">Story 1</div>
          <span className="description">Описание истории 1</span>
        </div>
        <div className="story" data-anim="fade" data-delay="0.2">
          <div className="title fs__lg fw__bd">Story 2</div>
          <span className="description">Описание истории 2</span>
        </div>
        <div className="story" data-anim="fade" data-delay="0.3">
          <div className="title fs__lg fw__bd">Story 3</div>
          <span className="description">Описание истории 3</span>
        </div>
        <div className="story" data-anim="fade" data-delay="0.4">
          <div className="title fs__lg fw__bd">Story 4</div>
          <span className="description">Описание истории 4</span>
        </div>
      </div>
      <div className="grid grid--benefit" data-stagger="up" data-stagger-delay="0.15">
        <div className="benefit benefit__default" data-anim="fade" data-delay="0.1">
          <img src="https://bio30.ru/static/uploads/benefits/mobile_74ed8b708e0245aeb2a4211a6b1b104c.webp" alt="Benefit 1" className="image__mobile" />
          <img src="https://bio30.ru/static/uploads/benefits/6a317041578644d1b283abeaf781bf36.webp" alt="Benefit 1" className="image__web" />
          <div className="title fs__lg fw__bd">Натуральные ингредиенты</div>
          <span className="description">Наши продукты сделаны из натуральных ингредиентов.</span>
        </div>
        <div className="benefit benefit__default" data-anim="fade" data-delay="0.2">
          <img src="https://bio30.ru/static/uploads/benefits/mobile_image2.webp" alt="Benefit 2" className="image__mobile" />
          <img src="https://bio30.ru/static/uploads/benefits/image2.webp" alt="Benefit 2" className="image__web" />
          <div className="title fs__lg fw__bd">Инновационные технологии</div>
          <span className="description">Используем передовые технологии для производства.</span>
        </div>
        <div className="benefit benefit__default" data-anim="fade" data-delay="0.3">
          <img src="https://bio30.ru/static/uploads/benefits/mobile_image3.webp" alt="Benefit 3" className="image__mobile" />
          <img src="https://bio30.ru/static/uploads/benefits/image3.webp" alt="Benefit 3" className="image__web" />
          <div className="title fs__lg fw__bd">Здоровье и благополучие</div>
          <span className="description">Продукты для вашего здоровья и благополучия.</span>
        </div>
      </div>
      <div className="categories">
        <span className="title fs__xl fw__bd" data-anim="lux-up" data-delay="0.1">Категории</span>
        <div className="grid grid--categories" data-stagger="up" data-stagger-delay="0.15">
          <div className="card card__horizontal" data-anim="fade" data-delay="0.1">
            <div className="aside">
              <span className="title fs__lg fw__bd">Категория 1</span>
              <span className="description">Описание категории 1</span>
            </div>
            <div className="bside">
              <img src="/front/static/uploads/categories/cat1.webp" alt="Категория 1" className="image__web" />
            </div>
          </div>
          <div className="card card__horizontal" data-anim="fade" data-delay="0.2">
            <div className="aside">
              <span className="title fs__lg fw__bd">Категория 2</span>
              <span className="description">Описание категории 2</span>
            </div>
            <div className="bside">
              <img src="/front/static/uploads/categories/cat2.webp" alt="Категория 2" className="image__web" />
            </div>
          </div>
          <div className="card card__horizontal" data-anim="fade" data-delay="0.3">
            <div className="aside">
              <span className="title fs__lg fw__bd">Категория 3</span>
              <span className="description">Описание категории 3</span>
            </div>
            <div className="bside">
              <img src="/front/static/uploads/categories/cat3.webp" alt="Категория 3" className="image__web" />
            </div>
          </div>
          <div className="card card__horizontal" data-anim="fade" data-delay="0.4">
            <div className="aside">
              <span className="title fs__lg fw__bd">Категория 4</span>
              <span className="description">Описание категории 4</span>
            </div>
            <div className="bside">
              <img src="/front/static/uploads/categories/cat4.webp" alt="Категория 4" className="image__web" />
            </div>
          </div>
        </div>
      </div>
      {/* Add FAQ section if present in main.txt */}
      <div className="faq">
        <span className="title fs__xl fw__bd" data-anim="lux-up" data-delay="0.1">Часто задаваемые вопросы</span>
        <div className="faq-item" data-anim="fade" data-delay="0.1">
          <div className="question fs__md fw__bd">Вопрос 1?</div>
          <span className="answer">Ответ 1.</span>
        </div>
        <div className="faq-item" data-anim="fade" data-delay="0.2">
          <div className="question fs__md fw__bd">Вопрос 2?</div>
          <span className="answer">Ответ 2.</span>
        </div>
        <div className="faq-item" data-anim="fade" data-delay="0.3">
          <div className="question fs__md fw__bd">Вопрос 3?</div>
          <span className="answer">Ответ 3.</span>
        </div>
        <div className="faq-item" data-anim="fade" data-delay="0.4">
          <div className="question fs__md fw__bd">Вопрос 4?</div>
          <span className="answer">Ответ 4.</span>
        </div>
        <div className="faq-item" data-anim="fade" data-delay="0.5">
          <div className="question fs__md fw__bd">Вопрос 5?</div>
          <span className="answer">Ответ 5.</span>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default HomePage;