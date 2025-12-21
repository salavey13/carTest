"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { FaShieldHalved, FaSkull, FaEye, FaHandFist, FaCheck, FaUsers, FaFlame, FaUserEdit, FaPhone, FaSchool } from "react-icons/fa6";
import { cn } from "@/lib/utils";
import { toast } from 'sonner';

const SAFETY_QUESTIONS = [
  { id: 1, q: "Ты потерял защитные очки во время боя. Твои действия?", options: [
      { text: "Прищуриться и бежать на базу", correct: false, response: "ОШИБКА. Стой на месте, закрой лицо руками и кричи 'СТОП ИГРА'!" },
      { text: "Упасть лицом в землю, закрыть голову руками, кричать 'СТОП ИГРА'", correct: true, response: "ВЕРНО. Безопасность превыше всего." }
  ]},
  { id: 2, q: "Тебе меньше 14 лет. Можешь ли ты находиться на территории клуба один?", options: [
      { text: "Да, если я уже играл", correct: false, response: "НЕТ. Дети до 14 лет только с родителями (Пункт №2 правил клуба)." },
      { text: "Нет, только в сопровождении родителей", correct: true, response: "ВЕРНО. Это требование безопасности." }
  ]},
  { id: 3, q: "В тебя попали, но ты не уверен, был ли это шар или ветка.", options: [
      { text: "Играть дальше", correct: false, response: "НЕТ. Страйкбол — игра на честность. Сомневаешься — уходи." },
      { text: "Уйти в мертвяк", correct: true, response: "ВЕРНО. Сохраняй репутацию честного игрока." }
  ]},
  { id: 4, q: "Кому категорически не рекомендуется посещение программ клуба?", options: [
      { text: "Людям с заболеваниями психики или позвоночника", correct: true, response: "ВЕРНО. Это пункты №5 и №6 правил." },
      { text: "Людям без камуфляжа", correct: false, response: "НЕТ. Основное ограничение — здоровье." }
  ]},
  { id: 5, q: "Ты видишь противника в 2 метрах от себя. Как стрелять?", options: [
      { text: "Очередью в голову", correct: false, response: "ТРАВМООПАСНО. Стой! Используй 'гуманный' выстрел." },
      { text: "Сказать 'БАХ' или использовать пистолет", correct: true, response: "ВЕРНО. Не калечь друзей." }
  ]},
  { id: 6, q: "Можно ли использовать свои петарды или конфетти на территории?", options: [
      { text: "Да, это праздник", correct: false, response: "ЗАПРЕЩЕНО. Пункт №11: пиротехника только по согласованию." },
      { text: "Нет, запрещено без согласования с админом", correct: true, response: "ВЕРНО. Только с разрешения." }
  ]}
];

const RULES_SUMMARY = [
  { icon: FaEye, title: "ГЛАЗА", text: "Очки НИКОГДА не снимаются. Запотели? Иди в мертвяк." },
  { icon: FaUsers, title: "ДЕТИ", text: "До 14 лет — только с родителями. Родители следят за детьми 100% времени." },
  { icon: FaShieldHalved, title: "ЗДОРОВЬЕ", text: "Противопоказано при заболеваниях психики и позвоночника." },
  { icon: FaFlame, title: "ПИРОТЕХНИКА", text: "Фейерверки и конфетти без согласования запрещены (Пункт №11)." }
];

