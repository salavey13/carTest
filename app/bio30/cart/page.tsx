"use client";

import React, { useEffect } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useAppContext } from '@/contexts/AppContext';
import { removeFromCart, checkoutCart } from '../actions';
import { useBioAnimations } from '../hooks/useBioAnimations';
import '../styles.css';

const CartPage: React.FC = () => {
  useBioAnimations();

  const { dbUser, refreshDbUser, tg } = useAppContext();
  const cart = dbUser?.metadata?.cart || [];

  const handleRemove = async (productId: string) => {
    if (!dbUser?.user_id) return;
    const result = await removeFromCart(dbUser.user_id, productId);
    if (result.success) {
      await refreshDbUser();
    }
  };

  const handleCheckout = async () => {
    if (!dbUser?.user_id || !tg?.initDataUnsafe?.user?.id) return;
    const result = await checkoutCart(dbUser.user_id, tg.initDataUnsafe.user.id.toString());
    if (result.success) {
      // Show success toast
    } else {
      // Show error toast
    }
  };

  const total = cart.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0);

  return (
    <div>
      <Header />
      <div className="messages"></div>
      <div className="hero">
        <span className="title fs__xxl fw__bd gradient" data-anim="lux-up" data-delay="0.1">Корзина - BIO 3.0</span>
        <span className="subtitle fs__md fw__rg opc opc--75" data-anim="lux-up" data-delay="0.2">Ваша корзина в BIO 3.0. Проверьте список товаров и оформите заказ. Быстрая доставка и качественные биопродукты.</span>
      </div>
      <div className="cart-items grid grid--cards" data-stagger="up" data-stagger-delay="0.15">
        {cart.map((item: any, index: number) => (
          <div key={item.productId} className="card card__vertical" data-anim="fade" data-delay={0.1 * (index + 1)}>
            <div className="aside">
              <span className="name fs__md fw__bd">{item.name}</span>
              <span className="quantity fs__sm">Количество: {item.quantity}</span>
              <span className="price fs__md">{item.price * item.quantity} руб.</span>
            </div>
            <div className="bside">
              <button onClick={() => handleRemove(item.productId)} className="btn btn--danger fs__sm">Удалить</button>
            </div>
          </div>
        ))}
        {cart.length === 0 && (
          <span className="empty fs__md fw__rg text-center" data-anim="fade" data-delay="0.1">Корзина пуста</span>
        )}
      </div>
      <div className="total row ctr gp gp--md pd pd__lg--top pd__lg--btm">
        <span className="title fs__lg fw__bd">Итого: {total} руб.</span>
        <button onClick={handleCheckout} className="btn btn--primary" disabled={cart.length === 0 || !tg}>Оформить заказ</button>
      </div>
      <Footer />
    </div>
  );
};

export default CartPage;