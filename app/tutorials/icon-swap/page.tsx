"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import ScrollControlledVideoPlayer from '@/components/ScrollControlledVideoPlayer';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { Button } from '@/components/ui/button';

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
        videoSrc: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-icon-swap-wtf/step1_find_icon.mp4" // Placeholder
      },
      {
        id: 2,
        title: "Шаг 2: Идентификация Цели",
        description: "Запомни имя `<iconname>` из предупреждения. Это имя (в нижнем регистре) должно быть ключом в `iconNameMap` в `/components/VibeContentRenderer.tsx`. Значение этого ключа – корректное PascalCase имя иконки из `react-icons/fa6`.",
        icon: "FaCrosshairs",
        color: "brand-pink",
        videoSrc: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-icon-swap-wtf/step2_sticky_chat.mp4" // Placeholder
      },
      {
        id: 3,
        title: "Шаг 3: Подбор Боеприпаса (Иконки)",
        description: "Если иконки нет в карте, или имя некорректно, найди правильное имя на сайте [FontAwesome](https://fontawesome.com/search?o=r&m=free&f=brands,solid,regular) (например, `magnifying-glass` -> `FaMagnifyingGlass`) или в документации `react-icons`. ",
        icon: "FaBookMedical",
        color: "brand-blue",
        videoSrc: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-icon-swap-wtf/step3_modal_magic.mp4" // Placeholder
      },
      {
        id: 4,
        title: "Шаг 4: Нейтрализация Угрозы",
        description: "Внеси исправление: \n1. Если ошибка в строке типа `::FaIconName::`, убедись что `FaIconName` (PascalCase) написано правильно и `faiconname` (lowercase) есть в `iconNameMap` и указывает на существующую иконку. \n2. Если нужно добавить новую иконку в карту – отредактируй `iconNameMap` в `VibeContentRenderer.tsx`. \n3. Используй SUPERVIBE Studio для автоматической замены через 'Magic Swap' или 'Search/Replace'.",
        icon: "FaShieldHalved",
        color: "brand-purple",
        videoSrc: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-icon-swap-wtf/step4_profit.mp4" // Placeholder
      },
      {
        id: 5,
        title: "Шаг 5: Контрольная Проверка",
        description: "Обнови страницу. Убедись, что иконка отображается корректно и предупреждение в консоли исчезло. Помни: без `VibeContentRenderer` или другой защиты, отсутствующая иконка может вызвать падение сборки!",
        icon: "FaCheckDouble",
        color: "brand-green",
        // No video for this RU step typically
      }
    ],
    nextLevelTitle: "::FaAward:: Навык 'Разминирование Иконок' Получен!",
    nextLevelText: "Отличная работа, сапёр! Теперь ты можешь поддерживать визуальную целостность интерфейсов. <Link href='/repo-xml' class='text-brand-blue hover:underline font-semibold'>SUPERVIBE Studio</Link> готова к новым задачам.",
    tryLiveButton: "::FaTools:: Перейти в Студию",
    toggleButtonToWtf: "::FaBrain:: Переключить на WTF-инструкцию",
    toggleButtonToNormal: "::FaBookOpen:: Вернуться к нормальной инструкции",
  },
  wtf: {
    pageTitle: "Инструкция по Иконкам для Чайников",
    pageSubtitle: "Просто следуй этим шагам, и всё будет ::FaThumbsUp::!",
    steps: [
      {
        id: 1,
        title: "Шаг 1: Увидел? Запомни!",
        description: "На странице видишь `[?] Неизвестная иконка <ИМЯ_ИКОНКИ>`? Просто ЗАПОМНИ это `<ИМЯ_ИКОНКИ>`. Больше ничего не надо, просто запомни или скопируй.",
        icon: "FaEye",
        color: "brand-orange",
        videoSrc: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-icon-swap-wtf/step1_find_icon.mp4"
      },
      {
        id: 2,
        title: "Шаг 2: Кнопка Чата -> Вставь Имя",
        description: "Внизу слева есть КРУГЛАЯ КНОПКА ::FaCommentDots:: (это Sticky Chat). Нажми её. Появится поле для текста. ВСТАВЬ туда `<ИМЯ_ИКОНКИ>` которое ты запомнил.",
        icon: "FaKeyboard",
        color: "brand-pink",
        videoSrc: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-icon-swap-wtf/step2_sticky_chat.mp4"
      },
      {
        id: 3,
        title: "Шаг 3: Магия Sticky Chat!",
        description: "Sticky Chat сам всё поймёт! Он предложит ЗАМЕНИТЬ иконку. Нажми кнопку, которую он покажет. Откроется окно. Там будет:\n1.  Ссылка на сайт со ВСЕМИ иконками. Нажми, найди НУЖНУЮ, скопируй её ПОЛНОЕ ИМЯ (например, `FaBeer`).\n2.  Поле, куда ВСТАВИТЬ это новое имя.\n3.  Кнопка 'OK'. Нажми её. Всё! Можно расслабиться. Это самый сложный шаг, ты справишься!",
        icon: "FaWandMagicSparkles",
        color: "brand-purple",
        videoSrc: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-icon-swap-wtf/step3_modal_magic.mp4"
      },
      {
        id: 4,
        title: "Шаг 4: ПРОФИТ! Иконка на Месте!",
        description: "Автоматика всё сделает: обновит код, создаст PR, он сам одобрится. Через пару минут обнови страницу – иконка будет КРАСИВАЯ! Ты – ГЕРОЙ!",
        icon: "FaCheckDouble",
        color: "brand-green",
        videoSrc: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-icon-swap-wtf/step4_profit.mp4"
      }
    ],
    nextLevelTitle: "::FaMedal:: Иконки Обезврежены!",
    nextLevelText: "Ты крут! Теперь ты можешь чинить иконки как профи. Хочешь еще магии? <Link href='/repo-xml' class='text-brand-blue hover:underline font-semibold'>SUPERVIBE Studio</Link> ждет.",
    tryLiveButton: "::FaTools:: В Студию!",
    toggleButtonToWtf: "::FaBrain:: Переключить на WTF-инструкцию",
    toggleButtonToNormal: "::FaBookOpen:: Вернуться к нормальной инструкции",
  }
};

