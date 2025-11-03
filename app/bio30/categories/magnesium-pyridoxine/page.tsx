"use client";

import React from 'react';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { useBioAnimations } from '../../hooks/useBioAnimations';
import { addToCart } from '../../actions';
import { useAppContext } from '@/contexts/AppContext';
import '../../styles.css';

const MagnesiumPyridoxinePage: React.FC = () => {
  useBioAnimations();
  const { dbUser, refreshDbUser } = useAppContext();

  const handleAddToCart = async () => {
    if (!dbUser?.user_id) return;
    await addToCart(dbUser.user_id, "4");
    await refreshDbUser();
  };

  return (
    <div>
      <Header />
      <div className="messages"></div>
      <div className="hero">
        <span className="title fs__xxl fw__bd gradient" data-anim="lux-up" data-delay="0.1">Magnesium Pyridoxine - BIO 3.0</span>
        <span className="subtitle fs__md fw__rg opc opc--75" data-anim="lux-up" data-delay="0.2">Синергетический комплекс магния и витамина B6 для здоровья нервной системы и полноценного восстановления. Высокобиодоступные формы магния цитрата и пиридоксина обеспечивают глубокое расслабление, качественный сон и защиту от стресса.</span>
      </div>
      <div className="grid grid--product" data-stagger="up" data-stagger-delay="0.15">
        <div className="fluid" data-anim="fade" data-delay="0.1">
          <img src="https://bio30.ru/front/static/uploads/products/1552689351894f229843f51efdb813fc.webp" alt="Magnesium Pyridoxine" className="product-image w-full h-auto object-cover" />
        </div>
        <div className="benefit benefit__default" data-anim="fade" data-delay="0.2">
          <div className="title fs__lg fw__bd">Здоровье нервной системы</div>
          <span className="description">Поддерживает нервную систему.</span>
        </div>
        <div className="benefit benefit__default" data-anim="fade" data-delay="0.3">
          <div className="title fs__lg fw__bd">Качественный сон</div>
          <span className="description">Улучшает сон.</span>
        </div>
        <div className="benefit benefit__default" data-anim="fade" data-delay="0.4">
          <div className="title fs__lg fw__bd">Защита от стресса</div>
          <span className="description">Защищает от стресса.</span>
        </div>
        {/* Add more benefits */}
      </div>
      <button onClick={handleAddToCart} className="btn btn--primary">Добавить в корзину</button>
      <Footer />
    </div>
  );
};

export default MagnesiumPyridoxinePage;