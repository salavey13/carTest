// /app/bio30/categories/spirulina-chlorella/page.tsx
"use client";

import React from 'react';


import { useBio30ThemeFix } from "../../hooks/useBio30ThemeFix";
import { addToCart } from '../../actions';
import { useAppContext } from '@/contexts/AppContext';

const SpirulinaChlorellaPage: React.FC = () => {
  useBio30ThemeFix();
  const { dbUser, refreshDbUser } = useAppContext();

  const handleAddToCart = async () => {
    if (!dbUser?.user_id) return;
    await addToCart(dbUser.user_id, "3");
    await refreshDbUser();
  };

  return (
    <div>
      
      <div className="messages"></div>
      <div className="hero">
        <span className="title fs__xxl fw__bd gradient" data-anim="lux-up" data-delay="0.1">Spirulina Chlorella - BIO 3.0</span>
        <span className="subtitle fs__md fw__rg opc opc--75" data-anim="lux-up" data-delay="0.2">Spirulina Chlorella — это уникальное сочетание двух суперфудов: спирулины и хлореллы. Спирулина — это сине-зеленая водоросль, богатая белками, витаминами и минералами. Хлорелла — это одноклеточная зеленая водоросль, известная своими детоксикационными свойствами и высоким содержанием хлорофилла. Этот продукт помогает укрепить иммунную систему, улучшить пищеварение и поддерживать общее здоровье организма. Рекомендуется для вегетарианцев, спортсменов и всех, кто стремится к здоровому образу жизни.</span>
      </div>
      <div className="grid grid--product" data-stagger="up" data-stagger-delay="0.15">
        <div className="fluid" data-anim="fade" data-delay="0.1">
          <img src="https://bio30.ru/front/static/uploads/products/44aa9efb6836449bb10a1f7ac9d42923.webp" alt="Spirulina Chlorella" className="product-image w-full h-auto object-cover" />
        </div>
        <div className="benefit benefit__default" data-anim="fade" data-delay="0.2">
          <div className="title fs__lg fw__bd">Укрепление иммунитета</div>
          <span className="description">Укрепляет иммунную систему.</span>
        </div>
        <div className="benefit benefit__default" data-anim="fade" data-delay="0.3">
          <div className="title fs__lg fw__bd">Детоксикация организма</div>
          <span className="description">Очищает организм от токсинов.</span>
        </div>
        <div className="benefit benefit__default" data-anim="fade" data-delay="0.4">
          <div className="title fs__lg fw__bd">Улучшение пищеварения</div>
          <span className="description">Поддерживает здоровое пищеварение.</span>
        </div>
      </div>
      <button onClick={handleAddToCart} className="btn btn--primary">Добавить в корзину</button>
      
    </div>
  );
};

export default SpirulinaChlorellaPage;