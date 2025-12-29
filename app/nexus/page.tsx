"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { 
  FlaskConical, Terminal, Play, Box, GraduationCap, 
  Brain, Dna, Zap, DollarSign, AlertTriangle, CheckCircle,
  ArrowRight, Activity, ShieldCheck, Wifi
} from "lucide-react";
import { cn } from "@/lib/utils";

// --- Types & Data ---

type SectorStatus = 'trial' | 'live' | 'sandbox' | 'secure';
type RiskLevel = 'zero' | 'low' | 'time';

// Map to handle icons dynamically from string keys
const ICON_MAP: Record<string, React.ElementType> = {
  GraduationCap,
  Box,
  Activity,
  Terminal,
  Brain,
  Dna,
};

interface SystemSector {
  id: string;
  title: string;
  description: string;
  icon: string; // This maps to the ICON_MAP key
  href: string;
  color: string;
  status: SectorStatus;
  risk: RiskLevel;
  metrics: string;
  tag: string;
}

const SECTORS: SystemSector[] = [
  {
    id: 'academy',
    title: 'ПЕСОЧНИЦА: АКАДЕМИЯ',
    description: 'Безопасная среда для отработки навыков. Ошибки не стоят денег, они дают данные.',
    icon: 'GraduationCap',
    href: '/vpr-tests',
    color: 'text-brand-green',
    status: 'trial',
    risk: 'zero',
    metrics: 'Риск: 0%',
    tag: 'ОБУЧЕНИЕ'
  },
  {
    id: 'logistics',
    title: 'ОПС: WMS РЕЙД',
    description: 'Складской учет как игра. Находи потери, получай XTR. Интегрируй с 1С.',
    icon: 'Box',
    href: '/wblanding',
    color: 'text-brand-cyan',
    status: 'live',
    risk: 'time',
    metrics: 'ROI: +21% (сред.)',
    tag: 'ДОКАЗАНО'
  },
  {
    id: 'dr',
    title: 'СОЦСЕТЬ: DRINK ROYALE',
    description: 'Гео-триггерная игра в городе. Найди врага, победи, получи скидку на чек.',
    icon: 'Activity',
    href: '/strikeball',
    color: 'text-red-400',
    status: 'live',
    risk: 'low',
    metrics: 'Вход: Бесплатно',
    tag: 'ВИРАЛЬНО'
  },
  {
    id: 'studio',
    title: 'ДЕВ: BOT FORGE',
    description: 'Создай Telegram-бота за 10 минут. Песочница, релиз, монетизация.',
    icon: 'Terminal',
    href: '/repo-xml',
    color: 'text-brand-red-orange',
    status: 'sandbox',
    risk: 'time',
    metrics: 'Время деплоя: <10м',
    tag: 'СОЗДАВАТЬ'
  },
  {
    id: 'cybervibe',
    title: 'СТРАТ: CYBERVIBE',
    description: 'Стратегическая сессия. PDF-дорожная карта за 1 час вместо месяца планирования.',
    icon: 'Brain',
    href: '/cybervibe',
    color: 'text-brand-purple',
    status: 'secure',
    risk: 'time',
    metrics: 'Стоимость: 0₽ (Плати после победы)',
    tag: 'РЕЗУЛЬТАТ'
  },
  {
    id: 'bio',
    title: 'БИО: СЕЛФ-ТРЕКИНГ',
    description: '3-дневный эксперимент. Измени один фактор (сон, добавка), засеки результат.',
    icon: 'Dna',
    href: '/bio30',
    color: 'text-neon-lime',
    status: 'trial',
    risk: 'low',
    metrics: 'Длительность: 72ч',
    tag: 'НАУКА'
  }
];

// --- Components ---

