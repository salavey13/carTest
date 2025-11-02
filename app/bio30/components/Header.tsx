"use client";

import React, { useEffect } from 'react';
import '../styles.css'; // Import shared styles

const Header: React.FC = () => {
  useEffect(() => {
    // Initialize animations, sliders, etc., from provided JS
    // For example, load GSAP, Lenis, Slick if needed via imports
    // Assuming dependencies are installed: npm i gsap @studio-freight/lenis slick-carousel
    // initAnimations() function can be called here
  }, []);

  return (
    <header>
      <div className="web">
        <div className="row ctr gp gp--xs">
          <div className="row ctr gp gp--xl">
            <a href="/?lang=ru&region=ru" className="ctr" data-anim="fade" data-delay="0.1">
              <span className="logo" data-anim="lux-up" data-delay="0.2"></span>
              <span className="title fw__md gradient mg mg__sm--lft slogan opc opc--75" data-i18n="header.slogan" data-anim="lux-up" data-delay="0.1">
                МАГАЗИН БИОЛОГИЧЕСКИ АКТИВНЫХ ДОБАВОК
              </span>
            </a>
            <div className="row ctr gp gp--lg" data-anim="fade" data-delay="0.1">
              <a href="/categories?lang=ru&region=ru" className="link fs__md fw__md opc opc--50 anmt" data-i18n="header.products_link" data-anim="lux-up" data-delay="0.2">
                <span data-i18n="header.products_link">Продукты</span>
              </a>
              <a href="/delivery?lang=ru&region=ru" className="link fs__md fw__md opc opc--50 anmt" data-i18n="header.delivery_link" data-anim="lux-up" data-delay="0.3">
                <span data-i18n="header.delivery_link">Доставка</span>
              </a>
              <a href="/referal?lang=ru&region=ru" className="link fs__md fw__md opc opc--50 anmt" data-i18n="header.referral_program_link" data-anim="lux-up" data-delay="0.4">
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