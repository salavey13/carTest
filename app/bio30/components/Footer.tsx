"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useBio30ThemeFix } from "../hooks/useBio30ThemeFix";
import { useStaggerFadeIn } from "../hooks/useStaggerFadeIn";

const Footer: React.FC = () => {
  useBio30ThemeFix();

  const { ref, controls, container, child } = useStaggerFadeIn(20, 0.08);
  const docBase = "https://bio30.ru/docs";

  return (
    <motion.footer
      ref={ref}
      variants={container}
      initial="hidden"
      animate={controls}
      className="footer"
    >
      <div className="row ctr pd pd__xxl--top pd pd__xxl--btm">
        <motion.div variants={child} className="row">
          <a
            href="mailto:privet@bio30.ru"
            className="btn btn--blk btn__primary"
          >
            privet@bio30.ru
          </a>
        </motion.div>

        <motion.div variants={child} className="row ctr rgt">
          <div className="social gp gp--lg mg mg__lg--rgt">
            <motion.a
              variants={child}
              href="https://t.me/BIO30_chat"
              className="telegram btn btn--blk btn__primary"
              aria-label="Telegram"
            >
              📱
            </motion.a>
            <motion.a
              variants={child}
              href="https://vk.com/club231438011"
              className="vk btn btn--blk btn__primary"
              aria-label="VK"
            >
              🎵
            </motion.a>
            <motion.a
              variants={child}
              href="https://dzen.ru/id/6868db59568f80115b12a631"
              className="dzen btn btn--blk btn__primary"
              aria-label="Dzen"
            >
              📝
            </motion.a>
          </div>
          <motion.button
            variants={child}
            id="language-btn"
            className="btn btn--blk btn__primary"
            aria-haspopup="true"
            aria-expanded="false"
          >
            <span className="language"></span>
            <b className="link">Россия</b>
          </motion.button>
        </motion.div>
      </div>

      <div className="row">
        {/* КУПИТЬ */}
        <motion.div variants={child} className="col gp gp--md">
          <span className="title fs__md fw__bd mg mg__md--btm">КУПИТЬ</span>
        </motion.div>

        {/* РЕГИОН */}
        <motion.div variants={child} className="col gp gp--md">
          <span className="title fs__md fw__bd mg mg__md--btm">РЕГИОН</span>
          <div className="region-block col gp gp--xs">
            <span className="link fs__md fw__rg">Россия</span>
            <div id="languages-ru" className="languages-dropdown row gp gp--xs">
              <motion.a
                variants={child}
                href="#"
                className="languages__item link fs__md fw__rg opc opc--50"
                data-lang="ru"
                data-region="ru"
              >
                <span className="flag ru"></span>
                Русский
              </motion.a>
              <motion.a
                variants={child}
                href="#"
                className="languages__item link fs__md fw__rg opc opc--50"
                data-lang="en"
                data-region="ru"
              >
                <span className="flag en"></span>
                English
              </motion.a>
            </div>
          </div>
        </motion.div>

        {/* ЗАРАБОТАТЬ */}
        <motion.div variants={child} className="col gp gp--md">
          <span className="title fs__md fw__bd mg mg__md--btm">ЗАРАБОТАТЬ</span>
          <Link
            href="/bio30/referal"
            className="link fs__md fw__rg opc opc--50 anmt"
          >
            Общая информация
          </Link>
          <Link
            href="/profile"
            className="link fs__md fw__rg opc opc--50 anmt"
          >
            Мой кабинет
          </Link>
        </motion.div>

        {/* ДОКУМЕНТЫ */}
        <motion.div variants={child} className="col gp gp--md">
          <span className="title fs__md fw__bd mg mg__md--btm">ДОКУМЕНТЫ</span>
          {[
            "data",
            "gdpr",
            "confidencial",
            "policy",
            "info",
            "payment",
            "returns",
          ].map((slug, i) => (
            <motion.a
              key={slug}
              variants={child}
              href={`${docBase}/${slug}`}
              className="link fs__md fw__rg opc opc--50 anmt"
            >
              {slug.toUpperCase()}
            </motion.a>
          ))}
        </motion.div>
      </div>

      <div className="row top pd pd__xxl--top pd pd__xxl--btm">
        <motion.div variants={child} className="aside">
          <div className="row ctr gp gp--xs">
            <div className="age">18+</div>
            <span className="text fs__sm fw__rg opc opc--50">Для лиц старше 18 лет</span>
          </div>
        </motion.div>
        <motion.div variants={child} className="bside">
          <div className="row ctr rgt gp gp--xs pd pd__lg--rgt">
            <Link href={`${docBase}/data`} className="subtitle fs__sm fw__rg">
              Обработка персональных данных
            </Link>
            <Link href={`${docBase}/confidencial`} className="subtitle fs__sm fw__rg">
              Политика конфиденциальности
            </Link>
          </div>
        </motion.div>
      </div>
    </motion.footer>
  );
};

export default Footer;