const colorClasses: Record<string, { text: string; border: string; shadow: string }> = {
  "brand-pink": { text: "text-brand-pink", border: "border-brand-pink/50", shadow: "shadow-brand-pink/40" },
  "brand-blue": { text: "text-brand-blue", border: "border-brand-blue/50", shadow: "shadow-brand-blue/40" },
  "brand-purple": { text: "text-brand-purple", border: "border-brand-purple/50", shadow: "shadow-brand-purple/40" },
  "brand-green": { text: "text-brand-green", border: "border-brand-green/50", shadow: "shadow-brand-green/40" },
  "brand-orange": { text: "text-brand-orange", border: "border-brand-orange/50", shadow: "shadow-brand-orange/40" },
};

export default function IconSwapTutorialPage() {
  const [currentMode, setCurrentMode] = useState<'ru' | 'wtf'>('ru');
  const t = iconSwapTutorialTranslations[currentMode];

  const toggleMode = () => {
    setCurrentMode(prevMode => prevMode === 'ru' ? 'wtf' : 'ru');
  };

  const stepsToRender = currentMode === 'wtf' ? iconSwapTutorialTranslations.wtf.steps : iconSwapTutorialTranslations.ru.steps;
  const pageMainColor = "brand-purple"; // Main color for this tutorial page

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
              "mt-6 bg-card/50 hover:bg-brand-cyan/10 transition-all duration-200 text-sm px-4 py-2",
              colorClasses["brand-cyan"]?.border || "border-brand-cyan/50", // WTF button always cyan for contrast
              `${colorClasses["brand-cyan"]?.text}/90 hover:${colorClasses["brand-cyan"]?.text}`
            )}
          >
            <VibeContentRenderer content={currentMode === 'ru' ? t.toggleButtonToWtf : t.toggleButtonToNormal} />
          </Button>
        </header>

        <div className="space-y-12 md:space-y-20">
          {stepsToRender.map((step, index) => {
            const stepColor = colorClasses[step.color] || colorClasses["brand-purple"];
            // Check if videoSrc exists and is a non-empty string for the current step
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
             // Add other color conditions if this page type can have variable main colors
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