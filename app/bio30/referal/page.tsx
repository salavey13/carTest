"use client";

import React, { useEffect } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import PartnerForm from '../components/PartnerForm';
import '../styles.css';

const ReferalPage: React.FC = () => {
  useEffect(() => {
    // Similar useEffect as in page.tsx
  }, []);

  return (
    <div>
      <Header />
      <div className="messages"></div>
      <div className="hero">
        <span className="title fs__xxl fw__bd gradient" data-anim="lux-up" data-delay="0.1">Реферальная программа - BIO 3.0</span>
        <span className="subtitle fs__md fw__rg opc opc--75" data-anim="lux-up" data-delay="0.2">Участвуйте в реферальной программе BIO 3.0! Приглашайте друзей и получайте бонусы и скидки на продукцию. Узнайте условия и начните зарабатывать.</span>
      </div>
      <div className="grid grid--referral_01" data-stagger="up" data-stagger-delay="0.15">
        <div className="benefit benefit__center" data-anim="fade" data-delay="0.1">
          <div className="title fs__lg fw__bd">Как это работает</div>
          <span className="description">Описание механизма реферальной программы.</span>
        </div>
        <div className="benefit benefit__horizontal" data-anim="fade" data-delay="0.2">
          <div className="title fs__lg fw__bd">Преимущества</div>
          <span className="description">Бонусы и вознаграждения.</span>
        </div>
        <div className="benefit benefit__horizontal" data-anim="fade" data-delay="0.3">
          <div className="title fs__lg fw__bd">Условия</div>
          <span className="description">Правила участия.</span>
        </div>
      </div>
      <div className="grid grid--referral_02" data-stagger="up" data-stagger-delay="0.15">
        <div className="benefit benefit__default" data-anim="fade" data-delay="0.1">
          <div className="title fs__lg fw__bd">Шаг 1</div>
          <span className="description">Регистрация.</span>
        </div>
        <div className="benefit benefit__default" data-anim="fade" data-delay="0.2">
          <div className="title fs__lg fw__bd">Шаг 2</div>
          <span className="description">Приглашение друзей.</span>
        </div>
        <div className="benefit benefit__default" data-anim="fade" data-delay="0.3">
          <div className="title fs__lg fw__bd">Шаг 3</div>
          <span className="description">Получение бонусов.</span>
        </div>
        <div className="benefit benefit__default" data-anim="fade" data-delay="0.4">
          <div className="title fs__lg fw__bd">Шаг 4</div>
          <span className="description">Вывод средств.</span>
        </div>
        <div className="benefit benefit__default" data-anim="fade" data-delay="0.5">
          <div className="title fs__lg fw__bd">FAQ</div>
          <span className="description">Часто задаваемые вопросы.</span>
        </div>
        <div className="benefit benefit__default" data-anim="fade" data-delay="0.6">
          <div className="title fs__lg fw__bd">Контакты</div>
          <span className="description">Поддержка.</span>
        </div>
      </div>
      <PartnerForm />
      <Footer />
    </div>
  );
};

export default ReferalPage;