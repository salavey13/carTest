"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, Zap, Rocket, GraduationCap, Flame } from 'lucide-react';
import Link from 'next/link';

// --- AD CONTENT DATA ---
const ADS = [
  {
    id: 'hostinger-style',
    icon: <Globe className="w-6 h-6 text-purple-400" />,
    title: "Твой код никто не видит?",
    body: (
      <>
        Ты выучил Python, написал бота, но он работает только на твоем ноуте? 
        <br/><br/>
        <strong>Знакомо.</strong> В 2025 году, если твоего кода нет в облаке — его не существует. 
        Забудь про сложные настройки серверов. 
        <span className="text-white font-bold"> Cyber Vibe </span> деплоит твои проекты одной командой.
        Никаких "тысяч строк конфигов". Просто <code>git push</code>.
        <br/><br/>
        Зачем платить админам, если ты сам себе админ?
      </>
    ),
    cta: "ЗАДЕПЛОИТЬ БЕСПЛАТНО",
    link: "/start-training",
    color: "from-purple-900/40 to-indigo-900/40 border-purple-500/30"
  },
  {
    id: 'hubspot-style',
    icon: <Rocket className="w-6 h-6 text-orange-400" />,
    title: "Стартап в 7 классе?",
    body: (
      <>
        Пока другие зубрят параграфы, 14-летний парень из Казани запустил AI-бота для подсчета калорий и поднял <strong>24 миллиона</strong>.
        <br/><br/>
        Как? Он не изобретал велосипед. Он просто использовал готовые API.
        <br/>
        В нашем <strong>Кибер-Плейбуке</strong> мы разобрали 7 реальных схем: от парсинга Wildberries до Telegram-магазинов.
        Хватит учиться "в стол". Учись зарабатывать.
      </>
    ),
    cta: "СКАЧАТЬ ПЛЕЙБУК",
    link: "/wblanding",
    color: "from-orange-900/40 to-red-900/40 border-orange-500/30"
  },
  {
    id: 'hoonigan-style',
    icon: <Flame className="w-6 h-6 text-yellow-400" />,
    title: "BLACK FRIDAY КАЖДЫЙ ДЕНЬ!",
    body: (
      <>
        Скидки? Нет. <strong>ХАЛЯВА.</strong>
        <br/><br/>
        Мы раздаем доступ к закрытым уровням. Обычно это стоит 99XP, но сегодня — <strong>0</strong>. 
        Потому что я так сказал! Ахаха!
        <br/>
        Новые скины для аватара, доступ к VIP-серверам, секретные шпаргалки по физике. 
        Не тупи. Забирай, пока админ не проснулся.
        <br/><br/>
        Если ты ждешь знака — ЭТО ОН.
      </>
    ),
    cta: "ЛУТАТЬ",
    link: "/nexus",
    color: "from-yellow-900/40 to-amber-900/40 border-yellow-500/30"
  }
];

import { Globe } from 'lucide-react'; // Fix missing import

export const AdBreak = () => {
  const [isVisible, setIsVisible] = useState(true);
  const [ad, setAd] = useState(ADS[0]);

  // Randomize ad on mount to avoid hydration mismatch, but for now just pick one deterministic or use effect
  useEffect(() => {
    setAd(ADS[Math.floor(Math.random() * ADS.length)]);
  }, []);

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className={`relative my-12 p-6 rounded-2xl border ${ad.color} bg-gradient-to-br shadow-2xl overflow-hidden`}
      >
        {/* Background Noise */}
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none"></div>
        
        {/* Close Button */}
        <button 
          onClick={() => setIsVisible(false)}
          className="absolute top-4 right-4 text-white/30 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        <div className="flex flex-col md:flex-row gap-6 items-start relative z-10">
          {/* Visual Side */}
          <div className="hidden md:flex flex-col items-center justify-center w-32 h-32 bg-black/40 rounded-xl border border-white/10 shrink-0">
             {ad.icon}
             <span className="text-[10px] text-gray-500 mt-2 font-mono uppercase">Sponsor</span>
          </div>

          {/* Content Side */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
                <span className="bg-white/10 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-widest border border-white/10">
                    Рекламная Пауза
                </span>
            </div>
            
            <h3 className="text-2xl font-black text-white mb-4 uppercase italic tracking-tight">
                {ad.title}
            </h3>
            
            <div className="text-gray-300 text-sm leading-relaxed mb-6 font-serif">
                {ad.body}
            </div>

            <Link href={ad.link}>
                <button className="group flex items-center gap-2 bg-white text-black px-6 py-3 rounded-lg font-bold text-sm hover:scale-105 transition-transform shadow-lg shadow-white/10">
                    {ad.cta} <ExternalLink className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
            </Link>
          </div>
        </div>

      </motion.div>
    </AnimatePresence>
  );
};