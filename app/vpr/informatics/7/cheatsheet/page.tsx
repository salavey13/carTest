"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Globe, Lock, Server, FileText, RotateCcw, CheckCircle2, AlertTriangle, Terminal, Wifi, Search, Circle, MoveDown, Rocket, Zap, ShieldCheck, Network } from "lucide-react";
import Link from "next/link";
import { cn } from '@/lib/utils';

// --- GAME 1 DATA: ROUTING (Next.js Style) ---
// Задача: Собрать путь к веб-приложению
const TASK_FRAGMENTS = [
  { id: 1, text: "https://", type: "protocol" },
  { id: 2, text: "cyber.", type: "subdomain" },
  { id: 3, text: "net", type: "domain-zone" },
  { id: 4, text: "/", type: "separator" },
  { id: 5, text: "app", type: "folder" },
  { id: 6, text: "/", type: "separator" },
  { id: 7, text: "start-training", type: "page" },
];
// Цель: https://cyber.net/app/start-training
const CORRECT_SEQUENCE = [1, 2, 3, 4, 5, 6, 7]; 

// --- GAME 2 DATA: EULER CIRCLES ---
const EULER_ITEMS = [
  { id: 101, text: "Python & Java", type: "and", label: "Мало (Пересечение)" },
  { id: 102, text: "Python | Java", type: "or", label: "Много (Объединение)" },
  { id: 103, text: "Python", type: "single", label: "Средне (Одно слово)" },
];
// Порядок убывания: ИЛИ -> Одно -> И
const EULER_CORRECT_SEQUENCE = [102, 103, 101]; 

