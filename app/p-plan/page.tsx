"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database.types";
import VibeContentRenderer from "@/components/VibeContentRenderer";
import Link from "next/link";

// --- ICONS ---
import {
  FaFileLines, FaBullseye, FaUsers, FaBoxOpen, FaChartLine, FaAtom,
  FaMobile, FaComments, FaPaintbrush, FaBrain, FaRocket, FaUserNinja,
  FaMoneyBillWave, FaTriangleExclamation, FaUserAstronaut, FaSignature,
  FaRecycle, FaCode, FaNewspaper, FaGithub, FaTelegram, FaCarBurst,
  FaRobot, FaGift, FaHandshake, FaBomb, FaFlaskVial, FaInfinity, FaDumbbell,
  FaEye, FaHatWizard, FaPoo, FaKey, FaBolt, FaScroll,
  FaHandPointer, FaUserSecret, FaGamepad,
  // Added for UI controls:
  FaCheck, FaLock, FaUnlock, FaChevronDown, FaArrowRight
} from "react-icons/fa6";

// --- TYPES ---
type DbUser = Database["public"]["Tables"]["users"]["Row"] | null;

interface PlanSection {
  id: string;
  title: string;
  icon: React.ElementType;
  color: string; // Tailwind text color class
  borderColor: string; // Tailwind border color class
  content: string; // String with Markdown & ::Icon:: syntax
  action?: {
    label: string;
    href: string;
    icon: React.ElementType;
  };
}

