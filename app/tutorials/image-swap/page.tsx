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

const imageSwapTutorialTranslations = {
  ru: {
    pageTitle: "Миссия 1: Охота на Битый Пиксель",
    pageSubtitle: "Первая миссия, Агент! Научись быстро заменять изображения в коде, используя мощь SUPERVIBE Studio. Это твой первый шаг к мастерству.",
    steps: [ 
      { id: 1, title: "Шаг 1: Захват URL Старого Артефакта", description: "Первая задача, оперативник: обнаружить в кодовой базе изображение, требующее замены. Найдя, скопируй его полный URL. Это твоя основная цель!", videoSrc: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-1-img-swap//1_copy_image_link.mp4", icon: "FaLink", color: "brand-pink" },
      { id: 2, title: "Шаг 2: Развертывание Нового Актива", description: "Далее, загрузи свой новенький, сияющий файл замены. Рекомендуем Supabase Storage для гладкой интеграции, но подойдет любой публично доступный URL. Защити новую ссылку!", videoSrc: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-1-img-swap//2_upload_new_image.mp4", icon: "FaUpload", color: "brand-blue" },
      { id: 3, title: "Шаг 3: Активация VIBE-Трансмутации!", description: "Время магии! Направляйся в SUPERVIBE Studio. Введи URL старого изображения, затем нового. Наш AI-агент обработает модификации кода и подготовит замену.", videoSrc: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-1-img-swap//3_sitback_and_relax_its_swappin.mp4", icon: "FaWandMagicSparkles", color: "brand-purple" },
      { id: 4, title: "Шаг 4: Операция Успешна! Анализ PR", description: "Миссия выполнена! Pull Request с заменой изображения сгенерирован автоматически. Осталось лишь проверить, смерджить и наслаждаться результатом. Профит!", videoSrc: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-1-img-swap//4_profit_check.mp4", icon: "FaCheckDouble", color: "brand-green" }
    ],
    nextLevelTitle: "<FaPlayCircle /> Новый Уровень Разблокирован!",
    nextLevelText: "Основы у тебя в кармане, Агент! Готов применить эти навыки в реальном бою? <Link href='/start-training' class='text-brand-blue hover:underline font-semibold'>Следующая Миссия</Link> ждет!",
    tryLiveButton: "<FaWandMagicSparkles /> Попробовать в Студии",
    toggleButtonToWtf: "<FaPooStorm /> Включить Режим БОГА (WTF?!)",
  },
  wtf: {
    pageTitle: "КАРТИНКИ МЕНЯТЬ – КАК ДВА БАЙТА ПЕРЕСЛАТЬ!",
    pageSubtitle: "Это твой первый урок, салага! Научись менять картинки или проваливай!",
    steps: [ 
      { id: 1, title: "ШАГ 1: КОПИРУЙ СТАРЫЙ URL", description: "Нашел картинку в коде? КОПИРНИ ЕЕ АДРЕС. Всё.", videoSrc: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-1-img-swap//1_copy_image_link.mp4", icon: "FaCopy", color: "brand-pink" },
      { id: 2, title: "ШАГ 2: ЗАЛЕЙ НОВУЮ, КОПИРУЙ URL", description: "Загрузи НОВУЮ картинку. КОПИРНИ ЕЕ АДРЕС. Изи.", videoSrc: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-1-img-swap//2_upload_new_image.mp4", icon: "FaCloudArrowUp", color: "brand-blue" },
      { id: 3, title: "ШАГ 3: СТУДИЯ -> CTRL+V, CTRL+V -> MAGIC!", description: "Иди в SUPERVIBE. Старый URL -> Новый URL. ЖМИ КНОПКУ. Бот сам всё сделает.", videoSrc: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-1-img-swap//3_sitback_and_relax_its_swappin.mp4", icon: "FaRightLeft", color: "brand-purple" },
      { id: 4, title: "ШАГ 4: PR ГОТОВ! ТЫ КРАСАВЧИК!", description: "PR создан. Проверь, смерджи. Всё! Ты поменял картинку быстрее, чем заварил дошик.", videoSrc: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-1-img-swap//4_profit_check.mp4", icon: "FaThumbsUp", color: "brand-green" }
    ],
    nextLevelTitle: "<FaRocket /> ТЫ ПРОКАЧАЛСЯ, БРО!",
    nextLevelText: "Менять картинки – это для лохов. Ты уже ПРО. Го на <Link href='/start-training' class='text-brand-blue hover:underline font-semibold'>Следующую Миссию</Link>, там РЕАЛЬНЫЕ ДЕЛА.",
    tryLiveButton: "<FaArrowRight /> В Студию, НЕ ТОРМОЗИ!",
    toggleButtonToNormal: "<FaBookOpen /> Вернуть Скучную Инструкцию", 
  }
};

const colorClasses: Record<string, { text: string; border: string; shadow: string }> = {
  "brand-pink": { text: "text-brand-pink", border: "border-brand-pink", shadow: "shadow-pink-glow" },
  "brand-blue": { text: "text-brand-blue", border: "border-brand-blue", shadow: "shadow-blue-glow" },
  "brand-purple": { text: "text-brand-purple", border: "border-brand-purple", shadow: "shadow-purple-glow" },
  "brand-green": { text: "text-brand-green", border: "border-brand-green", shadow: "shadow-green-glow" },
};

function ImageSwapTutorialContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { dbUser, isAuthenticated } = useAppContext();
  const { addToast } = useAppToast();
  const heroTriggerId = useId().replace(/:/g, "-") + "-hero-trigger"; // Unique ID for trigger

  const initialModeFromUrl = searchParams.get('mode') === 'wtf';
  const [currentMode, setCurrentMode] = useState<'ru' | 'wtf'>(initialModeFromUrl ? 'wtf' : 'ru');

  const t = imageSwapTutorialTranslations[currentMode];
  const tutorialQuestId = "image-swap-mission";

  const handleTutorialCompletion = useCallback(async () => {
    if (isAuthenticated && dbUser?.user_id) {
      const result = await markTutorialAsCompleted(dbUser.user_id, tutorialQuestId);
      if (result.success && result.kiloVibesAwarded && result.kiloVibesAwarded > 0) {
        addToast(`::FaCheckCircle:: Миссия "${imageSwapTutorialTranslations.ru.pageTitle}" пройдена! +${result.kiloVibesAwarded} KiloVibes!`, "success");
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
    router.replace(`/tutorials/image-swap${newMode === 'wtf' ? '?mode=wtf' : ''}`, { scroll: false });
  };
  
  useEffect(() => {
    const modeFromUrl = searchParams.get('mode') === 'wtf' ? 'wtf' : 'ru';
    if (modeFromUrl !== currentMode) {
      setCurrentMode(modeFromUrl);
    }
  }, [searchParams, currentMode]);

  const stepsToRender = t.steps;
  const pageMainColorKey = "brand-green"; 

  return (
    <TutorialPageContainer>
      <RockstarHeroSection 
        title={t.pageTitle} 
        subtitle={t.pageSubtitle}
        triggerElementSelector={`#${heroTriggerId}`}
        mainBackgroundImageUrl="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-1-img-swap//Screenshot_2025-05-17-11-07-09-401_org.telegram.messenger.jpg" 
        backgroundImageObjectUrl="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/appStore/oneSitePls_transparent_icon.png"
      >
        <Button 
            onClick={toggleMode} 
            variant="outline" 
            size="lg"
            className={cn(
              "bg-card/80 backdrop-blur-md hover:bg-pink-600/30 transition-all duration-200 font-semibold shadow-xl hover:shadow-pink-600/50 focus:ring-offset-background active:scale-95 transform hover:scale-105",
              currentMode === 'ru' 
                ? "border-pink-500/80 text-pink-400 hover:text-pink-200 focus:ring-2 focus:ring-pink-500" 
                : "border-blue-500/80 text-blue-400 hover:text-blue-200 focus:ring-2 focus:ring-blue-500"
            )}
        >
            <VibeContentRenderer content={currentMode === 'ru' ? t.toggleButtonToWtf : t.toggleButtonToNormal} />
        </Button>
      </RockstarHeroSection>
      
      <div id={heroTriggerId} style={{ height: '250vh' }} aria-hidden="true" />

      <TutorialContentContainer className="relative">
        <div className="space-y-16 md:space-y-24">
          {stepsToRender.map((step, index) => {
            const stepColorData = colorClasses[step.color as keyof typeof colorClasses] || colorClasses["brand-purple"];
            const hasVideo = !!step.videoSrc && typeof step.videoSrc === 'string';

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
                    <p className="text-muted-foreground text-base md:text-lg leading-relaxed">
                      <VibeContentRenderer content={step.description} />
                    </p>
                    {step.id === 3 && ( 
                      <Button asChild variant="default" size="lg" className={cn( 
                        "inline-flex items-center justify-center px-8 py-3 text-base font-semibold rounded-md transition-colors shadow-lg mt-4",
                        "active:scale-95 transform hover:scale-105"
                        )}>
                        <Link href="/repo-xml?flow=imageSwap">
                           <VibeContentRenderer content="К Студии SUPERVIBE <FaArrowUpRightFromSquare />" />
                        </Link>
                      </Button>
                    )}
                  </div>
                 
                  {hasVideo && (
                    <div className="md:w-3/5 lg:w-2/3">
                      <div className={cn("rounded-xl overflow-hidden border-2 shadow-2xl", stepColorData.border, stepColorData.shadow, "bg-black")}>
                        <ScrollControlledVideoPlayer 
                          src={step.videoSrc} 
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

export default function ImageSwapTutorialPage() {
  return (
    <Suspense fallback={<TutorialLoader />}>
      <ImageSwapTutorialContent />
    </Suspense>
  );
}