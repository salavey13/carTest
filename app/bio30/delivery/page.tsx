"use client";

import React, { useEffect } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import '../styles.css';

const DeliveryPage: React.FC = () => {
  useEffect(() => {
    // Similar useEffect for animations, slick, messages
  }, []);

  return (
    <div>
      <Header />
      <div className="messages"></div>
      <div className="hero">
        <span className="title fs__xxl fw__bd gradient" data-anim="lux-up" data-delay="0.1">Доставка - BIO 3.0</span>
        <span className="subtitle fs__md fw__rg opc opc--75" data-anim="lux-up" data-delay="0.2">Узнайте об условиях доставки BIO 3.0. Стоимость, сроки и способы доставки ваших заказов.</span>
      </div>
      <div className="grid grid--delivery" data-stagger="up" data-stagger-delay="0.15">
        <div className="benefit benefit__vertical">
          <div className="title fs__lg fw__bd">Методы доставки</div>
          <span className="description">Описание</span>
        </div>
        <div className="benefit benefit__vertical">
          <div className="title fs__lg fw__bd">Оплата</div>
          <span className="description">Описание</span>
        </div>
        {/* Add more from delivery.txt */}
      </div>
      <Footer />
    </div>
  );
};

export default DeliveryPage;