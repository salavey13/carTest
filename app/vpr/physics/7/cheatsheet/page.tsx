"use client";

import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { Atom, Zap, Gauge, Weight, MoveRight, Layers } from "lucide-react";

// --- SVG Components ---

const SpeedGraphSVG = () => (
  <svg viewBox="0 0 300 180" className="w-full h-full" style={{fontFamily: 'monospace'}}>
    <rect width="100%" height="100%" fill="#1c1917" rx="8" />
    {/* Grid */}
    <path d="M 40 10 L 40 150 L 280 150" fill="none" stroke="#57534e" strokeWidth="2" />
    
    {/* Graph Line */}
    <path d="M 40 150 L 260 30" fill="none" stroke="#f59e0b" strokeWidth="3" />
    
    {/* Axis Labels */}
    <text x="20" y="20" fill="#a8a29e" fontSize="12">S(м)</text>
    <text x="270" y="170" fill="#a8a29e" fontSize="12">t(с)</text>
    
    {/* Formula Label */}
    <rect x="150" y="80" width="80" height="30" rx="4" fill="#f59e0b" fillOpacity="0.2" stroke="#f59e0b" />
    <text x="190" y="100" fill="#f59e0b" fontSize="14" fontWeight="bold" textAnchor="middle">v = S / t</text>
    
    {/* Dotted lines for a point */}
    <path d="M 150 150 L 150 90 L 40 90" fill="none" stroke="#57534e" strokeDasharray="4 4" />
  </svg>
);

const DensityCubeSVG = () => (
  <svg viewBox="0 0 300 150" className="w-full h-full">
    {/* Cube 1 (Light) */}
    <g transform="translate(40, 40)">
        <rect x="0" y="0" width="60" height="60" fill="none" stroke="#38bdf8" strokeWidth="2" />
        <text x="30" y="80" fill="#38bdf8" textAnchor="middle" fontSize="12">Пенопласт</text>
        {/* Few dots */}
        <circle cx="10" cy="10" r="2" fill="#38bdf8" />
        <circle cx="50" cy="50" r="2" fill="#38bdf8" />
        <circle cx="30" cy="30" r="2" fill="#38bdf8" />
    </g>

    {/* Math Symbol */}
    <text x="130" y="75" fill="#fff" fontSize="20" textAnchor="middle">VS</text>

    {/* Cube 2 (Heavy) */}
    <g transform="translate(180, 40)">
        <rect x="0" y="0" width="60" height="60" fill="rgba(239, 68, 68, 0.2)" stroke="#ef4444" strokeWidth="2" />
        <text x="30" y="80" fill="#ef4444" textAnchor="middle" fontSize="12">Свинец</text>
        {/* Many dots */}
        <pattern id="dots" x="0" y="0" width="10" height="10" patternUnits="userSpaceOnUse">
             <circle cx="2" cy="2" r="2" fill="#ef4444" />
        </pattern>
        <rect x="0" y="0" width="60" height="60" fill="url(#dots)" />
    </g>
    
    {/* Formula */}
    <text x="150" y="130" fill="#fff" fontSize="16" fontWeight="bold" textAnchor="middle">ρ = m / V</text>
  </svg>
);

const ForcesBlockSVG = () => (
  <svg viewBox="0 0 300 200" className="w-full h-full">
    <rect width="100%" height="100%" fill="#1c1917" rx="8" />
    
    {/* Ground */}
    <line x1="20" y1="150" x2="280" y2="150" stroke="#a8a29e" strokeWidth="2" />
    <path d="M 20 150 L 280 150 L 260 170 L 40 170 Z" fill="rgba(255,255,255,0.05)" />

    {/* Block */}
    <rect x="100" y="90" width="100" height="60" fill="#292524" stroke="#f59e0b" strokeWidth="2" />
    <circle cx="150" cy="120" r="3" fill="#fff" />

    {/* Vectors */}
    {/* mg (Gravity) */}
    <line x1="150" y1="120" x2="150" y2="180" stroke="#ef4444" strokeWidth="3" markerEnd="url(#arrowRed)" />
    <text x="160" y="175" fill="#ef4444" fontSize="14" fontWeight="bold">Fтяж</text>

    {/* N (Normal) */}
    <line x1="150" y1="90" x2="150" y2="40" stroke="#38bdf8" strokeWidth="3" markerEnd="url(#arrowBlue)" />
    <text x="160" y="55" fill="#38bdf8" fontSize="14" fontWeight="bold">N</text>

    {/* F traction */}
    <line x1="200" y1="120" x2="260" y2="120" stroke="#22c55e" strokeWidth="3" markerEnd="url(#arrowGreen)" />
    <text x="240" y="110" fill="#22c55e" fontSize="14" fontWeight="bold">Fтяги</text>

    {/* F friction */}
    <line x1="100" y1="120" x2="60" y2="120" stroke="#eab308" strokeWidth="3" markerEnd="url(#arrowYellow)" />
    <text x="40" y="110" fill="#eab308" fontSize="14" fontWeight="bold">Fтр</text>

    {/* Markers Defs */}
    <defs>
      <marker id="arrowRed" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
        <path d="M0,0 L0,6 L9,3 z" fill="#ef4444" />
      </marker>
      <marker id="arrowBlue" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
        <path d="M0,0 L0,6 L9,3 z" fill="#38bdf8" />
      </marker>
      <marker id="arrowGreen" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
        <path d="M0,0 L0,6 L9,3 z" fill="#22c55e" />
      </marker>
      <marker id="arrowYellow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
        <path d="M0,0 L0,6 L9,3 z" fill="#eab308" />
      </marker>
    </defs>
  </svg>
);

