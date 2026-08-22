"use client";

import React, { useState, useEffect, Suspense, useCallback, useId } from 'react'; 
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import ScrollControlledVideoPlayer from '@/components/ScrollControlledVideoPlayer';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { Button } from '@/components/ui/button';
import TutorialLoader from '../TutorialLoader'; 
import { useAppContext } from '@/contexts/AppContext';
import { markTutorialAsCompleted } from '@/hooks/cyberFitnessSupabase';
import { useAppToast } from '@/hooks/useAppToast';

import TutorialPageContainer from '../TutorialPageContainer';
import RockstarHeroSection from '../RockstarHeroSection';
import TutorialContentContainer from '../TutorialContentContainer';
import TutorialStepSection from '../TutorialStepSection';
import NextLevelTeaser from '../NextLevelTeaser';

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
    nextLevelText: "Отличная работа, сапёр! Теперь ты можешь поддерживать визуальную целостность интерфейсов. <Link href='/start-training' class='text-brand-blue hover:underline font-semibold'>Следующая Миссия</Link> ждет!",
    tryLiveButton: "::FaTools:: Перейти в Студию",
    toggleButtonToWtf: "::FaPooStorm:: Врубить Режим БОГА (WTF?!)",
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
        icon: "FaCircleCheck", 
        color: "brand-green",
        videoSrc: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-icon-swap-wtf/step4_profit.mp4"
      }
    ],
    nextLevelTitle: "::FaCrown:: ИКОНКИ ПОДЧИНЯЮТСЯ ТЕБЕ!",
    nextLevelText: "Ты теперь повелитель иконок! Го на <Link href='/start-training' class='text-brand-blue hover:underline font-semibold'>Следующую Миссию</Link>, там РЕАЛЬНЫЕ ДЕЛА.",
    tryLiveButton: "::FaHammer:: В Студию, РАБОТЯГА!",
    toggleButtonToWtf: "::FaPooStorm:: Врубить Режим БОГА (WTF?!)", 
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
  const router = useRouter();
  const { dbUser, isAuthenticated } = useAppContext();
  const { addToast } = useAppToast();
  const heroTriggerId = useId().replace(/:/g, "-") + "-hero-trigger"; 

  const initialModeFromUrl = searchParams.get('mode') === 'wtf';
  const [currentMode, setCurrentMode] = useState<'ru' | 'wtf'>(initialModeFromUrl ? 'wtf' : 'ru');
  
  const t = iconSwapTutorialTranslations[currentMode];
  const tutorialQuestId = "icon-swap-mission";

  const handleTutorialCompletion = useCallback(async () => {
    if (isAuthenticated && dbUser?.user_id) {
      const result = await markTutorialAsCompleted(dbUser.user_id, tutorialQuestId);
      if (result.success && result.kiloVibesAwarded && result.kiloVibesAwarded > 0) {
        addToast(`::FaCircleCheck:: Миссия "${iconSwapTutorialTranslations.ru.pageTitle}" пройдена! +${result.kiloVibesAwarded} KiloVibes!`, "success");
      }
      result.newAchievements?.forEach(ach => {
        addToast(`🏆 Ачивка: ${ach.name}!`, "success", 5000, { description: ach.description });
      });
    }
  }, [isAuthenticated, dbUser, addToast, tutorialQuestId]);

  useEffect(() => {
    handleTutorialCompletion();
  }, [handleTutorialCompletion]);
  
  const toggleMode = () => {
    const newMode = currentMode === 'ru' ? 'wtf' : 'ru';
    setCurrentMode(newMode);
    router.replace(`/tutorials/icon-swap${newMode === 'wtf' ? '?mode=wtf' : ''}`, { scroll: false });
  };
  
  useEffect(() => {
    const modeFromUrl = searchParams.get('mode') === 'wtf' ? 'wtf' : 'ru';
    if (modeFromUrl !== currentMode) {
      setCurrentMode(modeFromUrl);
    }
  }, [searchParams, currentMode]);

  const stepsToRender = t.steps;
  const pageMainColorKey = "brand-purple"; 

  return (
    <TutorialPageContainer>
      <RockstarHeroSection
        title={t.pageTitle}
        subtitle={t.pageSubtitle}
        triggerElementSelector={`#${heroTriggerId}`}
        // mainBackgroundImageUrl uses new default from RockstarHeroSection if not overridden
        backgroundImageObjectUrl="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/appStore/oneSitePls_transparent_icon.png"
      >
        <Button 
            onClick={toggleMode} 
            variant="outline" 
            size="lg"
            className={cn(
                "backdrop-blur-lg transition-all duration-300 font-orbitron active:scale-95 transform hover:scale-105 focus:ring-offset-background",
                currentMode === 'ru' 
                ? "bg-brand-pink/10 border-2 border-brand-pink text-brand-pink shadow-md shadow-brand-pink/40 hover:bg-brand-pink/20 hover:text-white hover:shadow-pink-glow focus:ring-2 focus:ring-brand-pink" 
                : "bg-brand-blue/10 border-2 border-brand-blue text-brand-blue shadow-md shadow-brand-blue/40 hover:bg-brand-blue/20 hover:text-white hover:shadow-blue-glow focus:ring-2 focus:ring-brand-blue"
            )}
        >
            <VibeContentRenderer content={currentMode === 'ru' ? iconSwapTutorialTranslations.ru.toggleButtonToWtf : iconSwapTutorialTranslations.wtf.toggleButtonToNormal} />
        </Button>
      </RockstarHeroSection>

      <div id={heroTriggerId} style={{ height: '250vh' }} aria-hidden="true" />

      <TutorialContentContainer className="relative">
        <div className="space-y-12 md:space-y-20">
          {stepsToRender.map((step, index) => {
            const stepColorData = colorClasses[step.color as keyof typeof colorClasses] || colorClasses["brand-purple"];
            const hasVideo = !!(step as any).videoSrc && typeof (step as any).videoSrc === 'string';

            return (
              <TutorialStepSection 
                key={step.id} 
                className={cn(index > 0 && "pt-12 md:pt-16")} 
                isLastStep={index === stepsToRender.length -1}
              >
                <div className={cn(
                  "flex flex-col gap-6 md:gap-10",
                  index % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"
                )}>
                  <div className={cn("space-y-4 flex flex-col items-start justify-center", hasVideo ? "md:w-2/5 lg:w-1/3" : "w-full")}>
                    <h2 className={cn("text-3xl md:text-4xl font-orbitron flex items-center gap-3", stepColorData.text)}>
                      <VibeContentRenderer content={`::${step.icon}::`} className="text-3xl opacity-90" />
                      <VibeContentRenderer content={step.title} />
                    </h2>
                    <div className="text-gray-300 text-base md:text-lg leading-relaxed prose prose-invert prose-sm md:prose-base max-w-none prose-p:my-2 prose-ul:my-2 prose-li:my-1 prose-headings:my-3 prose-a:text-brand-blue hover:prose-a:text-brand-cyan">
                      <VibeContentRenderer content={step.description} />
                    </div>
                  </div>

                  {hasVideo && (
                    <div className="md:w-3/5 lg:w-2/3">
                      <div className={cn("rounded-xl overflow-hidden border-2 shadow-2xl", stepColorData.border, stepColorData.shadow, "bg-black")}>
                        <ScrollControlledVideoPlayer 
                          src={(step as any).videoSrc}
                          className="w-full" 
                        />
                      </div>
                    </div>
                  )}
                </div>
              </TutorialStepSection>
            );
          })}
        </div>
      </TutorialContentContainer>
      
      <NextLevelTeaser 
        title={t.nextLevelTitle}
        text={t.nextLevelText}
        buttonText={t.tryLiveButton}
        buttonLink="/start-training"
        mainColorClassKey={pageMainColorKey}
      />
    </TutorialPageContainer>
  );
}

export default function IconSwapTutorialPage() {
  return (
    <Suspense fallback={<TutorialLoader />}>
      <IconSwapTutorialContent />
    </Suspense>
  );
}