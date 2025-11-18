"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Globe, Lock, Server, FileText, RotateCcw, CheckCircle2, AlertTriangle, Terminal, Wifi } from "lucide-react";
import Link from "next/link";
import { cn } from '@/lib/utils';

// --- GAME DATA: The Problem ---
// Доступ к файлу gаme.ppt, находящемуся на сервере help.ru, осуществляется по протоколу http.
const TASK_FRAGMENTS = [
  { id: 1, text: "//", type: "separator" },
  { id: 2, text: "/", type: "separator" },
  { id: 3, text: "http:", type: "protocol" },
  { id: 4, text: "ru", type: "domain-zone" },
  { id: 5, text: "help.", type: "domain-name" },
  { id: 6, text: "game", type: "filename" },
  { id: 7, text: ".ppt", type: "extension" },
];

const CORRECT_SEQUENCE = [3, 1, 5, 4, 2, 6, 7]; // http: // help. ru / game .ppt
const CORRECT_URL = "http://help.ru/game.ppt";

export default function InformaticsCheatsheet() {
  const [sequence, setSequence] = useState<number[]>([]);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

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
    
    if (currentString === correctString) {
      setStatus('success');
    } else {
      setStatus('error');
    }
  };

  // Determine current constructed URL string for display
  const constructedUrl = sequence.map(id => TASK_FRAGMENTS.find(f => f.id === id)?.text).join('');

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
            <span className="text-green-500">&lt;</span> URL DECODER <span className="text-green-500">/&gt;</span>
          </h1>
          <p className="text-zinc-400">Информатика 7 класс • Сети • Адресация</p>
        </header>

        {/* --- INTERACTIVE LESSON --- */}
        <Card className="bg-zinc-900 border-green-500/30 shadow-[0_0_30px_rgba(34,197,94,0.1)] mb-12 overflow-hidden">
          <CardHeader className="border-b border-green-500/20 bg-zinc-900/50">
            <CardTitle className="flex items-center gap-2 text-white">
              <Terminal className="w-5 h-5 text-green-500" /> 
              Mission: Собери Адрес
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
              <p className="mt-2 text-green-500 animate-pulse">_ Ожидание ввода адреса...</p>
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
              <Button 
                onClick={handleReset} 
                variant="outline" 
                className="border-zinc-600 text-zinc-400 hover:text-white hover:bg-zinc-800"
              >
                <RotateCcw className="w-4 h-4 mr-2" /> Сброс (Reboot)
              </Button>
              <Button 
                onClick={handleCheck}
                disabled={status === 'success' || sequence.length === 0}
                className={cn(
                  "font-bold min-w-[140px]",
                  status === 'success' ? "bg-green-600 hover:bg-green-700" : "bg-white text-black hover:bg-gray-200"
                )}
              >
                {status === 'success' ? "ACCESS GRANTED" : "Connect ->"}
              </Button>
            </div>
            
            {/* SUCCESS MESSAGE */}
            <AnimatePresence>
              {status === 'success' && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-6 p-4 bg-green-900/20 border border-green-500/50 rounded-lg text-center"
                >
                  <p className="text-green-300 font-bold text-lg">Отличная работа, Агент! 🎉</p>
                  <p className="text-zinc-400">Код ответа: <span className="font-mono font-bold text-white tracking-widest">3154267</span></p>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>

        {/* --- THE CHEATSHEET (THEORY) --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
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
            desc="Имя компьютера в сети. 'ru' — домен верхнего уровня (страна), 'help' — имя сайта."
            color="text-cyan-400"
            borderColor="border-cyan-500/30"
          />
          <InfoCard 
            icon={<FileText className="w-6 h-6" />}
            title="3. Файл (Путь)"
            code="/game.ppt"
            desc="Что конкретно мы берем. Слэш '/' разделяет папки. В конце — расширение (.ppt)."
            color="text-yellow-400"
            borderColor="border-yellow-500/30"
          />
        </div>

        {/* --- VIBE CODING CONNECTION (The Morale Boost) --- */}
        <div className="relative p-8 rounded-2xl border-2 border-dashed border-zinc-700 bg-zinc-900/50 overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-20">
            <Wifi className="w-24 h-24 text-white" />
          </div>
          
          <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
            🚀 Как это связано с Vibe Coding?
          </h3>
          <p className="text-zinc-300 mb-4 leading-relaxed">
            Думаешь, это просто школьная задачка? <strong className="text-green-400">Не-а.</strong>
          </p>
          <p className="text-zinc-300 mb-6 leading-relaxed">
            В нашем <strong>Warehouse App</strong> (приложение для склада) мы используем точно такие же адреса, чтобы общаться с сервером (API). 
            Когда ты сканируешь штрих-код, телефон отправляет запрос по ссылке, похожей на эту:
          </p>
          
          <div className="bg-black p-4 rounded-lg border border-zinc-800 font-mono text-xs md:text-sm mb-6 overflow-x-auto whitespace-nowrap">
            <span className="text-pink-500">https://</span>
            <span className="text-cyan-500">api.wildberries.ru</span>
            <span className="text-zinc-500">/stocks/</span>
            <span className="text-yellow-500">update</span>
          </div>

          <p className="text-zinc-300">
            Понимаешь структуру URL = Понимаешь, как работает весь современный Интернет и IT-бизнес. 
            Ты уже учишься быть инженером, просто решая эти тесты.
          </p>

          <Link href="/vpr-tests">
            <Button className="bg-green-600 hover:bg-green-500 text-white font-bold rounded-full px-8 py-6 text-lg transition-all hover:scale-105 shadow-lg shadow-green-900/20">
              На Базу
            </Button>
          </Link>
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
