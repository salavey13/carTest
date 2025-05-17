"use client";

import React, { useState, useEffect, Suspense, useCallback } from 'react'; 
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

// New Structural Components (placeholders for now or simple wrappers)
const TutorialPageContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="relative min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 text-gray-200 overflow-x-hidden">
    {children}
  </div>
);

const RockstarHeroSection: React.FC<{ title: string; subtitle: string; backgroundImageUrl?: string }> = ({ title, subtitle, backgroundImageUrl }) => (
  <section 
    className="h-[70vh] md:h-[80vh] flex flex-col items-center justify-center text-center p-4 bg-black/30 relative" // Basic styling
    // style={{ backgroundImage: backgroundImageUrl ? `url(${backgroundImageUrl})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }}
  >
    {/* Grid overlay - can be more complex later */}
    <div
        className="absolute inset-0 bg-repeat opacity-5 -z-10"
        style={{
          backgroundImage: `linear-gradient(to right, rgba(0, 255, 157, 0.07) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(0, 255, 157, 0.07) 1px, transparent 1px)`,
          backgroundSize: '30px 30px',
        }}
    ></div>
    <h1 className={cn(
        "text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-orbitron font-bold cyber-text glitch mb-4 md:mb-6",
         colorClasses["brand-green"]?.text || "text-brand-green" // Default to green or a specific hero color
        )} data-text={title}>
      <VibeContentRenderer content={title} />
    </h1>
    <p className="text-md sm:text-lg md:text-xl text-gray-300 font-mono max-w-3xl mx-auto">
      <VibeContentRenderer content={subtitle} />
    </p>
  </section>
);

const TutorialContentContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="container mx-auto px-4 py-12 md:py-16">
    {children}
  </div>
);

const TutorialStepSection: React.FC<{ children: React.ReactNode, className?: string }> = ({ children, className }) => (
  <section className={cn("py-8 md:py-12", className)}>
    {children}
  </section>
);

const NextLevelTeaser: React.FC<{ title: string; text: string; buttonText: string; buttonLink: string; mainColorClass: string }> = ({ title, text, buttonText, buttonLink, mainColorClass }) => (
   <section className={cn(
            "mt-16 md:mt-24 text-center py-12 md:py-16",
            colorClasses[mainColorClass]?.border ? `border-t ${colorClasses[mainColorClass]?.border}/30` : "border-t border-brand-green/30"
            )}>
          <h2 className={cn("text-3xl md:text-4xl font-orbitron mb-6", colorClasses[mainColorClass]?.text || "text-brand-green")}>
             <VibeContentRenderer content={title} />
          </h2>
          <p className="text-lg md:text-xl text-gray-300 font-mono max-w-2xl mx-auto mb-8">
            <VibeContentRenderer content={text} />
          </p>
          <Button asChild className={cn(
             "inline-flex items-center justify-center px-8 py-4 border border-transparent text-lg font-semibold rounded-full text-black transition-transform transform hover:scale-105",
             "shadow-xl",
              mainColorClass && colorClasses[mainColorClass] ? `${colorClasses[mainColorClass].text.replace('text-', 'bg-')} hover:${colorClasses[mainColorClass].text.replace('text-', 'bg-')}/80 ${colorClasses[mainColorClass].shadow.replace('shadow-','hover:shadow-')}/60` : "bg-brand-green hover:bg-brand-green/80 hover:shadow-green-glow/60",
             )}>
            <Link href={buttonLink}>
                <VibeContentRenderer content={buttonText} />
            </Link>
          </Button>
        </section>
);


