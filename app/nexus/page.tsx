"use client";

import React, { useState, useEffect } from 'react';
import { motion } from "framer-motion";
import Link from "next/link";
import { 
  FlaskVial, Terminal, Play, FaBeer, FaBox, FaGraduationCap, 
  FaTerminal, FaBrain, FaDna, FaBolt, FaSackDollar
} from "lucide-react";
import { cn } from "@/lib/utils";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { useAppContext } from "@/contexts/AppContext";

// --- Types & Data ---

type SectorStatus = 'trial' | 'live' | 'sandbox' | 'available';

interface SystemSector {
  id: string;
  title: string;
  description: string;
  icon: string;
  href: string;
  color: string;
  status: SectorStatus;
  metrics: string;
  filesCount: number;
}

const SECTORS: SystemSector[] = [
  {
    id: 'academy',
    title: 'ПОПРОБУЙ ПЕРВЫМ',
    description: 'Короткие задания: 5–15 минут. Без провалов — только данные.',
    icon: 'FaGraduationCap',
    href: '/vpr-tests',
    color: 'text-brand-green',
    status: 'trial',
    metrics: '✓ Безопасно провалиться',
    filesCount: 0
  },
  {
    id: 'logistics',
    title: 'СКЛАД-РЕЙД (БЕТА)',
    description: 'Запусти командное событие. Мы считаем победы, а не ошибки.',
    icon: 'FaBox',
    href: '/wblanding',
    color: 'text-brand-cyan',
    status: 'live',
    metrics: 'Последняя победа: +4 800₽',
    filesCount: 0
  },
  {
    id: 'dr',
    title: 'DRINK ROYALE',
    description: 'Зови друзей → иди в бар → побеждай через геолокацию.',
    icon: 'FaBeer',
    href: '/strikeball',
    color: 'text-red-400',
    status: 'live',
    metrics: 'Средний смех: 14 раз/матч',
    filesCount: 0
  },
  {
    id: 'studio',
    title: 'СДЕЛАЙ БОТА ЗА 10 МИН',
    description: 'Мы даём песочницу. Ты — реальный релиз.',
    icon: 'FaTerminal',
    href: '/repo-xml',
    color: 'text-brand-red-orange',
    status: 'sandbox',
    metrics: 'Твой первый деплой: < 10 мин',
    filesCount: 0
  },
  {
    id: 'cybervibe',
    title: 'КИБЕРВАЙБ-СЕССИЯ',
    description: '1 час «что если?». Результат — PDF-дорожная карта.',
    icon: 'FaBrain',
    href: '/cybervibe',
    color: 'text-brand-purple',
    status: 'available',
    metrics: 'Стоимость: 0 ₽ (плати после победы)',
    filesCount: 0
  },
  {
    id: 'bio',
    title: 'БИО-ТЕСТ (3 ДНЯ)',
    description: 'Попробуй мелкое изменение (сон, добавка, прогулка). Отслеживай ощущения.',
    icon: 'FaDna',
    href: '/bio30',
    color: 'text-neon-lime',
    status: 'trial',
    metrics: 'Длительность: 72 часа',
    filesCount: 0
  }
];

// --- Components ---

