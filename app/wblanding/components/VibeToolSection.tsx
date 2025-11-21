"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Brain, Zap, Skull, Crown, Rocket, 
  Bot, Terminal, Code2, Fingerprint, 
  Network, Cpu, ChevronRight 
} from "lucide-react";
import { cn } from "@/lib/utils";

// --- Data: The Karpathy Autonomy Spectrum ---
const AUTONOMY_LEVELS = [
  {
    id: 1,
    label: "LV.1: СКРИПТ-КИДДИ",
    range: "100% AI / 0% HUMAN",
    title: "One-Click Fix",
    desc: "Ты не кодишь. Ты тыкаешь пальцем. «Почини картинку». «Поменяй цвет». AI генерит, делает PR, ты просто жмешь Merge.",
    icon: Zap,
    color: "text-brand-cyan",
    borderColor: "border-brand-cyan",
    bgGradient: "from-brand-cyan/20 to-transparent"
  },
  {
    id: 4,
    label: "LV.4: ИНЖЕНЕР",
    range: "60% AI / 40% HUMAN",
    title: "The Co-Pilot Loop",
    desc: "Ты даешь контекст: «Возьми этот компонент и перепиши на Server Actions». Ты читаешь код, AI пишет бойлерплейт. Ты — Архитектор.",
    icon: Terminal,
    color: "text-brand-purple",
    borderColor: "border-brand-purple",
    bgGradient: "from-brand-purple/20 to-transparent"
  },
  {
    id: 7,
    label: "LV.7: НЕО",
    range: "30% AI / 70% HUMAN",
    title: "Data Master",
    desc: "AI пишет сложные SQL-запросы и миграции, но ТОЛЬКО ТЫ знаешь структуру данных. Ты валидируешь логику. Ставки высоки.",
    icon: DatabaseIcon,
    color: "text-brand-pink",
    borderColor: "border-brand-pink",
    bgGradient: "from-brand-pink/20 to-transparent"
  },
  {
    id: 10,
    label: "LV.10: ДЕМИУРГ",
    range: "ARCHITECT MODE",
    title: "System Creator",
    desc: "Ты разворачиваешь свой инстанс. Свои LLM. Свои агенты. Ты больше не пользователь, ты владелец сети.",
    icon: Crown,
    color: "text-brand-gold",
    borderColor: "border-brand-gold",
    bgGradient: "from-brand-gold/20 to-transparent"
  }
];

// --- Icons Helper ---
function DatabaseIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  );
}

