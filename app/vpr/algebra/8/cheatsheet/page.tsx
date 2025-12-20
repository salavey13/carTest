"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Calculator, Zap, Target, ShieldAlert, 
  RotateCcw, CheckCircle2, AlertTriangle, 
  Terminal, Hash, MoveDown, Crosshair,
  Lock, Key, Activity
} from "lucide-react";
import { cn } from '@/lib/utils';

// --- MISSION 1: QUADRATIC DECODER ---
// Task: Assemble the Discriminant Formula
const DISCRIMINANT_FRAGMENTS = [
  { id: 1, text: "D =", type: "start" },
  { id: 2, text: "b²", type: "val" },
  { id: 3, text: "-", type: "op" },
  { id: 4, text: "4", type: "num" },
  { id: 5, text: "a", type: "val" },
  { id: 6, text: "c", type: "val" },
];
const DISCRIMINANT_CORRECT = [1, 2, 3, 4, 5, 6];

// --- MISSION 2: RADICAL OPS (Square Roots) ---
const ROOT_RULES = [
  { id: 201, formula: "√a · √b", result: "√(a·b)", desc: "Слияние сигналов" },
  { id: 202, formula: "√a / √b", result: "√(a/b)", desc: "Разделение частот" },
  { id: 203, formula: "(√a)²", result: "a", desc: "Дешифровка (Полный сброс)" },
];

