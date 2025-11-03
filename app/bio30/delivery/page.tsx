// /app/bio30/delivery/page.tsx
"use client";

import React, { useEffect } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import '../styles.css';
import { useBioAnimations } from '../hooks/useBioAnimations';
const DeliveryPage: React.FC = () => {
  useBioAnimations();

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
          <span className="description">Мы предлагаем несколько способов доставки: курьерская доставка, почта, самовывоз. Сроки зависят от региона.</span>
        </div>
        <div className="benefit benefit__vertical" data-anim="fade" data-delay="0.2">
          <div className="title fs__lg fw__bd">Стоимость доставки</div>
          <span className="description">Стоимость рассчитывается индивидуально, от 300 руб. Бесплатно при заказе от 5000 руб.</span>
        </div>
        <div className="benefit benefit__vertical" data-anim="fade" data-delay="0.3">
          <div className="title fs__lg fw__bd">Сроки доставки</div>
          <span className="description">В Москве - 1-2 дня, в регионах - 3-7 дней.</span>
        </div>
        <div className="benefit benefit__vertical" data-anim="fade" data-delay="0.4">
          <div className="title fs__lg fw__bd">Оплата</div>
          <span className="description">Оплата при получении или онлайн через сайт.</span>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default DeliveryPage;