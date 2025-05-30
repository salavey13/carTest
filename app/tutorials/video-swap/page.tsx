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

const videoSwapTutorialTranslations = {
  ru: {
    pageTitle: "Миссия 3: Видео-Рендер",
    pageSubtitle: "Агент, время для тяжелой артиллерии – замена видео! Это как обновить голографическую проекцию в штабе: ::FaVideoSlash:: -> ::FaToolbox:: -> ::FaVideo::. Принцип тот же, что и с картинками, но файлы больше, ответственность выше!",
    steps: [
      {
        id: 1,
        title: "Шаг 1: Идентификация Старого Видео-потока (URL)",
        description: "Твоя первая задача: найти в коде компонент или тег, отображающий видео, которое нужно заменить. Скопируй полный URL текущего видео-источника (атрибут `src` или аналогичный). Это твоя цель номер один.",
        icon: "FaLink",
        color: "brand-pink",
        videoSrc: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-1-img-swap//1_copy_image_link.mp4" 
      },
      {
        id: 2,
        title: "Шаг 2: Загрузка и Получение URL Нового Видео-файла",
        description: "Загрузи новый видео-файл на хостинг (например, Supabase Storage). Убедись, что файл доступен по публичному URL. Скопируй этот новый URL – это твой ключ к обновлению.",
        icon: "FaUpload",
        color: "brand-blue",
        videoSrc: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-1-img-swap//2_upload_new_image.mp4" 
      },
      {
        id: 3,
        title: "Шаг 3: Активация Замены в SUPERVIBE Studio",
        description: "Перейди в SUPERVIBE Studio. В специальном интерфейсе для замены (Image/Video Swap) укажи старый URL видео и новый URL. AI-ассистент проанализирует код и подготовит необходимые изменения.",
        icon: "FaWandMagicSparkles",
        color: "brand-purple",
        videoSrc: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-1-img-swap//3_sitback_and_relax_its_swappin.mp4" 
      },
      {
        id: 4,
        title: "Шаг 4: Верификация Замены и Интеграция (PR)",
        description: "Миссия почти выполнена! SUPERVIBE Studio автоматически создаст Pull Request с изменениями. Твоя задача – проверить корректность замены в PR, смерджить его и убедиться, что новое видео отображается на сайте. Победа!",
        icon: "FaCheckDouble",
        color: "brand-green",
        videoSrc: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-1-img-swap//4_profit_check.mp4" 
      }
    ],
    nextLevelTitle: "::FaFilm:: Киномеханик Готов!",
    nextLevelText: "Отличная работа, Агент! Ты освоил замену видео. <Link href='/start-training' class='text-brand-blue hover:underline font-semibold'>Следующая Миссия</Link> ждет. *Заметка: для видео используется тот же ImageSwap флоу в студии.*",
    tryLiveButton: "::FaWandMagicSparkles:: Попробовать в Студии",
    toggleButtonToWtf: "::FaPooStorm:: Включить Режим БОГА (WTF?!)",
    toggleButtonToNormal: "::FaBook:: Вернуть Скучную Инструкцию", 
  },
  wtf: {
    pageTitle: "ВИДОСЫ МЕНЯТЬ – ЕЩЁ ПРОЩЕ, ЧЕМ ТЫ ДУМАЛ!",
    pageSubtitle: "Большие файлы? Большая ответственность? ХА! Те же 4 кнопки, братан. ::FaVideo::",
    steps: [
      {
        id: 1,
        title: "ШАГ 1: СТАРЫЙ URL ВИДОСА – COPY!",
        description: "Нашел СТАРОЕ видео в коде? Адрес (URL) скопировал. Поехали дальше.",
        icon: "FaFilm",
        color: "brand-pink",
        videoSrc: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-1-img-swap//1_copy_image_link.mp4" 
      },
      {
        id: 2,
        title: "ШАГ 2: НОВЫЙ ВИДОС ЗАЛЕЙ, URL – COPY!",
        description: "Загрузи НОВОЕ видео. Адрес (URL) скопировал. Не сложнее, чем мем ВКонтакте залить.",
        icon: "FaServer",
        color: "brand-blue",
        videoSrc: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-1-img-swap//2_upload_new_image.mp4" 
      },
      {
        id: 3,
        title: "ШАГ 3: СТУДИЯ! URL_СТАРЫЙ -> URL_НОВЫЙ -> GO!",
        description: "SUPERVIBE Studio (да, та же, что для картинок). Старый URL, новый URL. Кнопка 'ВПЕРЕД'. AI не тупой, разберется.",
        icon: "FaVideo", 
        color: "brand-purple",
        videoSrc: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-1-img-swap//3_sitback_and_relax_its_swappin.mp4" 
      },
      {
        id: 4,
        title: "ШАГ 4: PR СОЗДАН! ТЫ – ТАРАНТИНО!",
        description: "PR готов. Проверь, смерджи. Готово! Твои видосы теперь топчик. Считай, Оскар твой.",
        icon: "FaMedal",
        color: "brand-green",
        videoSrc: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-1-img-swap//4_profit_check.mp4" 
      }
    ],
    nextLevelTitle: "::FaPhotoFilm:: ТЫ ТЕПЕРЬ ВИДЕО-МАГНАТ!",
    nextLevelText: "Картинки, иконки, видосы... Что дальше? Весь Голливуд твой! <Link href='/start-training' class='text-brand-blue hover:underline font-semibold'>Следующая Миссия</Link> ждет.",
    tryLiveButton: "::FaVideoCamera:: В Монтажную!",
    toggleButtonToWtf: "::FaPooStorm:: Включить Режим БОГА (WTF?!)",
    toggleButtonToNormal: "::FaBook:: Вернуть Скучную Инструкцию", 
  }
};

