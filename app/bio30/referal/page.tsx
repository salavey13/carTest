"use client";

import React, { useEffect } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import PartnerForm from '../components/PartnerForm';
import '../styles.css';

const ReferalPage: React.FC = () => {
  useEffect(() => {
    // Initialize if needed
  }, []);

  return (
    <div>
      <Header />
      <div className="messages"></div>
      <div className="hero">
        <span className="title fs__xxl fw__bd gradient">Реферальная программа - BIO 3.0</span>
        <span className="subtitle">Участвуйте в реферальной программе BIO 3.0! Приглашайте друзей и получайте бонусы и скидки на продукцию.</span>
      </div>
      <div className="grid grid--referral_01">
        <div className="benefit benefit__center">
          <div className="title">Общая информация</div>
          <span className="description">Описание реферальной программы</span>
        </div>
        {/* Add more from referal.txt */}
      </div>
      <div className="grid grid--referral_02">
        {/* Additional referral sections */}
      </div>
      <PartnerForm />
      <Footer />
    </div>
  );
};

export default ReferalPage;