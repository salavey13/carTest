"use client";

import React from 'react';
import Link from "next/link";
import { Ruler, Triangle, Maximize2, MoveDiagonal, CheckCircle2 } from "lucide-react";

// --- SVG Components for Blueprints ---

const AnglesBlueprint = () => (
  <svg viewBox="0 0 300 200" className="w-full h-full" style={{fontFamily: 'monospace'}}>
    <rect width="100%" height="100%" fill="#002244" />
    {/* Grid Lines */}
    <pattern id="geoGrid" width="20" height="20" patternUnits="userSpaceOnUse">
       <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>
    </pattern>
    <rect width="100%" height="100%" fill="url(#geoGrid)" />

    {/* Lines */}
    <line x1="50" y1="150" x2="250" y2="50" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    <line x1="50" y1="50" x2="250" y2="150" stroke="#fff" strokeWidth="2" strokeLinecap="round" />

    {/* Vertical Angles (Alpha) */}
    <path d="M 130 100 Q 120 100 125 90" fill="none" stroke="#22d3ee" strokeWidth="2" />
    <path d="M 170 100 Q 180 100 175 110" fill="none" stroke="#22d3ee" strokeWidth="2" />
    <text x="110" y="105" fill="#22d3ee" fontSize="14">1</text>
    <text x="180" y="105" fill="#22d3ee" fontSize="14">1</text>

    {/* Adjacent Angle (Beta) */}
    <path d="M 150 80 Q 150 70 160 75" fill="none" stroke="#facc15" strokeWidth="2" />
    <text x="150" y="60" fill="#facc15" fontSize="14">2</text>
    
    {/* Text info */}
    <text x="10" y="190" fill="#fff" fontSize="10" opacity="0.7">∠1 = ∠1 (Вертикальные)</text>
    <text x="150" y="190" fill="#fff" fontSize="10" opacity="0.7">∠1 + ∠2 = 180° (Смежные)</text>
  </svg>
);

const TrianglesBlueprint = () => (
    <svg viewBox="0 0 400 250" className="w-full h-full">
        <rect width="100%" height="100%" fill="#002244" />
        {/* Triangle 1 */}
        <g transform="translate(20, 50)">
            <polygon points="0,100 50,0 100,100" fill="rgba(255,255,255,0.1)" stroke="#fff" strokeWidth="2" />
            {/* Markings Side 1 */}
            <line x1="20" y1="50" x2="30" y2="50" stroke="#facc15" strokeWidth="2" />
            {/* Markings Angle */}
            <path d="M 10 90 Q 20 80 30 100" fill="none" stroke="#22d3ee" strokeWidth="2" />
             <text x="20" y="130" fill="#fff" fontSize="12">1. СУС</text>
             <text x="0" y="145" fill="#aaa" fontSize="10">2 стороны + угол</text>
        </g>
        
        {/* Triangle 2 */}
        <g transform="translate(150, 50)">
            <polygon points="0,100 50,0 100,100" fill="rgba(255,255,255,0.1)" stroke="#fff" strokeWidth="2" />
            {/* Markings Side */}
            <line x1="45" y1="95" x2="55" y2="105" stroke="#facc15" strokeWidth="2" />
            {/* Markings Angles */}
            <path d="M 10 90 Q 20 80 30 100" fill="none" stroke="#22d3ee" strokeWidth="2" />
            <path d="M 70 100 Q 80 80 90 90" fill="none" stroke="#22d3ee" strokeWidth="2" />
            <text x="20" y="130" fill="#fff" fontSize="12">2. УСУ</text>
            <text x="0" y="145" fill="#aaa" fontSize="10">Сторона + 2 угла</text>
        </g>

        {/* Triangle 3 */}
        <g transform="translate(280, 50)">
            <polygon points="0,100 50,0 100,100" fill="rgba(255,255,255,0.1)" stroke="#fff" strokeWidth="2" />
            {/* Markings Sides */}
            <line x1="25" y1="50" x2="25" y2="50" stroke="#facc15" strokeWidth="4" strokeLinecap="round"/>
            <line x1="75" y1="50" x2="75" y2="50" stroke="#facc15" strokeWidth="4" strokeLinecap="round"/>
            <line x1="50" y1="100" x2="50" y2="100" stroke="#facc15" strokeWidth="4" strokeLinecap="round"/>
            <text x="20" y="130" fill="#fff" fontSize="12">3. ССС</text>
            <text x="0" y="145" fill="#aaa" fontSize="10">3 стороны</text>
        </g>
    </svg>
);

