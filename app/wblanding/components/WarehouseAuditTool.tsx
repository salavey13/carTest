'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { FaSkull, FaRocket, FaCircleCheck, FaTelegram, FaRedo, FaKeyboard, FaArrowRight, FaTriangleExclamation } from 'react-icons/fa6';
import { Loader2, ChevronLeft, Terminal, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useWarehouseAudit } from '../hooks/useWarehouseAudit';
import { useAppContext } from '@/contexts/AppContext';
import { useState, useEffect } from 'react';

export const WarehouseAuditTool = () => {
  const { dbUser } = useAppContext();
  const {
    step, questions, currentAnswer, isSending, breakdown, showResult,
    efficiency, estimatedTime, roadmap, hasCompletedAudit,
    setCurrentAnswer, handleNext, handleGetReport, reset, startAudit, validateAnswer,
    trackAuditEvent,
  } = useWarehouseAudit(dbUser?.user_id);

  const [validationResult, setValidationResult] = useState<{ type: 'error' | 'warning' | null; message: string; }>(null);
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null); // Added missing state

  useEffect(() => {
    // Safety check: make sure question exists before validating
    if (step > 0 && currentAnswer && questions && questions[step]) {
      setValidationResult(validateAnswer(currentAnswer, questions[step]));
    } else {
      setValidationResult(null);
    }
  }, [currentAnswer, step, questions, validateAnswer]);

  // --- WELCOME SCREEN ---
  if (step === 0 && !showResult) {
    return (
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 sm:p-12 shadow-2xl max-w-3xl mx-auto relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"/>
        
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-zinc-800 rounded-2xl mb-6 border border-zinc-700">
            <Terminal className="text-3xl text-indigo-400" />
          </div>
          <h3 className="text-3xl sm:text-5xl font-black text-white mb-4 tracking-tight">
            Ваш Склад <br/><span className="text-red-500">Сжигает Деньги?</span>
          </h3>
          <p className="text-lg text-zinc-400 max-w-lg mx-auto">
            90% селлеров теряют деньги на "невидимых" штрафах и Ghost Stock. 
            Рассчитай свой ежемесячный убыток за 60 секунд.
          </p>
        </div>
        
        <div className="flex justify-center">
          <Button 
            onClick={() => startAudit()} 
            size="lg" 
            className="bg-white text-black hover:bg-gray-200 px-10 py-8 text-xl rounded-xl font-bold shadow-[0_0_30px_rgba(255,255,255,0.2)] transition-transform hover:scale-105"
          >
            Начать Диагностику <FaArrowRight className="ml-3" />
          </Button>
        </div>
        
        <p className="text-center text-zinc-600 mt-6 font-mono text-xs uppercase tracking-widest">
           Системный Анализ • Конфиденциально • Бесплатно
        </p>
      </motion.div>
    );
  }

  // --- RESULT SCREEN ---
  if (showResult && breakdown) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-black border border-zinc-800 rounded-3xl p-8 shadow-2xl max-w-5xl mx-auto"
      >
        <div className="grid lg:grid-cols-2 gap-12">
            {/* Left: The Pain */}
            <div>
                <h3 className="text-zinc-400 font-mono text-sm uppercase mb-2">Текущий Статус</h3>
                <h2 className="text-4xl font-black text-white mb-6">Отчет Эффективности</h2>
                
                <div className="space-y-4">
                    <div className="bg-red-900/10 border border-red-900/30 p-6 rounded-2xl">
                        <div className="flex items-center gap-3 mb-2">
                            <FaSkull className="text-red-500"/>
                            <span className="text-red-400 font-bold">ЕЖЕМЕСЯЧНЫЕ ПОТЕРИ</span>
                        </div>
                        <div className="text-5xl font-black text-red-500 font-mono tracking-tighter">
                           -{Math.floor(breakdown.monthlySavings / 0.65).toLocaleString()}₽
                        </div>
                        <p className="text-red-400/60 text-sm mt-2">Деньги, сгорающие на штрафах и простоях.</p>
                    </div>

                    <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl">
                         <div className="flex justify-between items-center mb-4">
                            <span className="text-zinc-400">Operational Score</span>
                            <span className={`text-2xl font-bold ${efficiency > 70 ? 'text-green-500' : 'text-yellow-500'}`}>
                                {efficiency}/100
                            </span>
                         </div>
                         <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                            <div className="bg-indigo-500 h-full" style={{ width: `${efficiency}%` }}/>
                         </div>
                    </div>
                </div>
            </div>

            {/* Right: The Solution */}
            <div className="bg-zinc-900/50 p-8 rounded-3xl border border-zinc-800 relative overflow-hidden">
                 <div className="absolute top-0 right-0 bg-indigo-500/10 w-32 h-32 rounded-full blur-3xl"/>
                 
                 <h3 className="text-indigo-400 font-bold mb-6 flex items-center gap-2">
                    <FaRocket/> ПОТЕНЦИАЛ ЭКОНОМИИ
                 </h3>
                 
                 <div className="text-4xl font-black text-white mb-8 font-mono">
                    +{breakdown.monthlySavings.toLocaleString()}₽<span className="text-zinc-500 text-lg">/мес</span>
                 </div>

                 <div className="space-y-3 mb-8">
                    {roadmap.slice(0,3).map((item, i) => (
                        <div key={i} className="flex items-center gap-3 text-sm text-zinc-300">
                            <FaCircleCheck className="text-green-500 flex-shrink-0"/>
                            <span>{item.title} (+{item.impact.toLocaleString()}₽)</span>
                        </div>
                    ))}
                 </div>

                 {dbUser?.user_id ? (
                    <Button 
                        onClick={handleGetReport} 
                        disabled={isSending}
                        className="w-full bg-white text-black hover:bg-gray-200 font-bold py-6 text-lg rounded-xl"
                    >
                        {isSending ? <Loader2 className="animate-spin mr-2"/> : <><FaTelegram className="mr-2"/> Отправить план в Telegram</>}
                    </Button>
                 ) : (
                    <div className="text-center">
                        <p className="text-zinc-400 mb-4">Войдите, чтобы получить файл внедрения.</p>
                        <Link href="/wb">
                            <Button variant="outline" className="border-zinc-600 text-white hover:bg-zinc-800">Войти / Регистрация</Button>
                        </Link>
                    </div>
                 )}
                 
                 <button onClick={reset} className="mt-6 text-zinc-500 text-xs hover:text-white flex items-center justify-center w-full gap-2">
                    <FaRedo/> Пересчитать
                 </button>
            </div>
        </div>
      </motion.div>
    );
  }

  // --- QUESTION SCREEN ---
  // CRITICAL FIX: Guard clause to prevent undefined error on last step transition
  if (!questions || !questions[step]) return null;

  const currentQ = questions[step];
  const progress = ((step) / questions.length) * 100;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 sm:p-10 shadow-2xl max-w-2xl mx-auto"
    >
      {/* Progress */}
      <div className="mb-8">
         <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
            <motion.div 
                initial={{ width: 0 }} animate={{ width: `${progress}%` }} 
                className="h-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]"
            />
         </div>
         <div className="flex justify-between mt-2 text-xs font-mono text-zinc-500">
            <span>ШАГ {step + 1}/{questions.length}</span>
            <span>ВРЕМЯ: {estimatedTime}</span>
         </div>
      </div>

      <div className="mb-8 min-h-[180px]">
         <Label className="text-2xl sm:text-3xl font-bold text-white mb-4 block">
            {currentQ.text}
         </Label>
         {currentQ.helper && (
            <p className="text-zinc-400 text-sm mb-6 flex gap-2 items-start">
               <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5"/> 
               {currentQ.helper}
            </p>
         )}

         <div className="relative">
            {currentQ.type === 'select' ? (
                <select
                  value={currentAnswer}
                  onChange={(e) => setCurrentAnswer(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 text-white text-xl p-4 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none appearance-none"
                >
                   <option value="">Выбрать...</option>
                   {currentQ.options?.map((opt: any) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                   ))}
                </select>
            ) : (
                <Input
                   type="number"
                   placeholder={currentQ.placeholder}
                   value={currentAnswer}
                   onChange={(e) => setCurrentAnswer(e.target.value)}
                   onKeyDown={(e) => e.key === 'Enter' && handleNext()}
                   className="bg-zinc-950 border-zinc-700 text-white text-3xl p-8 h-auto rounded-xl font-mono focus:ring-2 focus:ring-indigo-500"
                   autoFocus
                />
            )}
         </div>
         
         <AnimatePresence>
            {validationResult && (
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-red-400 mt-2 text-sm font-bold">
                  {validationResult.message}
               </motion.div>
            )}
         </AnimatePresence>
      </div>

      <div className="flex gap-4">
         {step > 1 && (
            <Button variant="ghost" onClick={() => { /* logic to go back handled in hook usually, simplified here */ }} className="text-zinc-500 hover:text-white">
               <ChevronLeft/> Назад
            </Button>
         )}
         <Button 
            onClick={handleNext} 
            disabled={!currentAnswer || validationResult?.type === 'error'}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-6 text-lg rounded-xl font-bold"
         >
            Далее <FaArrowRight className="ml-2"/>
         </Button>
      </div>
    </motion.div>
  );
};