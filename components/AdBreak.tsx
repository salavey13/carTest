"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, ExternalLink, Zap, Rocket, 
  Terminal, ShieldAlert, Cpu, 
  Target, Activity, ChevronRight 
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

/* 
  === THE PROCESS OF VIBING ===
  
  1. SYSTEM_OVERRIDE VISUALS: 
     - Treats Ad Break as a "System Alert", not a banner. 
     - Uses solid, high-contrast backgrounds (dark:bg-zinc-900) vs pastel. 
     - Uses pure white/light-gray text for maximum readability. 
     - Borders are hard stops (border-zinc-700) to define edges.

  2. HUD TYPOGRAPHY: 
     - Font-mono is mandatory for "System" feel. 
     - Uppercase with tracking-widest simulates tactical/computer interface. 
     - Monospace numbers (tracking-tighter) look like coordinates.

  3. SCANLINES & GLITCH: 
     - Adds CRT scanlines (background-size: 2px) to create texture and contrast.
     - Uses animate-pulse on the icon to simulate "Active Uplink". 
     - The grid overlay adds "interference" visual noise.

  4. ACCENT STRATEGY: 
     - Do not use brand colors that blend in. Use pure Neon: 
       - Green #00ff41 (Success/GO)
       - Cyan #00f3ff (System/Info)
       - Red #ff003c (Error/STOP)
       - These pop against Zinc-900 background.

  5. BUTTON ACTION: 
     - The button is not a "call to action", it's a "system command". 
     - It should look like a terminal key. 
     - Hover effects should be "switch on" states.

  RESULT: The component transforms from an ad into a high-fidelity, 
          cybernetic system interrupt that commands attention without looking like a 
          marketing popup.
*/

const ADS = [
  {
    id: 'strikeball-os-gold',
    icon: <Target className="w-8 h-8 text-red-600" />,
    label: "OPERATIONAL_SITREP",
    title: "ХВАТИТ ИГРАТЬ В СЛЕПУЮ",
    body: (
      <>
        Твои игры в страйкбол — это хаос и споры о попаданиях? 
        <br/><br/>
        Разверни <span className="text-white font-bold underline">Strikeball Tactical OS</span>. 
        Реальное время, захват точек через QR, логистика отрядов и честный счет. 
        <br/><br/>
        <span className="text-red-500 font-mono text-[10px]">/// СТАТУС: БОЕГОТОВНОСТЬ_100%</span>
      </>
    ),
    cta: "КОМАНДОВАТЬ_ПАРАДОМ",
    link: "/strikeball",
    color: "border-red-900/50 bg-black shadow-[0_0_40px_rgba(220,38,38,0.1)]",
    accent: "bg-red-600"
  },
  {
    id: 'cybervibe-shovel-rickroll',
    icon: <Cpu className="w-8 h-8 text-brand-cyan" />,
    label: "SYSTEM_MANIFESTO",
    title: "Я СОЗДАЛ ЭТО НА ТЕЛЕФОНЕ",
    body: (
      <>
        Страница, которую ты сейчас читаешь, была собрана AI-ассистентом, пока я ехал в автобусе. 
        <br/><br/>
        Я не писал код. Я просто "вайбил". 
        В 2025 году программирование — это не знание синтаксиса, а <span className="text-brand-cyan">сила твоего воображения</span>. 
        <br/><br/>
        Хочешь строить свои миры за 15 минут?
      </>
    ),
    cta: "ОТКРЫТЬ_ЛАБОРАТОРИЮ",
    link: "/repo-xml",
    color: "border-brand-cyan/30 bg-black shadow-[0_0_40px_rgba(0,194,255,0.1)]",
    accent: "bg-brand-cyan"
  },
  {
    id: 'syndicate-opportunity',
    icon: <Terminal className="w-8 h-8 text-brand-green" />,
    label: "MARKET_DISRUPTION",
    title: "СХЕМА СИНДИКАТА",
    body: (
      <>
        Пока твои одноклассники качают героев в RPG, мы качаем реальные кэш-машины. 
        <br/><br/>
        От парсинга маркетплейсов до AI-автоматизации локального бизнеса. 
        Наш <span className="text-brand-green font-bold">Кибер-Плейбук</span> — это не теория. Это алгоритмы заработка звёзд.
        <br/><br/>
        <span className="italic text-zinc-500">Доступ ограничен уровнем доступа.</span>
      </>
    ),
    cta: "ВСТУПИТЬ В РЕЙД",
    link: "/wblanding",
    color: "border-brand-green/30 bg-black shadow-[0_0_40px_rgba(34,197,94,0.1)]",
    accent: "bg-brand-green"
  }
];

