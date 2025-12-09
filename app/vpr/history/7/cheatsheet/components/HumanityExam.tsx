"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BrainCircuit, RefreshCcw, ShieldCheck, AlertTriangle } from 'lucide-react';
import { saveHumanityExamResult } from '../actions';
import { toast } from 'sonner';
import { useAppContext } from "@/contexts/AppContext"; // Importing context to get user

// --- DATA ---
type Question = {
  id: number;
  statement: string; // The propaganda claim
  explanation: string; // The reality check
};

const QUESTIONS: Question[] = [
  // BLOCK 1: CASUS BELLI (WHO STARTED IT?)
  { 
    id: 1, 
    statement: "СССР был вынужден напасть на Финляндию, чтобы отодвинуть границу от Ленинграда ради безопасности.", 
    explanation: "Это классика 1939 года. Агрессор всегда говорит, что он 'защищается', нападая на соседа. Безопасность Ленинграда была лишь предлогом для захвата территории." 
  },
  { 
    id: 2, 
    statement: "Финская артиллерия первой обстреляла советских солдат в деревне Майнила.", 
    explanation: "Фейк НКВД. У финнов там даже не было пушек (они их отвели, чтобы не провоцировать). СССР обстрелял своих же, чтобы получить повод для войны (Casus Belli)." 
  },
  { 
    id: 3, 
    statement: "Маленькая страна (Финляндия) угрожала существованию огромного СССР.", 
    explanation: "Абсурд. Население Финляндии было в 50 раз меньше. Это как если бы котенок угрожал медведю. Пропаганда всегда рисует жертву 'опасным монстром'." 
  },

  // BLOCK 2: PUPPET GOVERNMENTS (WHO ARE WE FIGHTING?)
  { 
    id: 4, 
    statement: "СССР не воевал с народом Финляндии, а помогал законному правительству рабочих.", 
    explanation: "Это правительство (ФДР) создали в Москве за один день до войны. Никто в Финляндии его не выбирал. Это кукольный театр для оправдания вторжения." 
  },
  { 
    id: 5, 
    statement: "Если по телевизору говорят, что народ соседней страны ждет освобождения, это правда.", 
    explanation: "В 1939 году советским солдатам говорили, что финские рабочие встретят их с цветами. Их встретили пулеметами. Диктаторы часто верят в свою же ложь." 
  },
  { 
    id: 6, 
    statement: "Создание 'Народных Республик' на границе — это защита местных жителей.", 
    explanation: "В 1939 году это был способ захватить страну по частям. Как только блицкриг провалился, про эту 'республику' сразу забыли." 
  },

  // BLOCK 3: WAR METHODS (HOW THEY LIE)
  { 
    id: 7, 
    statement: "Советская авиация не бомбила города, а сбрасывала хлеб голодающим.", 
    explanation: "Знаменитая ложь Молотова. Это были кассетные бомбы. Финны в ответ назвали зажигательную смесь 'Коктейль для Молотова'." 
  },
  { 
    id: 8, 
    statement: "Если армия большая и у нее много танков, она победит за 2 недели.", 
    explanation: "СССР планировал парад в Хельсинки через 2 недели. Война шла 105 дней и стоила 127,000 жизней советских солдат. Шапкозакидательство убивает." 
  },
  { 
    id: 9, 
    statement: "Потери в 'маленькой победоносной войне' всегда минимальны.", 
    explanation: "СССР потерял в 5 раз больше людей, чем Финляндия. 'Мясные штурмы' — это старая тактика, когда солдат не жалеют." 
  },
  
  // BLOCK 4: INTERNATIONAL REACTION (THE WORLD IS WATCHING)
  { 
    id: 10, 
    statement: "Весь мир был против СССР просто потому, что они русофобы.", 
    explanation: "СССР исключили из Лиги Наций (аналог ООН) как агрессора за нападение на маленькую страну. Это была реакция на нарушение правил, а не 'фобия'." 
  },
  { 
    id: 11, 
    statement: "Санкции и исключение из международных организаций делают страну сильнее.", 
    explanation: "Изоляция тормозит развитие. СССР получил территорию, но потерял репутацию и показал слабость армии, что вдохновило Гитлера напасть позже." 
  },
  { 
    id: 12, 
    statement: "История ничему не учит, сейчас всё по-другому.", 
    explanation: "Методы диктаторов не меняются столетиями: провокация -> марионеточное правительство -> 'мы только защищаемся' -> затяжная война." 
  },
];

