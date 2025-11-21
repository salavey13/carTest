"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Brain, Zap, Skull, Crown, Rocket, 
  Bot, Terminal, Code2, Fingerprint, 
  ShieldAlert, ChevronRight, Server, Construction 
} from "lucide-react";
import { cn } from "@/lib/utils";

// --- Custom Glitch Title Component ---
const GlitchText = ({ text }: { text: string }) => {
  return (
    <div className="relative inline-block group">
      <span className="relative z-10">{text}</span>
      <span className="absolute top-0 left-0 -z-10 w-full h-full text-brand-red-orange opacity-70 animate-glitch-anim-1 group-hover:translate-x-1">
        {text}
      </span>
      <span className="absolute top-0 left-0 -z-10 w-full h-full text-brand-cyan opacity-70 animate-glitch-anim-2 group-hover:-translate-x-1">
        {text}
      </span>
    </div>
  );
};

// --- Data: The Warehouse Autonomy Spectrum ---
const AUTONOMY_LEVELS = [
  {
    id: 1,
    label: "LV.1: КОСМЕТИЧЕСКИЙ РЕМОНТ",
    role: "ОПЕРАТОР",
    title: "Fix It Yourself",
    desc: "Бесит, что кнопка «Принять» слишком маленькая? Или цвет текста не виден на сканере? Ты говоришь боту: «Сделай кнопку красной». Он делает. МойСклад за это попросит 50к и 3 месяца.",
    task: "Задача: UI/UX Правки",
    icon: Zap,
    color: "text-brand-cyan",
    borderColor: "border-brand-cyan",
    bgGradient: "from-brand-cyan/20 to-transparent",
    terminalOutput: "> AI: Style updated. Button size increased 150%. Deploying..."
  },
  {
    id: 4,
    label: "LV.4: НОВАЯ ЛОГИКА",
    role: "ИНЖЕНЕР",
    title: "Custom Features",
    desc: "Нужно поле «Срок годности»? Или чтобы при сканировании брака бот матерился в чат? Ты описываешь логику. AI пишет код. Ты получаешь фичу, которой нет у конкурентов.",
    task: "Задача: Бизнес-логика",
    icon: Construction,
    color: "text-brand-purple",
    borderColor: "border-brand-purple",
    bgGradient: "from-brand-purple/20 to-transparent",
    terminalOutput: "> AI: Added 'expiration_date' column. Updated scan handler. Logic applied."
  },
  {
    id: 7,
    label: "LV.7: ХОЗЯИН ДАННЫХ",
    role: "НЕО",
    title: "Deep Integration",
    desc: "Твои данные — твои правила. Настрой сложный расчет зарплаты грузчикам: «5 рублей за коробку, но если уронил — минус 500». AI генерит SQL и бэкенд.",
    task: "Задача: Payroll & API",
    icon: Brain,
    color: "text-brand-pink",
    borderColor: "border-brand-pink",
    bgGradient: "from-brand-pink/20 to-transparent",
    terminalOutput: "> AI: Calculated payroll for Shift #492. Total: 4250 RUB. Sent to Telegram."
  },
  {
    id: 10,
    label: "LV.10: СУВЕРЕНИТЕТ",
    role: "АРХИТЕКТОР",
    title: "Self-Hosted God Mode",
    desc: "Ты перерос нас? Забирай код. Поднимай свой сервер. Отключайся от нашего облака. Ты больше не платишь никому. Ты владеешь средством производства.",
    task: "Задача: Полная Независимость",
    icon: Server,
    color: "text-brand-gold",
    borderColor: "border-brand-gold",
    bgGradient: "from-brand-gold/20 to-transparent",
    terminalOutput: "> SYSTEM: Forking Repository... Deploying to Client Server... GOODBYE."
  }
];

