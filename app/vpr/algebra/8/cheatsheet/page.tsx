"use client";

import React, { useState } from 'react';
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Calculator, Zap, BookOpen, 
  RotateCcw, CheckCircle2, AlertTriangle, 
  Terminal, Hash, Layers, 
  Code, Sparkles, Brain, Lightbulb
} from "lucide-react";
import { cn } from '@/lib/utils';

// --- МИНИ-ИГРА: КОНСТРУКТОР ДИСКРИМИНАНТА ---
const FRAGMENTS = [
  { id: 1, text: "D =", type: "start" },
  { id: 2, text: "b²", type: "val" },
  { id: 3, text: "−", type: "op" },
  { id: 4, text: "4", type: "num" },
  { id: 5, text: "a", type: "val" },
  { id: 6, text: "c", type: "val" },
];
const CORRECT_SEQ = [1, 2, 3, 4, 5, 6];

export default function Algebra8FriendlyCheatsheet() {
  const [seq, setSeq] = useState<number[]>([]);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleFragClick = (id: number) => {
    if (status === 'success') return;
    setSeq(prev => [...prev, id]);
    setStatus('idle');
  };

  const checkResult = () => {
    setStatus(seq.join(',') === CORRECT_SEQ.join(',') ? 'success' : 'error');
  };

  return (
    <div className="min-h-screen bg-[#030303] text-zinc-300 font-sans p-4 md:p-8 selection:bg-brand-cyan/30 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute inset-0 pointer-events-none opacity-5" 
           style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '30px 30px' }}>
      </div>

      <div className="max-w-4xl mx-auto relative z-10">
        
        {/* HEADER */}
        <header className="mb-12 text-center">
          <motion.div 
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-4 py-1.5 rounded-full text-xs font-medium mb-6"
          >
            <Sparkles className="w-4 h-4 text-brand-cyan" /> 
            <span>Помощник по Алгебре • 8 класс • 1 полугодие</span>
          </motion.div>
          <h1 className="text-4xl md:text-6xl font-black text-white mb-4 tracking-tight">
            Algebra <span className="text-brand-cyan">Master</span>
          </h1>
          <p className="text-zinc-500 text-lg">Всё, что нужно для контрольных и ВПР, в одном месте.</p>
        </header>

        {/* TOPIC 1: RATIONAL FRACTIONS */}
        <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                <Layers className="text-brand-pink" /> 1. Рациональные дроби
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="bg-zinc-900/50 border-zinc-800">
                    <CardHeader><CardTitle className="text-sm text-brand-pink">ОДЗ (Это важно!)</CardTitle></CardHeader>
                    <CardContent className="text-sm leading-relaxed">
                        Знаменатель <b>никогда</b> не может быть равен нулю. Если видишь <code className="text-white">A / (x-3)</code>, то <code className="text-brand-pink">x ≠ 3</code>.
                    </CardContent>
                </Card>
                <Card className="bg-zinc-900/50 border-zinc-800">
                    <CardHeader><CardTitle className="text-sm text-brand-pink">Основное свойство</CardTitle></CardHeader>
                    <CardContent className="text-sm">
                        Числитель и знаменатель можно умножать или делить на одно и то же число (кроме нуля). Так мы сокращаем дроби!
                    </CardContent>
                </Card>
            </div>
            {/* Examples */}
            <div className="mt-4 p-4 bg-zinc-950 border border-zinc-800 rounded-xl font-mono text-xs text-zinc-400">
                <p className="mb-2 text-zinc-200">// Примеры операций:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>Умножение: (a/b) * (c/d) = (ac)/(bd)</div>
                    <div>Деление: (a/b) : (c/d) = (ad)/(bc)</div>
                </div>
            </div>
        </section>

        {/* TOPIC 2: SQUARE ROOTS */}
        <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                <Hash className="text-brand-yellow" /> 2. Квадратные корни
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl text-center">
                    <div className="text-xs text-zinc-500 mb-1">Произведение</div>
                    <div className="text-xl font-bold text-white">√a · √b = √ab</div>
                </div>
                <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl text-center">
                    <div className="text-xs text-zinc-500 mb-1">Частное</div>
                    <div className="text-xl font-bold text-white">√a / √b = √(a/b)</div>
                </div>
                <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl text-center">
                    <div className="text-xs text-zinc-500 mb-1">Квадрат корня</div>
                    <div className="text-xl font-bold text-white">(√a)² = a</div>
                </div>
            </div>
            <Card className="bg-yellow-900/10 border-brand-yellow/20">
                <CardContent className="p-4 flex items-start gap-3">
                    <Lightbulb className="text-brand-yellow w-10 h-10 flex-shrink-0" />
                    <div className="text-sm">
                        <p className="font-bold text-white mb-1">Хак: Вынос множителя</p>
                        <p>√50 = √(25 · 2) = 5√2. Всегда ищи внутри корня числа, из которых корень извлекается нацело (4, 9, 16, 25, 36, 49...).</p>
                    </div>
                </CardContent>
            </Card>
        </section>

        {/* TOPIC 3: QUADRATIC EQUATIONS (GAME) */}
        <section className="mb-12">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                <Brain className="text-brand-cyan" /> 3. Квадратные уравнения
            </h2>
            
            {/* GAME BLOCK */}
            <Card className="bg-zinc-900 border-brand-cyan/30 shadow-xl mb-6 overflow-hidden">
              <CardHeader className="bg-brand-cyan/5 border-b border-brand-cyan/10">
                <CardTitle className="text-lg flex items-center gap-2">
                    <Calculator className="w-5 h-5" /> Конструктор Формулы
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <p className="text-sm text-zinc-400 mb-6">Собери формулу Дискриминанта — главного ключа к решению уравнений:</p>

                <div className={cn(
                    "flex items-center justify-center h-20 border-2 rounded-xl mb-6 font-mono text-3xl transition-all",
                    status === 'success' ? "border-green-500 text-green-400 bg-green-500/5" :
                    status === 'error' ? "border-red-500 text-red-500 bg-red-500/5" :
                    "border-zinc-800 bg-black text-zinc-600"
                )}>
                    {seq.map(id => FRAGMENTS.find(f => f.id === id)?.text).join(' ') || "???"}
                </div>

                <div className="flex flex-wrap gap-2 justify-center mb-8">
                    {FRAGMENTS.map(f => (
                        <button
                            key={f.id}
                            onClick={() => handleFragClick(f.id)}
                            disabled={seq.includes(f.id) || status === 'success'}
                            className={cn(
                                "px-5 py-2 rounded-lg border font-bold transition-all",
                                seq.includes(f.id) ? "opacity-20" : "bg-zinc-800 border-zinc-700 hover:border-brand-cyan hover:text-white"
                            )}
                        >
                            {f.text}
                        </button>
                    ))}
                </div>

                <div className="flex justify-center gap-4">
                    <Button variant="ghost" onClick={() => {setSeq([]); setStatus('idle');}} size="sm">Сброс</Button>
                    <Button onClick={checkResult} disabled={seq.length === 0 || status === 'success'} className="bg-brand-cyan text-black font-bold">Проверить</Button>
                </div>
              </CardContent>
            </Card>

            {/* ROOTS LOGIC */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-zinc-900 rounded-xl border-l-4 border-green-500">
                    <div className="font-bold text-white">D {'>'} 0</div>
                    <div className="text-xs text-zinc-500 uppercase mt-1">2 разных корня</div>
                </div>
                <div className="p-4 bg-zinc-900 rounded-xl border-l-4 border-zinc-500">
                    <div className="font-bold text-white">D = 0</div>
                    <div className="text-xs text-zinc-500 uppercase mt-1">1 корень (два совпавших)</div>
                </div>
                <div className="p-4 bg-zinc-900 rounded-xl border-l-4 border-red-500">
                    <div className="font-bold text-white">D {'<'} 0</div>
                    <div className="text-xs text-zinc-500 uppercase mt-1">Корней нет</div>
                </div>
            </div>
        </section>

        {/* TOPIC 4: VIETA'S THEOREM (BONUS) */}
        <section className="mb-16">
            <div className="p-6 bg-gradient-to-br from-indigo-900/20 to-zinc-900 border border-indigo-500/30 rounded-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5"><Brain className="w-32 h-32" /></div>
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <Zap className="text-indigo-400 w-5 h-5" /> Теорема Виета (Чит-код)
                </h3>
                <p className="text-sm text-zinc-400 mb-6 max-w-xl">
                    Для уравнений, где <code className="text-white">a = 1</code> (приведённых), корни можно найти в уме!
                </p>
                <div className="space-y-4 font-mono">
                    <div className="flex items-center gap-4">
                        <span className="text-indigo-400">x₁ + x₂ = −b</span>
                        <span className="text-zinc-600 text-xs">// Сумма корней</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-indigo-400">x₁ · x₂ = c</span>
                        <span className="text-zinc-600 text-xs">// Произведение корней</span>
                    </div>
                </div>
            </div>
        </section>

        {/* TROJAN HORSE: STUDIO INVITE */}
        <div className="bg-white text-black p-8 rounded-none mb-20 flex flex-col md:flex-row items-center gap-8 shadow-[10px_10px_0_rgba(0,194,255,1)]">
            <div className="w-20 h-20 bg-brand-cyan flex items-center justify-center rounded-full shrink-0">
                <Code className="w-10 h-10 text-white" />
            </div>
            <div>
                <h3 className="text-2xl font-black uppercase mb-2">Как создана эта страница?</h3>
                <p className="text-zinc-700 text-sm leading-relaxed mb-6">
                    Эта «шпаргалка» была полностью написана искусственным интеллектом в нашей <b>SuperVibe Studio</b>. 
                    Математика — это база для программирования. Хочешь перестать просто учить формулы и начать создавать свои приложения, игры и ботов прямо со смартфона?
                </p>
                <div className="flex gap-4">
                    <Link href="/repo-xml">
                        <Button className="bg-black text-white hover:bg-zinc-800 font-bold px-6 py-4 rounded-none uppercase text-xs tracking-widest">
                            Попробовать Вайб-Кодинг
                        </Button>
                    </Link>
                    <Link href="/start-training">
                        <Button variant="outline" className="border-black text-black font-bold px-6 py-4 rounded-none uppercase text-xs tracking-widest">
                            Обучение
                        </Button>
                    </Link>
                </div>
            </div>
        </div>

        {/* FOOTER */}
        <footer className="text-center pb-20 text-zinc-700 text-[10px] font-mono uppercase tracking-widest">
            Generated with AI in CyberVibe Studio // First half of 8th Grade Protocol // No copyright, just Vibe.
        </footer>

      </div>
    </div>
  );
}