const ParallelBlueprint = () => (
    <svg viewBox="0 0 300 200" className="w-full h-full">
        <rect width="100%" height="100%" fill="#002244" />
        
        {/* Lines a and b */}
        <line x1="20" y1="60" x2="280" y2="60" stroke="#fff" strokeWidth="2" />
        <text x="285" y="65" fill="#fff" fontSize="12">a</text>
        <line x1="20" y1="140" x2="280" y2="140" stroke="#fff" strokeWidth="2" />
        <text x="285" y="145" fill="#fff" fontSize="12">b</text>

        {/* Transversal c */}
        <line x1="80" y1="20" x2="220" y2="180" stroke="#f87171" strokeWidth="2" />
        <text x="225" y="180" fill="#f87171" fontSize="12">c</text>

        {/* Alternate Angles (Z) */}
        <path d="M 135 60 Q 145 60 140 70" fill="none" stroke="#4ade80" strokeWidth="2" />
        <path d="M 165 140 Q 155 140 160 130" fill="none" stroke="#4ade80" strokeWidth="2" />
        <text x="10" y="30" fill="#4ade80" fontSize="12">● Накрест лежащие</text>

        {/* Corresponding */}
        <circle cx="120" cy="50" r="3" fill="#facc15" />
        <circle cx="155" cy="130" r="3" fill="#facc15" />
        <text x="150" y="30" fill="#facc15" fontSize="12">● Соответственные</text>
    </svg>
);