const SectorCard = ({ sector, index }: { sector: SystemSector; index: number }) => {
  const [isHovered, setIsHovered] = useState(false);
  const IconComponent = ICON_MAP[sector.icon]; // Retrieve the Lucide component

  const statusColors: Record<SectorStatus, string> = {
    trial: "bg-emerald-500",
    live: "bg-red-500",
    sandbox: "bg-orange-500",
    secure: "bg-blue-500",
  };

  const riskLabels: Record<RiskLevel, { text: string; color: string }> = {
    zero: { text: "НУЛЕВОЙ РИСК", color: "text-emerald-400 border-emerald-500/30" },
    low: { text: "НИЗКИЙ РИСК", color: "text-yellow-400 border-yellow-500/30" },
    time: { text: "ИНВЕСТИЦИЯ ВРЕМЕНИ", color: "text-cyan-400 border-cyan-500/30" }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.5 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
    >
      <Link href={sector.href} className="block h-full">
        <div className={cn(
          "relative h-full bg-black/80 border border-zinc-800 p-6 backdrop-blur-md transition-all duration-300 overflow-hidden group",
          isHovered ? "border-opacity-100 shadow-[0_0_40px_-10px_rgba(255,255,255,0.1)]" : "border-opacity-30"
        )}>
          {/* Scanline Overlay */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-0 pointer-events-none bg-[length:100%_2px,3px_100%] opacity-20 group-hover:opacity-30" />

          {/* Content */}
          <div className="relative z-10 flex flex-col h-full">
            {/* Header */}
            <div className="flex justify-between items-start mb-4">
              <div className={cn("p-3 rounded bg-zinc-900 border border-white/5 group-hover:border-white/20 transition-colors", sector.color)}>
                {/* Render Lucide Icon directly */}
                {IconComponent && <IconComponent className="w-6 h-6" />}
              </div>
              <div className={cn(
                "px-2 py-1 text-[9px] font-mono font-bold border rounded uppercase tracking-wider",
                riskLabels[sector.risk].color
              )}>
                {riskLabels[sector.risk].text}
              </div>
            </div>

            {/* Text */}
            <h3 className="text-xl font-black text-white font-orbitron mb-2 group-hover:translate-x-1 transition-transform">
              {sector.title}
            </h3>
            <p className="text-sm text-zinc-400 mb-6 line-clamp-2 font-mono leading-relaxed">
              {sector.description}
            </p>

            {/* Footer */}
            <div className="mt-auto pt-4 border-t border-white/5 flex justify-between items-center">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-zinc-600">Метрики</span>
                <span className="text-xs font-mono text-zinc-300">{sector.metrics}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-[9px] uppercase font-black text-zinc-700 group-hover:text-white transition-colors">
                  {sector.tag}
                </span>
                <ArrowRight className={cn("w-4 h-4 transform transition-transform duration-300", isHovered ? "translate-x-1" : "translate-x-0")} />
              </div>
            </div>
          </div>

          {/* Glow Effect */}
          <div className={cn(
            "absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity pointer-events-none",
            `bg-gradient-to-br ${sector.color.replace('text-', 'from-')}/20 to-transparent`
          )} />
        </div>
      </Link>
    </motion.div>
  );
};

// Live System Feed Component (Живой Лог)
const LiveSystemFeed = () => {
  const [logs, setLogs] = useState<string[]>([
    "> СИСТЕМА: VIBE_NEXUS ИНИЦИАЛИЗИРОВАНА...",
    "> СЕТЬ: СОЕДИНЕНИЕ УСТАНОВЛЕНО [56.32.44.01]",
    "> АВТОР: ОБНАРУЖЕН АНОНИМНЫЙ ПОЛЬЗОВАТЕЛЬ",
  ]);

  const messages = [
    "> ПОБЕДА: USER_ID:992A НАШЕЛ +4500₽ НА СКЛАДЕ",
    "> СИНХР: ИГРА DRINK ROYALE #442 НАЧАЛАСЬ",
    "> АЛЕРТ: ОБНАРУЖЕН МАЛЫЙ ЗАПАС [СЕКТОР_7]",
    "> ПОБЕДА: USER_ID:BB1Q ЗАВЕРШИЛ БИО-ТЕСТ",
    "> МИНИНГ: 500 ТОКЕНОВ XTR СГЕНЕРИРОВАНО",
    "> СЕТЬ: 4 НОВЫХ ОПЕРАТОРА В СЕТИ"
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      const randomMsg = messages[Math.floor(Math.random() * messages.length)];
      const timestamp = new Date().toLocaleTimeString('ru-RU', { hour12: false });
      setLogs(prev => [`[${timestamp}] ${randomMsg}`, ...prev].slice(0, 8));
    }, 3500); // Новая запись каждые 3.5 сек
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-black border border-zinc-800 p-4 rounded-lg font-mono text-xs overflow-hidden relative">
      <div className="flex items-center gap-2 mb-3 border-b border-zinc-900 pb-2">
        <Wifi className="w-3 h-3 text-green-500 animate-pulse" />
        <span className="text-zinc-500 font-bold uppercase tracking-widest text-[10px]">Живой Лог Системы</span>
      </div>
      <div className="space-y-1.5 h-32 overflow-y-auto no-scrollbar">
        <AnimatePresence mode='popLayout'>
          {logs.map((log, i) => (
            <motion.div
              key={`${log}-${i}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0.5, x: 10 }}
              className={cn(
                "truncate",
                log.includes("ПОБЕДА") ? "text-brand-cyan" : 
                log.includes("АЛЕРТ") ? "text-red-400" : "text-zinc-500"
              )}
            >
              {log}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default function NexusPage() {
  const [protocolStatus, setProtocolStatus] = useState<'idle' | 'accepted' | 'deferred'>('idle');
  
  const handleAccept = () => {
    setProtocolStatus('accepted');
    // В реальном приложении здесь откроется модальное окно или произойдет редирект
  };

  const handleDefer = () => {
    setProtocolStatus('deferred');
    // Логика для напоминания позже
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-brand-cyan/30 overflow-x-hidden relative">
      
      {/* Background Grid */}
      <div className="fixed inset-0 z-0 opacity-15 pointer-events-none" 
           style={{ 
             backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px)', 
             backgroundSize: '30px 30px'
           }} 
      />
      
      <main className="relative z-10 max-w-7xl mx-auto px-4 py-12 md:py-20">
        
        {/* Header */}
        <header className="mb-16 border-b border-white/5 pb-12">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6"
          >
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-2 w-2 bg-brand-cyan rounded-full animate-ping" />
                <span className="text-[10px] font-mono text-brand-cyan tracking-[0.3em] uppercase">
                  СТАТУС СИСТЕМЫ: ОПЕРАТИВЕН
                </span>
              </div>
              <h1 className="text-6xl md:text-9xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-white/10 font-orbitron tracking-tighter leading-none mb-4">
                VIBE<span className="text-brand-cyan italic">NEXUS</span>
              </h1>
              <p className="text-lg md:text-xl text-zinc-400 max-w-2xl font-mono border-l-2 border-brand-purple pl-4">
                Выберите реальность. <br/>
                <span className="text-white">Платите только за результат (Pay After Win).</span>
              </p>
            </div>
            
            {/* Live Stats Block */}
            <div className="hidden md:flex flex-col gap-2 text-right">
               <div className="text-3xl font-black font-orbitron text-white">12 402</div>
               <div className="text-[10px] uppercase text-zinc-500 tracking-widest">Активных Экспериментов</div>
               <div className="h-px w-32 bg-zinc-800 ml-auto mt-2" />
               <div className="text-2xl font-black font-orbitron text-brand-green">840%</div>
               <div className="text-[10px] uppercase text-zinc-500 tracking-widest">Средний ROI</div>
            </div>
          </motion.div>
        </header>

        {/* Live Feed (Visual Engagement) */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mb-12"
        >
          <LiveSystemFeed />
        </motion.div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-20">
          {SECTORS.map((sector, index) => (
            <SectorCard key={sector.id} sector={sector} index={index} />
          ))}
        </div>

        {/* The "PACT" Section: Activation Protocol */}
        <motion.section 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="relative max-w-4xl mx-auto"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-brand-purple/20 to-brand-cyan/20 blur-[100px] -z-10" />
          
          <div className="bg-zinc-900 border border-white/10 p-1 rounded-2xl backdrop-blur-xl">
            <div className="bg-black rounded-xl p-8 md:p-12 border border-zinc-800 relative overflow-hidden">
              {/* Decoration */}
              <div className="absolute top-0 right-0 p-32 bg-brand-cyan/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />

              {protocolStatus === 'idle' && (
                <div className="text-center space-y-8">
                  <div className="inline-flex items-center justify-center p-4 rounded-full bg-zinc-900 border border-zinc-800 mb-4">
                    <FlaskConical className="w-8 h-8 text-brand-purple" />
                  </div>
                  
                  <h2 className="text-3xl md:text-4xl font-black font-orbitron text-white">
                    ИНИЦИИРОВАТЬ ПЕРВЫЙ ЭКСПЕРИМЕНТ?
                  </h2>
                  
                  <p className="text-zinc-400 max-w-xl mx-auto leading-relaxed">
                    У нас нет подписок. Есть только результаты. 
                    Выберите путь и докажите, что он работает. 
                    Если результата нет — <span className="text-white font-bold">вы ничего не платите</span>.
                  </p>

                  <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
                    <button
                      onClick={handleAccept}
                      className="group relative px-8 py-4 bg-white text-black font-black text-sm tracking-widest uppercase rounded hover:bg-brand-cyan transition-colors overflow-hidden"
                    >
                      <span className="relative z-10 flex items-center gap-2">
                        ПРИНЯТЬ ПРОТОКОЛ <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </span>
                    </button>
                    
                    <button
                      onClick={handleDefer}
                      className="px-8 py-4 bg-transparent border border-zinc-700 text-zinc-400 font-bold text-sm tracking-widest uppercase rounded hover:border-zinc-500 hover:text-white transition-colors"
                    >
                      ОТЛОЖИТЬ (Смотреть)
                    </button>
                  </div>
                  
                  <div className="flex justify-center gap-6 mt-8">
                     <div className="flex items-center gap-2 text-[10px] text-zinc-600 uppercase tracking-wider">
                        <ShieldCheck className="w-3 h-3" /> Без Карты
                     </div>
                     <div className="flex items-center gap-2 text-[10px] text-zinc-600 uppercase tracking-wider">
                        <CheckCircle className="w-3 h-3" /> Отмена В任何时候
                     </div>
                  </div>
                </div>
              )}

              {protocolStatus === 'accepted' && (
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-center py-12"
                >
                  <div className="inline-block p-4 rounded-full bg-brand-green/20 border border-brand-green/50 mb-6">
                    <CheckCircle className="w-12 h-12 text-brand-green" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-4">ДОСТУП РАЗРЕШЕН</h3>
                  <p className="text-zinc-400 mb-8">Выберите сектор выше для начала работы.</p>
                  <button 
                    onClick={() => setProtocolStatus('idle')}
                    className="text-xs text-zinc-600 hover:text-white underline"
                  >
                    СБРОСИТЬ ПРОТОКОЛ
                  </button>
                </motion.div>
              )}

              {protocolStatus === 'deferred' && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-12"
                >
                  <div className="inline-block p-4 rounded-full bg-zinc-800 mb-6">
                    <AlertTriangle className="w-8 h-8 text-zinc-500" />
                  </div>
                  <h3 className="text-2xl font-bold text-zinc-300 mb-4">ПРОТОКОЛ ПРИОСТАНОВЛЕН</h3>
                  <p className="text-zinc-500 mb-8">Мы напомним вам через 48 часов. Без спама.</p>
                  <button 
                    onClick={() => setProtocolStatus('idle')}
                    className="px-6 py-2 border border-zinc-700 text-white text-xs uppercase tracking-wider hover:bg-zinc-800"
                  >
                    ПЕРЕЗАПУСК
                  </button>
                </motion.div>
              )}

            </div>
          </div>
        </motion.section>

      </main>
    </div>
  );
}