const colorClasses: Record<string, { text: string; border: string; shadow: string }> = {
  "brand-pink": { text: "text-brand-pink", border: "border-brand-pink/50", shadow: "shadow-brand-pink/40" },
  "brand-blue": { text: "text-brand-blue", border: "border-brand-blue/50", shadow: "shadow-brand-blue/40" },
  "brand-purple": { text: "text-brand-purple", border: "border-brand-purple/50", shadow: "shadow-brand-purple/40" },
  "brand-green": { text: "text-brand-green", border: "border-brand-green/50", shadow: "shadow-brand-green/40" },
  "brand-cyan": { text: "text-brand-cyan", border: "border-brand-cyan/50", shadow: "shadow-brand-cyan/40" },
  "brand-orange": { text: "text-brand-orange", border: "border-brand-orange/50", shadow: "shadow-brand-orange/40" },
};

function VideoSwapTutorialContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { dbUser, isAuthenticated } = useAppContext();
  const { addToast } = useAppToast();
  const heroTriggerId = useId().replace(/:/g, "-") + "-hero-trigger";

  const initialModeFromUrl = searchParams.get('mode') === 'wtf';
  const [currentMode, setCurrentMode] = useState<'ru' | 'wtf'>(initialModeFromUrl ? 'wtf' : 'ru');
  
  const t = videoSwapTutorialTranslations[currentMode];
  const tutorialQuestId = "video-swap-mission";

  const handleTutorialCompletion = useCallback(async () => {
    if (isAuthenticated && dbUser?.user_id) {
      const result = await markTutorialAsCompleted(dbUser.user_id, tutorialQuestId);
      if (result.success && result.kiloVibesAwarded && result.kiloVibesAwarded > 0) {
        addToast(`::FaCircleCheck:: Миссия "${videoSwapTutorialTranslations.ru.pageTitle}" пройдена! +${result.kiloVibesAwarded} KiloVibes!`, "success");
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
    router.replace(`/tutorials/video-swap${newMode === 'wtf' ? '?mode=wtf' : ''}`, { scroll: false });
  };

  useEffect(() => {
    const modeFromUrl = searchParams.get('mode') === 'wtf' ? 'wtf' : 'ru';
    if (modeFromUrl !== currentMode) {
      setCurrentMode(modeFromUrl);
    }
  }, [searchParams, currentMode]);

  const stepsToRender = t.steps; 
  const pageMainColorKey = "brand-cyan"; 

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
            <VibeContentRenderer content={currentMode === 'ru' ? videoSwapTutorialTranslations.ru.toggleButtonToWtf : videoSwapTutorialTranslations.wtf.toggleButtonToNormal} />
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

export default function VideoSwapTutorialPage() {
  return (
    <Suspense fallback={<TutorialLoader />}>
      <VideoSwapTutorialContent />
    </Suspense>
  );
}