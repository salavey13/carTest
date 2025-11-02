"use client";

import React, { useEffect } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import './styles.css';

const HomePage: React.FC = () => {
  useEffect(() => {
    // Initialize Slick slider for stories and description
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
  }, []);

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
        {/* Add story items from main.txt if available */}
      </div>
      <div className="grid grid--benefit" data-stagger="up" data-stagger-delay="0.15">
        <div className="benefit benefit__default" data-anim="fade" data-delay="0.1">
          <img src="https://bio30.ru/static/uploads/benefits/mobile_74ed8b708e0245aeb2a4211a6b1b104c.webp" alt="Benefit 1" className="image__mobile" />
          <img src="https://bio30.ru/static/uploads/benefits/6a317041578644d1b283abeaf781bf36.webp" alt="Benefit 2" className="image__web" />
          <div className="title">Benefit Title</div>
          {/* Add more content */}
        </div>
        {/* Add additional benefits */}
      </div>
      <div className="categories">
        <div className="grid grid--categories">
          {/* Category items */}
        </div>
      </div>
      {/* Add FAQ, etc. */}
      <Footer />
    </div>
  );
};

export default HomePage;