"use client";

import React, { useState, useEffect, Suspense } from 'react'; // Added Suspense
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import ScrollControlledVideoPlayer from '@/components/ScrollControlledVideoPlayer';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { Button } from '@/components/ui/button';
import TutorialLoader from '../TutorialLoader'; // Import the loader

const iconSwapTutorialTranslations = {
  ru: {
    pageTitle: "Миссия 2: Сапёр Иконок",
    pageSubtitle: "Агент! Твоя цель – научиться обезвреживать 'минные поля' из битых иконок. ::FaLandMineOn:: -> ::FaScrewdriverWrench:: -> ::FaSmileWink::. Одна ошибка – и интерфейс может 'подорваться'!",
    steps: [
      {
        id: 1,
        title: "Шаг 1: Обнаружение Аномалии",
        description: "Первый признак проблемы – предупреждение `[?] Неизвестная иконка <iconname>` в консоли браузера (F12) или в Оверлее Ошибок (Ctrl+Shift+E). Это сигнал от `VibeContentRenderer`, что иконка не найдена в его карте (`iconNameMap`).",
        icon: "FaTriangleExclamation",
        color: "brand-orange",
        videoSrc: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-icon-swap-wtf/step1_find_icon.mp4" 
      },
      {
        id: 2,
        title: "Шаг 2: Идентификация Цели",
        description: "Запомни имя `<iconname>` из предупреждения. Это имя (в нижнем регистре) должно быть ключом в `iconNameMap` в `/components/VibeContentRenderer.tsx`. Значение этого ключа – корректное PascalCase имя иконки из `react-icons/fa6`.",
        icon: "FaCrosshairs",
        color: "brand-pink",
        videoSrc: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-icon-swap-wtf/step2_sticky_chat.mp4" 
      },
      {
        id: 3,
        title: "Шаг 3: Подбор Боеприпаса (Иконки)",
        description: "Если иконки нет в карте, или имя некорректно, найди правильное имя на сайте [FontAwesome](https://fontawesome.com/search?o=r&m=free&f=brands,solid,regular) (например, `magnifying-glass` -> `FaMagnifyingGlass`) или в документации `react-icons`. ",
        icon: "FaBookMedical",
        color: "brand-blue",
        videoSrc: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-icon-swap-wtf/step3_modal_magic.mp4" 
      },
      {
        id: 4,
        title: "Шаг 4: Нейтрализация Угрозы",
        description: "Внеси исправление: \n1. Если ошибка в строке типа `::FaIconName::`, убедись что `FaIconName` (PascalCase) написано правильно и `faiconname` (lowercase) есть в `iconNameMap` и указывает на существующую иконку. \n2. Если нужно добавить новую иконку в карту – отредактируй `iconNameMap` в `VibeContentRenderer.tsx`. \n3. Используй SUPERVIBE Studio для автоматической замены через 'Magic Swap' или 'Search/Replace'.",
        icon: "FaShieldHalved",
        color: "brand-purple",
        videoSrc: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-icon-swap-wtf/step4_profit.mp4" 
      },
      {
        id: 5,
        title: "Шаг 5: Контрольная Проверка",
        description: "Обнови страницу. Убедись, что иконка отображается корректно и предупреждение в консоли исчезло. Помни: без `VibeContentRenderer` или другой защиты, отсутствующая иконка может вызвать падение сборки!",
        icon: "FaCheckDouble",
        color: "brand-green",
      }
    ],
    nextLevelTitle: "::FaAward:: Навык 'Разминирование Иконок' Получен!",
    nextLevelText: "Отличная работа, сапёр! Теперь ты можешь поддерживать визуальную целостность интерфейсов. <Link href='/repo-xml' class='text-brand-blue hover:underline font-semibold'>SUPERVIBE Studio</Link> готова к новым задачам.",
    tryLiveButton: "::FaTools:: Перейти в Студию",
    toggleButtonToWtf: "::FaPooStorm:: Включить Режим БОГА (WTF?!)",
    toggleButtonToNormal: "::FaBook:: Вернуть Скучную Инструкцию",
  },
  wtf: {
    pageTitle: "WTF IS THIS ICON?! ::FaHandMiddleFinger::",
    pageSubtitle: "Сломалась иконка? Пффф, ИЗИ! Sticky Chat – твой чит-код. Press F to Pay Respects to Broken Icons.",
    steps: [
      {
        id: 1,
        title: "ШАГ 1: СКОПИПАСТЬ ИМЯ БАГА",
        description: "Видишь `[?] Неизвестная иконка <СРАТОЕ_ИМЯ>`? Копируй `<СРАТОЕ_ИМЯ>`! ВСЁ!",
        icon: "FaRegCopy", 
        color: "brand-orange",
        videoSrc: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-icon-swap-wtf/step1_find_icon.mp4"
      },
      {
        id: 2,
        title: "ШАГ 2: КНОПКА ЧАТА -> CTRL+V",
        description: "Слева внизу КРУГЛАЯ ФИГНЯ ::FaCommentDots::. Жми. В поле вставь `<СРАТОЕ_ИМЯ>`. Done.",
        icon: "FaPaste", 
        color: "brand-pink",
        videoSrc: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-icon-swap-wtf/step2_sticky_chat.mp4"
      },
      {
        id: 3,
        title: "ШАГ 3: МАГИЯ STICKY CHAT, BLYAT!",
        description: "Чат предложит 'Заменить Иконку'. Жми! \n1. Ссылка на FontAwesome – тыкай, ищи НОРМ ИКОНКУ, копируй её ПОЛНОЕ ИМЯ (типа `FaBeer`).\n2. Вставь новое имя в поле. \n3. Жми 'OK'. Profit!",
        icon: "FaMagic", 
        color: "brand-purple",
        videoSrc: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-icon-swap-wtf/step3_modal_magic.mp4"
      },
      {
        id: 4,
        title: "ШАГ 4: GG WP! ИКОНКА ЦЕЛА!",
        description: "Автоматика всё сделает: PR, мердж. Обнови страницу – иконка ИДЕАЛЬНА! Ты – боженька UX!",
        icon: "FaCheckCircle", 
        color: "brand-green",
        videoSrc: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-icon-swap-wtf/step4_profit.mp4"
      }
    ],
    nextLevelTitle: "::FaCrown:: ИКОНКИ ПОДЧИНЯЮТСЯ ТЕБЕ!",
    nextLevelText: "Ты теперь повелитель иконок! Го в <Link href='/repo-xml' class='text-brand-blue hover:underline font-semibold'>SUPERVIBE Studio</Link> ломать дальше... или чинить.",
    tryLiveButton: "::FaHammer:: В Студию, РАБОТЯГА!",
    toggleButtonToWtf: "::FaPooStorm:: Включить Режим БОГА (WTF?!)",
    toggleButtonToNormal: "::FaBook:: Вернуть Скучную Инструкцию",
  }
};

