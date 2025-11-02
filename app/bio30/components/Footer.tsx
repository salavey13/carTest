"use client";

import React from 'react';
import '../styles.css';

const Footer: React.FC = () => {
  return (
    <footer>
      <div className="row pd pd__xxl--top pd__xxl--btm">
        <div className="col gp gp--md">
          <span className="title fs__md fw__bd mg mg__md--btm" data-i18n="footer.region_section" data-anim="lux-up" data-delay="0.1">РЕГИОН</span>
          <div className="region-block col gp gp--xs">
            <span className="link s__md fw__rg" data-anim="lux-up" data-delay="0.2" data-i18n="Россия">Россия</span>
            <div id="languages-ru" className="languages-dropdown row gp gp--xs">
              <a href="#" className="languages__item link fs__md fw__rg opc opc--50" data-anim="fade" data-delay="0.28" data-lang="ru" data-region="ru" data-i18n="Русский">
                <span className="flag ru"></span>
                Русский
              </a>
              <a href="#" className="languages__item link fs__md fw__rg opc opc--50" data-anim="fade" data-delay="0.48" data-lang="en" data-region="ru" data-i18n="English">
                <span className="flag en"></span>
                English
              </a>
            </div>
          </div>
        </div>
        <div className="col gp gp--md">
          <span className="title fs__md fw__bd mg mg__md--btm" data-i18n="footer.earn_section" data-anim="lux-up" data-delay="0.1">ЗАРАБОТАТЬ</span>
          <a href="/referal" className="link fs__md fw__rg opc opc--50 anmt" data-i18n="footer.general_info" data-anim="lux-up" data-delay="0.1">Общая информация</a>
          <a href="/settings" className="link fs__md fw__rg opc opc--50 anmt" data-i18n="footer.my_account" data-anim="lux-up" data-delay="0.1">Мой кабинет</a>
        </div>
        <div className="col gp gp--md">
          <span className="title fs__md fw__bd mg mg__md--btm" data-i18n="footer.documents_section" data-anim="lux-up" data-delay="0.1">ДОКУМЕНТЫ</span>
          <a href="/docs/data" className="link fs__md fw__rg opc opc--50 anmt" data-i18n="docs.data" data-anim="lux-up" data-delay="0.2"></a>
          <a href="/docs/gdpr" className="link fs__md fw__rg opc opc--50 anmt" data-i18n="docs.gdpr" data-anim="lux-up" data-delay="0.3"></a>
          <a href="/docs/confidencial" className="link fs__md fw__rg opc opc--50 anmt" data-i18n="docs.confidencial" data-anim="lux-up" data-delay="0.4"></a>
          <a href="/docs/policy" className="link fs__md fw__rg opc opc--50 anmt" data-i18n="docs.policy" data-anim="lux-up" data-delay="0.5"></a>
          <a href="/docs/info" className="link fs__md fw__rg opc opc--50 anmt" data-i18n="docs.info" data-anim="lux-up" data-delay="0.6"></a>
          <a href="/docs/payment" className="link fs__md fw__rg opc opc--50 anmt" data-i18n="docs.payment" data-anim="lux-up" data-delay="0.7"></a>
          <a href="/docs/returns" className="link fs__md fw__rg opc opc--50 anmt" data-i18n="docs.returns" data-anim="lux-up" data-delay="0.8"></a>
        </div>
      </div>
      <div className="row top pd pd__xxl--top pd__xxl--btm">
        <div className="aside" >
          <div className="row ctr gp gp--xs">
            <div className="age"></div>
            <span className="text fs__sm fw__rg opc opc--50" data-i18n="footer.site_info_adults"  ></span>
          </div>
        </div>
        <div className="bside">
          <div className="row ctr rgt gp gp--xs pd pd__lg--rgt">
            <span className="subtitle fs__sm fw__rg" >
              <a href="/docs/data" className="subtitle fs__sm fw__rg" data-i18n="footer.personal_data_processing" >Обработка персональных данных</a>
            </span>
            <span className="subtitle fs__sm fw__rg" >
              <a href="/docs/confidencial" className="subtitle fs__sm fw__rg" data-i18n="footer.privacy_policy"  >Политика конфиденциальности</a>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;