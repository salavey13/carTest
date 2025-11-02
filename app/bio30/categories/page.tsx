"use client";

import React, { useEffect } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import '../styles.css';

const CategoriesPage: React.FC = () => {
  useEffect(() => {
    // Similar useEffect as in main page for animations, slick, messages
    if (typeof window !== 'undefined') {
      const $ = require('jquery');
      require('slick-carousel');
      $('.stories, .description').slick({
        dots: false,
        arrows: false,
        infinite: false,
        speed: 800,
        slidesToShow: 1,
        slidesToScroll: 1,
        responsive: [
          { breakpoint: 1024, settings: { dots: true } },
          { breakpoint: 600, settings: { slidesToShow: 2, slidesToScroll: 2 } },
          { breakpoint: 480, settings: { slidesToShow: 1, slidesToScroll: 1 } }
        ]
      });
    }

    // initAnimations function here, same as in page.tsx

    const msgs = document.querySelector('.messages');
    if (msgs && msgs.querySelectorAll('.alert').length > 0) {
      msgs.classList.add('has-messages');
      setTimeout(() => msgs.classList.remove('has-messages'), 5000);
    }
  }, []);

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
            <img src="/front/static/uploads/categories/cat1.webp" alt="Категория 1" className="image__web" />
          </div>
        </div>
        <div className="card card__horizontal" data-anim="fade" data-delay="0.2">
          <div className="aside">
            <span className="title fs__lg fw__bd">Категория 2</span>
            <span className="description">Описание категории 2, витамины и минералы.</span>
          </div>
          <div className="bside">
            <img src="/front/static/uploads/categories/cat2.webp" alt="Категория 2" className="image__web" />
          </div>
        </div>
        {/* Add more category cards based on categories.txt structure */}
      </div>
      <Footer />
    </div>
  );
};

export default CategoriesPage;