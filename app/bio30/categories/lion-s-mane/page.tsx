// /app/bio30/categories/lion-s-mane/page.tsx
"use client";

import React from 'react';


import { useBio30ThemeFix } from "../../hooks/useBio30ThemeFix";
import { addToCart } from '../../actions';
import { useAppContext } from '@/contexts/AppContext';

const LionSManePage: React.FC = () => {
  useBio30ThemeFix();
  const { dbUser, refreshDbUser } = useAppContext();

  const handleAddToCart = async () => {
    if (!dbUser?.user_id) return;
    await addToCart(dbUser.user_id, "1");
    await refreshDbUser();
  };

  return (
    <div>
      
      <div className="messages"></div>
      <div className="hero">
        <span className="title fs__xxl fw__bd gradient" data-anim="lux-up" data-delay="0.1">Lion's Mane - BIO 3.0</span>
        <span className="subtitle fs__md fw__rg opc opc--75" data-anim="lux-up" data-delay="0.2">Lion's Mane, также известный как грива льва или гриб-геркулес, является популярным биологически активным добавкой (БАД), используемой в традиционной китайской медицине. Этот гриб известен своими нейропротекторными свойствами, которые помогают улучшить когнитивные функции, память и концентрацию. Lion's Mane также поддерживает нервную систему и способствует общему укреплению организма. Рекомендуется для людей, стремящихся улучшить свою умственную активность и общее здоровье.</span>
      </div>
      <div className="grid grid--product" data-stagger="up" data-stagger-delay="0.15">
        <div className="fluid" data-anim="fade" data-delay="0.1">
          <img src="https://bio30.ru/front/static/uploads/products/9aeea9dde8f048238a27f43c3997c9fd.webp" alt="Lion's Mane" className="product-image w-full h-auto object-cover" />
        </div>
        <div className="benefit benefit__default" data-anim="fade" data-delay="0.2">
          <div className="title fs__lg fw__bd">Улучшение когнитивных функций</div>
          <span className="description">Помогает улучшить память и концентрацию.</span>
        </div>
        <div className="benefit benefit__default" data-anim="fade" data-delay="0.3">
          <div className="title fs__lg fw__bd">Нейропротекторные свойства</div>
          <span className="description">Защищает нервную систему.</span>
        </div>
        <div className="benefit benefit__default" data-anim="fade" data-delay="0.4">
          <div className="title fs__lg fw__bd">Общее укрепление организма</div>
          <span className="description">Способствует укреплению организма.</span>
        </div>
      </div>
      <button onClick={handleAddToCart} className="btn btn--primary">Добавить в корзину</button>
      
    </div>
  );
};

export default LionSManePage;