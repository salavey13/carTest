"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { FaShieldHalved, FaSkull, FaEye, FaHandFist, FaCheck } from "react-icons/fa6";
import { cn } from "@/lib/utils";
import { toast } from 'sonner';

type Question = {
  id: number;
  q: string;
  options: { text: string; correct: boolean; response: string }[];
};

const SAFETY_QUESTIONS: Question[] = [
  {
    id: 1,
    q: "Ты потерял защитные очки во время боя. Твои действия?",
    options: [
      { text: "Прищуриться и бежать на базу", correct: false, response: "ОШИБКА. Глаза не отрастут. Стой на месте, закрой лицо руками и кричи 'СТОП ИГРА'!" },
      { text: "Упасть лицом в землю, закрыть голову руками, кричать 'СТОП ИГРА'", correct: true, response: "ВЕРНО. Безопасность превыше всего. Игра останавливается." },
      { text: "Попросить запасные у врага", correct: false, response: "НЕТ. Не снимай руки с лица, пока не будешь в безопасности." }
    ]
  },
  {
    id: 2,
    q: "В тебя попали, но ты не уверен, был ли это шар или ветка.",
    options: [
      { text: "Играть дальше, пока не будет синяка", correct: false, response: "НЕТ. Страйкбол — игра на честность. Сомневаешься — уходи." },
      { text: "Уйти в мертвяк", correct: true, response: "ВЕРНО. Лучше перестраховаться и сохранить репутацию честного игрока." },
      { text: "Спросить у стрелявшего", correct: false, response: "НЕТ. Мертвые не разговаривают, а живые не спорят посреди боя." }
    ]
  },
  {
    id: 3,
    q: "Ты видишь противника в 2 метрах от себя. Как стрелять?",
    options: [
      { text: "Очередью в голову", correct: false, response: "ТРАВМООПАСНО. Запрещено правилами большинства игр." },
      { text: "Сказать 'БАХ' или использовать пистолет/нож", correct: true, response: "ВЕРНО. Правило 'Гуманности'. Не калечь друзей." },
      { text: "От бедра, не глядя", correct: false, response: "ЗАПРЕЩЕНО. Стрельба по-сомалийски (вслепую) запрещена." }
    ]
  }
];

export const SafetyBriefing = ({ onComplete, isSigned }: { onComplete: () => void, isSigned: boolean }) => {
  const [step, setStep] = useState(0);
  const [failed, setFailed] = useState(false);

  const handleAnswer = (correct: boolean, response: string) => {
    if (correct) {
      toast.success(response);
      if (step < SAFETY_QUESTIONS.length - 1) {
        setTimeout(() => setStep(step + 1), 1000);
      } else {
        setTimeout(() => onComplete(), 1000);
      }
    } else {
      toast.error(response);
      setFailed(true);
    }
  };

  const restart = () => {
    setStep(0);
    setFailed(false);
  };

  if (isSigned) {
    return (
        <div className="bg-emerald-900/20 border border-emerald-600 p-6 rounded-xl text-center">
            <FaShieldHalved className="mx-auto text-4xl text-emerald-500 mb-4" />
            <h3 className="text-xl font-bold text-emerald-400 font-orbitron uppercase">ДОПУСК ПОЛУЧЕН</h3>
            <p className="text-zinc-400 text-sm mt-2 font-mono">Вы прошли инструктаж и допущены к операции.</p>
            <div className="mt-4 inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-300 px-4 py-2 rounded text-xs font-bold">
                <FaCheck /> SIGNED & VERIFIED
            </div>
        </div>
    );
  }

  if (failed) {
    return (
      <div className="bg-red-900/20 border border-red-600 p-6 rounded-xl text-center animate-shake">
        <FaSkull className="mx-auto text-4xl text-red-500 mb-4" />
        <h3 className="text-xl font-bold text-red-500 font-orbitron uppercase">ОШИБКА ДОПУСКА</h3>
        <p className="text-zinc-400 text-sm mt-2 font-mono">Вы провалили тест на знание правил безопасности. Это может стоить кому-то глаза.</p>
        <Button onClick={restart} className="mt-6 bg-red-700 hover:bg-red-600 w-full font-bold">
            ПОВТОРИТЬ ИНСТРУКТАЖ
        </Button>
      </div>
    );
  }

  const question = SAFETY_QUESTIONS[step];

  return (
    <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 h-1 bg-red-900 w-full">
            <motion.div 
                className="h-full bg-red-500" 
                initial={{ width: 0 }} 
                animate={{ width: `${((step) / SAFETY_QUESTIONS.length) * 100}%` }}
            />
        </div>

        <div className="mb-6 flex items-center justify-between">
            <h3 className="text-lg font-bold text-red-500 font-orbitron flex items-center gap-2">
                <FaEye /> ПРОВЕРКА ЗНАНИЙ
            </h3>
            <span className="text-xs font-mono text-zinc-500">ВОПРОС {step + 1}/{SAFETY_QUESTIONS.length}</span>
        </div>

        <h4 className="text-xl font-bold text-white mb-6 font-sans leading-relaxed">
            {question.q}
        </h4>

        <div className="space-y-3">
            {question.options.map((opt, idx) => (
                <button
                    key={idx}
                    onClick={() => handleAnswer(opt.correct, opt.response)}
                    className="w-full text-left p-4 rounded bg-zinc-950 border border-zinc-800 hover:border-red-500 hover:bg-zinc-900 transition-all text-sm text-zinc-300 font-mono group"
                >
                    <span className="text-red-500 font-bold mr-3 opacity-50 group-hover:opacity-100">{String.fromCharCode(65 + idx)}.</span>
                    {opt.text}
                </button>
            ))}
        </div>
    </div>
  );
};