const SectorCard = ({ sector, index }: { sector: SystemSector; index: number }) => {
  const statusColors: Record<SectorStatus, string> = {
    trial: "bg-amber-500",
    live: "bg-green-500",
    sandbox: "bg-purple-500",
    available: "bg-blue-500",
  };

  const statusTexts: Record<SectorStatus, string> = {
    trial: "ПОПРОБУЙ",
    live: "ЖИВО",
    sandbox: "ПЕСОЧНИЦА",
    available: "ДОСТУПНО",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="group relative"
    >
      <Link href={sector.href} className="block h-full">
        <div className={cn(
          "h-full bg-zinc-900/50 border border-white/5 rounded-xl p-6 backdrop-blur-md transition-all duration-300 overflow-hidden",
          "hover:border-opacity-50 hover:bg-zinc-900/80 hover:shadow-[0_0_30px_-10px_rgba(0,0,0,0.5)]",
          `hover:border-${sector.color.split('-')[1]}-500`
        )}>
          {/* Status Dot */}
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <span className={cn(
              "w-2 h-2 rounded-full",
              statusColors[sector.status]
            )} />
            <span className="text-[10px] uppercase font-mono text-zinc-500">
              {statusTexts[sector.status]}
            </span>
          </div>

          {/* Icon */}
          <div className={cn("mb-4 text-4xl", sector.color)}>
            <VibeContentRenderer content={`::${sector.icon}::`} />
          </div>

          {/* Text */}
          <h3 className="text-xl font-bold text-white font-orbitron mb-2 group-hover:text-white transition-colors">
            {sector.title}
          </h3>
          <p className="text-sm text-gray-400 mb-6 line-clamp-2">
            {sector.description}
          </p>

          {/* Footer */}
          <div className="mt-auto pt-4 border-t border-white/5 flex justify-between items-center text-xs font-mono text-zinc-500">
            <span className="opacity-70 group-hover:opacity-100">
              {sector.metrics}
            </span>
          </div>
          
          {/* Hover Glow */}
          <div className={cn(
            "absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity pointer-events-none bg-gradient-to-br",
            sector.color.replace('text-', 'from-')
          )} />
        </div>
      </Link>
    </motion.div>
  );
};

