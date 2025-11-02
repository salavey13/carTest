"use client";

import React, { useEffect } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import '../styles.css';

const DetailsPage: React.FC = () => {
  useEffect(() => {
    // Similar useEffect for animations, slick, messages
  }, []);

  return (
    <div>
      <Header />
      <div className="messages"></div>
      <div className="hero">
        <span className="title fs__xxl fw__bd gradient" data-anim="lux-up" data-delay="0.1">Детали - BIO 3.0</span>
        <span className="subtitle fs__md fw__rg opc opc--75" data-anim="lux-up" data-delay="0.2">Подробная информация о BIO 3.0, технологиях и продуктах.</span>
      </div>
      <div className="grid grid--benefit" data-stagger="up" data-stagger-delay="0.15">
        <div className="benefit benefit__default">
          <div className="title fs__lg fw__bd">Деталь 1</div>
          <span className="description">Описание детали 1</span>
        </div>
        {/* Add more details sections */}
      </div>
      <Footer />
    </div>
  );
};

export default DetailsPage;