export default function InformaticsCheatsheet() {
  // --- URL Game State ---
  const [sequence, setSequence] = useState<number[]>([]);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // --- Euler Game State ---
  const [eulerSequence, setEulerSequence] = useState<number[]>([]);
  const [eulerStatus, setEulerStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // --- URL Handlers ---
  const handleFragmentClick = (id: number) => {
    if (status === 'success') return;
    setSequence(prev => [...prev, id]);
    setStatus('idle');
  };
  const handleReset = () => {
    setSequence([]);
    setStatus('idle');
  };
  const handleCheck = () => {
    const currentString = sequence.join(',');
    const correctString = CORRECT_SEQUENCE.join(',');
    setStatus(currentString === correctString ? 'success' : 'error');
  };
  const constructedUrl = sequence.map(id => TASK_FRAGMENTS.find(f => f.id === id)?.text).join('');

  // --- Euler Handlers ---
  const handleEulerClick = (id: number) => {
    if (eulerStatus === 'success' || eulerSequence.includes(id)) return;
    setEulerSequence(prev => [...prev, id]);
    setEulerStatus('idle');
  };
  const handleEulerReset = () => {
    setEulerSequence([]);
    setEulerStatus('idle');
  };
  const handleEulerCheck = () => {
    const currentString = eulerSequence.join(',');
    const correctString = EULER_CORRECT_SEQUENCE.join(',');
    setEulerStatus(currentString === correctString ? 'success' : 'error');
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-green-400 font-mono p-4 md:p-8 selection:bg-green-900 selection:text-white relative overflow-hidden">
      {/* Background Grid Effect */}
      <div className="absolute inset-0 pointer-events-none opacity-10" 
           style={{ backgroundImage: 'linear-gradient(0deg, transparent 24%, rgba(0, 255, 0, .3) 25%, rgba(0, 255, 0, .3) 26%, transparent 27%, transparent 74%, rgba(0, 255, 0, .3) 75%, rgba(0, 255, 0, .3) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(0, 255, 0, .3) 25%, rgba(0, 255, 0, .3) 26%, transparent 27%, transparent 74%, rgba(0, 255, 0, .3) 75%, rgba(0, 255, 0, .3) 76%, transparent 77%, transparent)', backgroundSize: '50px 50px' }}>
      </div>

      <div className="max-w-4xl mx-auto relative z-10">
        
        {/* HEADER */}
        <header className="mb-10 text-center">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-block border border-green-500/50 bg-green-900/20 px-4 py-1 rounded-full text-xs tracking-widest uppercase mb-4"
          >
            Protocol: Routing_v7.0
          </motion.div>
          <h1 className="text-4xl md:text-6xl font-black text-white mb-2 tracking-tighter">
            <span className="text-green-500">&lt;</span> NET ARCHITECT <span className="text-green-500">/&gt;</span>
          </h1>
          <p className="text-zinc-400">Информатика 7 класс • Маршрутизация • Логика</p>
        </header>

        {/* ================================================================================== */}
        {/* SECTION 1: ROUTING GAME */}
        {/* ================================================================================== */}
        <Card className="bg-zinc-900 border-green-500/30 shadow-[0_0_30px_rgba(34,197,94,0.1)] mb-12 overflow-hidden">
          <CardHeader className="border-b border-green-500/20 bg-zinc-900/50">
            <CardTitle className="flex items-center gap-2 text-white">
              <Network className="w-5 h-5 text-green-500" /> 
              Mission 1: Построй Маршрут (Routing)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="mb-6 bg-zinc-950 p-4 rounded-lg border border-zinc-800 font-mono text-sm md:text-base text-zinc-300">
              <p className="mb-2"><span className="text-green-500">dev@local:~$</span> cat requirements.txt</p>
              <p className="italic text-zinc-400">
                "Для доступа к панели тренировки, перейдите на защищенный протокол <span className="text-white font-bold">https</span>, сервер <span className="text-white font-bold">cyber.net</span>, в раздел приложения <span className="text-white font-bold">app</span>, на страницу <span className="text-white font-bold">start-training</span>."
              </p>
            </div>

            {/* ADDRESS BAR */}
            <div className={cn(
              "flex items-center h-14 px-4 rounded-lg border-2 mb-6 font-mono text-lg transition-all",
              status === 'success' ? "bg-green-950/30 border-green-500 text-white" :
              status === 'error' ? "bg-red-950/30 border-red-500 text-red-200" :
              "bg-zinc-950 border-zinc-700 text-zinc-400"
            )}>
              <Globe className="w-5 h-5 mr-3 opacity-50" />
              <span className="truncate w-full tracking-wider">
                {constructedUrl || "Нажимай фрагменты..."}
              </span>
              {status === 'success' && <CheckCircle2 className="w-6 h-6 text-green-500 ml-2" />}
              {status === 'error' && <AlertTriangle className="w-6 h-6 text-red-500 ml-2" />}
            </div>

            {/* FRAGMENTS BUTTONS */}
            <div className="flex flex-wrap gap-2 justify-center mb-8">
              {TASK_FRAGMENTS.map((frag) => {
                const isUsed = sequence.includes(frag.id);
                return (
                  <motion.button
                    key={frag.id}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleFragmentClick(frag.id)}
                    disabled={isUsed || status === 'success'}
                    className={cn(
                      "px-3 py-2 rounded border font-bold font-mono text-lg relative overflow-hidden group transition-all",
                      isUsed 
                        ? "bg-zinc-800 border-zinc-800 text-zinc-600 cursor-not-allowed opacity-50" 
                        : "bg-zinc-900 border-green-500/50 text-green-400 hover:bg-green-500/10 hover:border-green-400 hover:shadow-[0_0_15px_rgba(34,197,94,0.4)]"
                    )}
                  >
                    {frag.text}
                  </motion.button>
                );
              })}
            </div>

            {/* CONTROLS */}
            <div className="flex justify-center gap-4">
              <Button onClick={handleReset} variant="outline" className="border-zinc-600 text-zinc-400 hover:text-white hover:bg-zinc-800">
                <RotateCcw className="w-4 h-4 mr-2" /> Сброс
              </Button>
              <Button 
                onClick={handleCheck}
                disabled={status === 'success' || sequence.length === 0}
                className={cn("font-bold min-w-[140px]", status === 'success' ? "bg-green-600" : "bg-white text-black")}
              >
                {status === 'success' ? "ROUTING OK" : "Проверить Путь"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* --- CHEATSHEET 1: URL THEORY --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
          <InfoCard 
            icon={<Lock className="w-6 h-6" />}
            title="1. Протокол"
            code="https://"
            desc="Язык общения. HTTP — открытый текст. HTTPS (Secure) — шифрованный канал. Как бронированный кабель."
            color="text-pink-400"
            borderColor="border-pink-500/30"
          />
          <InfoCard 
            icon={<Server className="w-6 h-6" />}
            title="2. Домен (Сервер)"
            code="cyber.net"
            desc="Адрес дома в интернете. DNS-серверы переводят эти буквы в IP-адреса (цифры), чтобы компьютеры нашли друг друга."
            color="text-cyan-400"
            borderColor="border-cyan-500/30"
          />
          <InfoCard 
            icon={<FileText className="w-6 h-6" />}
            title="3. Путь (Роутинг)"
            code="/app/start..."
            desc="Путь внутри сервера. В современном вебе это не всегда файл, а часто 'маршрут' к коду, который генерирует страницу."
            color="text-yellow-400"
            borderColor="border-yellow-500/30"
          />
        </div>

        {/* ================================================================================== */}
        {/* SECTION 2: EULER CIRCLES */}
        {/* ================================================================================== */}
        
        {/* THEORY VISUALIZATION */}
        <div className="mb-12">
            <div className="flex items-center gap-4 mb-6">
                <div className="h-[1px] bg-green-500/30 flex-grow"></div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Search className="text-purple-400" /> Логика Поиска (Круги Эйлера)
                </h2>
                <div className="h-[1px] bg-green-500/30 flex-grow"></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* CARD: OR (|) */}
                <div className="bg-zinc-900/50 border border-purple-500/30 rounded-xl p-6 flex flex-col items-center text-center relative overflow-hidden">
                    <div className="absolute top-2 right-4 text-4xl font-black text-purple-500/10 pointer-events-none">OR</div>
                    <h3 className="text-purple-400 font-bold text-xl mb-2">Объединение (ИЛИ / |)</h3>
                    <div className="relative w-48 h-32 my-4">
                        <svg viewBox="0 0 200 120" className="w-full h-full drop-shadow-[0_0_10px_rgba(168,85,247,0.4)]">
                            <circle cx="70" cy="60" r="40" fill="rgba(168, 85, 247, 0.6)" stroke="#a855f7" strokeWidth="2" />
                            <circle cx="130" cy="60" r="40" fill="rgba(168, 85, 247, 0.6)" stroke="#a855f7" strokeWidth="2" />
                            <text x="100" y="115" textAnchor="middle" fill="#fff" fontSize="12" className="font-mono">ВСЁ ВМЕСТЕ</text>
                        </svg>
                    </div>
                    <p className="text-zinc-300 text-sm">
                        Ищет где есть <span className="text-purple-400 font-bold">ХОТЯ БЫ ОДНО</span> слово.
                        <br/><span className="bg-purple-500/20 px-2 py-1 rounded text-purple-200">РЕЗУЛЬТАТОВ МАКСИМУМ 📈</span>
                    </p>
                </div>

                {/* CARD: AND (&) */}
                <div className="bg-zinc-900/50 border border-blue-500/30 rounded-xl p-6 flex flex-col items-center text-center relative overflow-hidden">
                    <div className="absolute top-2 right-4 text-4xl font-black text-blue-500/10 pointer-events-none">AND</div>
                    <h3 className="text-blue-400 font-bold text-xl mb-2">Пересечение (И / &)</h3>
                    <div className="relative w-48 h-32 my-4">
                        <svg viewBox="0 0 200 120" className="w-full h-full drop-shadow-[0_0_10px_rgba(59,130,246,0.4)]">
                            <circle cx="70" cy="60" r="40" fill="none" stroke="#3b82f6" strokeWidth="2" strokeOpacity="0.3" />
                            <circle cx="130" cy="60" r="40" fill="none" stroke="#3b82f6" strokeWidth="2" strokeOpacity="0.3" />
                            <path d="M 110,26 A 40 40 0 0 1 110,94 A 40 40 0 0 1 110,26" fill="rgba(59, 130, 246, 0.9)" stroke="#3b82f6" />
                            <text x="100" y="115" textAnchor="middle" fill="#fff" fontSize="12" className="font-mono">ТОЛЬКО ОБЩЕЕ</text>
                        </svg>
                    </div>
                    <p className="text-zinc-300 text-sm">
                        Ищет где есть <span className="text-blue-400 font-bold">ОБА СЛОВА СРАЗУ</span>.
                        <br/><span className="bg-blue-500/20 px-2 py-1 rounded text-blue-200">РЕЗУЛЬТАТОВ МИНИМУМ 📉</span>
                    </p>
                </div>
            </div>
        </div>

        {/* INTERACTIVE TASK 2 */}
        <Card className="bg-zinc-900 border-purple-500/30 shadow-[0_0_30px_rgba(168,85,247,0.1)] mb-12 overflow-hidden">
            <CardHeader className="border-b border-purple-500/20 bg-zinc-900/50">
                <CardTitle className="flex items-center gap-2 text-white">
                    <Circle className="w-5 h-5 text-purple-500" /> 
                    Mission 2: Логическая Сортировка
                </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
                <div className="mb-6 bg-zinc-950 p-4 rounded-lg border border-zinc-800 font-mono text-sm text-zinc-300">
                    <p className="mb-4 text-white font-bold">ЗАДАНИЕ:</p>
                    <p>
                        Расположите поисковые запросы в порядке <span className="text-red-400 font-bold underline">УБЫВАНИЯ</span> количества страниц.
                        <br/>
                        <span className="text-zinc-500 text-xs">(От самого широкого запроса к самому узкому).</span>
                    </p>
                </div>

                {/* SELECTED ORDER DISPLAY */}
                <div className="min-h-[60px] flex flex-col gap-2 mb-6 p-4 bg-zinc-950/50 rounded-lg border border-dashed border-zinc-700">
                    <div className="text-xs text-zinc-500 uppercase tracking-widest mb-2">Твой ответ (нажми кнопки ниже):</div>
                    <div className="space-y-2">
                        {eulerSequence.map((id, index) => {
                            const item = EULER_ITEMS.find(i => i.id === id);
                            return (
                                <motion.div 
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    key={id}
                                    className="flex items-center gap-3 text-white bg-zinc-800 p-2 rounded border border-zinc-700"
                                >
                                    <span className="bg-purple-500/20 text-purple-300 px-2 rounded text-xs font-bold">{index + 1}</span>
                                    <span className="font-mono">{item?.text}</span>
                                    <MoveDown className="w-4 h-4 ml-auto text-zinc-600" />
                                </motion.div>
                            )
                        })}
                        {eulerSequence.length === 0 && <span className="text-zinc-600 italic text-sm">Поле пустое...</span>}
                    </div>
                </div>

                {/* RESULT STATUS */}
                <div className="h-8 mb-4 text-center">
                     {eulerStatus === 'success' && (
                        <span className="text-green-400 font-bold flex items-center justify-center gap-2">
                            <CheckCircle2 className="w-5 h-5" /> Верно! Правило воронки: ИЛИ {'>'} СЛОВО {'>'} И
                        </span>
                    )}
                    {eulerStatus === 'error' && (
                        <span className="text-red-400 font-bold flex items-center justify-center gap-2">
                            <AlertTriangle className="w-5 h-5" /> Ошибка. Вспомни: "ИЛИ" дает больше всего результатов.
                        </span>
                    )}
                </div>

                {/* SELECTION BUTTONS */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
                    {EULER_ITEMS.map((item) => {
                         const isSelected = eulerSequence.includes(item.id);
                         return (
                            <button
                                key={item.id}
                                onClick={() => handleEulerClick(item.id)}
                                disabled={isSelected || eulerStatus === 'success'}
                                className={cn(
                                    "p-4 rounded border text-left transition-all relative group",
                                    isSelected 
                                        ? "bg-zinc-900 opacity-40 border-zinc-800 cursor-not-allowed"
                                        : "bg-zinc-900 border-purple-500/30 hover:border-purple-400 hover:bg-purple-900/10"
                                )}
                            >
                                <div className="font-mono font-bold text-purple-300 text-lg mb-1">{item.text}</div>
                                <div className="text-xs text-zinc-500 group-hover:text-zinc-300 transition-colors">{item.label}</div>
                            </button>
                         )
                    })}
                </div>

                {/* CONTROLS */}
                <div className="flex justify-center gap-4">
                    <Button onClick={handleEulerReset} variant="outline" className="border-zinc-600 text-zinc-400 hover:text-white hover:bg-zinc-800">
                        <RotateCcw className="w-4 h-4 mr-2" /> Сброс
                    </Button>
                    <Button 
                        onClick={handleEulerCheck}
                        disabled={eulerStatus === 'success' || eulerSequence.length !== EULER_ITEMS.length}
                        className={cn("font-bold min-w-[140px]", eulerStatus === 'success' ? "bg-green-600 hover:bg-green-700" : "bg-purple-600 hover:bg-purple-700 text-white")}
                    >
                        {eulerStatus === 'success' ? "VERIFIED" : "Проверить"}
                    </Button>
                </div>
            </CardContent>
        </Card>

        {/* --- NEW: CYBER ACADEMY TEASER (BONUS SECTION) --- */}
        <div className="mt-12 bg-gradient-to-br from-indigo-950 to-purple-950 rounded-2xl border border-indigo-500/30 p-8 relative overflow-hidden group hover:border-indigo-400 transition-colors">
            {/* Decorative Background */}
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 pointer-events-none" />
            <div className="absolute -right-20 -top-20 w-64 h-64 bg-indigo-500/20 blur-[100px] rounded-full pointer-events-none group-hover:bg-indigo-400/30 transition-colors" />

            <div className="relative z-10">
                <div className="flex flex-col md:flex-row items-start md:items-center gap-6 mb-6">
                    <div className="bg-indigo-500/20 p-4 rounded-xl border border-indigo-500/40 animate-pulse-slow">
                        <Rocket className="w-10 h-10 text-indigo-300" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="bg-indigo-500 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-widest">Secret Level</span>
                            <span className="text-indigo-300 text-xs font-mono">/// ACCESS_GRANTED</span>
                        </div>
                        <h3 className="text-2xl md:text-4xl font-black text-white font-orbitron leading-tight">
                            КИБЕРШКОЛА: <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">ZERO TO HERO</span>
                        </h3>
                    </div>
                </div>

                <div className="prose prose-invert max-w-none text-indigo-100/80 mb-8 leading-relaxed">
                    <p>
                        Ты прошел основы Информатики. Теперь ты знаешь, как работают URL и логика. Но что, если я скажу тебе, что ты можешь не просто <em>решать</em> тесты, а <strong>СОЗДАВАТЬ</strong> их?
                    </p>
                    <p>
                        Мы построили тренировочный полигон, где ты научишься кодить, деплоить сайты и даже настраивать базы данных, просто играя.
                        <br/>
                        <span className="text-white font-bold">Твой путь от "просто школьник" до "Full-Stack Cyber Demon" начинается здесь.</span>
                    </p>
                    <ul className="grid md:grid-cols-2 gap-2 text-sm mt-4 list-none pl-0">
                        <li className="flex items-center gap-2"><Zap className="w-4 h-4 text-yellow-400"/> Как менять иконки и картинки кодом</li>
                        <li className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-green-400"/> Как задеплоить свой проект бесплатно</li>
                        <li className="flex items-center gap-2"><Terminal className="w-4 h-4 text-pink-400"/> Как работать с GitHub и Vercel</li>
                        <li className="flex items-center gap-2"><Server className="w-4 h-4 text-blue-400"/> Как поднять свою базу данных (Supabase)</li>
                    </ul>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                    <Link href="/start-training" className="flex-1">
                        <Button className="w-full h-14 text-lg font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/50 border border-indigo-400/50 rounded-xl transition-all hover:scale-[1.02]">
                            <Rocket className="mr-2 w-5 h-5" /> НАЧАТЬ ТРЕНИРОВКУ
                        </Button>
                    </Link>
                    
                    {/* Link to the Informatics Subject Page (ID 70), where the tutorial variant might appear or be selected */}
                    <Link href="/vpr-test/70" className="flex-1">
                        <Button variant="outline" className="w-full h-14 text-lg font-bold bg-black/40 border-indigo-500/50 text-indigo-300 hover:bg-indigo-900/30 hover:text-white hover:border-indigo-400 rounded-xl backdrop-blur-sm transition-all">
                            <Terminal className="mr-2 w-5 h-5" /> ПРОЙТИ СЕКРЕТНЫЙ ТЕСТ
                        </Button>
                    </Link>
                </div>
                
                <div className="mt-6 text-center">
                     <Link href="/wblanding" className="text-xs text-indigo-400/60 hover:text-indigo-300 underline decoration-dashed underline-offset-4 transition-colors">
                        P.S. Хочешь узнать, как на этом заработать? (Схема "Синдикат")
                    </Link>
                </div>
            </div>
        </div>

      </div>
    </div>
  );
}

// Helper Component for Theory Cards
function InfoCard({ icon, title, code, desc, color, borderColor }: any) {
  return (
    <div className={cn("bg-zinc-900/80 p-6 rounded-xl border hover:bg-zinc-900 transition-colors", borderColor)}>
      <div className={cn("mb-4", color)}>{icon}</div>
      <h3 className={cn("font-bold text-lg mb-2", color)}>{title}</h3>
      <div className="bg-black/50 px-2 py-1 rounded text-zinc-300 font-mono text-sm mb-3 inline-block border border-white/10">
        {code}
      </div>
      <p className="text-zinc-400 text-sm leading-relaxed">
        {desc}
      </p>
    </div>
  );
}