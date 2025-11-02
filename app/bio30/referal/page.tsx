"use client";

import React from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import PartnerForm from '../components/PartnerForm';
import '../styles.css';

const ReferalPage: React.FC = () => {
  return (
    <div>
      <Header />
      <div className="grid grid--referral_01">
        <div className="benefit benefit__default">
          <div className="title">Реферальная программа</div>
          {/* Add referral info */}
        </div>
        {/* More sections from referal.txt */}
      </div>
      <PartnerForm />
      <Footer />
    </div>
  );
};

export default ReferalPage;