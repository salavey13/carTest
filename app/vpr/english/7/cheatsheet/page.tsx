"use client";

import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { MessageCircle, Clock, Globe, AlertTriangle, Play } from "lucide-react";

// --- SVG Components ---

const TimelineSVG = () => (
  <svg viewBox="0 0 400 200" className="w-full h-full" style={{fontFamily: 'sans-serif'}}>
    <rect width="100%" height="100%" fill="#1a0b2e" />
    
    {/* Main Line */}
    <line x1="20" y1="100" x2="380" y2="100" stroke="#4c1d95" strokeWidth="4" />
    <path d="M 370 90 L 380 100 L 370 110" fill="none" stroke="#4c1d95" strokeWidth="4" />

    {/* Past Simple Marker */}
    <circle cx="80" cy="100" r="6" fill="#f472b6" />
    <text x="80" y="80" fill="#f472b6" textAnchor="middle" fontSize="12" fontWeight="bold">PAST SIMPLE</text>
    <text x="80" y="130" fill="#f472b6" textAnchor="middle" fontSize="10">Yesterday</text>
    <text x="80" y="145" fill="#f472b6" textAnchor="middle" fontSize="10">Ago</text>

    {/* Present Marker */}
    <line x1="200" y1="60" x2="200" y2="140" stroke="#fff" strokeWidth="2" strokeDasharray="4 4" />
    <text x="200" y="50" fill="#fff" textAnchor="middle" fontSize="14" fontWeight="bold">NOW</text>

    {/* Present Continuous Range */}
    <path d="M 180 100 Q 200 80 220 100 Q 200 120 180 100" fill="rgba(34, 211, 238, 0.3)" stroke="#22d3ee" strokeWidth="2" />
    <text x="200" y="90" fill="#22d3ee" textAnchor="middle" fontSize="10" fontWeight="bold">CONTINUOUS</text>
    
    {/* Present Perfect Arc */}
    <path d="M 90 100 Q 145 20 200 95" fill="none" stroke="#a78bfa" strokeWidth="3" strokeDasharray="5 5" markerEnd="url(#arrowPerf)" />
    <text x="145" y="40" fill="#a78bfa" textAnchor="middle" fontSize="12" fontWeight="bold">PRESENT PERFECT</text>
    <text x="145" y="160" fill="#a78bfa" textAnchor="middle" fontSize="10">Result visible NOW!</text>

    <defs>
        <marker id="arrowPerf" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L0,6 L9,3 z" fill="#a78bfa" />
        </marker>
    </defs>
  </svg>
);

const SentenceStructureSVG = () => (
    <svg viewBox="0 0 300 120" className="w-full h-full">
        {/* Subject */}
        <g transform="translate(10, 30)">
            <rect x="0" y="0" width="80" height="60" rx="8" fill="#ec4899" />
            <text x="40" y="25" fill="#fff" textAnchor="middle" fontSize="14" fontWeight="bold">WHO?</text>
            <text x="40" y="45" fill="rgba(255,255,255,0.8)" textAnchor="middle" fontSize="12">Subject</text>
        </g>
        
        <text x="100" y="65" fill="#fff" fontSize="20" fontWeight="bold">+</text>

        {/* Verb */}
        <g transform="translate(120, 30)">
            <rect x="0" y="0" width="80" height="60" rx="8" fill="#22d3ee" />
            <text x="40" y="25" fill="#000" textAnchor="middle" fontSize="14" fontWeight="bold">ACTION</text>
            <text x="40" y="45" fill="rgba(0,0,0,0.6)" textAnchor="middle" fontSize="12">Verb (s/ed)</text>
        </g>

        <text x="210" y="65" fill="#fff" fontSize="20" fontWeight="bold">+</text>

        {/* Object */}
        <g transform="translate(230, 30)">
            <rect x="0" y="0" width="60" height="60" rx="8" fill="#8b5cf6" />
            <text x="30" y="35" fill="#fff" textAnchor="middle" fontSize="14" fontWeight="bold">...</text>
        </g>
    </svg>
);

