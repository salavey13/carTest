"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Globe, Lock, Server, FileText, RotateCcw, CheckCircle2, AlertTriangle, Terminal, Wifi, Search, Circle, MoveDown } from "lucide-react";
import Link from "next/link";
import { cn } from '@/lib/utils';

// --- GAME 1 DATA: URL ---
const TASK_FRAGMENTS = [
  { id: 1, text: "//", type: "separator" },
  { id: 2, text: "/", type: "separator" },
  { id: 3, text: "http:", type: "protocol" },
  { id: 4, text: "ru", type: "domain-zone" },
  { id: 5, text: "help.", type: "domain-name" },
  { id: 6, text: "game", type: "filename" },
  { id: 7, text: ".ppt", type: "extension" },
];
const CORRECT_SEQUENCE = [3, 1, 5, 4, 2, 6, 7]; // http://help.ru/game.ppt

// --- GAME 2 DATA: EULER CIRCLES ---
// Задача: Расположить в порядке УБЫВАНИЯ количества страниц
const EULER_ITEMS = [
  { id: 101, text: "Крейсер & Аврора", type: "and", label: "Мало (Пересечение)" },
  { id: 102, text: "Крейсер | Аврора", type: "or", label: "Много (Объединение)" },
  { id: 103, text: "Крейсер", type: "single", label: "Средне (Одно слово)" },
];
// Правильный порядок убывания: ИЛИ (Много) -> Одно слово -> И (Мало)
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
            Protocol: Knowledge_Transfer_v7.0
          </motion.div>
          <h1 className="text-4xl md:text-6xl font-black text-white mb-2 tracking-tighter">
            <span className="text-green-500">&lt;</span> NET MASTER <span className="text-green-500">/&gt;</span>
          </h1>
          <p className="text-zinc-400">Информатика 7 класс • Адресация • Поиск</p>
        </header>

        {/* ================================================================================== */}
        {/* SECTION 1: URL DECODER */}
        {/* ================================================================================== */}
        <Card className="bg-zinc-900 border-green-500/30 shadow-[0_0_30px_rgba(34,197,94,0.1)] mb-12 overflow-hidden">
          <CardHeader className="border-b border-green-500/20 bg-zinc-900/50">
            <CardTitle className="flex items-center gap-2 text-white">
              <Terminal className="w-5 h-5 text-green-500" /> 
              Mission 1: Собери Адрес
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="mb-6 bg-zinc-950 p-4 rounded-lg border border-zinc-800 font-mono text-sm md:text-base text-zinc-300">
              <p className="mb-2"><span className="text-green-500">root@school:~$</span> cat task.txt</p>
              <p className="italic text-zinc-400">
                "Доступ к файлу <span className="text-white font-bold">gаme.ppt</span>, 
                находящемуся на сервере <span className="text-white font-bold">help.ru</span>, 
                осуществляется по протоколу <span className="text-white font-bold">http</span>."
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
              <span className="truncate w-full">
                {constructedUrl || "Нажимай на фрагменты ниже..."}
              </span>
              {status === 'success' && <CheckCircle2 className="w-6 h-6 text-green-500 ml-2" />}
              {status === 'error' && <AlertTriangle className="w-6 h-6 text-red-500 ml-2" />}
            </div>

            {/* FRAGMENTS BUTTONS */}
            <div className="flex flex-wrap gap-3 justify-center mb-8">
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
                      "px-4 py-3 rounded border font-bold font-mono text-lg relative overflow-hidden group transition-all",
                      isUsed 
                        ? "bg-zinc-800 border-zinc-800 text-zinc-600 cursor-not-allowed opacity-50" 
                        : "bg-zinc-900 border-green-500/50 text-green-400 hover:bg-green-500/10 hover:border-green-400 hover:shadow-[0_0_15px_rgba(34,197,94,0.4)]"
                    )}
                  >
                    <span className="absolute top-0 left-1 text-[8px] opacity-50">{frag.id}</span>
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
                {status === 'success' ? "ACCESS GRANTED" : "Connect ->"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* --- CHEATSHEET 1: URL --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
          <InfoCard 
            icon={<Lock className="w-6 h-6" />}
            title="1. Протокол"
            code="http:// или https://"
            desc="Правила общения. Как рукопожатие. HTTPS — это защищенное рукопожатие (шифрование)."
            color="text-pink-400"
            borderColor="border-pink-500/30"
          />
          <InfoCard 
            icon={<Server className="w-6 h-6" />}
            title="2. Сервер (Домен)"
            code="help.ru"
            desc="Имя компьютера в сети. 'ru' — домен верхнего уровня, 'help' — имя сайта."
            color="text-cyan-400"
            borderColor="border-cyan-500/30"
          />
          <InfoCard 
            icon={<FileText className="w-6 h-6" />}
            title="3. Файл (Путь)"
            code="/game.ppt"
            desc="Что конкретно берем. Слэш '/' разделяет папки. В конце — расширение (.ppt)."
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
                         {/* SVG Representation for Union */}
                        <svg viewBox="0 0 200 120" className="w-full h-full drop-shadow-[0_0_10px_rgba(168,85,247,0.4)]">
                            <circle cx="70" cy="60" r="40" fill="rgba(168, 85, 247, 0.6)" stroke="#a855f7" strokeWidth="2" />
                            <circle cx="130" cy="60" r="40" fill="rgba(168, 85, 247, 0.6)" stroke="#a855f7" strokeWidth="2" />
                            <text x="100" y="115" textAnchor="middle" fill="#fff" fontSize="12" className="font-mono">ВСЁ ВМЕСТЕ</text>
                        </svg>
                    </div>
                    <p className="text-zinc-300 text-sm">
                        Поисковик ищет страницы, где есть <span className="text-purple-400 font-bold">ХОТЯ БЫ ОДНО</span> слово.
                        <br/><br/>
                        <span className="bg-purple-500/20 px-2 py-1 rounded text-purple-200">РЕЗУЛЬТАТОВ МНОГО 📈</span>
                    </p>
                </div>

                {/* CARD: AND (&) */}
                <div className="bg-zinc-900/50 border border-blue-500/30 rounded-xl p-6 flex flex-col items-center text-center relative overflow-hidden">
                    <div className="absolute top-2 right-4 text-4xl font-black text-blue-500/10 pointer-events-none">AND</div>
                    <h3 className="text-blue-400 font-bold text-xl mb-2">Пересечение (И / &)</h3>
                    <div className="relative w-48 h-32 my-4">
                        {/* SVG Representation for Intersection */}
                        <svg viewBox="0 0 200 120" className="w-full h-full drop-shadow-[0_0_10px_rgba(59,130,246,0.4)]">
                            <circle cx="70" cy="60" r="40" fill="none" stroke="#3b82f6" strokeWidth="2" strokeOpacity="0.3" />
                            <circle cx="130" cy="60" r="40" fill="none" stroke="#3b82f6" strokeWidth="2" strokeOpacity="0.3" />
                            {/* Intersection path */}
                            <path d="M 110,26 A 40 40 0 0 1 110,94 A 40 40 0 0 1 110,26" fill="rgba(59, 130, 246, 0.9)" stroke="#3b82f6" />
                            <text x="100" y="115" textAnchor="middle" fill="#fff" fontSize="12" className="font-mono">ТОЛЬКО ОБЩЕЕ</text>
                        </svg>
                    </div>
                    <p className="text-zinc-300 text-sm">
                        Поисковик ищет страницы, где есть <span className="text-blue-400 font-bold">ОБА СЛОВА СРАЗУ</span>.
                        <br/><br/>
                        <span className="bg-blue-500/20 px-2 py-1 rounded text-blue-200">РЕЗУЛЬТАТОВ МАЛО 📉</span>
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
                        <span className="text-zinc-500 text-xs">(Сначала то, что найдет больше всего страниц, в конце — меньше всего).</span>
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
                            <CheckCircle2 className="w-5 h-5" /> Верно! "ИЛИ" {'>'} "СЛОВО" {'>'} "И"
                        </span>
                    )}
                    {eulerStatus === 'error' && (
                        <span className="text-red-400 font-bold flex items-center justify-center gap-2">
                            <AlertTriangle className="w-5 h-5" /> Неверно. Вспомни правило: (ИЛИ {'>'} И)
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
                        {eulerStatus === 'success' ? "LOGIC VERIFIED" : "Проверить Порядок"}
                    </Button>
                </div>
            </CardContent>
        </Card>


        {/* --- VIBE CODING CONNECTION (The Morale Boost) --- */}
        <div className="relative p-8 rounded-2xl border-2 border-dashed border-zinc-700 bg-zinc-900/50 overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-20">
            <Wifi className="w-24 h-24 text-white" />
          </div>
          
          <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
            🚀 Как это связано с Vibe Coding?
          </h3>
          <p className="text-zinc-300 mb-4 leading-relaxed">
            Думаешь, это просто школьные задачки? <strong className="text-green-400">Не-а.</strong>
          </p>
          <div className="space-y-4">
            <p className="text-zinc-300 leading-relaxed">
              <strong>1. URL (Ссылки):</strong> В нашем <strong>Warehouse App</strong> мы используем такие же адреса для API. 
              <span className="block bg-black p-2 rounded mt-1 border border-zinc-800 font-mono text-xs">
                 <span className="text-pink-500">https://</span>api.wb.ru<span className="text-zinc-500">/stocks/</span><span className="text-yellow-500">update</span>
              </span>
            </p>
            <p className="text-zinc-300 leading-relaxed">
               <strong>2. Логика (И/ИЛИ):</strong> Когда ты фильтруешь товары на маркетплейсе (например: "Кроссовки" <span className="text-blue-400 font-bold">И</span> "Черные" <span className="text-blue-400 font-bold">И</span> "38 размер"), ты используешь операцию <strong>AND</strong>, отсекая лишнее.
            </p>
          </div>

          <div className="mt-8">
            <Link href="/vpr-tests">
                <Button className="bg-green-600 hover:bg-green-500 text-white font-bold rounded-full px-8 py-6 text-lg transition-all hover:scale-105 shadow-lg shadow-green-900/20 w-full md:w-auto">
                На Базу (Тесты)
                </Button>
            </Link>
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