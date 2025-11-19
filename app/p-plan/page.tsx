"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { 
  FaFileLines, FaBullseye, FaUsers, FaBoxOpen, FaChartLine, FaAtom,
  FaMobile, FaComments, FaPaintbrush, FaBrain, FaRocket, FaUserNinja,
  FaMoneyBillWave, FaTriangleExclamation, FaUserAstronaut, FaSignature,
  FaRecycle, FaCode, FaNewspaper, FaGithub, FaTelegram, FaCarBurst,
  FaRobot, FaGift, FaHandshake, FaBomb, FaFlaskVial, FaInfinity, FaDumbbell,
  FaEye, FaHatWizard, FaPoo, FaKey, FaBolt, FaScroll,
  FaHandPointer, FaUserSecret, FaGamepad, FaCheckCircle, FaLock, FaUnlock
} from "react-icons/fa6";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database.types";
import VibeContentRenderer from "@/components/VibeContentRenderer";
import Link from "next/link";
import { Button } from "@/components/ui/button"; // Assuming you have shadcn/ui button, or standard html button works too
import { Progress } from "@/components/ui/progress"; // Assuming shadcn/ui progress

// --- Types ---
type DbUser = Database["public"]["Tables"]["users"]["Row"] | null;

interface PlanSection {
  id: string;
  title: string;
  icon: React.ElementType;
  color: string;
  content: string;
  actionLabel?: string;
  actionLink?: string;
}

