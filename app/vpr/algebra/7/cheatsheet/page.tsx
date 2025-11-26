"use client";

import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { Calculator, Zap, TrendingUp, X, ChevronRight, Terminal } from "lucide-react";

// --- SVG Components for Visuals ---

const LinearGraphSVG = () => (
  <svg viewBox="0 0 400 300" className="w-full h-full" style={{fontFamily: 'monospace'}}>
    {/* Grid */}
    <defs>
      <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" strokeWidth="1"/>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#grid)" />
    
    {/* Axes */}
    <line x1="20" y1="150" x2="380" y2="150" stroke="#475569" strokeWidth="2" markerEnd="url(#arrow)" />
    <line x1="200" y1="280" x2="200" y2="20" stroke="#475569" strokeWidth="2" markerEnd="url(#arrow)" />
    <text x="370" y="140" fill="#94a3b8" fontSize="12">x</text>
    <text x="210" y="30" fill="#94a3b8" fontSize="12">y</text>

    {/* Function Line: y = 0.5x + 50 (scaled) */}
    <line x1="0" y1="250" x2="400" y2="50" stroke="#4ade80" strokeWidth="4" strokeLinecap="round" />
    
    {/* Intercept b */}
    <circle cx="200" cy="150" r="4" fill="#ec4899" />
    <text x="210" y="140" fill="#ec4899" fontWeight="bold" fontSize="16">b (сдвиг)</text>
    
    {/* Slope k */}
    <path d="M 280 110 L 320 110 L 320 90" fill="none" stroke="#facc15" strokeWidth="2" strokeDasharray="4 4" />
    <text x="330" y="105" fill="#facc15" fontSize="14">k (угол)</text>
  </svg>
);

const SquareSumSVG = () => (
  <svg viewBox="0 0 300 300" className="w-full h-full">
    {/* Main Square (a+b)^2 */}
    <rect x="50" y="50" width="200" height="200" fill="none" stroke="#6366f1" strokeWidth="2" />
    
    {/* Zones */}
    {/* a^2 */}
    <rect x="50" y="50" width="140" height="140" fill="rgba(99, 102, 241, 0.2)" stroke="#6366f1" strokeWidth="1" />
    <text x="110" y="130" fill="#fff" fontSize="24" textAnchor="middle">a²</text>
    
    {/* b^2 */}
    <rect x="190" y="190" width="60" height="60" fill="rgba(236, 72, 153, 0.2)" stroke="#ec4899" strokeWidth="1" />
    <text x="220" y="230" fill="#ec4899" fontSize="20" textAnchor="middle">b²</text>
    
    {/* ab rectangles */}
    <rect x="190" y="50" width="60" height="140" fill="rgba(168, 85, 247, 0.2)" stroke="#a855f7" strokeWidth="1" />
    <text x="220" y="130" fill="#a855f7" fontSize="20" textAnchor="middle">ab</text>
    
    <rect x="50" y="190" width="140" height="60" fill="rgba(168, 85, 247, 0.2)" stroke="#a855f7" strokeWidth="1" />
    <text x="110" y="230" fill="#a855f7" fontSize="20" textAnchor="middle">ab</text>
    
    {/* Labels */}
    <text x="120" y="40" fill="#fff" textAnchor="middle">a</text>
    <text x="220" y="40" fill="#fff" textAnchor="middle">b</text>
    <text x="30" y="130" fill="#fff" textAnchor="middle">a</text>
    <text x="30" y="220" fill="#fff" textAnchor="middle">b</text>
  </svg>
);