// --- DATA GENERATOR ---
const getPlanSections = (dbUser: DbUser): PlanSection[] => {
  const userName = dbUser?.first_name || 'Неофит';
  const isSanek = dbUser?.user_id?.toString() === '1260304309' || dbUser?.username === 'Pihman';
  const userHandle = isSanek ? '@Pihman_Reborn69' : (dbUser?.username ? `@${dbUser.username}` : 'Твой_Кибер_Сигил');
  const userOriginStory = isSanek
     ? "в гравитационном колодце разбитых карданов ::FaCarBurst className=\"inline text-red-500\"::"
     : "в поисках апгрейда серой реальности";

  return [
     {
      id: "protocol_init",
      title: `1. Протокол "Исход": ${userName}, Взлом Системы`,
      icon: FaBomb,
      color: "text-blue-400",
      borderColor: "border-blue-500",
      content: `Проект **"Кибер-Волк ${userName}"** – это не мануал. Это чит-код ::FaKey:: к твоей свободе. Мы выбиваем дверь из ${userOriginStory} с ноги.
      
      #### **Твой BIOS v2.0:**
      1. **Скорость (::FaRocket::):** Пока конкуренты планируют, мы деплоим.
      2. **AI-Нейролинк (::FaAtom::):** GPT/Claude – это твой второй мозг. Делегируй рутину, оставь себе творчество.
      3. **Экспонента (::FaChartLine::):** Линейный рост для рабочих. Мы строим системы, которые растут сами (L1 -> L2).
      
      **Миссия:** Создать ЛИЧНЫЙ ГЕНЕРАТОР КЭША, работающий с телефона ::FaMobile::.`,
      action: { label: "Принять Вызов", href: "#arsenal", icon: FaArrowRight }
    },
    {
      id: "arsenal",
      title: "2. Кибер-Арсенал: Zero-Cost Setup",
      icon: FaUserAstronaut,
      color: "text-cyan-400",
      borderColor: "border-cyan-500",
      content: `Тебе не нужен бюджет миллион. Тебе нужен этот стек (0 руб/мес):
      
      - **Голодек (Сайт):** Next.js + Vercel. Быстро, бесплатно, обновляется через Git ::FaGithub::.
      - **Зион (Штаб):** Telegram Канал ::FaTelegram::. Здесь живет твое племя.
      - **Оружейная (Код):** GitHub. Храни здесь скрипты и знания ::FaCode::.
      - **Джарвис (AI):** Твой генератор контента и идей ::FaRobot::.`,
      action: { label: "Открыть GitHub", href: "https://github.com", icon: FaGithub }
    },
    {
      id: "market_hunt",
      title: "3. Охотничьи Угодья: Поиск Своих",
      icon: FaBullseye,
      color: "text-pink-500",
      borderColor: "border-pink-500",
      content: `Рынок РФ – это Дикий Запад. Старые "Гуру" (Агенты Смиты) продают воздух.
      
      **Твоя Цель (ЦА):**
      - Разработчики, уставшие от галер.
      - Предприниматели, которые боятся AI.
      - Искатели, застрявшие в ${userOriginStory}.
      
      **Твой Код Неуязвимости:** Твоя история (::FaSignature::). Ты не учишь "успешному успеху", ты показываешь, как **взломал систему** сам.`,
    },
    {
      id: "product_artifacts",
      title: "4. Артефакты: Что мы продаем?",
      icon: FaBoxOpen,
      color: "text-orange-400",
      borderColor: "border-orange-500",
      content: `Сначала дай "Магию" бесплатно, потом продавай "Мастерство".
      
      **Free Tier (Вербовка):**
      - **Блог "Дневник Нео":** Твой путь без купюр ::FaNewspaper::.
      - **Jumpstart Kit:** Готовые шаблоны для старта (код, промпты) ::FaGift::.
      
      **Premium Tier (Экспонента):**
      - **Личный Менторинг:** "Дефрагментация мозга" с ${userName}.
      - **Закрытый Клуб:** Доступ к лучшим VIBE-практикам и инсайдам.`,
      action: { label: "Скачать Jumpstart", href: "/jumpstart", icon: FaRocket }
    },
    {
      id: "marketing_signal",
      title: "5. Неоновые Маяки: Маркетинг",
      icon: FaComments,
      color: "text-neon-lime",
      borderColor: "border-neon-lime",
      content: `Не продавай. **Зажигай маяки.**
      
      1. **Контент-Фабрика:** AI пишет черновик, ты добавляешь душу ::FaPaintbrush::. Видео, посты, кружочки.
      2. **Комьюнити-Драйв:** Отвечай всем. Будь настоящим. Строй Зион в комментариях.
      3. **Посев:** Закидывай вирусные идеи (VIBE-код) в профильные чаты.
      
      **Воронка:** Контент -> Чат -> Jumpstart (L1) -> Адепт (L2) -> Твоя Свобода.`,
    },
    {
      id: "operations_mobile",
      title: "6. Операционка: Офис в Кармане",
      icon: FaMobile,
      color: "text-cyan-300",
      borderColor: "border-cyan-400",
      content: `Твой офис – это смартфон ::FaMobile::.
      
      **Правило Железного Человека:**
      "Если это рутина – это делает Джарвис (AI)".
      - Монтаж видео? AI.
      - Ответы на FAQ? AI-бот.
      - Генерация идей? AI.
      
      Ты – Стратег ::FaUserSecret::. Роботы – Исполнители ::FaRobot::.`,
    },
    {
      id: "growth_exponential",
      title: "7. Структура: Ядро Экспоненты",
      icon: FaChartLine,
      color: "text-purple-400",
      borderColor: "border-purple-500",
      content: `Забудь про найм штата. Это прошлый век.
      
      **Формула VIBE-Роста:**
      Один ученик (L1), прокачавшийся до мастера (L2), приводит **ДВУХ** новичков.
      Рост: 1 -> 2 -> 4 -> 8 -> 16 -> ... ::FaInfinity::
      
      Твоя задача: Быть **Архитектором** ::FaBrain::, который нажимает кнопку L1->L2.`,
    },
    {
      id: "finance_fuel",
      title: "8. Финансы: Топливо Реактора",
      icon: FaMoneyBillWave,
      color: "text-yellow-400",
      borderColor: "border-yellow-500",
      content: `Деньги = Энергия ::FaBolt::.
      
      1. **Купи Свободу (Приоритет #1):** Подушка безопасности, чтобы не думать о выживании.
      2. **Первая Кровь (Приоритет #2):** Продай что-то за 1000р. Это даст тебе веру.
      3. **Реинвест (Приоритет #3):** Платные AI, реклама, обучение.
      4. **Щит Веры:** НЗ на случай сбоя Матрицы ::FaTriangleExclamation::.`,
    },
    {
      id: "risk_omega",
      title: "9. Протокол ОМЕГА (Риски)",
      icon: FaCarBurst,
      color: "text-red-500",
      borderColor: "border-red-600",
      content: `Что если всё рухнет?
      
      - **Выгорание:** Делегируй AI. Спи. "Нет ложки" ::FaEye::.
      - **Идея мертва:** Убей её быстро. Запусти новую за 24 часа.
      - **Бан/Блокировка:** Диверсифицируй (TG + Web + GitHub).
      
      Ты – Антихрупкий. Сбой системы делает тебя только злее и опытнее.`,
    }
  ];
};

// --- UI COMPONENTS ---

const ProgressBar = ({ current, total }: { current: number; total: number }) => {
  const percentage = Math.min(100, Math.max(0, (current / total) * 100));
  
  return (
    <div className="w-full mb-8 bg-black/40 p-4 rounded-xl border border-gray-800 backdrop-blur-sm">
      <div className="flex justify-between text-xs uppercase tracking-widest font-mono text-gray-400 mb-2">
        <span className="flex items-center gap-2"><FaBolt className="text-yellow-500"/> Синхронизация Системы</span>
        <span className="text-brand-cyan">{Math.round(percentage)}%</span>
      </div>
      <div className="h-3 bg-gray-900 rounded-full overflow-hidden border border-gray-700 relative">
        {/* Glow Effect */}
        <div className="absolute inset-0 bg-brand-purple/10 z-0"></div>
        <motion.div 
          className="h-full bg-gradient-to-r from-blue-600 via-purple-500 to-neon-lime shadow-[0_0_15px_rgba(174,255,0,0.6)] relative z-10"
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
      </div>
    </div>
  );
};

