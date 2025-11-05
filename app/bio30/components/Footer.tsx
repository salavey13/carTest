"use client";

import React from "react";

const Footer: React.FC = () => {
  return (
    <footer data-anim="fade" data-delay="0.1">
      {/* верхний блок — контакты и соцсети */}
      <div className="row ctr pd pd__xxl--top pd__xxl--btm">
        <div className="row">
          <a
            href="mailto:privet@bio30.ru"
            className="btn btn--blk btn__primary"
            data-anim="lux-up"
            data-delay="0.1"
          >
            <span>privet@bio30.ru</span>
          </a>
        </div>

        <div className="row ctr rgt">
          <div className="social gp gp--lg mg mg__lg--rgt">
            <a
              href="https://t.me/BIO30_chat"
              className="telegram btn btn--blk btn__primary"
              data-anim="lux-up"
              data-delay="0.2"
              target="_blank"
              rel="noopener noreferrer"
            ></a>
            <a
              href="https://vk.com/club231438011"
              className="vk btn btn--blk btn__primary"
              data-anim="lux-up"
              data-delay="0.3"
              target="_blank"
              rel="noopener noreferrer"
            ></a>
            <a
              href="https://dzen.ru/id/6868db59568f80115b12a631"
              className="dzen btn btn--blk btn__primary"
              data-anim="lux-up"
              data-delay="0.4"
              target="_blank"
              rel="noopener noreferrer"
            ></a>
          </div>

          <button
            id="language-btn"
            className="btn btn--blk btn__primary"
            aria-haspopup="true"
            aria-expanded="false"
            data-anim="lux-up"
            data-delay="0.5"
          >
            <span className="language"></span>
            <b className="link" data-i18n="Россия">
              Россия
            </b>
          </button>
        </div>
      </div>

      {/* блок секций: купить / регион / заработать / документы */}
      <div className="row">
        <div className="col gp gp--md">
          <span
            className="title fs__md fw__bd mg mg__md--btm"
            data-anim="lux-up"
            data-delay="0.1"
            data-i18n="footer.buy_section"
          >
            КУПИТЬ
          </span>
        </div>

        <div className="col gp gp--md">
          <span
            className="title fs__md fw__bd mg mg__md--btm"
            data-anim="lux-up"
            data-delay="0.1"
            data-i18n="footer.region_section"
          >
            РЕГИОН
          </span>

          <div className="region-block col gp gp--xs">
            <span
              className="link s__md fw__rg"
              data-anim="lux-up"
              data-delay="0.2"
              data-i18n="Россия"
            >
              Россия
            </span>

            <div id="languages-ru" className="languages-dropdown row gp gp--xs">
              <a
                href="#"
                className="languages__item link fs__md fw__rg opc opc--50"
                data-anim="fade"
                data-delay="0.28"
                data-lang="ru"
                data-region="ru"
                data-i18n="Русский"
              >
                <span className="flag ru"></span>Русский
              </a>
              <a
                href="#"
                className="languages__item link fs__md fw__rg opc opc--50"
                data-anim="fade"
                data-delay="0.48"
                data-lang="en"
                data-region="ru"
                data-i18n="English"
              >
                <span className="flag en"></span>English
              </a>
            </div>
          </div>
        </div>

        <div className="col gp gp--md">
          <span
            className="title fs__md fw__bd mg mg__md--btm"
            data-i18n="footer.earn_section"
            data-anim="lux-up"
            data-delay="0.1"
          >
            ЗАРАБОТАТЬ
          </span>
          <a
            href="https://bio30.ru/referal"
            className="link fs__md fw__rg opc opc--50 anmt"
            data-i18n="footer.general_info"
            data-anim="lux-up"
            data-delay="0.1"
          >
            Общая информация
          </a>
          <a
            href="https://bio30.ru/settings"
            className="link fs__md fw__rg opc opc--50 anmt"
            data-i18n="footer.my_account"
            data-anim="lux-up"
            data-delay="0.1"
          >
            Мой кабинет
          </a>
        </div>

        <div className="col gp gp--md">
          <span
            className="title fs__md fw__bd mg mg__md--btm"
            data-i18n="footer.documents_section"
            data-anim="lux-up"
            data-delay="0.1"
          >
            ДОКУМЕНТЫ
          </span>
          <a
            href="https://bio30.ru/docs/data"
            className="link fs__md fw__rg opc opc--50 anmt"
            data-i18n="docs.data"
            data-anim="lux-up"
            data-delay="0.2"
          >
            Персональные данные
          </a>
          <a
            href="https://bio30.ru/docs/gdpr"
            className="link fs__md fw__rg opc opc--50 anmt"
            data-i18n="docs.gdpr"
            data-anim="lux-up"
            data-delay="0.3"
          >
            GDPR
          </a>
          <a
            href="https://bio30.ru/docs/confidencial"
            className="link fs__md fw__rg opc opc--50 anmt"
            data-i18n="docs.confidencial"
            data-anim="lux-up"
            data-delay="0.4"
          >
            Конфиденциальность
          </a>
          <a
            href="https://bio30.ru/docs/policy"
            className="link fs__md fw__rg opc opc--50 anmt"
            data-i18n="docs.policy"
            data-anim="lux-up"
            data-delay="0.5"
          >
            Политика
          </a>
          <a
            href="https://bio30.ru/docs/info"
            className="link fs__md fw__rg opc opc--50 anmt"
            data-i18n="docs.info"
            data-anim="lux-up"
            data-delay="0.6"
          >
            Информация
          </a>
          <a
            href="https://bio30.ru/docs/payment"
            className="link fs__md fw__rg opc opc--50 anmt"
            data-i18n="docs.payment"
            data-anim="lux-up"
            data-delay="0.7"
          >
            Оплата
          </a>
          <a
            href="https://bio30.ru/docs/returns"
            className="link fs__md fw__rg opc opc--50 anmt"
            data-i18n="docs.returns"
            data-anim="lux-up"
            data-delay="0.8"
          >
            Возвраты
          </a>
        </div>
      </div>

      {/* нижний правовой блок */}
      <div className="row top pd pd__xxl--top pd__xxl--btm">
        <div className="aside">
          <div className="row ctr gp gp--xs">
            <div className="age"></div>
            <span
              className="text fs__sm fw__rg opc opc--50"
              data-i18n="footer.site_info_adults"
            >
              Для лиц старше 18 лет
            </span>
          </div>
        </div>

        <div className="bside">
          <div className="row ctr rgt gp gp--xs pd pd__lg--rgt">
            <span className="subtitle fs__sm fw__rg">
              <a
                href="https://bio30.ru/docs/data"
                className="subtitle fs__sm fw__rg"
                data-i18n="footer.personal_data_processing"
              >
                Обработка персональных данных
              </a>
            </span>
            <span className="subtitle fs__sm fw__rg">
              <a
                href="https://bio30.ru/docs/confidencial"
                className="subtitle fs__sm fw__rg"
                data-i18n="footer.privacy_policy"
              >
                Политика конфиденциальности
              </a>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;