export default function Algebra7Cheatsheet() {
  return (
    <div className="min-h-screen bg-slate-950 text-blue-100 p-4 md:p-8 font-mono relative overflow-x-hidden selection:bg-green-500/30">
      {/* Grid Background */}
      <div className="absolute inset-0 z-0 opacity-10 pointer-events-none" 
           style={{ backgroundImage: 'linear-gradient(#1e293b 1px, transparent 1px), linear-gradient(90deg, #1e293b 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
      </div>

      <div className="max-w-5xl mx-auto relative z-10">
        
        <header className="mb-12 border-b border-blue-800/50 pb-8 text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-900/30 border border-blue-500/30 text-blue-400 text-xs mb-4">
                <Terminal className="w-3 h-3" /> SYSTEM_READY
            </div>
            <h1 className="text-5xl md:text-7xl font-black text-white mb-2 tracking-tighter">
                ALGEBRA <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-green-400">7.0</span>
            </h1>
            <p className="text-slate-400 text-lg">
                Загрузка модулей: <span className="text-green-400">Линейная функция</span> // <span className="text-yellow-400">Степени</span> // <span className="text-purple-400">Формулы</span>
            </p>
        </header>

        {/* SECTION 1: LINEAR FUNCTION (THE BOSS) */}
        <section className="mb-16">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-green-900/20 rounded-xl border border-green-500/30">
                    <TrendingUp className="text-green-400 w-8 h-8" />
                </div>
                <div>
                    <h2 className="text-3xl font-bold text-white">Линейная Функция</h2>
                    <p className="text-slate-400 text-sm">Код: y = kx + b</p>
                </div>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8 items-stretch">
                {/* Visual Graph */}
                <div className="bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden shadow-2xl shadow-green-900/10 h-80 relative group">
                     <div className="absolute inset-0 bg-green-500/5 group-hover:bg-transparent transition-colors duration-500"></div>
                     <LinearGraphSVG />
                </div>

                {/* Explanation Card */}
                <Card className="bg-slate-900/50 border-green-500/20 backdrop-blur-sm">
                    <CardContent className="p-6 flex flex-col justify-center h-full space-y-6">
                        <div className="text-center p-4 bg-slate-950 rounded-xl border border-slate-800">
                            <span className="text-4xl font-bold text-white">y = </span>
                            <span className="text-4xl font-bold text-green-400" title="Коэффициент наклона">k</span>
                            <span className="text-4xl font-bold text-white">x + </span>
                            <span className="text-4xl font-bold text-pink-500" title="Свободный член (сдвиг)">b</span>
                        </div>
                        
                        <div className="space-y-4">
                            <div className="flex gap-4 items-start">
                                <div className="bg-green-500/20 text-green-400 font-bold p-2 rounded w-10 text-center">k</div>
                                <div>
                                    <h4 className="text-white font-bold">Slope (Наклон)</h4>
                                    <p className="text-sm text-slate-400">Отвечает за угол. <br/> Если <span className="text-green-400">k &gt; 0</span> — взлетаем ✈️. <br/> Если <span className="text-red-400">k &lt; 0</span> — падаем 📉.</p>
                                </div>
                            </div>
                             <div className="flex gap-4 items-start">
                                <div className="bg-pink-500/20 text-pink-400 font-bold p-2 rounded w-10 text-center">b</div>
                                <div>
                                    <h4 className="text-white font-bold">Intercept (Сдвиг)</h4>
                                    <p className="text-sm text-slate-400">Точка старта на оси Y (0, b). <br/> Двигает прямую вверх или вниз.</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </section>

        {/* SECTION 2: POWERS (ENERGY LEVELS) */}
        <section className="mb-16">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-yellow-900/20 rounded-xl border border-yellow-500/30">
                    <Zap className="text-yellow-400 w-8 h-8" />
                </div>
                <div>
                     <h2 className="text-3xl font-bold text-white">Свойства Степеней</h2>
                     <p className="text-slate-400 text-sm">Управление энергией</p>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-900 border border-slate-800 hover:border-yellow-500/50 p-6 rounded-2xl transition-all group">
                    <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">Умножение</div>
                    <div className="text-2xl font-bold text-white mb-2 group-hover:text-yellow-300 transition-colors">a<sup className="text-yellow-500">n</sup> · a<sup className="text-yellow-500">m</sup></div>
                    <div className="h-px bg-slate-800 my-2"></div>
                    <div className="text-xl font-bold text-green-400">a<sup className="text-green-300">n+m</sup></div>
                    <p className="text-xs text-slate-400 mt-2">Складывай!</p>
                </div>

                <div className="bg-slate-900 border border-slate-800 hover:border-yellow-500/50 p-6 rounded-2xl transition-all group">
                    <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">Деление</div>
                    <div className="text-2xl font-bold text-white mb-2 group-hover:text-yellow-300 transition-colors">a<sup className="text-yellow-500">n</sup> : a<sup className="text-yellow-500">m</sup></div>
                    <div className="h-px bg-slate-800 my-2"></div>
                    <div className="text-xl font-bold text-green-400">a<sup className="text-green-300">n-m</sup></div>
                    <p className="text-xs text-slate-400 mt-2">Вычитай!</p>
                </div>

                <div className="bg-slate-900 border border-slate-800 hover:border-yellow-500/50 p-6 rounded-2xl transition-all group">
                    <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">Power Up</div>
                    <div className="text-2xl font-bold text-white mb-2 group-hover:text-yellow-300 transition-colors">(a<sup className="text-yellow-500">n</sup>)<sup className="text-yellow-500">m</sup></div>
                    <div className="h-px bg-slate-800 my-2"></div>
                    <div className="text-xl font-bold text-green-400">a<sup className="text-green-300">n·m</sup></div>
                    <p className="text-xs text-slate-400 mt-2">Умножай!</p>
                </div>
                
                <div className="bg-gradient-to-br from-yellow-900/20 to-slate-900 border border-yellow-500/30 p-6 rounded-2xl flex flex-col justify-center items-center text-center">
                    <div className="text-4xl font-bold text-white mb-2">a<sup className="text-yellow-400">0</sup> = 1</div>
                    <p className="text-xs text-yellow-200/70">Абсолютная истина</p>
                    <p className="text-[10px] text-slate-500 mt-1">(если a ≠ 0)</p>
                </div>
            </div>
        </section>

        {/* SECTION 3: FORMULAS (CHEAT CODES) */}
        <section className="mb-16">
             <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-purple-900/20 rounded-xl border border-purple-500/30">
                    <X className="text-purple-400 w-8 h-8" />
                </div>
                <div>
                     <h2 className="text-3xl font-bold text-white">ФСУ (Чит-коды)</h2>
                     <p className="text-slate-400 text-sm">Формулы Сокращенного Умножения</p>
                </div>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8 items-center bg-slate-900/50 p-6 rounded-3xl border border-slate-800">
                <div className="space-y-6">
                    <div className="group cursor-pointer">
                        <div className="text-xs text-purple-400 uppercase tracking-widest mb-1">Квадрат суммы</div>
                        <div className="text-2xl md:text-3xl font-mono text-white group-hover:text-purple-300 transition-colors">
                            (a + b)² = <span className="text-indigo-400">a²</span> + <span className="text-purple-400">2ab</span> + <span className="text-pink-400">b²</span>
                        </div>
                    </div>
                    
                    <div className="group cursor-pointer">
                        <div className="text-xs text-blue-400 uppercase tracking-widest mb-1">Разность квадратов (MVP)</div>
                        <div className="text-2xl md:text-3xl font-mono text-white group-hover:text-blue-300 transition-colors">
                            a² - b² = (a - b)(a + b)
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Используется чаще всего!</p>
                    </div>

                    <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-sm text-slate-400 italic">
                        "Геометрия не врет: посмотри на схему справа. Квадрат суммы — это буквально площадь большого квадрата, состоящего из частей."
                    </div>
                </div>

                <div className="relative h-64 md:h-80 w-full flex items-center justify-center p-4 bg-slate-950 rounded-2xl border border-slate-800 shadow-inner">
                     <SquareSumSVG />
                </div>
            </div>
        </section>

        <div className="flex justify-center pb-8">
            <Link href="/vpr-tests" className="group flex items-center gap-3 bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 px-10 rounded-full shadow-lg shadow-blue-900/40 transition-all hover:scale-105">
                <Calculator className="w-5 h-5 group-hover:animate-pulse" /> 
                <span>ВЕРНУТЬСЯ В МЕНЮ</span>
            </Link>
        </div>

      </div>
    </div>
  );
}