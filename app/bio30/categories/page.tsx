"use client";

import React, { useEffect } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import '../styles.css';

const CategoriesPage: React.FC = () => {
  useEffect(() => {
    // Similar useEffect as in main page for animations and messages
    // Initialize Slick if needed
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

    // initAnimations function here, same as above

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
        <span className="subtitle fs__md fw__rg opc opc--75" data-anim="lux-up" data-delay="0.2">Каталог продуктов BIO 3.0. Широкий выбор БАДов для здоровья и красоты.</span>
      </div>
      <div className="grid grid--categories" data-stagger="up" data-stagger-delay="0.15">
        {/* Category cards from categories.txt */}
        <div className="card card__horizontal">
          <div className="aside">
            <span className="title fs__lg fw__bd">Category Name</span>
            <span className="description">Category Description</span>
          </div>
          <div className="bside">
            <img src="/front/static/uploads/categories/image.webp" alt="Category" className="image__web" />
          </div>
        </div>
        {/* Repeat for each category */}
      </div>
      <Footer />
    </div>
  );
};

export default CategoriesPage;