const imageSwapTutorialTranslations = {
  ru: {
    pageTitle: "Миссия 1: Охота на Битый Пиксель",
    pageSubtitle: "Агент, твоя задача: освоить замену изображений в коде! Думай об этом как о реанимации цифрового артефакта: <FaImageSlash /> -> <FaToolbox /> -> <FaImagePortrait />. Без регистрации, только чистый скилл-ап!",
    steps: [ 
      {
        id: 1,
        title: "Шаг 1: Захват URL Старого Артефакта",
        description: "Первая задача, оперативник: обнаружить в кодовой базе изображение, требующее замены. Найдя, скопируй его полный URL. Это твоя основная цель!",
        videoSrc: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-1-img-swap//1_copy_image_link.mp4",
        icon: "FaLink",
        color: "brand-pink"
      },
      {
        id: 2,
        title: "Шаг 2: Развертывание Нового Актива",
        description: "Далее, загрузи свой новенький, сияющий файл замены. Рекомендуем Supabase Storage для гладкой интеграции, но подойдет любой публично доступный URL. Защити новую ссылку!",
        videoSrc: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-1-img-swap//2_upload_new_image.mp4",
        icon: "FaUpload",
        color: "brand-blue"
      },
      {
        id: 3,
        title: "Шаг 3: Активация VIBE-Трансмутации!",
        description: "Время магии! Направляйся в SUPERVIBE Studio. Введи URL старого изображения, затем нового. Наш AI-агент обработает модификации кода и подготовит замену.",
        videoSrc: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-1-img-swap//3_sitback_and_relax_its_swappin.mp4",
        icon: "FaWandMagicSparkles",
        color: "brand-purple"
      },
      {
        id: 4,
        title: "Шаг 4: Операция Успешна! Анализ PR",
        description: "Миссия выполнена! Pull Request с заменой изображения сгенерирован автоматически. Осталось лишь проверить, смерджить и наслаждаться результатом. Профит!",
        videoSrc: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-1-img-swap//4_profit_check.mp4",
        icon: "FaCheckDouble",
        color: "brand-green"
      }
    ],
    nextLevelTitle: "<FaPlayCircle /> Новый Уровень Разблокирован!",
    nextLevelText: "Основы у тебя в кармане, Агент! Готов применить эти навыки в реальном бою? <Link href='/repo-xml?flow=imageSwap' class='text-brand-blue hover:underline font-semibold'>SUPERVIBE Studio</Link> ждет твоих команд.",
    tryLiveButton: "<FaWandMagicSparkles /> Попробовать в Студии",
    toggleButtonToWtf: "<FaPooStorm /> Включить Режим БОГА (WTF?!)",
  },
  wtf: {
    pageTitle: "КАРТИНКИ МЕНЯТЬ – КАК ДВА БАЙТА ПЕРЕСЛАТЬ!",
    pageSubtitle: "Забудь про нудятину. Делай как на видосе. ЭТО ЖЕ ЭЛЕМЕНТАРНО, ВАТСОН!",
    steps: [ 
      {
        id: 1,
        title: "ШАГ 1: КОПИРУЙ СТАРЫЙ URL",
        description: "Нашел картинку в коде? КОПИРНИ ЕЕ АДРЕС. Всё.",
        videoSrc: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-1-img-swap//1_copy_image_link.mp4",
        icon: "FaCopy",
        color: "brand-pink"
      },
      {
        id: 2,
        title: "ШАГ 2: ЗАЛЕЙ НОВУЮ, КОПИРУЙ URL",
        description: "Загрузи НОВУЮ картинку. КОПИРНИ ЕЕ АДРЕС. Изи.",
        videoSrc: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-1-img-swap//2_upload_new_image.mp4",
        icon: "FaCloudArrowUp", // Changed icon
        color: "brand-blue"
      },
      {
        id: 3,
        title: "ШАГ 3: СТУДИЯ -> CTRL+V, CTRL+V -> MAGIC!",
        description: "Иди в SUPERVIBE. Старый URL -> Новый URL. ЖМИ КНОПКУ. Бот сам всё сделает.",
        videoSrc: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-1-img-swap//3_sitback_and_relax_its_swappin.mp4",
        icon: "FaRightLeft", // Changed icon
        color: "brand-purple"
      },
      {
        id: 4,
        title: "ШАГ 4: PR ГОТОВ! ТЫ КРАСАВЧИК!",
        description: "PR создан. Проверь, смерджи. Всё! Ты поменял картинку быстрее, чем заварил дошик.",
        videoSrc: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-1-img-swap//4_profit_check.mp4",
        icon: "FaThumbsUp",
        color: "brand-green"
      }
    ],
    nextLevelTitle: "<FaRocket /> ТЫ ПРОКАЧАЛСЯ, БРО!",
    nextLevelText: "Менять картинки – это для лохов. Ты уже ПРО. Го в <Link href='/repo-xml?flow=imageSwap' class='text-brand-blue hover:underline font-semibold'>SUPERVIBE Studio</Link>, там РЕАЛЬНЫЕ ДЕЛА.",
    tryLiveButton: "<FaArrowRight /> В Студию, НЕ ТОРМОЗИ!",
    toggleButtonToNormal: "<FaBookOpen /> Вернуть Скучную Инструкцию", 
  }
};

