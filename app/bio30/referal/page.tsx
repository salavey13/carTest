"use client";

import React, { useEffect } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import PartnerForm from '../components/PartnerForm';
import Dashboard from '../components/Dashboard';
import { useAppContext } from '@/contexts/AppContext';
import '../styles.css';
import { useBioAnimations } from '../hooks/useBioAnimations';

const ReferalPage: React.FC = () => {
  const { dbUser } = useAppContext();
  const isPartner = dbUser?.metadata?.is_referral_partner || false;

  useBioAnimations();

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
          <span className="description">Пригласите друга по реферальной ссылке, он получит скидку, вы - бонус.</span>
        </div>
        <div className="benefit benefit__horizontal" data-anim="fade" data-delay="0.2">
          <div className="title fs__lg fw__bd">Ваша реферальная ссылка</div>
          <span className="description">https://bio30.ru/referal/yourcode</span>
        </div>
        <div className="benefit benefit__horizontal" data-anim="fade" data-delay="0.3">
          <div className="title fs__lg fw__bd">Статистика</div>
          <span className="description">Количество приглашенных: 5, Заработано: 500 руб.</span>
        </div>
      </div>
      <div className="grid grid--referral_02" data-stagger="up" data-stagger-delay="0.15">
        <div className="benefit benefit__default" data-anim="fade" data-delay="0.1">
          <div className="title fs__lg fw__bd">Шаг 1: Регистрация</div>
          <span className="description">Зарегистрируйтесь на сайте.</span>
        </div>
        <div className="benefit benefit__default" data-anim="fade" data-delay="0.2">
          <div className="title fs__lg fw__bd">Шаг 2: Получите ссылку</div>
          <span className="description">Получите уникальную реферальную ссылку.</span>
        </div>
        <div className="benefit benefit__default" data-anim="fade" data-delay="0.3">
          <div className="title fs__lg fw__bd">Шаг 3: Пригласите друзей</div>
          <span className="description">Поделитесь ссылкой с друзьями.</span>
        </div>
        <div className="benefit benefit__default" data-anim="fade" data-delay="0.4">
          <div className="title fs__lg fw__bd">Шаг 4: Получите бонусы</div>
          <span className="description">Получите бонусы за покупки друзей.</span>
        </div>
        <div className="benefit benefit__default" data-anim="fade" data-delay="0.5">
          <div className="title fs__lg fw__bd">FAQ</div>
          <span className="description">Часто задаваемые вопросы о программе.</span>
        </div>
        <div className="benefit benefit__default" data-anim="fade" data-delay="0.6">
          <div className="title fs__lg fw__bd">Контакты поддержки</div>
          <span className="description">support@bio30.ru</span>
        </div>
      </div>
      {isPartner ? <Dashboard /> : <PartnerForm />}
      <Footer />
    </div>
  );
};

export default ReferalPage;