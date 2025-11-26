"use client";

import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import Image from "next/image";
import { Calculator, Zap, TrendingUp, X, Divide } from "lucide-react";

// Промпты для генерации изображений
const imageUrls: Record<string, string> = {
  // Prompt: "Graph of linear function y = kx + b, neon coordinate system on dark grid, highlighting slope k and intercept b"
  'alg7-linear': 'https://placehold.co/600x400/0a0a0a/00ffaa?text=y=kx+b+(График)',
  
  // Prompt: "Algebraic Powers visualization, a^n concept, glowing mathematical symbols floating in cyberspace"
  'alg7-powers': 'https://placehold.co/600x400/100a20/aa00ff?text=Свойства+Степеней',
  
  // Prompt: "Short multiplication formulas (a+b)^2 visual breakdown, geometric square dissection style, blueprint aesthetic"
  'alg7-formulas': 'https://placehold.co/600x400/001030/00aaff?text=ФСУ+(Квадрат+суммы)',
};

export default function Algebra7Cheatsheet() {
  return (
    <div className="min-h-screen bg-slate-950 text-blue-100 p-4 md:p-8 font-mono relative overflow-x-hidden">
      {/* Grid Background */}
      <div className="absolute inset-0 z-0 opacity-10" 
           style={{ backgroundImage: 'linear-gradient(#1e293b 1px, transparent 1px), linear-gradient(90deg, #1e293b 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
      </div>

      <div className="max-w-5xl mx-auto relative z-10">
        
        <header className="mb-10 border-b border-blue-800 pb-6">
            <h1 className="text-5xl font-black text-white mb-2 tracking-tighter">
                ALGEBRA <span className="text-blue-500">SYSTEMS</span>
            </h1>
            <p className="text-blue-400">7th Grade Module // Functions & Polynomials</p>
        </header>

        {/* SECTION 1: LINEAR FUNCTION (THE BOSS) */}
        <section className="mb-12">
            <div className="flex items-center gap-3 mb-4">
                <TrendingUp className="text-green-400 w-8 h-8" />
                <h2 className="text-3xl font-bold text-white">Линейная Функция (y = kx + b)</h2>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8">
                <Card className="bg-slate-900/90 border-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.15)]">
                    <CardContent className="p-6">
                        <div className="space-y-6">
                            <div className="p-4 bg-blue-950/30 rounded border border-blue-800">
                                <span className="text-4xl font-bold text-white">y = </span>
                                <span className="text-4xl font-bold text-green-400" title="Коэффициент наклона">k</span>
                                <span className="text-4xl font-bold text-white">x + </span>
                                <span className="text-4xl font-bold text-pink-500" title="Свободный член (сдвиг)">b</span>
                            </div>
                            
                            <ul className="space-y-3 text-lg">
                                <li className="flex items-start gap-3">
                                    <span className="font-bold text-green-400 text-xl">k</span>
                                    <div>
                                        <p className="font-bold text-white">Угол наклона (Slope)</p>
                                        <p className="text-slate-400 text-sm">Если k > 0 — график растёт 📈</p>
                                        <p className="text-slate-400 text-sm">Если k &lt; 0 — график падает 📉</p>
                                    </div>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="font-bold text-pink-500 text-xl">b</span>
                                    <div>
                                        <p className="font-bold text-white">Пересечение с Y (Intercept)</p>
                                        <p className="text-slate-400 text-sm">Точка, где прямая режет ось Y (0, b).</p>
                                    </div>
                                </li>
                            </ul>
                        </div>
                    </CardContent>
                </Card>
                <div className="relative rounded-xl overflow-hidden border-2 border-slate-700 group">
                    <Image src={imageUrls['alg7-linear']} alt="График функции" width={600} height={400} className="object-cover w-full h-full opacity-80 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-2 text-center text-xs text-white">
                        График — прямая линия. Для построения достаточно 2 точки!
                    </div>
                </div>
            </div>
        </section>

        {/* SECTION 2: POWERS (ENERGY LEVELS) */}
        <section className="mb-12">
            <div className="flex items-center gap-3 mb-4">
                <Zap className="text-yellow-400 w-8 h-8" />
                <h2 className="text-3xl font-bold text-white">Свойства Степеней</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-slate-900 border border-slate-700 p-5 rounded-lg hover:bg-slate-800 transition-colors group">
                    <div className="text-xs text-slate-500 uppercase mb-1">Умножение (Базы равны)</div>
                    <div className="text-2xl font-bold text-white mb-2">a<sup className="text-yellow-400">n</sup> · a<sup className="text-yellow-400">m</sup> = a<sup className="text-yellow-400">n+m</sup></div>
                    <p className="text-sm text-slate-400 group-hover:text-white">Показатели складываются!</p>
                </div>

                <div className="bg-slate-900 border border-slate-700 p-5 rounded-lg hover:bg-slate-800 transition-colors group">
                    <div className="text-xs text-slate-500 uppercase mb-1">Деление</div>
                    <div className="text-2xl font-bold text-white mb-2">a<sup className="text-yellow-400">n</sup> : a<sup className="text-yellow-400">m</sup> = a<sup className="text-yellow-400">n-m</sup></div>
                    <p className="text-sm text-slate-400 group-hover:text-white">Показатели вычитаются!</p>
                </div>

                <div className="bg-slate-900 border border-slate-700 p-5 rounded-lg hover:bg-slate-800 transition-colors group">
                    <div className="text-xs text-slate-500 uppercase mb-1">Степень в степень</div>
                    <div className="text-2xl font-bold text-white mb-2">(a<sup className="text-yellow-400">n</sup>)<sup className="text-yellow-400">m</sup> = a<sup className="text-yellow-400">n·m</sup></div>
                    <p className="text-sm text-slate-400 group-hover:text-white">Показатели перемножаются!</p>
                </div>
                
                 <div className="bg-slate-900 border border-slate-700 p-5 rounded-lg hover:bg-slate-800 transition-colors group">
                    <div className="text-xs text-slate-500 uppercase mb-1">Степень произведения</div>
                    <div className="text-2xl font-bold text-white mb-2">(ab)<sup className="text-yellow-400">n</sup> = a<sup className="text-yellow-400">n</sup> · b<sup className="text-yellow-400">n</sup></div>
                    <p className="text-sm text-slate-400 group-hover:text-white">Каждому множителю своя степень.</p>
                </div>

                <div className="bg-slate-900 border border-slate-700 p-5 rounded-lg hover:bg-slate-800 transition-colors group md:col-span-2 relative overflow-hidden">
                    <div className="absolute right-2 top-2 opacity-20"><Zap size={40}/></div>
                    <div className="text-xs text-slate-500 uppercase mb-1">Важные константы</div>
                    <div className="flex gap-8 items-center">
                        <div className="text-3xl font-bold text-white">a<sup className="text-yellow-400">0</sup> = 1</div>
                        <div className="text-3xl font-bold text-white">a<sup className="text-yellow-400">1</sup> = a</div>
                    </div>
                    <p className="text-sm text-slate-400 mt-2">Любое число (кроме 0) в нулевой степени равно 1.</p>
                </div>
            </div>
        </section>

        {/* SECTION 3: FORMULAS (CHEAT CODES) */}
        <section className="mb-12">
             <div className="flex items-center gap-3 mb-4">
                <X className="text-pink-500 w-8 h-8" />
                <h2 className="text-3xl font-bold text-white">ФСУ (Чит-коды сокращения)</h2>
            </div>
            <div className="bg-gradient-to-r from-purple-900/50 to-blue-900/50 p-6 rounded-2xl border border-purple-500/30">
                <div className="grid md:grid-cols-2 gap-8 items-center">
                    <div className="space-y-4 font-mono text-lg">
                        <div className="flex justify-between border-b border-white/10 pb-2">
                            <span>Квадрат суммы:</span>
                            <span className="text-purple-300 font-bold">(a + b)² = a² + 2ab + b²</span>
                        </div>
                        <div className="flex justify-between border-b border-white/10 pb-2">
                            <span>Квадрат разности:</span>
                            <span className="text-purple-300 font-bold">(a - b)² = a² - 2ab + b²</span>
                        </div>
                        <div className="flex justify-between border-b border-white/10 pb-2">
                            <span>Разность квадратов:</span>
                            <span className="text-pink-400 font-bold">a² - b² = (a - b)(a + b)</span>
                        </div>
                         <div className="text-sm text-slate-400 mt-4 italic">
                            * Выучи "Разность квадратов" (последнюю) — она встречается в 80% заданий на упрощение!
                        </div>
                    </div>
                    <div className="relative h-48 rounded-lg overflow-hidden border border-white/10">
                         <Image src={imageUrls['alg7-formulas']} alt="Геометрический смысл формул" fill className="object-cover" />
                    </div>
                </div>
            </div>
        </section>

        <div className="text-center">
            <Link href="/vpr-tests" className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-8 rounded-lg shadow-lg hover:shadow-blue-500/40 transition-all">
                <Calculator className="w-4 h-4" /> Вернуться в Меню
            </Link>
        </div>

      </div>
    </div>
  );
}