export const VibeToolSection = () => {
  const [activeLevel, setActiveLevel] = useState(AUTONOMY_LEVELS[0]);

  return (
    <section className="py-24 md:py-32 bg-black relative overflow-hidden border-t border-white/10">
      
      {/* --- Background Atmosphere --- */}
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-brand-red-orange/10 blur-[150px] rounded-full pointer-events-none animate-pulse-slow" />
      
      <div className="max-w-7xl mx-auto px-4 relative z-10">
        
        {/* --- Header --- */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-20"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-brand-red-orange/30 bg-brand-red-orange/10 text-brand-red-orange font-mono text-xs md:text-sm mb-6 tracking-widest uppercase animate-pulse">
            <ShieldAlert className="w-4 h-4" /> VIBE TOOLZ: DEV-PLATFORM
          </div>
          
          <h2 className="text-4xl md:text-6xl lg:text-7xl font-black text-white mb-8 font-orbitron leading-[1.1] uppercase">
            МОЙСКЛАД — ЭТО <span className="text-zinc-600 line-through decoration-red-600 decoration-4">ТЮРЬМА</span>.<br/>
            ЭТО — ТВОЯ <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-red-orange via-brand-gold to-brand-yellow">
              <GlitchText text="ЗАТОЧКА" />
            </span>.
          </h2>
          
          <p className="text-xl text-gray-400 max-w-4xl mx-auto font-light leading-relaxed">
            Владелец бизнеса не должен ждать, пока разработчики "освободятся". 
            <br className="hidden md:block"/>
            С Vibe Toolz ты меняешь свой складской софт так же легко, как отправляешь голосовое.
          </p>
        </motion.div>

        {/* --- Interactive Interface --- */}
        <div className="grid lg:grid-cols-12 gap-6 lg:gap-10 items-stretch mb-24">
          
          {/* Left: Level Selector */}
          <div className="lg:col-span-5 flex flex-col gap-3">
            {AUTONOMY_LEVELS.map((level) => (
              <button
                key={level.id}
                onClick={() => setActiveLevel(level)}
                className={cn(
                  "relative group flex items-center gap-4 p-5 rounded-xl border transition-all duration-300 text-left overflow-hidden h-full",
                  activeLevel.id === level.id 
                    ? `bg-zinc-900 ${level.borderColor} shadow-[0_0_20px_-5px_rgba(0,0,0,0.5)]`
                    : "bg-black border-zinc-800 hover:border-zinc-600 opacity-60 hover:opacity-100"
                )}
              >
                {/* Active Gradient Overlay */}
                {activeLevel.id === level.id && (
                  <div className={cn("absolute inset-0 opacity-10 bg-gradient-to-r", level.bgGradient)} />
                )}

                <div className={cn(
                  "w-14 h-14 rounded-lg flex items-center justify-center border bg-black shrink-0 transition-colors font-bold text-xl font-orbitron",
                  activeLevel.id === level.id ? `${level.color} ${level.borderColor}` : "text-gray-600 border-zinc-800"
                )}>
                  {level.id}
                </div>
                
                <div className="flex-1">
                  <div className={cn(
                    "font-orbitron font-bold text-sm md:text-base tracking-wider mb-1 transition-colors uppercase",
                    activeLevel.id === level.id ? level.color : "text-gray-400"
                  )}>
                    {level.label}
                  </div>
                  <div className="text-xs font-mono text-gray-500 group-hover:text-gray-300 transition-colors uppercase">
                    Статус: {level.role}
                  </div>
                </div>

                {activeLevel.id === level.id && (
                  <ChevronRight className={cn("w-6 h-6 animate-pulse", level.color)} />
                )}
              </button>
            ))}
          </div>

          {/* Right: The Terminal Display */}
          <div className="lg:col-span-7 h-full min-h-[450px] relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeLevel.id}
                initial={{ opacity: 0, x: 20, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -20, scale: 0.95 }}
                transition={{ duration: 0.3, ease: "circOut" }}
                className={cn(
                  "h-full rounded-3xl border bg-zinc-950/90 backdrop-blur-2xl p-8 md:p-10 flex flex-col relative overflow-hidden shadow-2xl",
                  activeLevel.borderColor
                )}
              >
                {/* Decorative Elements */}
                <div className={cn("absolute top-0 right-0 w-96 h-96 blur-[120px] opacity-15 rounded-full bg-gradient-to-b pointer-events-none", activeLevel.bgGradient)} />
                <activeLevel.icon className={cn("absolute bottom-6 right-6 w-40 h-40 opacity-5 pointer-events-none", activeLevel.color)} />

                <div className="relative z-10 flex flex-col h-full justify-between">
                  <div>
                    <div className={cn("font-mono text-xs mb-6 uppercase tracking-widest opacity-80 flex items-center gap-2", activeLevel.color)}>
                      <span className="w-2 h-2 rounded-full bg-current animate-pulse"/>
                      /// ACCESS GRANTED: {activeLevel.task}
                    </div>
                    
                    <h3 className="text-3xl md:text-5xl font-black text-white mb-6 font-orbitron uppercase leading-tight">
                      {activeLevel.title}
                    </h3>
                    
                    <p className="text-lg text-gray-300 leading-relaxed font-light border-l-4 border-white/10 pl-6">
                      {activeLevel.desc}
                    </p>
                  </div>

                  {/* Terminal Effect */}
                  <div className="mt-10 p-5 bg-black rounded-xl border border-white/10 font-mono text-xs md:text-sm shadow-inner">
                    <div className="flex gap-1.5 mb-4">
                      <div className="w-3 h-3 rounded-full bg-red-500/50" />
                      <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                      <div className="w-3 h-3 rounded-full bg-green-500/50" />
                    </div>
                    <div className="space-y-2">
                      <span className="text-gray-500">{">"} initializing_vibe_protocol...</span><br/>
                      <span className={cn(activeLevel.color)}>{">"} accessing_core --level={activeLevel.id}</span><br/>
                      <span className="text-white animate-pulse">{activeLevel.terminalOutput}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* --- The Philosophy --- */}
        <div className="grid md:grid-cols-3 gap-6 pt-12 border-t border-white/10">
          <div className="p-8 rounded-2xl bg-zinc-900/30 border border-white/5 hover:border-brand-red-orange/30 transition-colors group">
            <Rocket className="w-10 h-10 text-brand-red-orange mb-6 group-hover:translate-y-[-5px] transition-transform" />
            <h4 className="text-xl font-bold text-white mb-3 font-orbitron">СКОРОСТЬ СВЕТА</h4>
            <p className="text-gray-400 leading-relaxed">
              Пока 1С внедряет обновление полгода, ты пишешь промпт и получаешь фичу через 3 минуты. Это не честная игра.
            </p>
          </div>
          
          <div className="p-8 rounded-2xl bg-zinc-900/30 border border-white/5 hover:border-brand-cyan/30 transition-colors group">
            <Bot className="w-10 h-10 text-brand-cyan mb-6 group-hover:translate-y-[-5px] transition-transform" />
            <h4 className="text-xl font-bold text-white mb-3 font-orbitron">AI-DEV В ШТАТЕ</h4>
            <p className="text-gray-400 leading-relaxed">
              Тебе не нужен дорогой программист. Бот знает весь твой код. Он не болеет, не спит и не просит прибавки.
            </p>
          </div>
          
          <div className="p-8 rounded-2xl bg-zinc-900/30 border border-white/5 hover:border-neon-lime/30 transition-colors group">
            <Code2 className="w-10 h-10 text-neon-lime mb-6 group-hover:translate-y-[-5px] transition-transform" />
            <h4 className="text-xl font-bold text-white mb-3 font-orbitron">NO VENDOR LOCK</h4>
            <p className="text-gray-400 leading-relaxed">
              Мы даём тебе код. Мы даём тебе базу. Если мы тебе надоедим — ты просто забираешь игрушки и уходишь в свой двор.
            </p>
          </div>
        </div>

      </div>
    </section>
  );
};