export default function Physics7Cheatsheet() {
  return (
    <div className="min-h-screen bg-[#0c0a09] text-orange-100 p-4 md:p-8 font-mono relative overflow-x-hidden selection:bg-orange-500/30">
      {/* Background Texture */}
      <div className="absolute inset-0 z-0 opacity-10 pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(circle, #44403c 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
      </div>

      <div className="max-w-5xl mx-auto relative z-10">
        
        <header className="mb-12 border-b-2 border-orange-800/50 pb-8 flex flex-col md:flex-row justify-between items-end">
            <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-orange-900/20 border border-orange-500/30 text-orange-400 text-xs mb-4 uppercase tracking-widest">
                    <Atom className="w-3 h-3 animate-spin-slow" /> Physics Engine v1.0
                </div>
                <h1 className="text-5xl md:text-6xl font-black text-white mb-2 tracking-tighter">
                    GRAVITY <span className="text-orange-500">LABS</span>
                </h1>
                <p className="text-stone-400 text-lg">
                    Модуль 7: Механика. Движение, Масса, Силы.
                </p>
            </div>
            <div className="hidden md:block text-right">
                <div className="text-4xl font-bold text-stone-700">F = ma</div>
                <div className="text-xs text-stone-600">(Спойлер к 9 классу)</div>
            </div>
        </header>

        {/* SECTION 1: KINEMATICS (SPEED) */}
        <section className="mb-16">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-stone-800 rounded-xl border border-stone-600">
                    <Gauge className="text-orange-400 w-8 h-8" />
                </div>
                <div>
                    <h2 className="text-3xl font-bold text-white">Скорость и Движение</h2>
                    <p className="text-stone-400 text-sm">Не тормози — сникерсни</p>
                </div>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8">
                <Card className="bg-stone-900 border-orange-500/20 shadow-xl shadow-orange-900/10">
                    <CardContent className="p-6 space-y-6">
                        <div className="flex justify-between items-center bg-stone-950 p-4 rounded-lg border border-stone-800">
                             <div className="text-center">
                                <div className="text-3xl font-bold text-white">S</div>
                                <div className="text-xs text-stone-500">Путь (м)</div>
                             </div>
                             <div className="text-2xl text-stone-600 font-bold">=</div>
                             <div className="text-center">
                                <div className="text-3xl font-bold text-orange-400">v</div>
                                <div className="text-xs text-stone-500">Скорость (м/с)</div>
                             </div>
                             <div className="text-2xl text-stone-600 font-bold">×</div>
                             <div className="text-center">
                                <div className="text-3xl font-bold text-white">t</div>
                                <div className="text-xs text-stone-500">Время (с)</div>
                             </div>
                        </div>
                        
                        <div className="space-y-2 text-sm text-stone-300">
                            <p>🏎️ <strong>Лайфхак перевода:</strong></p>
                            <div className="flex items-center gap-2 bg-stone-950/50 p-2 rounded border border-stone-800">
                                <span>км/ч</span>
                                <MoveRight className="w-4 h-4 text-orange-500" />
                                <span>м/с</span>
                                <span className="text-stone-500 ml-auto">Дели на 3.6</span>
                            </div>
                            <div className="flex items-center gap-2 bg-stone-950/50 p-2 rounded border border-stone-800">
                                <span>м/с</span>
                                <MoveRight className="w-4 h-4 text-orange-500" />
                                <span>км/ч</span>
                                <span className="text-stone-500 ml-auto">Умножай на 3.6</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <div className="rounded-xl overflow-hidden border border-stone-700 bg-stone-900 h-64 md:h-auto">
                    <SpeedGraphSVG />
                </div>
            </div>
        </section>

        {/* SECTION 2: DENSITY (MASS) */}
        <section className="mb-16">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-stone-800 rounded-xl border border-stone-600">
                    <Layers className="text-sky-400 w-8 h-8" />
                </div>
                <div>
                     <h2 className="text-3xl font-bold text-white">Плотность Вещества</h2>
                     <p className="text-stone-400 text-sm">Почему корабль плавает, а камень тонет?</p>
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8 items-center bg-stone-900/50 p-6 rounded-2xl border border-stone-800">
                <div className="h-48 w-full">
                    <DensityCubeSVG />
                </div>
                <div className="space-y-6">
                     <div className="text-center md:text-left">
                        <div className="text-4xl font-bold text-white mb-2 font-serif">ρ = m / V</div>
                        <p className="text-stone-400 text-sm">Ро (плотность) = Масса / Объем</p>
                     </div>
                     <ul className="space-y-3 text-sm">
                        <li className="flex gap-3 items-start">
                            <div className="bg-sky-500/20 text-sky-400 font-bold p-1 rounded px-2">кг/м³</div>
                            <span className="text-stone-300">Стандартная единица (СИ). Используй для задач.</span>
                        </li>
                        <li className="flex gap-3 items-start">
                            <div className="bg-red-500/20 text-red-400 font-bold p-1 rounded px-2">г/см³</div>
                            <span className="text-stone-300">Встречается в химии. <br/>1 г/см³ = 1000 кг/м³ (Вода).</span>
                        </li>
                     </ul>
                </div>
            </div>
        </section>

        {/* SECTION 3: FORCES (DYNAMICS) */}
        <section className="mb-16">
             <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-stone-800 rounded-xl border border-stone-600">
                    <Weight className="text-red-500 w-8 h-8" />
                </div>
                <div>
                     <h2 className="text-3xl font-bold text-white">Векторы Силы</h2>
                     <p className="text-stone-400 text-sm">Куда давим?</p>
                </div>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8 items-start">
                 <div className="rounded-xl overflow-hidden border-2 border-stone-700 bg-stone-900 h-64 shadow-2xl">
                    <ForcesBlockSVG />
                 </div>
                 
                 <div className="grid grid-cols-1 gap-3">
                    <div className="bg-stone-900 p-4 rounded-lg border-l-4 border-red-500">
                        <div className="flex justify-between">
                            <h4 className="font-bold text-white">Сила Тяжести</h4>
                            <span className="text-red-400 font-bold font-mono">F = mg</span>
                        </div>
                        <p className="text-xs text-stone-400 mt-1">Тянет всегда ВНИЗ (к центру Земли). g ≈ 10 Н/кг.</p>
                    </div>

                    <div className="bg-stone-900 p-4 rounded-lg border-l-4 border-sky-500">
                        <div className="flex justify-between">
                            <h4 className="font-bold text-white">Сила Упругости</h4>
                            <span className="text-sky-400 font-bold font-mono">F = kx</span>
                        </div>
                        <p className="text-xs text-stone-400 mt-1">Закон Гука. Пружина хочет вернуться назад.</p>
                    </div>

                    <div className="bg-stone-900 p-4 rounded-lg border-l-4 border-yellow-500">
                         <div className="flex justify-between">
                            <h4 className="font-bold text-white">Сила Трения</h4>
                            <span className="text-yellow-400 font-bold font-mono">Мешает</span>
                        </div>
                        <p className="text-xs text-stone-400 mt-1">Всегда направлена ПРОТИВ движения.</p>
                    </div>
                 </div>
            </div>
        </section>

        <div className="flex justify-center pb-8">
            <Link href="/vpr-tests" className="group flex items-center gap-3 bg-orange-700 hover:bg-orange-600 text-white font-bold py-4 px-10 rounded-lg shadow-lg shadow-orange-900/40 transition-all hover:translate-y-[-2px]">
                <Zap className="w-5 h-5 group-hover:fill-current" /> 
                <span>ВЕРНУТЬСЯ В ЛАБОРАТОРИЮ</span>
            </Link>
        </div>

      </div>
    </div>
  );
}