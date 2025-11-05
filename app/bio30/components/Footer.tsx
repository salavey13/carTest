"use client";

import React from "react";
import Link from "next/link";
import { useBio30ThemeFix } from "../hooks/useBio30ThemeFix";

const Footer: React.FC = () => {
  const docBase = "https://bio30.ru/docs";
  useBio30ThemeFix();

  return (
    <footer data-anim="fade" data-delay="0.1">
      <div className="row ctr pd pd__xxl--top pd__xxl--btm">
        <div className="row">
          <a href="mailto:privet@bio30.ru" className="btn btn--blk btn__primary" data-anim="lux-up" data-delay="0.1">
            privet@bio30.ru
          </a>
        </div>
        <div className="row ctr rgt">
          <div className="social gp gp--lg mg mg__lg--rgt">
            <a href="https://t.me/BIO30_chat" className="telegram btn btn--blk btn__primary" data-anim="lux-up" data-delay="0.2"></a>
            <a href="https://vk.com/club231438011" className="vk btn btn--blk btn__primary" data-anim="lux-up" data-delay="0.3"></a>
            <a href="https://dzen.ru/id/6868db59568f80115b12a631" className="dzen btn btn--blk btn__primary" data-anim="lux-up" data-delay="0.4"></a>
          </div>
          <button id="language-btn" className="btn btn--blk btn__primary" aria-haspopup="true" aria-expanded="false" data-anim="lux-up" data-delay="0.5">
            <span className="language"></span>
            <b className="link">Россия</b>
          </button>
        </div>
      </div>
      <div className="row">
        <div className="col gp gp--md">
          <span className="title fs__md fw__bd mg mg__md--btm" data-anim="lux-up" data-delay="0.1">КУПИТЬ</span>
        </div>
        <div className="col gp gp--md">
          <span className="title fs__md fw__bd mg mg__md--btm" data-anim="lux-up" data-delay="0.1">РЕГИОН</span>
          <div className="region-block col gp gp--xs">
            <span className="link s__md fw__rg" data-anim="lux-up" data-delay="0.2">Россия</span>
            <div id="languages-ru" className="languages-dropdown row gp gp--xs">
              <a href="#" className="languages__item link fs__md fw__rg opc opc--50" data-lang="ru" data-region="ru" data-anim="fade" data-delay="0.28">
                <span className="flag ru"></span>
                Русский
              </a>
              <a href="#" className="languages__item link fs__md fw__rg opc opc--50" data-lang="en" data-region="ru" data-anim="fade" data-delay="0.48">
                <span className="flag en"></span>
                English
              </a>
            </div>
          </div>
        </div>
        <div className="col gp gp--md">
          <span className="title fs__md fw__bd mg mg__md--btm" data-anim="lux-up" data-delay="0.1">ЗАРАБОТАТЬ</span>
          <Link href="/bio30/referal" className="link fs__md fw__rg opc opc--50 anmt" data-anim="lux-up" data-delay="0.1">Общая информация</Link>
          <Link href="/profile" className="link fs__md fw__rg opc opc--50 anmt" data-anim="lux-up" data-delay="0.1">Мой кабинет</Link>
        </div>
        <div className="col gp gp--md">
          <span className="title fs__md fw__bd mg mg__md--btm" data-anim="lux-up" data-delay="0.1">ДОКУМЕНТЫ</span>
          <a href="/docs/data" className="link fs__md fw__rg opc opc--50 anmt" data-anim="lux-up" data-delay="0.2"></a>
          <a href="/docs/gdpr" className="link fs__md fw__rg opc opc--50 anmt" data-anim="lux-up" data-delay="0.3"></a>
          <a href="/docs/confidencial" className="link fs__md fw__rg opc opc--50 anmt" data-anim="lux-up" data-delay="0.4"></a>
          <a href="/docs/policy" className="link fs__md fw__rg opc opc--50 anmt" data-anim="lux-up" data-delay="0.5"></a>
          <a href="/docs/info" className="link fs__md fw__rg opc opc--50 anmt" data-anim="lux-up" data-delay="0.6"></a>
          <a href="/docs/payment" className="link fs__md fw__rg opc opc--50 anmt" data-anim="lux-up" data-delay="0.7"></a>
          <a href="/docs/returns" className="link fs__md fw__rg opc opc--50 anmt" data-anim="lux-up" data-delay="0.8"></a>
        </div>
      </div>
      <div className="row top pd pd__xxl--top pd__xxl--btm">
        <div className="aside">
          <div className="row ctr gp gp--xs">
            <div className="age"></div>
            <span className="text fs__sm fw__rg opc opc--50"></span>
          </div>
        </div>
        <div className="bside">
          <div className="row ctr rgt gp gp--xs pd pd__lg--rgt">
            <span className="subtitle fs__sm fw__rg">
              <a href="/docs/data" className="subtitle fs__sm fw__rg">Обработка персональных данных</a>
            </span>
            <span className="subtitle fs__sm fw__rg">
              <a href="/docs/confidencial" className="subtitle fs__sm fw__rg">Политика конфиденциальности</a>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;