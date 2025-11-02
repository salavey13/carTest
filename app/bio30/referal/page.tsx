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
      {/* Extract content from referal.txt, including grid--referral_01, etc. */}
      <div className="grid grid--referral_01">
        {/* Referral sections */}
      </div>
      <PartnerForm />
      <Footer />
    </div>
  );
};

export default ReferalPage;