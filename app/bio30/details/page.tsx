"use client";

import React, { useEffect } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import '../styles.css';

const DetailsPage: React.FC = () => {
  useEffect(() => {
    // Similar useEffect as in other pages for animations, slick, messages
  }, []);

  return (
    <div>
      <Header />
      <div className="messages"></div>
      <div className="hero">
        <span className="title fs__xxl fw__bd gradient" data-anim="lux-up" data-delay="0.1">Детали - BIO 3.0</span>
        <span className="subtitle fs__md fw__rg opc opc--75" data-anim="lux-up" data-delay="0.2">Подробная информация о передовых биопродуктах и технологиях для здоровья и будущего.</span>
      </div>
      <div className="stories">
        {/* Stories slider if needed */}
      </div>
      <div className="grid grid--benefit" data-stagger="up" data-stagger-delay="0.15">
        <div className="benefit benefit__default" data-anim="fade" data-delay="0.1">
          <img src="https://bio30.ru/static/uploads/benefits/mobile_74ed8b708e0245aeb2a4211a6b1b104c.webp" alt="Detail 1" className="image__mobile" />
          <img src="https://bio30.ru/static/uploads/benefits/6a317041578644d1b283abeaf781bf36.webp" alt="Detail 1" className="image__web" />
          <div className="title fs__lg fw__bd">Технология 1</div>
          <span className="description">Описание технологии 1.</span>
        </div>
        <div className="benefit benefit__default" data-anim="fade" data-delay="0.2">
          <div className="title fs__lg fw__bd">Технология 2</div>
          <span className="description">Описание технологии 2.</span>
        </div>
        {/* Add more details in the same style */}
      </div>
      <Footer />
    </div>
  );
};

export default DetailsPage;