export const HumanityExam = () => {
  const { dbUser } = useAppContext(); // Getting user from context
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [showExplanation, setShowExplanation] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<'AGREE' | 'BULLSHIT' | 'IDK' | null>(null);

  const currentQ = QUESTIONS[currentIndex];

  const handleAnswer = (answer: 'AGREE' | 'BULLSHIT' | 'IDK') => {
    setSelectedAnswer(answer);
    
    // Scoring: "BULLSHIT" is the correct answer because all statements are propaganda tropes.
    if (answer === 'BULLSHIT') {
      setScore(prev => prev + 1);
    }
    
    setShowExplanation(true);
  };

  const handleNext = async () => {
    if (currentIndex < QUESTIONS.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setShowExplanation(false);
      setSelectedAnswer(null);
    } else {
      setIsFinished(true);
      // Save results using the server action, passing user ID if needed or handling inside action via auth
      if (dbUser?.user_id) {
          // Note: The server action handles auth check internally, but we check dbUser for UI state
           await saveHumanityExamResult(score, QUESTIONS.length);
           toast.success("Результат сохранен в личном деле.");
      } else {
          toast.info("Гостевой режим: результат не сохранен в базу.");
      }
    }
  };

  const restart = () => {
    setCurrentIndex(0);
    setScore(0);
    setShowExplanation(false);
    setIsFinished(false);
    setSelectedAnswer(null);
  };

  const getResult = () => {
    const ratio = score / QUESTIONS.length;
    if (ratio === 1) return { title: "ГРОССМЕЙСТЕР ИСТОРИИ 🧠", desc: "У тебя 100% иммунитет к пропаганде. Ты видишь исторические грабли издалека.", color: "text-emerald-500" };
    if (ratio > 0.8) return { title: "КРИТИЧЕСКИЙ МЫСЛИТЕЛЬ 🕵️", desc: "Отличный результат! Тебя сложно обмануть телевизором.", color: "text-blue-400" };
    if (ratio > 0.5) return { title: "СОМНЕВАЮЩИЙСЯ 🤔", desc: "Неплохо, но иногда старые мифы всё еще работают. Будь внимательнее!", color: "text-yellow-400" };
    return { title: "ЖЕРТВА ПРОПАГАНДЫ 🧟", desc: "Внимание! Твой мозг в опасности. Срочно перечитай главу про Майнилу.", color: "text-red-500" };
  };

  if (isFinished) {
    const result = getResult();
    return (
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="max-w-2xl mx-auto">
        <Card className="bg-stone-900 border-2 border-stone-700 shadow-2xl">
          <CardHeader className="text-center">
            <CardTitle className={`text-3xl md:text-4xl font-black ${result.color} mb-2`}>{result.title}</CardTitle>
            <p className="text-stone-400 text-lg">Верных ответов: {score} из {QUESTIONS.length}</p>
          </CardHeader>
          <CardContent className="space-y-8 text-center">
            <p className="text-xl text-stone-200">{result.desc}</p>
            
            <div className="bg-black/40 p-6 rounded-xl border border-stone-800 text-left">
               <h4 className="text-amber-500 font-mono text-sm uppercase mb-4 border-b border-stone-700 pb-2">Разбор полетов:</h4>
               <p className="text-stone-400 text-sm leading-relaxed">
                 Ты прошел тест на <span className="text-white font-bold">исторические паттерны</span>. 
                 Все утверждения в тесте — это реальные тезисы пропаганды 1939 года. 
                 Если они кажутся тебе знакомыми сегодня — это не случайно. 
                 Умение называть вещи своими именами (агрессия, фейк, ложь) — это твой главный щит.
               </p>
            </div>

            <Button onClick={restart} className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-6 text-lg rounded-xl shadow-lg shadow-amber-900/20">
              <RefreshCcw className="mr-2 h-5 w-5" /> ПЕРЕЗАГРУЗИТЬ СИМУЛЯЦИЮ
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto mt-8">
      
      {/* Header Info */}
      <div className="flex justify-between items-end mb-4 px-1">
        <div className="text-xs font-mono text-stone-500 uppercase tracking-widest">
            Level 7 // Bullshit Detector
        </div>
        <div className="text-amber-500 font-mono font-bold">
            XP: {score * 10}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-1.5 w-full bg-stone-900 rounded-full mb-8 overflow-hidden border border-stone-800">
        <motion.div 
          className="h-full bg-gradient-to-r from-amber-600 to-amber-400" 
          initial={{ width: 0 }}
          animate={{ width: `${((currentIndex + 1) / QUESTIONS.length) * 100}%` }}
          transition={{ ease: "circOut" }}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -20, opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <Card className="bg-stone-900/90 border border-stone-700 backdrop-blur-md overflow-hidden relative shadow-2xl">
            {/* Background texture */}
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-5 pointer-events-none"></div>

            <CardContent className="p-6 md:p-10 flex flex-col min-h-[450px]">
              
              <div className="flex-grow space-y-8">
                <div className="space-y-4">
                  <div className="inline-block px-3 py-1 rounded bg-stone-800 text-stone-400 text-xs font-bold uppercase tracking-wider">
                    Утверждение #{currentIndex + 1}
                  </div>
                  <h2 className="text-xl md:text-2xl font-medium text-stone-100 leading-relaxed font-serif">
                    "{currentQ.statement}"
                  </h2>
                </div>

                {!showExplanation && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8 pt-8 border-t border-stone-800/50">
                    <Button 
                      variant="outline" 
                      onClick={() => handleAnswer('AGREE')}
                      className="h-16 text-lg font-bold border-stone-700 bg-stone-900/50 text-stone-400 hover:bg-red-900/10 hover:text-red-400 hover:border-red-500/30 transition-all rounded-xl"
                    >
                      ВЕРЮ <span className="text-xs ml-2 opacity-40 font-normal block md:inline"> (Согласен)</span>
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      onClick={() => handleAnswer('BULLSHIT')}
                      className="h-16 text-lg font-bold border-stone-700 bg-stone-900/50 text-amber-500 hover:bg-amber-900/10 hover:text-amber-400 hover:border-amber-500/30 transition-all rounded-xl shadow-[0_0_15px_rgba(245,158,11,0.05)]"
                    >
                      БРЕД <span className="text-xs ml-2 opacity-60 font-normal block md:inline text-stone-400"> (Bullshit)</span>
                    </Button>

                    <Button 
                      variant="outline" 
                      onClick={() => handleAnswer('IDK')}
                      className="h-16 text-lg font-bold border-stone-700 bg-stone-900/50 text-stone-400 hover:bg-stone-800 hover:text-stone-300 transition-all rounded-xl"
                    >
                      ХЗ <span className="text-xs ml-2 opacity-40 font-normal block md:inline"> (Не знаю)</span>
                    </Button>
                  </div>
                )}
              </div>

              {showExplanation && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`mt-6 p-5 rounded-xl border-l-4 ${
                    selectedAnswer === 'BULLSHIT' 
                      ? 'bg-emerald-900/10 border-l-emerald-500 border-t border-r border-b border-emerald-500/20' 
                      : 'bg-red-900/10 border-l-red-500 border-t border-r border-b border-red-500/20'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-3 font-bold uppercase text-xs tracking-wider">
                    {selectedAnswer === 'BULLSHIT' ? (
                      <span className="text-emerald-400 flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> УГРОЗА ОТБИТА (+1 XP)</span>
                    ) : (
                      <span className="text-red-400 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> ВАС ОБМАНУЛИ</span>
                    )}
                  </div>
                  <p className="text-stone-300 text-sm md:text-base leading-relaxed border-t border-white/5 pt-3">
                    {currentQ.explanation}
                  </p>
                  <Button onClick={handleNext} className="w-full mt-6 bg-stone-100 text-stone-900 hover:bg-white font-bold py-6 rounded-xl shadow-lg">
                    СЛЕДУЮЩИЙ УРОВЕНЬ <BrainCircuit className="ml-2 w-5 h-5" />
                  </Button>
                </motion.div>
              )}

            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};