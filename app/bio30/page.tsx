"use client";

import React from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import './styles.css';

const HomePage: React.FC = () => {
  return (
    <div>
      <Header />
      <div className="hero">
        <div className="row ctr gp gp--xl">
          <div className="title fs__xxl fw__bd gradient" data-anim="lux-up" data-delay="0.1">BIO 3.0 - Биопродукты будущего</div>
          {/* Add more hero content from main.txt */}
        </div>
      </div>
      <div className="stories">
        {/* Stories slider */}
      </div>
      <div className="grid grid--benefit">
        {/* Benefits cards */}
        <div className="benefit benefit__default">
          <img src="https://bio30.ru/static/uploads/benefits/mobile_74ed8b708e0245aeb2a4211a6b1b104c.webp" alt="Benefit 1" className="image__mobile" />
          {/* Add content */}
        </div>
        {/* More benefits */}
      </div>
      {/* Add other sections like categories, faq, etc. */}
      <Footer />
    </div>
  );
};

export default HomePage;