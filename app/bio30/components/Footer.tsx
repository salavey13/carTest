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
      className="bg-background border-t border-border mt-16 py-12"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top Row */}
        <div className="flex flex-col sm:flex-row items-center sm:items-center justify-between gap-4 mb-8">
          <motion.div variants={child}>
            <a
              href="mailto:privet@bio30.ru"
              className="inline-flex items-center bg-foreground text-background px-4 py-2 rounded-md hover:bg-opacity-90 transition-colors font-medium"
            >
              privet@bio30.ru
            </a>
          </motion.div>

          <motion.div variants={child} className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2">
              <a
                href="https://t.me/BIO30_chat"
                className="w-10 h-10 rounded-full bg-foreground text-background flex items-center justify-center hover:bg-opacity-90 transition-colors"
                aria-label="Telegram"
              >
                📱
              </a>
              <a
                href="https://vk.com/club231438011"
                className="w-10 h-10 rounded-full bg-foreground text-background flex items-center justify-center hover:bg-opacity-90 transition-colors"
                aria-label="VK"
              >
                🎵
              </a>
              <a
                href="https://dzen.ru/id/6868db59568f80115b12a631"
                className="w-10 h-10 rounded-full bg-foreground text-background flex items-center justify-center hover:bg-opacity-90 transition-colors"
                aria-label="Dzen"
              >
                📝
              </a>
            </div>
            <motion.button
              variants={child}
              id="language-btn"
              className="inline-flex items-center gap-2 bg-foreground text-background px-3 py-2 rounded-md hover:bg-opacity-90 transition-colors font-medium"
              aria-haspopup="true"
              aria-expanded="false"
            >
              <span className="w-5 h-5 rounded-full bg-background"></span>
              <b className="font-medium">Россия</b>
            </motion.button>
          </motion.div>
        </div>

        {/* Main Columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          {/* КУПИТЬ */}
          <motion.div variants={child} className="flex flex-col gap-4">
            <span className="font-bold mb-2 block">КУПИТЬ</span>
          </motion.div>

          {/* РЕГИОН */}
          <motion.div variants={child} className="flex flex-col gap-4">
            <span className="font-bold mb-2 block">РЕГИОН</span>
            <div className="flex flex-col gap-1">
              <span className="font-medium">Россия</span>
              <div className="flex flex-col gap-1 mt-2">
                <a href="#" className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors text-sm">
                  <span className="w-5 h-4 bg-muted rounded-sm"></span>
                  Русский
                </a>
                <a href="#" className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors text-sm">
                  <span className="w-5 h-4 bg-muted rounded-sm"></span>
                  English
                </a>
              </div>
            </div>
          </motion.div>

          {/* ЗАРАБОТАТЬ */}
          <motion.div variants={child} className="flex flex-col gap-4">
            <span className="font-bold mb-2 block">ЗАРАБОТАТЬ</span>
            <Link href="/bio30/referral" className="text-muted-foreground hover:text-primary transition-colors font-medium">
              Общая информация
            </Link>
            <Link href="/profile" className="text-muted-foreground hover:text-primary transition-colors font-medium">
              Мой кабинет
            </Link>
          </motion.div>

          {/* ДОКУМЕНТЫ */}
          <motion.div variants={child} className="flex flex-col gap-4">
            <span className="font-bold mb-2 block">ДОКУМЕНТЫ</span>
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
                className="text-muted-foreground hover:text-primary transition-colors font-medium"
              >
                {slug.toUpperCase()}
              </motion.a>
            ))}
          </motion.div>
        </div>

        {/* Bottom Row */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8 border-t border-border">
          <motion.div variants={child} className="flex items-center gap-2">
            <div className="w-16 h-8 bg-gradient-to-r from-[hsl(var(--brand-red-orange))] to-[hsl(var(--brand-deep-indigo))] rounded-sm flex items-center justify-center text-white font-bold text-xs">
              18+
            </div>
            <span className="text-sm text-muted-foreground">Для лиц старше 18 лет</span>
          </motion.div>
          <motion.div variants={child} className="flex items-center gap-4">
            <Link href={`${docBase}/data`} className="text-sm text-muted-foreground hover:text-primary transition-colors">
              Обработка персональных данных
            </Link>
            <Link href={`${docBase}/confidencial`} className="text-sm text-muted-foreground hover:text-primary transition-colors">
              Политика конфиденциальности
            </Link>
          </motion.div>
        </div>
      </div>
    </motion.footer>
  );
};

export default Footer;