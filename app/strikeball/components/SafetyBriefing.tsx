"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { FaShieldHalved, FaSkull, FaEye, FaHandFist, FaCheck, FaUsers, FaFire, FaUserPen, FaPhone, FaSchool, FaBeerMugEmpty, FaLaptopCode, FaMotorcycle, FaSnowflake } from "react-icons/fa6";
import { cn } from "@/lib/utils";
import { toast } from 'sonner';

// --- CONTENT DEFINITIONS ---

const TACTICAL_QUESTIONS = [
  { id: 1, q: "Ты потерял защитные очки во время боя. Твои действия?", options: [
      { text: "Прищуриться и бежать на базу", correct: false, response: "ОШИБКА. Стой на месте, закрой лицо руками и кричи 'СТОП ИГРА'!" },
      { text: "Упасть лицом в землю, закрыть голову руками, кричать 'СТОП ИГРА'", correct: true, response: "ВЕРНО. Безопасность превыше всего." }
  ]},
  { id: 2, q: "Тебе меньше 14 лет. Можешь ли ты находиться на территории клуба один?", options: [
      { text: "Да, если я уже играл", correct: false, response: "НЕТ. Дети до 14 лет только с родителями." },
      { text: "Нет, только в сопровождении родителей", correct: true, response: "ВЕРНО. Это требование безопасности." }
  ]},
  { id: 3, q: "В тебя попали, но ты не уверен, был ли это шар или ветка.", options: [
      { text: "Играть дальше", correct: false, response: "НЕТ. Честность превыше всего. Сомневаешься — уходи." },
      { text: "Уйти в мертвяк", correct: true, response: "ВЕРНО. Сохраняй репутацию честного игрока." }
  ]},
  { id: 4, q: "Кому категорически не рекомендуется посещение?", options: [
      { text: "Людям с заболеваниями психики или позвоночника", correct: true, response: "ВЕРНО. Здоровье важнее игры." },
      { text: "Людям без камуфляжа", correct: false, response: "НЕТ. Ограничение только по здоровью." }
  ]},
  { id: 5, q: "Ты видишь противника в 2 метрах от себя. Как стрелять?", options: [
      { text: "Очередью в голову", correct: false, response: "ТРАВМООПАСНО. Используй 'гуманный' выстрел." },
      { text: "Сказать 'БАХ' или использовать пистолет", correct: true, response: "ВЕРНО. Не калечь друзей." }
  ]},
  { id: 6, q: "Можно ли использовать свои петарды или конфетти?", options: [
      { text: "Да, это праздник", correct: false, response: "ЗАПРЕЩЕНО. Пиротехника только по согласованию." },
      { text: "Нет, запрещено без согласования с админом", correct: true, response: "ВЕРНО. Спроси у маршала." }
  ]}
];

const PARTY_QUESTIONS = [
  { id: 1, q: "Ты чувствуешь себя плохо после игры. Твои действия?", options: [
      { text: "Молча уйти домой", correct: false, response: "ОПАСНО. Сообщи организатору или другу." },
      { text: "Сообщить организатору и не садиться за руль", correct: true, response: "ВЕРНО. Безопасность приоритет." }
  ]},
  { id: 2, q: "Можно ли приводить друзей без предварительной записи?", options: [
      { text: "Да, чем больше, тем веселее", correct: false, response: "НЕТ. У нас лимит мест и список гостей." },
      { text: "Нет, нужно согласовать", correct: true, response: "ВЕРНО. Проверь свободные слоты." }
  ]}
];

const TECH_QUESTIONS = [
  { id: 1, q: "Можно ли пить напитки рядом с дорогостоящим оборудованием?", options: [
      { text: "Да, я аккуратный", correct: false, response: "НЕТ. Любая капля может вывести технику из строя." },
      { text: "Нет, только в designated зоне", correct: true, response: "ВЕРНО. Береги нервы и железо." }
  ]},
  { id: 2, q: "Ты случайно удалил важный файл. Что делать?", options: [
      { text: "Молчать", correct: false, response: "ПЛОХО. Сообщи ментору, возможно что-то можно восстановить." },
      { text: "Сразу сказать и попытаться восстановить", correct: true, response: "ВЕРНО. Honesty is best policy." }
  ]}
];

const SPORT_QUESTIONS = [
  { id: 1, q: "Обязательно ли носить шлем?", options: [
      { text: "Нет, я крученый", correct: false, response: "ГЛУПОСТЬ. Шлем спасает жизнь." },
      { text: "Да, всегда", correct: true, response: "ВЕРНО. Без шлема — никуда." }
  ]},
  { id: 2, q: "Ты сломался на трассе. Твои действия?", options: [
      { text: "Оставить мопед посередине трассы", correct: false, response: "НЕТ. Это опасно для других." },
      { text: "Оттащить в безопасное место и подать сигнал", correct: true, response: "ВЕРНО. Безопасность всех участников." }
  ]}
];

const SNOWBOARD_QUESTIONS = [
  { id: 1, q: "Обязательна ли привязь (leash) на борде?", options: [
      { text: "Нет, это неудобно", correct: false, response: "НЕТ. Потерянный борд на горе может убить человека внизу." },
      { text: "Да, это строгий стандарт безопасности", correct: true, response: "ВЕРНО. Привязь обязательна." }
  ]},
  { id: 2, q: "Кому нужно уступить дорогу на склоне?", options: [
      { text: "Кто едет быстрее", correct: false, response: "НЕТ. Правом обладает тот, кто находится ниже (спереди)." },
      { text: "Тот, кто едет позади (выше)", correct: true, response: "ВЕРНО. Контролируй скорость, не наезжай на тех, кто ниже." }
  ]},
  { id: 3, q: "Ты собираешься прыгнуть с трамплина, но сверху наваливается очередь.", options: [
      { text: "Прыгать, чтобы не ждать", correct: false, response: "ОПАСНО. Остановись и убедись, что зона приземления свободна." },
      { text: "Остановиться и убедиться в безопасности", correct: true, response: "ВЕРНО. Проверь трамплин перед стартом." }
  ]}
];

