// /app/bio30/categories/page.tsx
"use client";

import React, { useEffect } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import CategoryFilter from '../components/CategoryFilter';
import '../styles.css';
import { useBioAnimations } from '../hooks/useBioAnimations';

const CategoriesPage: React.FC = () => {
  useBioAnimations();

  return (
    <div>
      <Header />
      <div className="messages"></div>
      <div className="hero">
        <span className="title fs__xxl fw__bd gradient" data-anim="lux-up" data-delay="0.1">Продукты - BIO 3.0</span>
        <span className="subtitle fs__md fw__rg opc opc--75" data-anim="lux-up" data-delay="0.2">Каталог продуктов BIO 3.0. Широкий выбор БАДов для здоровья и красоты. Узнайте больше и выберите подходящие вам биологически активные добавки.</span>
    </div>
      <div className="grid grid--categories" data-stagger="up" data-stagger-delay="0.15">
        <div className="card card__horizontal" data-anim="fade" data-delay="0.1">
          <div className="aside">
            <span className="title fs__lg fw__bd">Категория 1</span>
            <span className="description">Описание категории 1, биопродукты для здоровья.</span>
          </div>
          <div className="bside">
            <img src="https://bio30.ru/static/uploads/categories/image1.webp" alt="Категория 1" className="image__web" />
          </div>
        </div>
        <div className="card card__horizontal" data-anim="fade" data-delay="0.2">
          <div className="aside">
            <span className="title fs__lg fw__bd">Категория 2</span>
            <span className="description">Описание категории 2, витамины и минералы.</span>
          </div>
          <div className="bside">
            <img src="https://bio30.ru/static/uploads/categories/image2.webp" alt="Категория 2" className="image__web" />
          </div>
        </div>
        <div className="card card__horizontal" data-anim="fade" data-delay="0.3">
          <div className="aside">
            <span className="title fs__lg fw__bd">Категория 3</span>
            <div className="description">Описание категории 3, добавки для иммунитета.</div>
          </div>
          <div className="bside">
            <img src="https://bio30.ru/static/uploads/categories/image3.webp" alt="Категория 3" className="image__web" />
          </div>
        </div>
        <div className="card card__horizontal" data-anim="fade" data-delay="0.4">
          <div className="aside">
            <span className="title fs__lg fw__bd">Категория 4</span>
            <span className="description">Описание категории 4, продукты для красоты.</span>
          </div>
          <div className="bside">
            <img src="https://bio30.ru/static/uploads/categories/image4.webp" alt="Категория 4" className="image__web" />
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default CategoriesPage;