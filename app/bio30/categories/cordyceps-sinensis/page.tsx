"use client";

import React from 'react';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { useBioAnimations } from '../../hooks/useBioAnimations';
import { addToCart } from '../../actions';
import { useAppContext } from '@/contexts/AppContext';
import '../../styles.css';

const CordycepsSinensisPage: React.FC = () => {
  useBioAnimations();
  const { dbUser, refreshDbUser } = useAppContext();

  const handleAddToCart = async () => {
    if (!dbUser?.user_id) return;
    await addToCart(dbUser.user_id, "2");
    await refreshDbUser();
  };

  return (
    <div>
      <Header />
      <div className="messages"></div>
      <div className="hero">
        <span className="title fs__xxl fw__bd gradient" data-anim="lux-up" data-delay="0.1">Cordyceps Sinensis - BIO 3.0</span>
        <span className="subtitle fs__md fw__rg opc opc--75" data-anim="lux-up" data-delay="0.2">Адаптоген, помогает справляться со стрессом. Содержит кордицепин и полисахариды для поддержки иммунитета, улучшения выносливости, общего укрепления. Идеален для спортсменов, активных людей и стремящихся к здоровью.</span>
      </div>
      <div className="grid grid--product" data-stagger="up" data-stagger-delay="0.15">
        <div className="fluid" data-anim="fade" data-delay="0.1">
          <img src="https://bio30.ru/front/static/uploads/products/deab27a3b7834149ad5187c430301f9c.webp" alt="Cordyceps Sinensis" className="product-image w-full h-auto object-cover" />
        </div>
        <div className="benefit benefit__default" data-anim="fade" data-delay="0.2">
          <div className="title fs__lg fw__bd">Поддержка иммунитета</div>
          <span className="description">Укрепляет иммунную систему.</span>
        </div>
        <div className="benefit benefit__default" data-anim="fade" data-delay="0.3">
          <div className="title fs__lg fw__bd">Улучшение выносливости</div>
          <span className="description">Повышает выносливость и энергию.</span>
        </div>
        <div className="benefit benefit__default" data-anim="fade" data-delay="0.4">
          <div className="title fs__lg fw__bd">Защита от стресса</div>
          <span className="description">Помогает справляться со стрессом.</span>
        </div>
      </div>
      <button onClick={handleAddToCart} className="btn btn--primary">Добавить в корзину</button>
      <Footer />
    </div>
  );
};

export default CordycepsSinensisPage;