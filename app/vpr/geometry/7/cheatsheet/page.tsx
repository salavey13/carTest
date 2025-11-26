"use client";

import React from 'react';
import Link from "next/link";
import Image from "next/image";
import { Ruler, Triangle,  Maximize2, MoveDiagonal } from "lucide-react";

// Промпты для генерации изображений
const imageUrls: Record<string, string> = {
  // Prompt: "Technical drawing of vertical and adjacent angles, blueprint style, white lines on blue background, marked angles alpha and beta"
  'geo7-angles': 'https://placehold.co/600x400/003366/ffffff?text=Смежные+и+Вертикальные',
  
  // Prompt: "Three signs of triangle equality visualization (SSS, SAS, ASA), blueprint diagram, highlighting equal sides and angles with distinct markers"
  'geo7-triangles': 'https://placehold.co/600x400/004488/ffffff?text=Признаки+равенства+∆',
  
  // Prompt: "Parallel lines cut by a transversal, blueprint style, highlighting alternate and corresponding angles"
  'geo7-parallel': 'https://placehold.co/600x400/003366/ffcc00?text=Параллельные+прямые',
};

export default function Geometry7Cheatsheet() {
  return (
    <div className="min-h-screen bg-[#002b4d] text-white p-4 md:p-8 font-sans relative overflow-x-hidden">
        {/* Grid Pattern (Blueprint) */}
        <div className="absolute inset-0 pointer-events-none opacity-20" 
             style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
        </div>

        <div className="max-w-5xl mx-auto relative z-10 border-4 border-white/20 p-6 md:p-10 rounded-sm bg-[#003366]/80 backdrop-blur-sm shadow-2xl">
            
            <header className="flex flex-col md:flex-row justify-between items-center mb-10 border-b-2 border-white/20 pb-6">
                <div>
                    <h1 className="text-4xl font-bold uppercase tracking-widest text-white mb-2 font-mono">Blueprint: GEO-7</h1>
                    <p className="text-blue-200 font-mono text-sm">Project: VPR Survival // Status: Active</p>
                </div>
                <Ruler className="w-16 h-16 text-white/50 hidden md:block" />
            </header>

            {/* BLOCK 1: ANGLES */}
            <section className="mb-10">
                <h2 className="text-xl font-bold bg-white text-[#003366] inline-block px-4 py-1 mb-4 font-mono">01. БАЗОВЫЕ УГЛЫ</h2>
                <div className="grid md:grid-cols-2 gap-6 items-center">
                    <div className="space-y-6">
                        <div className="border-l-4 border-yellow-400 pl-4">
                            <h3 className="text-lg font-bold text-yellow-400 uppercase mb-1">Смежные углы</h3>
                            <p className="text-sm text-blue-100">Соседи на одной прямой. У них одна общая сторона, а две другие — продолжение друг друга.</p>
                            <div className="text-2xl font-mono mt-2">∠1 + ∠2 = 180°</div>
                        </div>
                        <div className="border-l-4 border-cyan-400 pl-4">
                            <h3 className="text-lg font-bold text-cyan-400 uppercase mb-1">Вертикальные углы</h3>
                            <p className="text-sm text-blue-100">Как ножницы. Стороны одного угла являются продолжением сторон другого.</p>
                            <div className="text-2xl font-mono mt-2">∠1 = ∠3</div>
                        </div>
                    </div>
                    <div className="border-2 border-white/30 rounded p-2 bg-[#002244]">
                        <Image src={imageUrls['geo7-angles']} alt="Углы" width={500} height={300} className="w-full h-auto opacity-90" />
                    </div>
                </div>
            </section>

            {/* BLOCK 2: TRIANGLES (THE CORE) */}
            <section className="mb-10">
                <h2 className="text-xl font-bold bg-white text-[#003366] inline-block px-4 py-1 mb-4 font-mono">02. РАВЕНСТВО ТРЕУГОЛЬНИКОВ</h2>
                <div className="grid md:grid-cols-3 gap-4">
                    {/* Sign 1 */}
                    <div className="bg-[#004080] p-4 border border-white/20 hover:border-yellow-400 transition-all">
                        <div className="flex justify-between items-start mb-2">
                             <Triangle className="w-6 h-6 text-yellow-400" />
                             <span className="text-3xl font-bold text-white/20">I</span>
                        </div>
                        <h3 className="font-bold text-lg mb-2">СУС (Две стороны и угол)</h3>
                        <p className="text-xs text-blue-200 leading-relaxed">
                            Если 2 стороны и угол <strong className="text-white underline">между ними</strong> одного треугольника равны двум сторонам и углу между ними другого.
                        </p>
                    </div>

                    {/* Sign 2 */}
                    <div className="bg-[#004080] p-4 border border-white/20 hover:border-cyan-400 transition-all">
                        <div className="flex justify-between items-start mb-2">
                             <Triangle className="w-6 h-6 text-cyan-400" />
                             <span className="text-3xl font-bold text-white/20">II</span>
                        </div>
                        <h3 className="font-bold text-lg mb-2">УСУ (Сторона и 2 угла)</h3>
                        <p className="text-xs text-blue-200 leading-relaxed">
                            Если сторона и 2 <strong className="text-white underline">прилежащих</strong> к ней угла одного треугольника равны стороне и 2 прилежащим углам другого.
                        </p>
                    </div>

                    {/* Sign 3 */}
                    <div className="bg-[#004080] p-4 border border-white/20 hover:border-pink-400 transition-all">
                         <div className="flex justify-between items-start mb-2">
                             <Triangle className="w-6 h-6 text-pink-400" />
                             <span className="text-3xl font-bold text-white/20">III</span>
                        </div>
                        <h3 className="font-bold text-lg mb-2">ССС (Три стороны)</h3>
                        <p className="text-xs text-blue-200 leading-relaxed">
                            Если три стороны одного треугольника равны трем сторонам другого.
                        </p>
                    </div>
                </div>
                 <div className="mt-4 border-2 border-white/30 rounded p-2 bg-[#002244] h-48 relative overflow-hidden">
                    <Image src={imageUrls['geo7-triangles']} alt="Признаки равенства" fill className="object-cover opacity-80" />
                </div>
            </section>

             {/* BLOCK 3: PARALLEL LINES */}
             <section className="mb-10">
                <h2 className="text-xl font-bold bg-white text-[#003366] inline-block px-4 py-1 mb-4 font-mono">03. ПАРАЛЛЕЛЬНЫЕ ПРЯМЫЕ</h2>
                <div className="flex flex-col md:flex-row gap-6">
                     <div className="flex-1 space-y-4 text-sm">
                        <p className="flex items-center gap-2"><Maximize2 className="w-4 h-4 text-green-400" /> <span className="text-green-300 font-bold">Накрест лежащие</span> углы равны.</p>
                        <p className="flex items-center gap-2"><MoveDiagonal className="w-4 h-4 text-orange-400" /> <span className="text-orange-300 font-bold">Соответственные</span> углы равны.</p>
                        <p className="flex items-center gap-2"><span className="font-bold border px-1 border-red-400 text-red-400">∑</span> <span className="text-red-300 font-bold">Односторонние</span> углы в сумме дают 180°.</p>
                     </div>
                     <div className="flex-1 border-2 border-white/30 rounded p-2 bg-[#002244] min-h-[120px] relative">
                        <Image src={imageUrls['geo7-parallel']} alt="Параллельные прямые" fill className="object-cover opacity-90" />
                     </div>
                </div>
            </section>

            <footer className="mt-12 pt-6 border-t border-white/10 text-center">
                 <Link href="/vpr-tests" className="inline-block border-2 border-white text-white hover:bg-white hover:text-[#003366] font-bold py-2 px-6 rounded transition-colors uppercase tracking-widest text-sm">
                    Закрыть чертеж (Меню)
                </Link>
            </footer>

        </div>
    </div>
  );
}