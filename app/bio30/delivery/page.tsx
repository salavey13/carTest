"use client";

import React, { useEffect } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import '../styles.css';

const DeliveryPage: React.FC = () => {
  useEffect(() => {
    // Similar useEffect for animations, slick, messages as in page.tsx
  }, []);

  return (
    <div>
      <Header />
      <div className="messages"></div>
      <div className="hero">
        <span className="title fs__xxl fw__bd gradient" data-anim="lux-up" data-delay="0.1">Доставка - BIO 3.0</span>
        <span className="subtitle fs__md fw__rg opc opc--75" data-anim="lux-up" data-delay="0.2">Узнайте об условиях доставки BIO 3.0. Стоимость, сроки и способы доставки ваших заказов. Быстрая и надежная доставка биопродуктов.</span>
      </div>
      <div className="grid grid--delivery" data-stagger="up" data-stagger-delay="0.15">
        <div className="benefit benefit__vertical" data-anim="fade" data-delay="0.1">
          <div className="title fs__lg fw__bd">Способы доставки</div>
          <span className="description">Описание способов доставки, сроки и стоимость.</span>
        </div>
        <div className="benefit benefit__vertical" data-anim="fade" data-delay="0.2">
          <div className="title fs__lg fw__bd">Оплата</div>
          <span className="description">Информация об оплате заказов.</span>
        </div>
        <div className="benefit benefit__vertical" data-anim="fade" data-delay="0.3">
          <div className="title fs__lg fw__bd">Регионы доставки</div>
          <span className="description">Список регионов с условиями доставки.</span>
        </div>
        <div className="benefit benefit__vertical" data-anim="fade" data-delay="0.4">
          <div className="title fs__lg fw__bd">FAQ по доставке</div>
          <span className="description">Часто задаваемые вопросы о доставке.</span>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default DeliveryPage;