const colorClasses: Record<string, { text: string; border: string; shadow: string }> = {
  "brand-pink": { text: "text-brand-pink", border: "border-brand-pink", shadow: "shadow-brand-pink/30" },
  "brand-blue": { text: "text-brand-blue", border: "border-brand-blue", shadow: "shadow-brand-blue/30" },
  "brand-purple": { text: "text-brand-purple", border: "border-brand-purple", shadow: "shadow-brand-purple/30" },
  "brand-green": { text: "text-brand-green", border: "border-brand-green", shadow: "shadow-brand-green/30" },
};

function ImageSwapTutorialContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { dbUser, isAuthenticated } = useAppContext();
  const { addToast } = useAppToast();

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
    // Update URL without full page reload, if possible, or simply for bookmarking
    router.replace(`/tutorials/image-swap${newMode === 'wtf' ? '?mode=wtf' : ''}`, { scroll: false });
  };
  
  useEffect(() => {
    const modeFromUrl = searchParams.get('mode') === 'wtf' ? 'wtf' : 'ru';
    if (modeFromUrl !== currentMode) {
      setCurrentMode(modeFromUrl);
    }
  }, [searchParams, currentMode]);

  const stepsToRender = t.steps;
  const pageMainColor = "brand-green"; // Or determine dynamically

  return (
    <TutorialPageContainer>
      <RockstarHeroSection title={t.pageTitle} subtitle={t.pageSubtitle} />
      
      <div className="text-center my-8">
        <Button 
            onClick={toggleMode} 
            variant="outline" 
            className={cn(
            "bg-background/70 backdrop-blur-sm hover:bg-brand-pink/20 transition-all duration-200 text-sm px-4 py-2",
            currentMode === 'ru' ? "border-brand-pink/70 text-brand-pink/90 hover:text-brand-pink" : "border-brand-blue/70 text-brand-blue/90 hover:text-brand-blue"
            )}
        >
            <VibeContentRenderer content={currentMode === 'ru' ? t.toggleButtonToWtf : t.toggleButtonToNormal} />
        </Button>
      </div>

      <TutorialContentContainer>
        <div className="space-y-16 md:space-y-24">
          {stepsToRender.map((step, index) => {
            const stepColor = colorClasses[step.color] || colorClasses["brand-purple"];
            const hasVideo = !!(step as any).videoSrc && typeof (step as any).videoSrc === 'string';

            return (
              <TutorialStepSection key={step.id} className={cn(index > 0 && "border-t border-gray-700/30 pt-12 md:pt-16")}>
                <div className={cn(
                  "flex flex-col gap-6 md:gap-10",
                  index % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"
                )}>
                  <div className={cn("space-y-4 flex flex-col items-start justify-center", hasVideo ? "md:w-2/5 lg:w-1/3" : "w-full")}>
                    <h2 className={cn("text-3xl md:text-4xl font-orbitron flex items-center gap-3", stepColor.text)}>
                      <VibeContentRenderer content={`::${step.icon}::`} className="text-3xl opacity-90" />
                      <VibeContentRenderer content={step.title} />
                    </h2>
                    <p className="text-gray-300 text-base md:text-lg leading-relaxed">
                      <VibeContentRenderer content={step.description} />
                    </p>
                    {step.id === 3 && ( 
                      <Button asChild className={cn(
                        "inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-black transition-colors shadow-lg mt-4",
                        "bg-brand-yellow hover:bg-brand-yellow/80 hover:shadow-yellow-glow/50"
                        )}>
                        <Link href="/repo-xml?flow=imageSwap">
                           <VibeContentRenderer content="К Студии SUPERVIBE <FaArrowUpRightFromSquare />" />
                        </Link>
                      </Button>
                    )}
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
              </TutorialStepSection>
            );
          })}
        </div>
      </TutorialContentContainer>
      
      <NextLevelTeaser 
        title={t.nextLevelTitle}
        text={t.nextLevelText}
        buttonText={t.tryLiveButton}
        buttonLink="/repo-xml?flow=imageSwap"
        mainColorClass={pageMainColor}
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