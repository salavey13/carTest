"use client";

import React from 'react';
import '../styles.css';

const Footer: React.FC = () => {
  return (
    <footer>
      <div className="row pd pd__xxl--top pd__xxl--btm">
        {/* ... (extract full footer structure from main.txt or others, including regions, earn, documents, etc.) */}
        <div className="row top pd pd__xxl--top pd__xxl--btm">
          <div className="aside">
            <div className="row ctr gp gp--xs">
              <div className="age"></div>
              <span className="text fs__sm fw__rg opc opc--50" data-i18n="footer.site_info_adults"></span>
            </div>
          </div>
          <div className="bside">
            <div className="row ctr rgt gp gp--xs pd pd__lg--rgt">
              <span className="subtitle fs__sm fw__rg">
                <a href="/docs/data" className="subtitle fs__sm fw__rg" data-i18n="footer.personal_data_processing">Обработка персональных данных</a>
              </span>
              <span className="subtitle fs__sm fw__rg">
                <a href="/docs/confidencial" className="subtitle fs__sm fw__rg" data-i18n="footer.privacy_policy">Политика конфиденциальности</a>
              </span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;