// --- CONTENT SELECTOR ---

const getBriefingContent = (mode: string) => {
  const m = mode?.toUpperCase();
  
  if (["STRIKEBALL", "PAINTBALL", "LAZERTAG", "HYDROBALL"].includes(m)) {
    return {
      questions: TACTICAL_QUESTIONS,
      summary: [
        { icon: FaEye, title: "ГЛАЗА", text: "Очки НИКОГДА не снимаются." },
        { icon: FaUsers, title: "ДЕТИ", text: "До 14 лет — только с родителями." },
        { icon: FaShieldHalved, title: "ЗДОРОВЬЕ", text: "Противопоказано при заболеваниях психики и позвоночника." },
        { icon: FaFire, title: "ПИРОТЕХНИКА", text: "Без согласования запрещена." }
      ]
    };
  }
  
  if (["DRINKNIGHT ROYALE"].includes(m)) {
    return {
      questions: PARTY_QUESTIONS,
      summary: [
        { icon: FaBeerMugEmpty, title: "АЛКОГОЛЬ", text: "Умеренность и ответственность." },
        { icon: FaHandFist, title: "РЕСПЕКТ", text: "Никакой агрессии к другим игрокам." },
        { icon: FaShieldHalved, title: "ДОРОГА", text: "Напился — вызвал такси. Пьяный за рулем = БАН." }
      ]
    };
  }

  if (["VIBECODE"].includes(m)) {
    return {
      questions: TECH_QUESTIONS,
      summary: [
        { icon: FaLaptopCode, title: "ТЕХНИКА", text: "Не роняй и не лей на ноутбуки." },
        { icon: FaEye, title: "ГИГИЕНА", text: "Мой руки перед работой с чужим девайсом." },
        { icon: FaFire, title: "ПИТАНИЕ", text: "Еда только в зоне отдыха (Kitchen)." }
      ]
    };
  }

  if (["ENDURO"].includes(m)) {
    return {
      questions: SPORT_QUESTIONS,
      summary: [
        { icon: FaMotorcycle, title: "ЭКИП", text: "Шлем, защита, перчатки — обязательно." },
        { icon: FaUsers, title: "ТРАССА", text: "Движение только в одну сторону." },
        { icon: FaHandFist, title: "ПОМОЩЬ", text: "Остановись, если кто-то упал." }
      ]
    };
  }

  if (["SNOWBOARD"].includes(m)) {
    return {
      questions: SNOWBOARD_QUESTIONS,
      summary: [
        { icon: FaSnowflake, title: "ПРИВЯЗЬ", text: "Leash (привязь) к ноге — ОБЯЗАТЕЛЬНО." },
        { icon: FaEye, title: "ПРАВА", text: "Уступай дорогу тем, кто ниже тебя на склоне." },
        { icon: FaShieldHalved, title: "ЭКИП", text: "Шлем и защита обязательны для катания." }
      ]
    };
  }

  // Fallback (Generic)
  return {
    questions: PARTY_QUESTIONS, // Reuse party questions as generic safe ones
    summary: [
      { icon: FaShieldHalved, title: "БЕЗОПАСНОСТЬ", text: "Соблюдай общие правила клуба." },
      { icon: FaUsers, title: "УВАЖЕНИЕ", text: "Относись к другим игрокам с уважением." }
    ]
  };
};

// --- COMPONENT ---

export const SafetyBriefing = ({ mode, onComplete, isSigned }: any) => {
  const content = getBriefingContent(mode);
  
  const [view, setView] = useState<'theory' | 'test' | 'form'>('theory');
  const [step, setStep] = useState(0);
  const [failed, setFailed] = useState(false);
  const [formData, setFormData] = useState({ fio: "", phone: "", school: "" });

  const handleAnswer = (correct: boolean, response: string) => {
    if (correct) {
      toast.success(response);
      if (step < content.questions.length - 1) setTimeout(() => setStep(step + 1), 800);
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
        <p className="text-zinc-500 text-[10px] mt-2 font-mono uppercase tracking-widest">Digital signature confirmed // {mode}</p>
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
            <FaUserPen className="text-brand-cyan" /> Анкетные_Данные
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
                <span className="text-[8px] font-mono text-zinc-500 uppercase ml-1">Школа / Организация (Опционально)</span>
                <input className="w-full bg-black border border-zinc-800 p-3 text-sm text-white focus:border-white outline-none rounded-none" value={formData.school} onChange={e => setFormData({...formData, school: e.target.value})} placeholder="..." />
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
        {content.summary.map((rule, idx) => (
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
            <span>DATA_PACKET: {step + 1}/{content.questions.length}</span>
        </div>
        <h4 className="text-lg font-bold text-white mb-6 leading-tight uppercase tracking-tighter">{content.questions[step].q}</h4>
        <div className="space-y-3">
            {content.questions[step].options.map((opt, idx) => (
                <button key={idx} onClick={() => handleAnswer(opt.correct, opt.response)} className="w-full text-left p-4 bg-black border border-zinc-800 hover:border-brand-cyan hover:text-white text-[11px] text-zinc-400 font-mono transition-colors">
                    {opt.text}
                </button>
            ))}
        </div>
    </div>
  );
};