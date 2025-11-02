"use client";

import React, { useEffect } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import '../styles.css';

const CategoriesPage: React.FC = () => {
  useEffect(() => {
    // Initialize Slick if needed
    if (typeof window !== 'undefined') {
      const $ = require('jquery');
      require('slick-carousel');
      // Initialize sliders if present
    }
  }, []);

  return (
    <div>
      <Header />
      <div className="messages"></div>
      <div className="hero">
        <span className="title fs__xxl fw__bd gradient">Продукты - BIO 3.0</span>
        <span className="subtitle">Каталог продуктов BIO 3.0. Широкий выбор БАДов для здоровья и красоты.</span>
      </div>
      <div className="grid grid--categories">
        {/* Extract category cards from categories.txt */}
        <div className="card card__horizontal">
          <div className="aside">
            <span className="title fs__lg fw__bd">Категория 1</span>
            <span className="description">Описание категории</span>
          </div>
          <div className="bside">
            <img src="/path/to/image" alt="Category 1" className="image__web" />
          </div>
        </div>
        {/* More categories, repeat for each */}
      </div>
      <Footer />
    </div>
  );
};

export default CategoriesPage;