export const SafetyBriefing = ({ onComplete, isSigned }: any) => {
  const [view, setView] = useState<'theory' | 'test' | 'form'>('theory');
  const [step, setStep] = useState(0);
  const [failed, setFailed] = useState(false);
  const [formData, setFormData] = useState({ fio: "", phone: "", school: "" });

  const handleAnswer = (correct: boolean, response: string) => {
    if (correct) {
      toast.success(response);
      if (step < SAFETY_QUESTIONS.length - 1) setTimeout(() => setStep(step + 1), 800);
      else setView('form');
    } else {
      toast.error(response);
      setFailed(true);
    }
  };

  const handleFinalSubmit = () => {
    if (formData.fio.split(' ').length < 2) return toast.error("Введите Имя и Фамилию");
    if (formData.phone.length < 10) return toast.error("Введите номер телефона");
    onComplete(formData);
  };

  if (isSigned) return (
    <div className="bg-emerald-950/20 border border-emerald-500 p-8 rounded-none text-center">
        <FaShieldHalved className="mx-auto text-5xl text-emerald-500 mb-4" />
        <h3 className="text-xl font-black text-emerald-500 font-orbitron uppercase">ДОПУСК_ПОЛУЧЕН</h3>
        <p className="text-zinc-500 text-[10px] mt-2 font-mono uppercase tracking-widest">Digital signature confirmed // Archive_OK</p>
    </div>
  );

  if (failed) return (
    <div className="bg-red-950/20 border border-red-600 p-8 rounded-none text-center">
        <FaSkull className="mx-auto text-5xl text-red-600 mb-4" />
        <h3 className="text-xl font-black text-red-600 font-orbitron uppercase">ОТКАЗ_В_ДОПУСКЕ</h3>
        <Button onClick={() => {setStep(0); setFailed(false); setView('theory');}} className="mt-6 bg-red-600 w-full rounded-none">ПОВТОРИТЬ_ИНСТРУКТАЖ</Button>
    </div>
  );

  if (view === 'form') return (
    <div className="bg-zinc-900 border-2 border-brand-cyan p-6 space-y-6">
        <h3 className="text-xl font-black text-white font-orbitron uppercase flex items-center gap-3 italic">
            <FaUserEdit className="text-brand-cyan" /> Анкетные_Данные
        </h3>
        <div className="space-y-4">
            <div className="space-y-1">
                <span className="text-[8px] font-mono text-zinc-500 uppercase ml-1">Ф.И.О. Полностью</span>
                <input className="w-full bg-black border border-zinc-800 p-3 text-sm text-white focus:border-white outline-none rounded-none" value={formData.fio} onChange={e => setFormData({...formData, fio: e.target.value})} placeholder="Иванов Иван Иванович" />
            </div>
            <div className="space-y-1">
                <span className="text-[8px] font-mono text-zinc-500 uppercase ml-1">Контактный Телефон</span>
                <input className="w-full bg-black border border-zinc-800 p-3 text-sm text-white focus:border-white outline-none rounded-none" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="8-9XX-XXX-XX-XX" />
            </div>
            <div className="space-y-1">
                <span className="text-[8px] font-mono text-zinc-500 uppercase ml-1">Школа / Класс (Опционально)</span>
                <input className="w-full bg-black border border-zinc-800 p-3 text-sm text-white focus:border-white outline-none rounded-none" value={formData.school} onChange={e => setFormData({...formData, school: e.target.value})} placeholder="Школа №1, 8А" />
            </div>
        </div>
        <Button onClick={handleFinalSubmit} className="w-full bg-brand-cyan text-black font-black py-8 text-lg rounded-none hover:bg-white transition-all uppercase tracking-widest italic">
            <FaCheck className="mr-2" /> Подписать_Протокол
        </Button>
    </div>
  );

  return view === 'theory' ? (
    <div className="space-y-6">
        <div className="bg-zinc-900/50 p-4 border-l-4 border-amber-600 mb-4">
            <p className="text-[10px] text-amber-500 font-mono italic">Пункт №1: Правила должны быть прочитаны до входа и соблюдаться неукоснительно.</p>
        </div>
        {RULES_SUMMARY.map((rule, idx) => (
            <div key={idx} className="bg-zinc-950 p-4 border border-zinc-900 flex gap-4">
                <div className="text-zinc-600"><rule.icon size={20} /></div>
                <div>
                    <h4 className="font-bold text-white text-[11px] uppercase tracking-wider">{rule.title}</h4>
                    <p className="text-[9px] text-zinc-500 leading-tight">{rule.text}</p>
                </div>
            </div>
        ))}
        <Button onClick={() => setView('test')} className="w-full bg-white text-black font-black py-6 rounded-none uppercase italic tracking-widest shadow-[5px_5px_0_rgba(255,255,255,0.2)]">Инициировать_Экзамен</Button>
    </div>
  ) : (
    <div className="bg-zinc-950 border border-zinc-800 p-6 rounded-none">
        <div className="mb-6 flex justify-between text-[8px] font-mono text-zinc-600">
            <span>ЭКЗАМЕН_ТБ</span>
            <span>DATA_PACKET: {step + 1}/{SAFETY_QUESTIONS.length}</span>
        </div>
        <h4 className="text-lg font-bold text-white mb-6 leading-tight uppercase tracking-tighter">{SAFETY_QUESTIONS[step].q}</h4>
        <div className="space-y-3">
            {SAFETY_QUESTIONS[step].options.map((opt, idx) => (
                <button key={idx} onClick={() => handleAnswer(opt.correct, opt.response)} className="w-full text-left p-4 bg-black border border-zinc-800 hover:border-brand-cyan hover:text-white text-[11px] text-zinc-400 font-mono transition-colors">
                    {opt.text}
                </button>
            ))}
        </div>
    </div>
  );
};