export const AdBreak = () => {
  const [isVisible, setIsVisible] = useState(true);
  const [ad, setAd] = useState(ADS[0]);

  useEffect(() => {
    setAd(ADS[Math.floor(Math.random() * ADS.length)]);
  }, []);

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, y: 10 }}
        className={cn(
          "relative my-16 p-px overflow-hidden rounded-none border", 
          ad.color.split(' ')[0]
        )}
      >
        {/* CRT SCANLINE OVERLAY: Adds texture and forces contrast perception */}
        <div className="absolute inset-0 z-0 pointer-events-none"
             style={{ backgroundImage: 'linear-gradient(rgba(0,0,0,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.2) 1px, transparent 1px)', backgroundSize: '4px 4px', backgroundPosition: 'top center' }}>
        </div>

        <div className={cn("relative z-10 p-8 flex flex-col md:flex-row gap-8 items-center", ad.color.split(' ').slice(1).join(' '))}>
          
          {/* VISUAL UNIT */}
          <div className="flex-shrink-0 flex flex-col items-center justify-center w-24 h-24 border border-zinc-800 bg-zinc-950 relative group">
             <div className="absolute -top-1 -left-1 w-2 h-2 border-t border-l border-zinc-500" />
             <div className="absolute -bottom-1 -right-1 w-2 h-2 border-b border-r border-zinc-500" />
             {ad.icon}
             {/* MONOSPACE SYSTEM STATUS TEXT */}
             <div className="mt-2 text-[8px] font-mono text-zinc-600 tracking-widest animate-pulse dark:text-zinc-600">UPLINK_READY</div>
          </div>

          {/* INTEL UNIT */}
          <div className="flex-1 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-3 mb-4">
                <span className="text-[10px] font-black text-zinc-500 tracking-[0.3em] uppercase">
                  {ad.label}
                </span>
                <div className="h-px bg-zinc-800 flex-grow hidden md:block" />
                <Activity className="w-3 h-3 text-zinc-700" />
            </div>
            
            {/* HUD MESSAGE TEXT: High contrast body */}
            <h3 className="text-3xl font-black text-white mb-4 italic tracking-tighter uppercase dark:text-white">
                {ad.title}
            </h3>
            
            <div className="text-zinc-400 text-sm leading-relaxed mb-8 font-mono dark:text-zinc-500">
                {ad.body}
            </div>

            {/* COMMAND BUTTON */}
            <div className="flex flex-col sm:flex-row items-center gap-4">
                <Link href={ad.link} className="w-full sm:w-auto">
                    <button className={cn(
                        "w-full group flex items-center justify-center gap-3 px-8 py-4 font-black text-xs tracking-widest transition-all uppercase border-2",
                        ad.accent === 'bg-red-600' ? "bg-red-600 border-white text-white hover:bg-white hover:text-black" :
                        ad.accent === 'bg-brand-cyan' ? "bg-brand-cyan border-white text-black hover:bg-black hover:text-brand-cyan" :
                        "bg-brand-green border-white text-black hover:bg-black hover:text-brand-green"
                    )}>
                        {/* TEXT IS WHITE */}
                        <span className="dark:text-white">{ad.cta}</span> 
                        <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform text-white" />
                    </button>
                </Link>
                
                {/* DISMISS COMMAND: Looks like a system close button */}
                <button 
                  onClick={() => setIsVisible(false)}
                  className="text-[10px] font-mono text-zinc-600 hover:text-white uppercase tracking-widest border border-zinc-600 hover:border-zinc-400 bg-transparent hover:bg-zinc-900 dark:text-zinc-400 dark:hover:text-white dark:border-zinc-500 dark:hover:bg-zinc-900 transition-colors"
                >
                  [ IGNORE_SIG ]
                </button>
            </div>
          </div>

          {/* DECORATIVE SCANLINES */}
          <div className="absolute inset-0 pointer-events-none opacity-5 bg-[linear-gradient(rgba(18,16,16,0.5)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_2px,3px_100%]" />
        </div>

        {/* OLED BLACK MARGINS */}
        <div className="absolute top-0 right-0 p-2 text-[8px] font-mono text-zinc-800 pointer-events-none">
            SEC_ENCRYPT: AES-256
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default AdBreak;