const SectionCard = ({ 
  section, 
  isOpen, 
  isCompleted, 
  onToggle, 
  onComplete 
}: { 
  section: PlanSection; 
  isOpen: boolean; 
  isCompleted: boolean;
  onToggle: () => void;
  onComplete: (e: React.MouseEvent) => void;
}) => {
  const Icon = section.icon;
  const ActionIcon = section.action?.icon || FaArrowRight;

  return (
    <motion.div 
      initial={false}
      animate={{ 
        backgroundColor: isOpen ? "rgba(20, 20, 25, 0.9)" : "rgba(10, 10, 12, 0.6)",
        borderColor: isOpen ? "rgba(139, 92, 246, 0.5)" : isCompleted ? "rgba(34, 197, 94, 0.3)" : "rgba(63, 63, 70, 0.5)"
      }}
      className={cn(
        "border-l-[6px] rounded-r-xl overflow-hidden mb-4 backdrop-blur-md transition-all duration-300 border-y border-r border-gray-800/50",
        isCompleted ? "border-l-green-500 shadow-[0_0_15px_rgba(34,197,94,0.1)]" : isOpen ? `border-l-purple-500 shadow-lg` : "border-l-gray-700"
      )}
    >
      {/* Header */}
      <div 
        onClick={onToggle}
        className="p-5 flex items-center justify-between cursor-pointer group relative overflow-hidden"
      >
        {/* Hover Effect bg */}
        <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors duration-300" />

        <div className="flex items-center gap-4 relative z-10">
          <div className={cn(
            "p-3 rounded-xl bg-black/60 border border-white/10 shadow-inner transition-transform group-hover:scale-110 duration-300",
            section.color
          )}>
            <Icon className="text-xl md:text-2xl" />
          </div>
          <div>
            <h3 className={cn(
              "font-bold text-lg md:text-xl tracking-wide font-sans transition-colors",
              isCompleted ? "text-gray-400 line-through decoration-green-500/50" : "text-gray-100 group-hover:text-white"
            )}>
              <VibeContentRenderer content={section.title} />
            </h3>
            {isCompleted && (
              <span className="flex items-center gap-1 text-[10px] text-green-400 font-mono uppercase tracking-wider mt-1">
                <FaCheck className="text-[10px]" /> Протокол Выполнен
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-4 relative z-10">
            {/* Check Button */}
            <button
                onClick={onComplete}
                className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center border transition-all duration-300 z-20",
                    isCompleted 
                        ? "bg-green-500/20 border-green-500 text-green-400 scale-105" 
                        : "bg-black/40 border-gray-600 text-gray-600 hover:border-gray-400 hover:text-gray-200"
                )}
                title={isCompleted ? "Сбросить статус" : "Отметить выполненным"}
            >
                {isCompleted ? <FaCheck /> : <FaLock className="text-sm" />}
            </button>
            
            {/* Toggle Chevron */}
            <FaChevronDown className={cn(
                "text-gray-500 transition-transform duration-300 transform",
                isOpen && "rotate-180 text-brand-purple"
            )} />
        </div>
      </div>

      {/* Body */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <div className="px-6 pb-6 pt-2 border-t border-white/5 relative">
              {/* Content Renderer */}
              <div className="prose prose-invert prose-sm md:prose-base max-w-none text-gray-300 leading-relaxed font-sans">
                 <VibeContentRenderer content={section.content} />
              </div>
              
              {/* Action Button */}
              {section.action && (
                <div className="mt-6 flex justify-end">
                    <Link href={section.action.href} onClick={(e) => section.action?.href.startsWith('#') && e.preventDefault()}>
                        <button 
                            className={cn(
                                "flex items-center gap-2 px-6 py-3 rounded-lg font-bold text-white shadow-lg transition-all hover:translate-y-[-2px]",
                                "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500",
                                "shadow-[0_0_20px_rgba(124,58,237,0.3)]"
                            )}
                            onClick={() => {
                                if(section.action?.href.startsWith('#')) {
                                     const el = document.getElementById(section.action.href.substring(1));
                                     el?.scrollIntoView({ behavior: 'smooth' });
                                }
                            }}
                        >
                            {section.action.label} <ActionIcon />
                        </button>
                    </Link>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// --- MAIN PAGE ---
export default function PPlanPage() {
  const { dbUser, isLoading } = useAppContext();
  const [isMounted, setIsMounted] = useState(false);
  const [openSectionId, setOpenSectionId] = useState<string | null>("protocol_init");
  const [completedSections, setCompletedSections] = useState<string[]>([]);

  useEffect(() => { 
      setIsMounted(true); 
      // Load progress
      const saved = localStorage.getItem('vibe_plan_progress');
      if (saved) {
          try {
            setCompletedSections(JSON.parse(saved));
          } catch (e) { console.error("Failed to load progress", e); }
      }
  }, []);

  const sections = useMemo(() => getPlanSections(dbUser), [dbUser]);
  const pageTitleName = useMemo(() => dbUser?.first_name || "Кибер-Сталкер", [dbUser]);

  const toggleSection = (id: string) => {
    setOpenSectionId(prev => prev === id ? null : id);
  };

  const toggleComplete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setCompletedSections(prev => {
        const newState = prev.includes(id) 
            ? prev.filter(x => x !== id) 
            : [...prev, id];
        localStorage.setItem('vibe_plan_progress', JSON.stringify(newState));
        return newState;
    });
  };

  if (!isMounted || isLoading) {
      return (
        <div className="flex flex-col justify-center items-center min-h-screen bg-black text-cyan-500 font-mono gap-4">
            <FaAtom className="animate-spin text-5xl"/>
            <span className="animate-pulse text-xl tracking-widest">ЗАГРУЗКА НЕЙРО-ИНТЕРФЕЙСА...</span>
        </div>
      );
  }

  return (
    <div className="min-h-screen bg-zinc-950 pt-24 pb-12 px-4 md:px-8 font-sans selection:bg-purple-500 selection:text-white relative overflow-hidden">
        {/* Dynamic Background */}
        <div className="fixed inset-0 pointer-events-none z-0">
             <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03]"></div>
             <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-purple-900/20 rounded-full blur-[150px]" />
             <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-900/20 rounded-full blur-[150px]" />
        </div>

        <div className="max-w-4xl mx-auto relative z-10">
            {/* Page Header */}
            <motion.div 
                initial={{ opacity: 0, y: -30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7 }}
                className="text-center mb-12"
            >
                <div className="inline-flex items-center justify-center px-4 py-2 bg-black/40 border border-purple-500/30 rounded-full mb-6 backdrop-blur-md shadow-[0_0_15px_rgba(168,85,247,0.2)]">
                    <FaFlaskVial className="text-purple-400 mr-3 text-lg animate-pulse" />
                    <span className="text-purple-200 font-mono text-xs md:text-sm tracking-[0.2em] uppercase">Гримуар Кибер-Алхимика v3.0</span>
                </div>
                
                <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter mb-6 uppercase">
                    План <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 animate-gradient-x">{pageTitleName}</span>
                </h1>
                
                <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed font-light">
                    <VibeContentRenderer content="Твой личный алгоритм превращения хаоса в ::FaChartLine className='text-green-400 inline':: экспоненциальный рост." />
                </p>
            </motion.div>

            {/* Progress Dashboard */}
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 }}
            >
                <ProgressBar current={completedSections.length} total={sections.length} />
            </motion.div>

            {/* Sections List */}
            <div className="space-y-3 relative pb-20">
                {/* Connecting Line */}
                <div className="absolute left-[2.2rem] md:left-[2.5rem] top-4 bottom-10 w-px bg-gradient-to-b from-transparent via-purple-500/20 to-transparent hidden md:block z-0" />

                {sections.map((section, index) => (
                    <motion.div
                        key={section.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 + 0.4 }}
                        className="relative z-10"
                    >
                        <SectionCard 
                            section={section}
                            isOpen={openSectionId === section.id}
                            isCompleted={completedSections.includes(section.id)}
                            onToggle={() => toggleSection(section.id)}
                            onComplete={(e) => toggleComplete(e, section.id)}
                        />
                    </motion.div>
                ))}
            </div>

            {/* Footer CTA */}
            <motion.div 
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                className="text-center py-12 border-t border-white/10 relative"
            >
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />
                
                <FaGamepad className="text-6xl text-zinc-800 mx-auto mb-6 hover:text-purple-500 transition-colors duration-500" />
                
                <h2 className="text-3xl font-bold text-white mb-3 uppercase tracking-wide">Игра началась.</h2>
                <p className="text-gray-500 mb-8 font-mono text-sm">
                    Карта — это не территория. Вставай и иди.
                </p>
                
                <div className="flex justify-center gap-4 flex-wrap">
                    <Link href="https://t.me/salavey13" target="_blank">
                        <button className="px-8 py-3 bg-transparent border border-neon-lime/50 text-neon-lime hover:bg-neon-lime/10 hover:border-neon-lime rounded-lg font-mono uppercase tracking-wider flex items-center gap-2 transition-all">
                            <FaTelegram /> Связь с Архитектором
                        </button>
                    </Link>
                </div>
            </motion.div>
        </div>
    </div>
  );
}