export default function Geometry7Cheatsheet() {
  return (
    <div className="min-h-screen bg-[#002b4d] text-white p-4 md:p-8 font-sans relative overflow-x-hidden selection:bg-yellow-400 selection:text-black">
        {/* Grid Pattern (Blueprint) */}
        <div className="absolute inset-0 pointer-events-none opacity-20" 
             style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
        </div>

        <div className="max-w-6xl mx-auto relative z-10 border-[6px] border-white/10 p-2 md:p-6 rounded-xl bg-[#003366]/90 backdrop-blur-sm shadow-2xl">
            
            <header className="flex flex-col md:flex-row justify-between items-end mb-12 border-b-4 border-white pb-6 px-4">
                <div>
                    <div className="bg-white text-[#003366] px-2 py-1 text-xs font-bold inline-block mb-2">PROJECT: VPR-7</div>
                    <h1 className="text-4xl md:text-6xl font-black uppercase tracking-widest text-white mb-2 font-mono">
                        BLUEPRINT <span className="text-yellow-400">GEO</span>
                    </h1>
                    <p className="text-blue-200 font-mono text-sm tracking-wide">
                        Инженерная шпаргалка // Геометрия 7 класс
                    </p>
                </div>
                <div className="hidden md:block opacity-50">
                    <Ruler className="w-24 h-24 text-white" />
                </div>
            </header>

            {/* BLOCK 1: ANGLES */}
            <section className="mb-16">
                <div className="flex items-center gap-4 mb-6 px-4">
                    <div className="w-12 h-12 bg-white text-[#003366] rounded-full flex items-center justify-center font-bold text-xl">01</div>
                    <h2 className="text-2xl font-bold font-mono">БАЗОВЫЕ УГЛЫ</h2>
                </div>
                
                <div className="grid md:grid-cols-2 gap-8 bg-[#002244] border-2 border-white/20 p-6 rounded-lg mx-4 shadow-lg">
                    <div className="space-y-8 flex flex-col justify-center">
                        <div className="border-l-4 border-yellow-400 pl-6 py-2 bg-white/5 rounded-r-lg">
                            <h3 className="text-xl font-bold text-yellow-400 uppercase mb-2 flex items-center gap-2">
                                Смежные углы <span className="text-xs bg-yellow-400 text-black px-1 rounded">180°</span>
                            </h3>
                            <p className="text-blue-100 mb-2">Соседи на одной прямой. У них одна стена общая, а пол — прямая линия.</p>
                            <div className="font-mono text-xl bg-black/30 p-2 rounded text-center border border-yellow-400/30">∠1 + ∠2 = 180°</div>
                        </div>
                        
                        <div className="border-l-4 border-cyan-400 pl-6 py-2 bg-white/5 rounded-r-lg">
                            <h3 className="text-xl font-bold text-cyan-400 uppercase mb-2 flex items-center gap-2">
                                Вертикальные углы <span className="text-xs bg-cyan-400 text-black px-1 rounded">=</span>
                            </h3>
                            <p className="text-blue-100 mb-2">Как раскрытые ножницы. Смотрят друг на друга и всегда равны.</p>
                            <div className="font-mono text-xl bg-black/30 p-2 rounded text-center border border-cyan-400/30">∠1 = ∠3</div>
                        </div>
                    </div>
                    
                    <div className="border-4 border-white/10 rounded-lg overflow-hidden h-64 shadow-inner bg-[#001a33]">
                        <AnglesBlueprint />
                    </div>
                </div>
            </section>

            {/* BLOCK 2: TRIANGLES (THE CORE) */}
            <section className="mb-16">
                 <div className="flex items-center gap-4 mb-6 px-4">
                    <div className="w-12 h-12 bg-white text-[#003366] rounded-full flex items-center justify-center font-bold text-xl">02</div>
                    <h2 className="text-2xl font-bold font-mono">РАВЕНСТВО ТРЕУГОЛЬНИКОВ</h2>
                </div>

                <div className="bg-[#002244] border-2 border-white/20 p-2 rounded-lg mx-4">
                    {/* Visual Diagram */}
                    <div className="h-64 md:h-72 w-full border-b-2 border-white/10 mb-6 bg-[#001a33] rounded-t-lg overflow-hidden">
                         <TrianglesBlueprint />
                    </div>

                    {/* Cards */}
                    <div className="grid md:grid-cols-3 gap-4 px-4 pb-4">
                        <div className="bg-[#003366] p-4 rounded border border-yellow-400/30 hover:bg-[#004080] transition-colors group">
                            <div className="text-yellow-400 font-bold text-xl mb-1 group-hover:scale-110 transition-transform w-fit">I. СУС</div>
                            <div className="h-0.5 w-8 bg-yellow-400 mb-3"></div>
                            <p className="text-sm text-blue-100">
                                Две <strong className="text-white">Стороны</strong> и <strong className="text-white">Угол</strong> между ними.
                                <br/><span className="text-xs opacity-60">(Как клешня краба)</span>
                            </p>
                        </div>

                        <div className="bg-[#003366] p-4 rounded border border-cyan-400/30 hover:bg-[#004080] transition-colors group">
                            <div className="text-cyan-400 font-bold text-xl mb-1 group-hover:scale-110 transition-transform w-fit">II. УСУ</div>
                            <div className="h-0.5 w-8 bg-cyan-400 mb-3"></div>
                            <p className="text-sm text-blue-100">
                                <strong className="text-white">Сторона</strong> и два прилежащих <strong className="text-white">Угла</strong>.
                                <br/><span className="text-xs opacity-60">(Основание с двумя углами)</span>
                            </p>
                        </div>

                        <div className="bg-[#003366] p-4 rounded border border-pink-400/30 hover:bg-[#004080] transition-colors group">
                            <div className="text-pink-400 font-bold text-xl mb-1 group-hover:scale-110 transition-transform w-fit">III. ССС</div>
                            <div className="h-0.5 w-8 bg-pink-400 mb-3"></div>
                            <p className="text-sm text-blue-100">
                                Три <strong className="text-white">Стороны</strong>.
                                <br/><span className="text-xs opacity-60">(Жесткий каркас)</span>
                            </p>
                        </div>
                    </div>
                </div>
            </section>

             {/* BLOCK 3: PARALLEL LINES */}
             <section className="mb-10">
                <div className="flex items-center gap-4 mb-6 px-4">
                    <div className="w-12 h-12 bg-white text-[#003366] rounded-full flex items-center justify-center font-bold text-xl">03</div>
                    <h2 className="text-2xl font-bold font-mono">ПАРАЛЛЕЛЬНЫЕ ПРЯМЫЕ</h2>
                </div>

                <div className="flex flex-col md:flex-row gap-6 mx-4">
                     <div className="flex-1 space-y-4 text-sm bg-[#002244] p-6 rounded-lg border border-white/20">
                        <h3 className="text-lg font-bold text-white mb-4 border-b border-white/20 pb-2">Признаки параллельности:</h3>
                        
                        <div className="flex items-center gap-3 p-3 rounded hover:bg-white/5 transition-colors">
                            <Maximize2 className="w-5 h-5 text-green-400" /> 
                            <div>
                                <span className="text-green-300 font-bold block">Накрест лежащие</span>
                                <span className="text-blue-200">Должны быть РАВНЫ (∠Z)</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 p-3 rounded hover:bg-white/5 transition-colors">
                            <CheckCircle2 className="w-5 h-5 text-yellow-400" /> 
                            <div>
                                <span className="text-yellow-300 font-bold block">Соответственные</span>
                                <span className="text-blue-200">Должны быть РАВНЫ (∠F)</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 p-3 rounded hover:bg-white/5 transition-colors">
                            <span className="font-bold border-2 border-red-400 text-red-400 w-5 h-5 flex items-center justify-center text-xs rounded">∑</span>
                            <div>
                                <span className="text-red-300 font-bold block">Односторонние</span>
                                <span className="text-blue-200">Сумма = 180° (∠C)</span>
                            </div>
                        </div>
                     </div>

                     <div className="flex-1 border-4 border-white/10 rounded-lg overflow-hidden bg-[#001a33] min-h-[200px] shadow-lg">
                        <ParallelBlueprint />
                     </div>
                </div>
            </section>

            <footer className="mt-12 pt-8 border-t-2 border-white/20 text-center pb-6">
                 <Link href="/vpr-tests" className="inline-block border-2 border-white text-white hover:bg-white hover:text-[#003366] font-bold py-3 px-8 rounded transition-all transform hover:scale-105 uppercase tracking-widest text-sm shadow-lg">
                    Свернуть чертеж (В меню)
                </Link>
            </footer>

        </div>
    </div>
  );
}