// --- Content Generator ---
const getPlanSections = (dbUser: DbUser): PlanSection[] => {
  const userName = dbUser?.first_name || 'Неофит';
  const isSanek = dbUser?.user_id?.toString() === '1260304309' || dbUser?.username === 'Pihman';
  const userHandle = isSanek ? '@Pihman_Reborn69' : (dbUser?.username ? `@${dbUser.username}` : 'Твой_Кибер_Сигил');
  const userOriginStory = isSanek
     ? "в гравитационном колодце разбитых карданов ::FaCarBurst className=\"inline text-red-500\"::"
     : "в поисках апгрейда серой реальности";

  return [
     {
      id: "protocol_exodus",
      title: `1. Протокол "Исход": Взлом Матрицы`,
      icon: FaBomb,
      color: "text-blue-400",
      content: `Проект **"Кибер-Волк ${userName}"** – это твой чит-код ::FaKey::. Мы выбиваем дверь из ${userOriginStory} с ноги.
      
      #### **VIBE BIOS v2.0:**
      - **Скорость (::FaRocket::):** Линейный рост для рабов. Мы используем экспоненту.
      - **AI-Нейроусилитель:** Gemini/GPT – это твой второй мозг.
      - **"Один Клик → Экспонента":** L1→L2. Обучи последователя, и он приведет двоих. Это вирус роста.
      
      **Миссия:** Построить ЛИЧНЫЙ ГЕНЕРАТОР СВОБОДЫ, работающий на телефоне ::FaMobile::.`,
      actionLabel: "Принять Красную Таблетку",
      actionLink: "#arsenal" // Anchor link logic or distinct page
    },
    {
      id: "arsenal",
      title: "2. Кибер-Арсенал: Zero-Cost Setup",
      icon: FaUserAstronaut,
      color: "text-cyan-400",
      content: `Твой стек стоит 0 рублей, но мощнее корпоративных ERP.
      
      1. **Голодек (Vercel + Next.js):** Твой сайт. Обновляется сам через Git.
      2. **Зион (Telegram):** Твой штаб ::FaTelegram::. Здесь живет твоя стая.
      3. **Склад (GitHub):** Где лежат твои скрипты и знания ::FaGithub::.
      4. **Джарвис (AI):** Генератор контента, кода и идей ::FaAtom::.`,
      actionLabel: "Открыть GitHub Репозиторий",
      actionLink: "https://github.com"
    },
    {
      id: "market_hunt",
      title: "3. Охотничьи Угодья: Целевая Аудитория",
      icon: FaBullseye,
      color: "text-pink-500",
      content: `Рынок РФ – Дикий Запад. Старые правила мертвы.
      
      **Кого мы спасаем (ЦА):**
      - Разработчиков, застрявших в 2015 году.
      - Предпринимателей, которые боятся AI.
      - Всех, кто ищет выход из ${userOriginStory}.
      
      **Твой Код Неуязвимости:** Твоя история – это сигнал ::FaSignature::. Ты практик, а не инфоцыган.`,
    },
    {
      id: "artifacts",
      title: "4. Артефакты: Продуктовая Линейка",
      icon: FaBoxOpen,
      color: "text-orange-400",
      content: `Сначала дай магию бесплатно (Jumpstart Kit), потом продавай мастерство.
      
      **Free Tier (Вербовка):**
      - Блог "Дневник Нео" ::FaNewspaper::.
      - Jumpstart Kit: Готовые шаблоны ботов/сайтов ::FaCode::.
      
      **Premium Tier (Масштабирование):**
      - Личный VIBE-тюнинг (Менторство).
      - Закрытый клуб "Внутренний Круг Зиона".`,
      actionLabel: "Скачать Jumpstart Kit",
      actionLink: "/jumpstart"
    },
    {
      id: "neon_signals",
      title: "5. Маркетинг: Неоновые Маяки",
      icon: FaComments,
      color: "text-neon-lime",
      content: `Не продавай. Зажигай маяки.
      
      **Стратегия:**
      1. **Контент:** AI пишет основу, ты добавляешь душу. Правда и Польза.
      2. **Комьюнити:** Строй свой чат в Telegram. Это твой актив.
      3. **Посев:** Распространяй VIBE-вирус там, где обитает твоя ЦА.
      
      **Воронка:** Контент -> Чат -> Jumpstart (L1) -> Адепт (L2) -> Экспонента.`,
    },
    {
      id: "lab_ops",
      title: "6. Операционка: Телефон + AI",
      icon: FaMobile,
      color: "text-cyan-300",
      content: `Твой офис – в кармане.
      **Мантра:** "Если это можно делегировать AI – делегируй".
      - Видео? AI монтирует.
      - Пост? AI пишет черновик.
      - Клиент? Бот отвечает на FAQ.
      
      Ты – стратег. Роботы – исполнители.`,
    },
    {
      id: "exponential_org",
      title: "7. Структура: Ядро Экспоненты",
      icon: FaChartLine,
      color: "text-purple-400",
      content: `Забудь про найм сотрудников.
      
      **Формула VIBE-Роста:**
      Один ученик (L1), ставший мастером (L2), приводит ДВУХ новичков.
      Рост: 1 -> 2 -> 4 -> 8 -> 16.
      
      Твоя задача: Качать свой мозг ::FaBrain:: и нажимать кнопку L1->L2 у учеников.`,
    },
    {
      id: "finance_fuel",
      title: "8. Финансы: Топливо Реактора",
      icon: FaMoneyBillWave,
      color: "text-yellow-400",
      content: `Деньги = Энергия для свободы.
      
      1. **Купи СВОЕ Время:** Подушка безопасности, чтобы не думать о еде.
      2. **Первые Продажи:** Валидация идеи. Топливо для веры.
      3. **Реинвестиции:** В платные AI (Midjourney, GPT-4) и обучение.
      4. **Щит Веры:** НЗ на случай "Черного Лебедя".`,
    },
    {
      id: "omega_risks",
      title: "9. Протокол ОМЕГА (Риски)",
      icon: FaTriangleExclamation,
      color: "text-red-500",
      content: `Что если Матрица даст сбой?
      
      - **Выгорание:** Делегируй AI. Отдыхай. "Нет ложки".
      - **Идея не взлетела:** Убей её быстро. Запусти новую через 24 часа.
      - **Бан/Блокировка:** Диверсифицируй площадки (TG + Web + GitHub).
      
      Ты – Антихрупкий. Сбой системы делает тебя опытнее.`,
    }
  ];
};

// --- Components ---

