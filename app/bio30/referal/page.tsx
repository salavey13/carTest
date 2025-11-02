"use client";

import React, { useEffect } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import PartnerForm from '../components/PartnerForm';
import '../styles.css';

const ReferalPage: React.FC = () => {
  useEffect(() => {
    // Similar useEffect
  }, []);

  return (
    <div>
      <Header />
      <div className="messages"></div>
      <div className="hero">
        <span className="title fs__xxl fw__bd gradient" data-anim="lux-up" data-delay="0.1">Реферальная программа - BIO 3.0</span>
        <span className="subtitle fs__md fw__rg opc opc--75" data-anim="lux-up" data-delay="0.2">Участвуйте в реферальной программе BIO 3.0! Приглашайте друзей и получайте бонусы и скидки на продукцию.</span>
      </div>
      <div className="grid grid--referral_01" data-stagger="up" data-stagger-delay="0.15">
        <div className="benefit benefit__center">
          <div className="title fs__lg fw__bd">Общая информация</div>
          <span className="description">Описание</span>
        </div>
        {/* More sections */}
      </div>
      <div className="grid grid--referral_02" data-stagger="up" data-stagger-delay="0.15">
        {/* Additional sections */}
      </div>
      <PartnerForm />
      <Footer />
    </div>
  );
};

export default ReferalPage;