export const VibeToolSection = () => {
  const [activeLevel, setActiveLevel] = useState(AUTONOMY_LEVELS[0]);

  return (
    <section className="py-24 md:py-32 bg-black relative overflow-hidden border-t border-white/10">
      {/* --- Background Matrix --- */}
      <div className="absolute inset-0 bg-grid-pattern opacity-[0.07] pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-brand-deep-indigo/20 blur-[120px] rounded-full pointer-events-none" />
      
      <div className="max-w-7xl mx-auto px-4 relative z-10">
        
        {/* --- Header --- */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-20"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-brand-red-orange/30 bg-brand-red-orange/10 text-brand-red-orange font-mono text-xs md:text-sm mb-6 tracking-widest uppercase animate-pulse">
            <Skull className="w-4 h-4" /> Vibe Coding Methodology
          </div>
          
          <h2 className="text-4xl md:text-7xl font-black text-white mb-6 font-orbitron leading-[1.1]">
            ЭТО НЕ <span className="text-transparent bg-clip-text bg-gradient-to-r from-gray-500 to-gray-700">IDE</span>.<br/>
            ЭТО <span className="gta-vibe-text-effect text-shadow-neon">ЭКЗОСКЕЛЕТ</span>.
          </h2>
          
          <p className="text-xl text-gray-400 max-w-4xl mx-auto font-light leading-relaxed">
            Мы не заменяем программистов. Мы превращаем их в <span className="text-white font-bold">Тони Старков</span>.
            <br className="hidden md:block"/>
            Слайдер автономии (Karpathy) — это твой путь от новичка до архитектора системы.
          </p>
        </motion.div>

        {/* --- Interactive Autonomy HUD --- */}
        <div className="grid lg:grid-cols-12 gap-8 items-center mb-24">
          
          {/* Left: The Menu (Skill Tree) */}
          <div className="lg:col-span-4 flex flex-col gap-3">
            {AUTONOMY_LEVELS.map((level) => (
              <button
                key={level.id}
                onClick={() => setActiveLevel(level)}
                className={cn(
                  "relative group flex items-center gap-4 p-4 rounded-xl border transition-all duration-300 text-left overflow-hidden",
                  activeLevel.id === level.id 
                    ? `bg-zinc-900 ${level.borderColor} shadow-[0_0_20px_-5px_rgba(0,0,0,0.5)]`
                    : "bg-black border-zinc-800 hover:border-zinc-600 opacity-60 hover:opacity-100"
                )}
              >
                {/* Active Glow Background */}
                {activeLevel.id === level.id && (
                  <div className={cn("absolute inset-0 opacity-10 bg-gradient-to-r", level.bgGradient)} />
                )}

                <div className={cn(
                  "w-12 h-12 rounded-lg flex items-center justify-center border bg-black shrink-0 transition-colors",
                  activeLevel.id === level.id ? `${level.color} ${level.borderColor}` : "text-gray-500 border-zinc-700"
                )}>
                  <level.icon className="w-6 h-6" />
                </div>
                
                <div>
                  <div className={cn(
                    "font-orbitron font-bold text-sm tracking-wider mb-1 transition-colors",
                    activeLevel.id === level.id ? level.color : "text-gray-400"
                  )}>
                    {level.label}
                  </div>
                  <div className="text-xs font-mono text-gray-500 group-hover:text-gray-300 transition-colors">
                    {level.range}
                  </div>
                </div>

                {activeLevel.id === level.id && (
                  <ChevronRight className={cn("ml-auto w-5 h-5 animate-pulse", level.color)} />
                )}
              </button>
            ))}
          </div>

          {/* Right: The Display (Terminal) */}
          <div className="lg:col-span-8 h-full min-h-[400px] relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeLevel.id}
                initial={{ opacity: 0, x: 20, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -20, scale: 0.95 }}
                transition={{ duration: 0.4, ease: "backOut" }}
                className={cn(
                  "h-full rounded-3xl border bg-zinc-950/80 backdrop-blur-xl p-8 md:p-12 flex flex-col justify-center relative overflow-hidden",
                  activeLevel.borderColor
                )}
              >
                {/* Decor */}
                <div className={cn("absolute top-0 right-0 w-64 h-64 blur-[100px] opacity-20 rounded-full bg-gradient-to-b", activeLevel.bgGradient)} />
                <Fingerprint className={cn("absolute bottom-8 right-8 w-32 h-32 opacity-5", activeLevel.color)} />

                <div className="relative z-10">
                  <div className={cn("font-mono text-sm mb-4 uppercase tracking-widest opacity-70", activeLevel.color)}>
                    /// SYSTEM STATUS: {activeLevel.range}
                  </div>
                  
                  <h3 className="text-4xl md:text-5xl font-bold text-white mb-6 font-orbitron">
                    {activeLevel.title}
                  </h3>
                  
                  <p className="text-xl md:text-2xl text-gray-300 leading-relaxed font-light max-w-2xl">
                    {activeLevel.desc}
                  </p>

                  {/* Pseudo-Code / Terminal Effect */}
                  <div className="mt-8 p-4 bg-black/60 rounded-lg border border-white/5 font-mono text-xs md:text-sm text-gray-400">
                    <span className={activeLevel.color}>{">"} initiating_protocol...</span><br/>
                    <span className="text-white">{">"} vibe_engine --level {activeLevel.id}</span><br/>
                    <span className="text-green-500/70">{">"} success. neural_link established.</span>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* --- The Bottom Line --- */}
        <div className="grid md:grid-cols-3 gap-6 pt-10 border-t border-zinc-800">
          <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/50 hover:border-brand-red-orange/30 transition-colors group">
            <Rocket className="w-8 h-8 text-brand-red-orange mb-4 group-hover:translate-x-1 transition-transform" />
            <h4 className="text-lg font-bold text-white mb-2 font-orbitron">Скорость x10</h4>
            <p className="text-sm text-gray-400">Пока конкуренты пишут ТЗ, ты уже деплоишь фикс в прод. Без бюрократии.</p>
          </div>
          <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/50 hover:border-brand-cyan/30 transition-colors group">
            <Bot className="w-8 h-8 text-brand-cyan mb-4 group-hover:translate-x-1 transition-transform" />
            <h4 className="text-lg font-bold text-white mb-2 font-orbitron">Личный Джарвис</h4>
            <p className="text-sm text-gray-400">Бот знает твой код лучше тебя. Он предлагает решения, ты только аппрувишь.</p>
          </div>
          <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/50 hover:border-neon-lime/30 transition-colors group">
            <Code2 className="w-8 h-8 text-neon-lime mb-4 group-hover:translate-x-1 transition-transform" />
            <h4 className="text-lg font-bold text-white mb-2 font-orbitron">Без Vendor Lock</h4>
            <p className="text-sm text-gray-400">Весь код — твой. Забирай репозиторий, хости где хочешь. Мы даем старт, а не клетку.</p>
          </div>
        </div>

      </div>
    </section>
  );
};