const ProgressBar = ({ current, total }: { current: number; total: number }) => {
  const percentage = Math.min(100, Math.max(0, (current / total) * 100));
  
  return (
    <div className="w-full space-y-2 mb-8">
      <div className="flex justify-between text-xs uppercase tracking-widest font-mono text-gray-400">
        <span>Синхронизация Системы</span>
        <span>{Math.round(percentage)}%</span>
      </div>
      <div className="h-2 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
        <motion.div 
          className="h-full bg-gradient-to-r from-blue-600 via-purple-500 to-neon-lime shadow-[0_0_10px_rgba(174,255,0,0.5)]"
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
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

  return (
    <motion.div 
      initial={false}
      animate={{ 
        borderColor: isOpen ? "rgba(168, 85, 247, 0.5)" : isCompleted ? "rgba(34, 197, 94, 0.3)" : "rgba(55, 65, 81, 0.5)",
        backgroundColor: isOpen ? "rgba(0,0,0, 0.8)" : "rgba(0,0,0, 0.4)"
      }}
      className={cn(
        "border-l-4 rounded-r-xl overflow-hidden mb-4 backdrop-blur-sm transition-all duration-300",
        isCompleted ? "border-l-green-500" : isOpen ? "border-l-purple-500" : "border-l-gray-700"
      )}
    >
      <div 
        onClick={onToggle}
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors group"
      >
        <div className="flex items-center gap-4">
          <div className={cn("p-2 rounded-lg bg-black/50 border border-white/10 group-hover:border-white/20 transition-colors", section.color)}>
            <Icon className="text-xl" />
          </div>
          <div>
            <h3 className={cn("font-bold text-lg tracking-wide font-orbitron", isCompleted ? "text-gray-400 line-through decoration-green-500/50" : "text-gray-100")}>
              {section.title}
            </h3>
            {isCompleted && <span className="text-xs text-green-500 font-mono uppercase tracking-wider">Протокол выполнен</span>}
          </div>
        </div>
        
        <div className="flex items-center gap-3">
            <button
                onClick={onComplete}
                className={cn(
                    "p-2 rounded-full border transition-all z-10 hover:scale-110 active:scale-95",
                    isCompleted 
                        ? "bg-green-500/10 border-green-500 text-green-500" 
                        : "bg-transparent border-gray-600 text-gray-600 hover:border-gray-400 hover:text-gray-300"
                )}
                title={isCompleted ? "Отменить" : "Отметить как выполненное"}
            >
                <FaCheckCircle className="text-lg" />
            </button>
            <FaHandPointer className={cn("text-gray-600 transition-transform duration-300", isOpen && "rotate-180")} />
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="px-6 pb-6 pt-2 border-t border-white/5">
              <div className="prose prose-invert prose-sm max-w-none text-gray-300 leading-relaxed font-sans">
                <VibeContentRenderer content={section.content} />
              </div>
              
              {section.actionLabel && (
                <div className="mt-6 flex justify-end">
                    {section.actionLink?.startsWith('#') ? (
                         <Button 
                         variant="outline" 
                         className="border-purple-500/50 text-purple-300 hover:bg-purple-500/10 hover:text-purple-100 font-mono"
                         onClick={() => {
                             const el = document.getElementById(section.actionLink!.substring(1));
                             el?.scrollIntoView({ behavior: 'smooth' });
                         }}
                       >
                         <FaBolt className="mr-2" /> {section.actionLabel}
                       </Button>
                    ) : (
                        <Link href={section.actionLink || "#"}>
                            <Button 
                            className="bg-purple-600 hover:bg-purple-700 text-white font-bold shadow-[0_0_15px_rgba(168,85,247,0.4)]"
                            >
                            <FaRocket className="mr-2" /> {section.actionLabel}
                            </Button>
                        </Link>
                    )}
                 
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// --- Main Page Component ---
export default function PPlanPage() {
  const { dbUser, isLoading } = useAppContext();
  const [openSectionId, setOpenSectionId] = useState<string | null>("protocol_exodus");
  // В реальном приложении это состояние должно сохраняться в БД
  const [completedSections, setCompletedSections] = useState<string[]>([]);

  const sections = useMemo(() => getPlanSections(dbUser), [dbUser]);
  const pageTitleName = useMemo(() => dbUser?.first_name || "Кибер-Сталкер", [dbUser]);

  // Effects
  useEffect(() => {
    // Load completed sections from local storage for persistence in this demo
    const saved = localStorage.getItem('vibe_plan_progress');
    if (saved) setCompletedSections(JSON.parse(saved));
  }, []);

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

  if (isLoading) {
      return (
        <div className="flex flex-col justify-center items-center min-h-screen bg-black text-green-500 font-mono">
            <FaAtom className="animate-spin text-4xl mb-4"/>
            <span className="animate-pulse">Загрузка Нейро-Планировщика...</span>
        </div>
      );
  }

  return (
    <div className="min-h-screen bg-zinc-950 pt-24 pb-12 px-4 font-sans selection:bg-purple-500 selection:text-white">
        {/* Background Ambient */}
        <div className="fixed inset-0 pointer-events-none">
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-900/10 rounded-full blur-[120px]" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/10 rounded-full blur-[120px]" />
        </div>

        <div className="max-w-4xl mx-auto relative z-10">
            {/* Header */}
            <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center mb-12"
            >
                <div className="inline-flex items-center justify-center p-3 bg-black/50 border border-purple-500/30 rounded-full mb-6 backdrop-blur-md">
                    <FaFlaskVial className="text-purple-400 mr-3 text-xl animate-pulse" />
                    <span className="text-purple-200 font-mono text-sm tracking-widest uppercase">Гримуар Кибер-Алхимика v2.5</span>
                </div>
                
                <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter mb-4 glitch-text" data-text={`ПЛАН: ${pageTitleName.toUpperCase()}`}>
                    ПЛАН: <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">{pageTitleName.toUpperCase()}</span>
                </h1>
                <p className="text-gray-400 text-lg max-w-2xl mx-auto font-light">
                    Твой пошаговый алгоритм превращения хаоса в систему, а системы — в свободу.
                </p>
            </motion.div>

            {/* Progress Dashboard */}
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="bg-zinc-900/80 border border-zinc-800 p-6 rounded-2xl shadow-2xl backdrop-blur-xl mb-12"
            >
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <FaUserSecret className="text-2xl text-gray-100" />
                        <div className="flex flex-col">
                            <span className="text-xs text-gray-500 uppercase font-bold">Оперативник</span>
                            <span className="text-gray-200 font-mono">{dbUser?.username || "Unknown"}</span>
                        </div>
                    </div>
                    <div className="text-right">
                         <span className="text-xs text-gray-500 uppercase font-bold block">Статус Миссии</span>
                         <span className={cn(
                             "font-mono font-bold",
                             completedSections.length === sections.length ? "text-green-400" : "text-yellow-400"
                         )}>
                             {completedSections.length === sections.length ? "ВЫПОЛНЕНО" : "В ПРОЦЕССЕ"}
                         </span>
                    </div>
                </div>

                <ProgressBar current={completedSections.length} total={sections.length} />

                {completedSections.length === sections.length && (
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-green-900/20 border border-green-500/30 p-4 rounded-lg text-center"
                    >
                        <p className="text-green-400 font-bold flex items-center justify-center gap-2">
                            <FaCheckCircle /> Симуляция завершена. Ты готов к реальности.
                        </p>
                    </motion.div>
                )}
            </motion.div>

            {/* Timeline / Sections */}
            <div className="space-y-2 relative">
                {/* Vertical Line decoration (optional) */}
                <div className="absolute left-8 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-purple-900/50 to-transparent hidden md:block" />

                {sections.map((section, index) => (
                    <motion.div
                        key={section.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
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
                className="mt-16 text-center p-8 border-t border-white/10"
            >
                <FaGamepad className="text-5xl text-purple-500 mx-auto mb-4 animate-bounce" />
                <h2 className="text-2xl font-bold text-white mb-2">Игра началась.</h2>
                <p className="text-gray-400 mb-6">
                    Карта — это не территория. Вставай и иди.
                </p>
                <Link href="https://t.me/salavey13" target="_blank">
                    <Button variant="outline" className="border-neon-lime text-neon-lime hover:bg-neon-lime hover:text-black font-mono uppercase tracking-wider">
                        <FaTelegram className="mr-2" /> Связь с Архитектором
                    </Button>
                </Link>
            </motion.div>
        </div>
    </div>
  );
}