export default function Algebra8Cheatsheet() {
  const [seq, setSeq] = useState<number[]>([]);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleFragClick = (id: number) => {
    if (status === 'success') return;
    setSeq(prev => [...prev, id]);
    setStatus('idle');
  };

  const checkFormula = () => {
    setStatus(seq.join(',') === DISCRIMINANT_CORRECT.join(',') ? 'success' : 'error');
  };

  return (
    <div className="min-h-screen bg-[#000000] text-blue-400 font-mono p-4 md:p-8 selection:bg-blue-900 selection:text-white relative overflow-hidden">
      {/* Tactical Background Grid */}
      <div className="absolute inset-0 pointer-events-none opacity-20" 
           style={{ backgroundImage: 'linear-gradient(#1e293b 1px, transparent 1px), linear-gradient(90deg, #1e293b 1px, transparent 1px)', backgroundSize: '30px 30px' }}>
      </div>

      <div className="max-w-4xl mx-auto relative z-10">
        
        {/* HEADER SITREP */}
        <header className="mb-12 text-center border-b border-blue-900/50 pb-8">
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="inline-flex items-center gap-2 border border-blue-500/30 bg-blue-950/20 px-4 py-1 rounded-full text-[10px] tracking-[0.3em] uppercase mb-4"
          >
            <Activity className="w-3 h-3 animate-pulse" /> ALGEBRA_UNIT_8.0 // READY
          </motion.div>
          <h1 className="text-5xl md:text-7xl font-black text-white mb-2 tracking-tighter italic">
            ROOT_EXTRACTOR
          </h1>
          <p className="text-zinc-500 uppercase text-xs tracking-widest">Квадратные корни • Уравнения • Рациональные числа</p>
        </header>

        {/* MISSION 1: QUADRATIC DIAGNOSTIC */}
        <Card className="bg-black border-blue-600/30 shadow-[0_0_50px_rgba(37,99,235,0.1)] mb-12 rounded-none border-t-2">
          <CardHeader className="bg-blue-950/10">
            <CardTitle className="flex items-center gap-3 text-white text-xl font-black uppercase tracking-tighter">
              <Crosshair className="w-6 h-6 text-blue-500" /> 
              Mission 1: Сборка Дискриминанта
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="mb-8 bg-zinc-950 p-4 border-l-4 border-blue-600 font-mono text-sm text-zinc-400">
               <p className="mb-1 text-blue-500"># СИТУАЦИЯ:</p>
               <p>"Для захвата корней уравнения <span className="text-white">ax² + bx + c = 0</span> необходимо вычислить определитель <span className="text-white">D</span>. Собери формулу."</p>
            </div>

            {/* FORMULA BUFFER */}
            <div className={cn(
              "flex items-center justify-center h-20 px-6 border-2 mb-8 font-mono text-3xl transition-all",
              status === 'success' ? "bg-blue-900/20 border-blue-400 text-white shadow-[0_0_20px_rgba(59,130,246,0.3)]" :
              status === 'error' ? "bg-red-900/20 border-red-500 text-red-400" :
              "bg-black border-zinc-800 text-zinc-600"
            )}>
              <span className="tracking-widest">
                {seq.map(id => DISCRIMINANT_FRAGMENTS.find(f => f.id === id)?.text).join(' ') || "WAITING_FOR_INPUT..."}
              </span>
            </div>

            {/* INTERFACE KEYS */}
            <div className="flex flex-wrap gap-3 justify-center mb-10">
              {DISCRIMINANT_FRAGMENTS.map((frag) => (
                <button
                  key={frag.id}
                  onClick={() => handleFragClick(frag.id)}
                  disabled={seq.includes(frag.id) || status === 'success'}
                  className={cn(
                    "px-6 py-3 border-2 font-black transition-all",
                    seq.includes(frag.id) 
                      ? "border-zinc-900 text-zinc-800 bg-zinc-950 opacity-20" 
                      : "border-blue-900/50 text-blue-500 hover:border-blue-400 hover:bg-blue-600 hover:text-black active:scale-95"
                  )}
                >
                  {frag.text}
                </button>
              ))}
            </div>

            <div className="flex justify-center gap-6">
              <Button onClick={() => {setSeq([]); setStatus('idle');}} variant="ghost" className="text-zinc-600 hover:text-white uppercase text-xs">
                <RotateCcw className="w-4 h-4 mr-2" /> Reset_Buffer
              </Button>
              <Button onClick={checkFormula} disabled={status === 'success' || seq.length === 0} className="bg-white text-black font-black px-10 rounded-none hover:bg-blue-500 uppercase italic">
                {status === 'success' ? "DEPLOY_OK" : "Verify_Signal"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* MISSION 2: RADICAL THEORY */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-20">
            <div className="space-y-4">
                <h2 className="text-2xl font-black text-white flex items-center gap-3 uppercase italic">
                    <Key className="text-blue-500" /> Протоколы Корней
                </h2>
                {ROOT_RULES.map((rule) => (
                    <div key={rule.id} className="bg-zinc-900/30 border border-blue-900/30 p-4 hover:border-blue-500/50 transition-colors group">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-zinc-600 text-[10px] font-bold tracking-widest">RULE_{rule.id}</span>
                            <span className="text-blue-500 text-xs font-bold group-hover:animate-pulse">{rule.desc}</span>
                        </div>
                        <div className="text-2xl font-bold text-white tracking-widest">
                            {rule.formula} <span className="text-blue-600">→</span> {rule.result}
                        </div>
                    </div>
                ))}
            </div>

            {/* SYSTEM 2 PAUSE: THE ROOTS DETERMINANT */}
            <div className="bg-zinc-950 border border-zinc-800 p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-2 opacity-10"><Target className="w-20 h-20" /></div>
                <h3 className="text-white font-bold mb-4 flex items-center gap-2 uppercase text-sm">
                    <ShieldAlert className="text-red-500 w-4 h-4" /> Анализ Корней (D)
                </h3>
                <div className="space-y-6 relative z-10">
                    <div className="flex items-center gap-4">
                        <div className="bg-blue-600 text-black font-black px-2 py-1 text-xs">D &gt; 0</div>
                        <span className="text-zinc-400 text-xs">2 Сигнала обнаружено (2 корня)</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="bg-zinc-600 text-black font-black px-2 py-1 text-xs">D = 0</div>
                        <span className="text-zinc-400 text-xs">1 Сигнал (Корни совпали)</span>
                    </div>
                    <div className="flex items-center gap-4 opacity-50">
                        <div className="bg-red-900 text-white font-black px-2 py-1 text-xs">D &lt; 0</div>
                        <span className="text-red-500 text-xs">СИГНАЛ_ОТСУТСТВУЕТ (Нет корней)</span>
                    </div>
                </div>
            </div>
        </div>

        {/* --- THE CREATOR'S KITCHEN PROMPT --- */}
        <div className="bg-blue-600/10 border border-blue-500/40 rounded-3xl p-8 mb-20">
            <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="w-24 h-24 flex-shrink-0 bg-blue-500 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(59,130,246,0.6)]">
                    <Hash className="text-black w-12 h-12" />
                </div>
                <div>
                    <h3 className="text-2xl font-black text-white uppercase mb-2">Хочешь стать Архитектором?</h3>
                    <p className="text-zinc-400 text-sm leading-relaxed mb-6">
                        Ты только что прошел <b>Алгебру 8</b>. Это не просто цифры — это логика, которая управляет миром. 
                        Ты можешь использовать эту логику, чтобы строить свои приложения в <b>SuperVibe Studio</b>.
                    </p>
                    <Link href="/repo-xml">
                        <Button className="bg-blue-600 hover:bg-blue-500 text-white font-black px-8 py-6 rounded-xl transition-all hover:scale-105 uppercase tracking-widest">
                            Открыть Лабораторию Кода
                        </Button>
                    </Link>
                </div>
            </div>
        </div>

      </div>
    </div>
  );
}