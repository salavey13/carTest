"use client";

import React, { useEffect } from 'react';
import '../styles.css';

const Header: React.FC = () => {
  useEffect(() => {
    // Placeholder for initAnimations and other JS
  }, []);

  return (
    <header>
      <div className="web">
        <div className="row ctr gp gp--xs">
          <div className="row ctr gp gp--xl ">
            <a href="/?lang=ru&amp;region=ru" className="ctr " data-anim="fade" data-delay="0.1">
              <span className="logo" data-anim="lux-up" data-delay="0.2"></span>
              <span className="title  fw__md gradient mg mg__sm--lft slogan opc opc--75" data-i18n="header.slogan" data-anim="lux-up" data-delay="0.1">МАГАЗИН БИОЛОГИЧЕСКИ АКТИВНЫХ ДОБАВОК</span>
            </a>

            <div className="row ctr gp gp--lg" data-anim="fade" data-delay="0.1">
              <a href="/categories?lang=ru&amp;region=ru" className="link fs__md fw__md opc opc--50 anmt" data-i18n="header.products_link" data-anim="lux-up" data-delay="0.2">
                <span data-i18n="header.products_link">Продукты</span>
              </a>
              <a href="/delivery?lang=ru&amp;region=ru" className="link fs__md fw__md opc opc--50 anmt" data-i18n="header.delivery_link" data-anim="lux-up" data-delay="0.3">
                <span data-i18n="header.delivery_link">Доставка</span>
              </a>
              <a href="/referal?lang=ru&amp;region=ru" className="link fs__md fw__md opc opc--50 anmt" data-i18n="header.referral_program_link" data-anim="lux-up" data-delay="0.4">
                <span data-i18n="header.referral_program_link">Реферальная программа</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;