const SystemStats = () => {
  const stats = [
    { label: "САМЫЙ БЫСТРЫЙ ВЫИГРЫШ", val: "12 мин", icon: FaBolt, color: "text-brand-cyan" },
    { label: "ПОСЛЕДНЯЯ ПОБЕДА", val: "+2 300 ₽", icon: FaSackDollar, color: "text-green-400" },
    { label: "ВАШ СТАТУС", val: "ГОТОВ ПРОБОВАТЬ", icon: FlaskVial, color: "text-brand-purple" },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
      {stats.map((stat, i) => (
        <div key={i} className="bg-black/40 border border-white/10 p-4 rounded-lg flex items-center gap-4">
          <div className={cn("text-2xl", stat.color)}>
            <stat.icon className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">{stat.label}</div>
            <div className="text-lg font-bold text-white font-orbitron">{stat.val}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default function NexusPage() {
  const { user } = useAppContext();
  const [firstWinFeedback, setFirstWinFeedback] = useState<string | null>(null);

  // Для логгирования в аналитику (например, PostHog, Plausible) — только на клиенте
  useEffect(() => {
    // Можно добавить: if (firstWinFeedback) track('first_experiment_started')
  }, [firstWinFeedback]);

  const handleFirstWin = () => {
    setFirstWinFeedback("✅ Отлично! Теперь ты в игре. Следующий шаг — выбери эксперимент выше.");
    // Если нужна аналитика — вызовите track() здесь, например:
    // window.plausible?.('first_experiment_click');
  };

  const handleNotToday = () => {
    setFirstWinFeedback("Хорошо! Через пару дней напомним — без спама.");
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-brand-cyan/30 overflow-x-hidden relative">
      
      {/* Grid Background */}
      <div className="fixed inset-0 z-0 opacity-20 pointer-events-none" 
           style={{ 
             backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px)', 
             backgroundSize: '40px 40px',
             transform: 'perspective(500px) rotateX(20deg) scale(1.5) translateY(-100px)'
           }} 
      />
      
      <main className="relative z-10 max-w-7xl mx-auto px-4 py-12 md:py-20">
        
        {/* Header */}
        <header className="text-center mb-16">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/20 bg-white/5 backdrop-blur-sm mb-6"
          >
            <FlaskVial className="w-4 h-4 text-brand-purple animate-pulse" />
            <span className="text-xs font-mono text-gray-300">ВАШ ЭКСПЕРИМЕНТ — В РЕЖИМЕ ОЖИДАНИЯ</span>
          </motion.div>
          
          <h1 className="text-5xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-white/10 font-orbitron mb-6 tracking-tighter">
            YOUR<span className="text-brand-cyan"> EXPERIMENT</span> HUB
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Попробуй → Учись → Выиграй → Повтори.<br/>
            Без настройки. Без риска. Только <span className="text-brand-green font-bold">реальные победы</span>.
          </p>
        </header>

        <SystemStats />

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-20">
          {SECTORS.map((sector, index) => (
            <SectorCard key={sector.id} sector={sector} index={index} />
          ))}
        </div>

        {/* Real Wins */}
        <div className="border-t border-white/10 pt-12">
          <div className="flex flex-col md:flex-row justify-between items-end gap-6">
            <div>
              <h2 className="text-2xl font-bold font-orbitron mb-2 flex items-center gap-3">
                <Terminal className="w-6 h-6 text-brand-purple" /> 
                РЕАЛЬНЫЕ ЭКСПЕРИМЕНТЫ (ОТ ВАШИХ ДРУЗЕЙ)
              </h2>
              <p className="text-sm text-gray-500 font-mono">
                Не теория. Только доказательства.
              </p>
            </div>
            <Link href="/expmind">
              <div className="group flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-brand-purple to-brand-cyan rounded-lg border border-transparent hover:border-white transition-all cursor-pointer">
                <span className="text-sm font-bold text-black group-hover:text-white">Почему эксперименты побеждают планы</span>
                <Play className="w-4 h-4 text-black group-hover:text-white group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          </div>
          
          <div className="mt-6 bg-black p-4 rounded-lg border border-white/10 font-mono text-xs text-gray-400 h-48 overflow-y-auto simple-scrollbar">
            <p className="mb-1"><span className="text-green-500">✓</span> [ВЫИГРЫШ] Алекс запустил Drink Royale → заполнил слот во вторник у Антанты → получил +3 200₽ в фонд тимбилдинга.</p>
            <p className="mb-1"><span className="text-green-500">✓</span> [ВЫИГРЫШ] Лена прошла Bio Test (холодный душ утром) → +2ч фокуса → залила фичу за 1 день.</p>
            <p className="mb-1"><span className="text-green-500">✓</span> [ВЫИГРЫШ] Олег запустил Склад-Рейд → нашёл 7 пропавших джинс → сэкономил 21 000₽.</p>
            <p className="mb-1"><span className="text-amber-500">→</span> [ДАЛЕЕ] Попробуй любой эксперимент. Если нет победы → $0. Никогда.</p>
            <p>_</p>
          </div>
        </div>

        {/* Mini PACT — полностью SSR-safe */}
        <div className="mt-16 bg-zinc-950/60 border border-brand-purple/30 rounded-xl p-6 max-w-2xl mx-auto">
          <div className="flex items-start gap-4">
            <div className="mt-1 w-8 h-8 rounded-full bg-brand-purple flex items-center justify-center flex-shrink-0">
              <FlaskVial className="w-4 h-4 text-black" />
            </div>
            <div>
              <h3 className="font-orbitron font-bold text-lg text-brand-purple mb-2">Твой первый эксперимент (2 минуты):</h3>
              <p className="text-sm text-gray-300 mb-4">
                Открой Drink Royale → Отсканируй QR-код в любом баре → Узнай, кто «враг рядом».
              </p>
              
              {firstWinFeedback ? (
                <div className="mb-4 p-3 bg-black/30 border border-brand-green/30 rounded text-sm text-brand-green font-mono">
                  {firstWinFeedback}
                </div>
              ) : null}

              <div className="flex gap-3">
                <button
                  onClick={handleFirstWin}
                  className="px-5 py-2 bg-brand-green hover:bg-green-400 text-black font-bold text-sm rounded uppercase tracking-wider transition-colors"
                >
                  Я ВЫИГРАЛ!
                </button>
                <button
                  onClick={handleNotToday}
                  className="px-5 py-2 bg-zinc-800 hover:bg-zinc-700 text-gray-300 font-bold text-sm rounded uppercase tracking-wider transition-colors"
                >
                  Не сегодня
                </button>
              </div>
              <p className="text-[10px] text-gray-500 mt-3 italic">
                Это не тест. Это твой первый шаг в экспериментальное мышление.
              </p>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}