const colorClasses: Record<string, { text: string; border: string; shadow: string }> = {
  "brand-pink": { text: "text-brand-pink", border: "border-brand-pink/50", shadow: "shadow-brand-pink/40" },
  "brand-blue": { text: "text-brand-blue", border: "border-brand-blue/50", shadow: "shadow-brand-blue/40" },
  "brand-purple": { text: "text-brand-purple", border: "border-brand-purple/50", shadow: "shadow-brand-purple/40" },
  "brand-green": { text: "text-brand-green", border: "border-brand-green/50", shadow: "shadow-brand-green/40" },
  "brand-orange": { text: "text-brand-orange", border: "border-brand-orange/50", shadow: "shadow-brand-orange/40" },
};

function IconSwapTutorialContent() {
  const searchParams = useSearchParams();
  const initialMode = searchParams.get('mode') === 'wtf' ? 'wtf' : 'ru';
  const [currentMode, setCurrentMode] = useState<'ru' | 'wtf'>(initialMode);
  
  const t = iconSwapTutorialTranslations[currentMode];

  const toggleMode = () => {
    setCurrentMode(prevMode => prevMode === 'ru' ? 'wtf' : 'ru');
  };
  
  useEffect(() => {
    const newMode = searchParams.get('mode') === 'wtf' ? 'wtf' : 'ru';
    if (newMode !== currentMode) {
      setCurrentMode(newMode);
    }
  }, [searchParams, currentMode]);

  const stepsToRender = t.steps;
  const pageMainColor = "brand-purple"; 

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-gray-900 via-black to-indigo-900/30 text-gray-200 pt-24 pb-20 overflow-x-hidden">
      <div
        className="absolute inset-0 bg-repeat opacity-[0.04] -z-10"
        style={{
          backgroundImage: `linear-gradient(to right, rgba(139, 92, 246, 0.1) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(139, 92, 246, 0.1) 1px, transparent 1px)`,
          backgroundSize: '45px 45px',
        }}
      ></div>

      <div className="container mx-auto px-4">
        <header className="text-center mb-12 md:mb-16">
          <h1 className={cn(
            "text-4xl sm:text-5xl md:text-6xl font-orbitron font-bold cyber-text glitch mb-4",
             colorClasses[pageMainColor]?.text || "text-brand-purple"
            )} data-text={t.pageTitle}>
            <VibeContentRenderer content={t.pageTitle} />
          </h1>
          <p className="text-md sm:text-lg md:text-xl text-gray-300 font-mono max-w-3xl mx-auto">
            <VibeContentRenderer content={t.pageSubtitle} />
          </p>
           <Button 
            onClick={toggleMode} 
            variant="outline" 
            className={cn(
              "mt-6 bg-card/50 hover:bg-brand-pink/20 transition-all duration-200 text-sm px-4 py-2",
              "border-brand-pink/70 text-brand-pink/90 hover:text-brand-pink"
            )}
          >
            <VibeContentRenderer content={currentMode === 'ru' ? t.toggleButtonToWtf : t.toggleButtonToNormal} />
          </Button>
        </header>

        <div className="space-y-12 md:space-y-20">
          {stepsToRender.map((step, index) => {
            const stepColor = colorClasses[step.color] || colorClasses["brand-purple"];
            const hasVideo = !!(step as any).videoSrc && typeof (step as any).videoSrc === 'string';

            return (
              <section key={step.id} className={cn(index > 0 && "border-t border-gray-700/50 pt-10 md:pt-14")}>
                <div className={cn(
                  "flex flex-col gap-6 md:gap-10",
                  index % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"
                )}>
                  <div className={cn("space-y-4 flex flex-col items-start justify-center", hasVideo ? "md:w-2/5 lg:w-1/3" : "w-full")}>
                    <h2 className={cn("text-3xl md:text-4xl font-orbitron flex items-center gap-3", stepColor.text)}>
                      <VibeContentRenderer content={`::${step.icon}::`} className="text-3xl opacity-90" />
                      <VibeContentRenderer content={step.title} />
                    </h2>
                    <div className="text-gray-300 text-base md:text-lg leading-relaxed prose prose-invert prose-sm md:prose-base max-w-none prose-p:my-2 prose-ul:my-2 prose-li:my-1 prose-headings:my-3 prose-a:text-brand-blue hover:prose-a:text-brand-cyan">
                      <VibeContentRenderer content={step.description} />
                    </div>
                  </div>

                  {hasVideo && (
                    <div className="md:w-3/5 lg:w-2/3">
                      <div className={cn("rounded-xl overflow-hidden border-2 shadow-2xl", stepColor.border, stepColor.shadow, "bg-black")}>
                        <ScrollControlledVideoPlayer 
                          src={(step as any).videoSrc}
                          className="w-full" 
                        />
                      </div>
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>

        <section className={cn(
            "mt-20 md:mt-32 text-center pt-12 md:pt-16",
            colorClasses[pageMainColor]?.border ? `border-t ${colorClasses[pageMainColor]?.border}/40` : "border-t border-brand-purple/40"
            )}>
          <h2 className={cn("text-3xl md:text-4xl font-orbitron mb-6", colorClasses[pageMainColor]?.text || "text-brand-purple")}>
             <VibeContentRenderer content={t.nextLevelTitle} />
          </h2>
          <p className="text-lg md:text-xl text-gray-300 font-mono max-w-2xl mx-auto mb-8">
            <VibeContentRenderer content={t.nextLevelText} />
          </p>
          <Button asChild className={cn(
             "inline-flex items-center justify-center px-8 py-4 border border-transparent text-lg font-semibold rounded-full text-black transition-transform transform hover:scale-105",
             "shadow-xl",
             pageMainColor === "brand-purple" && "bg-brand-purple hover:bg-brand-purple/80 hover:shadow-purple-glow/60",
             )}>
            <Link href="/repo-xml">
                <VibeContentRenderer content={t.tryLiveButton} />
            </Link>
          </Button>
        </section>
      </div>
    </div>
  );
}

export default function IconSwapTutorialPage() {
  return (
    <Suspense fallback={<TutorialLoader />}>
      <IconSwapTutorialContent />
    </Suspense>
  );
}