export default function English7Cheatsheet() {
  return (
    <div className="min-h-screen bg-[#0f0718] text-purple-100 p-4 md:p-8 font-sans relative overflow-x-hidden selection:bg-fuchsia-500/30">
      {/* Neon Background */}
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none" 
           style={{ backgroundImage: 'linear-gradient(to right, #2e1065 1px, transparent 1px), linear-gradient(to bottom, #2e1065 1px, transparent 1px)', backgroundSize: '50px 50px' }}>
      </div>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-fuchsia-600/20 blur-[100px] rounded-full pointer-events-none"></div>

      <div className="max-w-5xl mx-auto relative z-10">
        
        <header className="mb-12 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-fuchsia-900/30 border border-fuchsia-500/50 text-fuchsia-300 text-sm mb-4 font-bold tracking-widest uppercase shadow-[0_0_15px_rgba(236,72,153,0.3)]">
                <Globe className="w-4 h-4" /> Global_Link_Established
            </div>
            <h1 className="text-5xl md:text-7xl font-black text-white mb-2 tracking-tighter drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
                NEON <span className="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-cyan-400">POLYGLOT</span>
            </h1>
            <p className="text-violet-300 text-lg">
                Grade 7 Access // Tenses, Verbs & Communication Protocols
            </p>
        </header>

        {/* SECTION 1: TENSES BATTLE */}
        <section className="mb-16">
            <div className="flex items-center gap-3 mb-6">
                <Clock className="text-cyan-400 w-8 h-8 animate-pulse" />
                <h2 className="text-3xl font-bold text-white">Машина Времени (The Big 4)</h2>
            </div>
            
            <div className="grid lg:grid-cols-2 gap-8 items-stretch">
                <div className="bg-[#1a0b2e] rounded-2xl border-2 border-fuchsia-500/30 overflow-hidden shadow-2xl h-80 lg:h-auto">
                    <TimelineSVG />
                </div>

                <div className="grid grid-cols-1 gap-4">
                    <Card className="bg-[#1a0b2e]/80 border-l-4 border-l-pink-500 border-t-0 border-r-0 border-b-0 hover:bg-[#2e1065] transition-colors">
                        <CardContent className="p-4">
                            <h3 className="text-pink-400 font-bold text-lg mb-1 flex justify-between">
                                Past Simple
                                <span className="text-xs bg-pink-900/50 px-2 py-1 rounded text-white">V2 / Ved</span>
                            </h3>
                            <p className="text-sm text-gray-300">Факт в прошлом. Точное время (yesterday, in 2020). <br/><em>"I played Dota yesterday."</em></p>
                        </CardContent>
                    </Card>

                    <Card className="bg-[#1a0b2e]/80 border-l-4 border-l-white border-t-0 border-r-0 border-b-0 hover:bg-[#2e1065] transition-colors">
                        <CardContent className="p-4">
                            <h3 className="text-white font-bold text-lg mb-1 flex justify-between">
                                Present Simple
                                <span className="text-xs bg-gray-700 px-2 py-1 rounded text-white">V1 / Vs</span>
                            </h3>
                            <p className="text-sm text-gray-300">Рутина. Регулярно (often, usually). <br/><em>"I always sleep in math class."</em></p>
                        </CardContent>
                    </Card>

                    <Card className="bg-[#1a0b2e]/80 border-l-4 border-l-cyan-400 border-t-0 border-r-0 border-b-0 hover:bg-[#2e1065] transition-colors">
                        <CardContent className="p-4">
                            <h3 className="text-cyan-400 font-bold text-lg mb-1 flex justify-between">
                                Present Continuous
                                <span className="text-xs bg-cyan-900/50 px-2 py-1 rounded text-white">am/is/are + Ving</span>
                            </h3>
                            <p className="text-sm text-gray-300">Прямо сейчас! (Now, look!). <br/><em>"I am doing my homework (actually no)."</em></p>
                        </CardContent>
                    </Card>

                    <Card className="bg-[#1a0b2e]/80 border-l-4 border-l-violet-400 border-t-0 border-r-0 border-b-0 hover:bg-[#2e1065] transition-colors">
                        <CardContent className="p-4">
                            <h3 className="text-violet-400 font-bold text-lg mb-1 flex justify-between">
                                Present Perfect
                                <span className="text-xs bg-violet-900/50 px-2 py-1 rounded text-white">have/has + V3</span>
                            </h3>
                            <p className="text-sm text-gray-300">Результат! Время не важно, важен опыт. <br/><em>"I have lost my keys." (Нет ключей сейчас!)</em></p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </section>

        {/* SECTION 2: SENTENCE BUILDER */}
        <section className="mb-16">
            <div className="flex items-center gap-3 mb-6">
                <MessageCircle className="text-fuchsia-400 w-8 h-8" />
                <h2 className="text-3xl font-bold text-white">Конструктор Предложений</h2>
            </div>

            <div className="bg-[#1e1b4b] p-6 rounded-3xl border border-indigo-500/30">
                 <div className="h-32 mb-6">
                     <SentenceStructureSVG />
                 </div>
                 <div className="grid md:grid-cols-2 gap-6">
                    <div className="bg-black/30 p-4 rounded-xl border border-white/10">
                        <h4 className="font-bold text-fuchsia-400 mb-2">⛔ Отрицание (NOT)</h4>
                        <p className="text-sm text-gray-300 mb-2">Нужен помощник (Auxiliary Verb)!</p>
                        <div className="font-mono bg-black p-2 rounded text-green-400 text-sm">
                            I <span className="text-red-500">do not</span> like...<br/>
                            He <span className="text-red-500">did not</span> go...
                        </div>
                    </div>
                    <div className="bg-black/30 p-4 rounded-xl border border-white/10">
                        <h4 className="font-bold text-cyan-400 mb-2">❓ Вопрос (?)</h4>
                        <p className="text-sm text-gray-300 mb-2">Помощник прыгает вперед!</p>
                        <div className="font-mono bg-black p-2 rounded text-green-400 text-sm">
                            <span className="text-cyan-400">Do</span> you like...?<br/>
                            <span className="text-cyan-400">Have</span> you seen...?
                        </div>
                    </div>
                 </div>
            </div>
        </section>

        {/* SECTION 3: IRREGULAR VERBS (GLITCHES) */}
        <section className="mb-16">
             <div className="flex items-center gap-3 mb-6">
                <AlertTriangle className="text-red-500 w-8 h-8" />
                <h2 className="text-3xl font-bold text-white">Сбой в Матрице (Irregular Verbs)</h2>
                <p className="text-sm text-gray-400 hidden md:block">Этих ребят надо просто вызубрить</p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                 {[
                    ['BE', 'WAS/WERE', 'BEEN', 'Быть'],
                    ['GO', 'WENT', 'GONE', 'Идти'],
                    ['DO', 'DID', 'DONE', 'Делать'],
                    ['HAVE', 'HAD', 'HAD', 'Иметь'],
                    ['SEE', 'SAW', 'SEEN', 'Видеть'],
                    ['TAKE', 'TOOK', 'TAKEN', 'Брать'],
                    ['MAKE', 'MADE', 'MADE', 'Создавать'],
                    ['EAT', 'ATE', 'EATEN', 'Есть'],
                 ].map(([v1, v2, v3, ru], i) => (
                    <div key={i} className="bg-gray-900 border border-gray-700 hover:border-fuchsia-500 p-3 rounded-lg group transition-all">
                        <div className="text-xs text-gray-500 mb-1">{ru}</div>
                        <div className="font-bold text-white group-hover:text-fuchsia-300">{v1}</div>
                        <div className="text-sm text-gray-400 group-hover:text-white">{v2}</div>
                        <div className="text-sm text-gray-400 group-hover:text-white">{v3}</div>
                    </div>
                 ))}
            </div>
        </section>

        <div className="flex justify-center pb-8">
            <Link href="/vpr-tests" className="group flex items-center gap-3 bg-fuchsia-700 hover:bg-fuchsia-600 text-white font-bold py-4 px-10 rounded-full shadow-[0_0_20px_rgba(192,38,211,0.5)] transition-all hover:scale-105">
                <Play className="w-5 h-5 fill-current" /> 
                <span>EXIT LEVEL</span>
            </Link>
        </div>

      </div>
    </div>
  );
}