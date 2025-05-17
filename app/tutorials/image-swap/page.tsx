"use client";

import React, { useState, useEffect, Suspense, useCallback, useRef } from 'react'; 
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
import { FaArrowUpRightFromSquare, FaBookOpen, FaCloudArrowUp, FaCopy, FaPooStorm, FaRightLeft, FaRocket, FaThumbsUp, FaWandMagicSparkles, FaCirclePlay, FaImage, FaToolbox, FaImagePortrait, FaLink, FaUpload, FaCheckDouble, FaArrowRight } from 'react-icons/fa6';


// New Structural Components
const TutorialPageContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="relative min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-brand-pink/30 selection:text-brand-pink">
    {children}
  </div>
);
TutorialPageContainer.displayName = "TutorialPageContainer";

interface RockstarHeroSectionProps {
  title: string;
  subtitle: string;
  mainBackgroundImageUrl?: string; // For the furthest background
  foregroundImageUrl?: string;    // For the object that zooms/moves most prominently
  revealedBackgroundImageUrl?: string; // For the background revealed 'through' the text/mask
  children?: React.ReactNode; // To place elements like buttons inside
}

const RockstarHeroSection: React.FC<RockstarHeroSectionProps> = ({
  title,
  subtitle,
  mainBackgroundImageUrl = "https://images.unsplash.com/photo-1505452209359-e739ed0ddd46?q=80&w=2574&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D", // Placeholder dark city
  foregroundImageUrl = "https://images.unsplash.com/photo-1605000794134-a013de605406?q=80&w=2670&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D", // Placeholder character/object
  revealedBackgroundImageUrl = "https://images.unsplash.com/photo-1587691592099-48109787033a?q=80&w=2574&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D", // Placeholder bright/abstract
  children
}) => {
  const [scrollProgress, setScrollProgress] = useState(0);
  const heroRef = useRef<HTMLDivElement>(null);
  const animationDurationVH = 150; // Animate over 150vh of scroll

  useEffect(() => {
    const handleScroll = () => {
      if (heroRef.current) {
        const rect = heroRef.current.getBoundingClientRect();
        // Progress from 0 (top of hero is at top of viewport) to 1 (bottom of hero is at top of viewport)
        // or when hero top is -animationDurationVH * vh_unit
        const scrollDistance = window.innerHeight * (animationDurationVH / 100);
        const currentScroll = Math.max(0, -rect.top);
        const progress = Math.min(1, currentScroll / scrollDistance);
        setScrollProgress(progress);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial calculation
    return () => window.removeEventListener('scroll', handleScroll);
  }, [animationDurationVH]);

  // Calculate dynamic styles based on scrollProgress
  const foregroundScale = 1 + scrollProgress * 1.5; // Zoom in more
  const foregroundTranslateY = -scrollProgress * 30; // Move up slightly less
  const textScale = 1 + scrollProgress * 0.3;
  const textTranslateY = -scrollProgress * 10;
  const revealedBgOpacity = scrollProgress > 0.1 ? Math.min(1, (scrollProgress - 0.1) * 1.5) : 0;
  const revealedBgScale = 1 - scrollProgress * 0.2; // Zoom out

  return (
    <section
      ref={heroRef}
      className="relative flex flex-col items-center justify-center text-center p-4 overflow-hidden"
      style={{ height: `${animationDurationVH}vh` }} // Define scrollable height for animation
    >
      {/* Main Background (Fixed or very slow parallax) */}
      {mainBackgroundImageUrl && (
        <div
          className="absolute inset-0 -z-30 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${mainBackgroundImageUrl})`, transform: `translateY(${scrollProgress * 10}vh)` }}
        />
      )}
       <div className="absolute inset-0 bg-black/60 -z-20"></div> {/* Dark overlay */}


      {/* Revealed Background (behind text, animates) */}
      {revealedBackgroundImageUrl && (
        <div
          className="absolute inset-0 -z-10 bg-cover bg-center bg-no-repeat transition-opacity duration-300"
          style={{ 
            backgroundImage: `url(${revealedBackgroundImageUrl})`, 
            opacity: revealedBgOpacity,
            transform: `scale(${revealedBgScale})`
          }}
        />
      )}
      
      {/* Foreground Image (zooms towards viewer) */}
      {foregroundImageUrl && (
        <img
          src={foregroundImageUrl}
          alt="Hero Foreground"
          className="absolute top-1/2 left-1/2 w-1/2 md:w-1/3 max-w-md h-auto object-contain -translate-x-1/2 -translate-y-1/2 transition-transform duration-100 ease-out pointer-events-none"
          style={{
            transform: `translate(-50%, -50%) scale(${foregroundScale}) translateY(${foregroundTranslateY}px)`,
            zIndex: 10, // Above text
          }}
        />
      )}

      {/* Text Content Block (Stays somewhat central, scales slightly) */}
      <div 
        className="sticky top-1/2 -translate-y-1/2 z-0 transition-transform duration-100 ease-out" // z-index 0, behind foreground
        style={{ 
          transform: `translateY(-50%) scale(${textScale}) translateY(${textTranslateY}px)`
        }}
      >
        <h1 className={cn(
            "text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-orbitron font-bold cyber-text glitch mb-4 md:mb-6",
            colorClasses["brand-green"]?.text || "text-brand-green"
            )} data-text={title}>
          <VibeContentRenderer content={title} />
        </h1>
        <p className="text-md sm:text-lg md:text-xl text-gray-200 font-mono max-w-3xl mx-auto px-4">
          <VibeContentRenderer content={subtitle} />
        </p>
      </div>
      {children && <div className="relative z-20 mt-8">{children}</div>} {/* For buttons, placed above all */}
    </section>
  );
};
RockstarHeroSection.displayName = "RockstarHeroSection";

const TutorialContentContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="container mx-auto px-4 py-12 md:py-16 relative z-10 bg-background"> {/* Ensure content is above fixed hero after scroll */}
    {children}
  </div>
);
TutorialContentContainer.displayName = "TutorialContentContainer";

const TutorialStepSection: React.FC<{ children: React.ReactNode, className?: string }> = ({ children, className }) => (
  <section className={cn("py-8 md:py-12", className)}>
    {children}
  </section>
);
TutorialStepSection.displayName = "TutorialStepSection";

const NextLevelTeaser: React.FC<{ title: string; text: string; buttonText: string; buttonLink: string; mainColorClassKey: keyof typeof colorClasses | string }> = ({ title, text, buttonText, buttonLink, mainColorClassKey }) => {
  const mainColor = colorClasses[mainColorClassKey as keyof typeof colorClasses] || colorClasses["brand-green"];
  return (
    <section className={cn(
            "mt-16 md:mt-24 text-center py-12 md:py-16",
            mainColor.border ? `border-t ${mainColor.border}/30` : "border-t border-brand-green/30"
            )}>
          <h2 className={cn("text-3xl md:text-4xl font-orbitron mb-6", mainColor.text)}>
             <VibeContentRenderer content={title} />
          </h2>
          <p className="text-lg md:text-xl text-gray-300 font-mono max-w-2xl mx-auto mb-8">
            <VibeContentRenderer content={text} />
          </p>
          <Button asChild className={cn(
             "inline-flex items-center justify-center px-8 py-4 border border-transparent text-lg font-semibold rounded-full text-black transition-transform transform hover:scale-105",
             "shadow-xl",
              `bg-${mainColorClassKey} hover:bg-${mainColorClassKey}/80 ${mainColor.shadow.replace('shadow-','hover:shadow-')}/60`
             )}>
            <Link href={buttonLink}>
                <VibeContentRenderer content={buttonText} />
            </Link>
          </Button>
        </section>
  );
};
NextLevelTeaser.displayName = "NextLevelTeaser";

const imageSwapTutorialTranslations = {
  ru: {
    pageTitle: "Миссия 1: Охота на Битый Пиксель",
    pageSubtitle: "Агент, твоя задача: освоить замену изображений в коде! Думай об этом как о реанимации цифрового артефакта: <FaImage /> -> <FaToolbox /> -> <FaImagePortrait />. Без регистрации, только чистый скилл-ап!",
    steps: [ 
      { id: 1, title: "Шаг 1: Захват URL Старого Артефакта", description: "Первая задача, оперативник: обнаружить в кодовой базе изображение, требующее замены. Найдя, скопируй его полный URL. Это твоя основная цель!", videoSrc: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-1-img-swap//1_copy_image_link.mp4", icon: "FaLink", color: "brand-pink" },
      { id: 2, title: "Шаг 2: Развертывание Нового Актива", description: "Далее, загрузи свой новенький, сияющий файл замены. Рекомендуем Supabase Storage для гладкой интеграции, но подойдет любой публично доступный URL. Защити новую ссылку!", videoSrc: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-1-img-swap//2_upload_new_image.mp4", icon: "FaUpload", color: "brand-blue" },
      { id: 3, title: "Шаг 3: Активация VIBE-Трансмутации!", description: "Время магии! Направляйся в SUPERVIBE Studio. Введи URL старого изображения, затем нового. Наш AI-агент обработает модификации кода и подготовит замену.", videoSrc: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-1-img-swap//3_sitback_and_relax_its_swappin.mp4", icon: "FaWandMagicSparkles", color: "brand-purple" },
      { id: 4, title: "Шаг 4: Операция Успешна! Анализ PR", description: "Миссия выполнена! Pull Request с заменой изображения сгенерирован автоматически. Осталось лишь проверить, смерджить и наслаждаться результатом. Профит!", videoSrc: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-1-img-swap//4_profit_check.mp4", icon: "FaCheckDouble", color: "brand-green" }
    ],
    nextLevelTitle: "<FaCirclePlay /> Новый Уровень Разблокирован!",
    nextLevelText: "Основы у тебя в кармане, Агент! Готов применить эти навыки в реальном бою? <Link href='/repo-xml?flow=imageSwap' class='text-brand-blue hover:underline font-semibold'>SUPERVIBE Studio</Link> ждет твоих команд.",
    tryLiveButton: "<FaWandMagicSparkles /> Попробовать в Студии",
    toggleButtonToWtf: "<FaPooStorm /> Включить Режим БОГА (WTF?!)",
  },
  wtf: {
    pageTitle: "КАРТИНКИ МЕНЯТЬ – КАК ДВА БАЙТА ПЕРЕСЛАТЬ!",
    pageSubtitle: "Забудь про нудятину. Делай как на видосе. ЭТО ЖЕ ЭЛЕМЕНТАРНО, ВАТСОН!",
    steps: [ 
      { id: 1, title: "ШАГ 1: КОПИРУЙ СТАРЫЙ URL", description: "Нашел картинку в коде? КОПИРНИ ЕЕ АДРЕС. Всё.", videoSrc: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-1-img-swap//1_copy_image_link.mp4", icon: "FaCopy", color: "brand-pink" },
      { id: 2, title: "ШАГ 2: ЗАЛЕЙ НОВУЮ, КОПИРУЙ URL", description: "Загрузи НОВУЮ картинку. КОПИРНИ ЕЕ АДРЕС. Изи.", videoSrc: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-1-img-swap//2_upload_new_image.mp4", icon: "FaCloudArrowUp", color: "brand-blue" },
      { id: 3, title: "ШАГ 3: СТУДИЯ -> CTRL+V, CTRL+V -> MAGIC!", description: "Иди в SUPERVIBE. Старый URL -> Новый URL. ЖМИ КНОПКУ. Бот сам всё сделает.", videoSrc: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-1-img-swap//3_sitback_and_relax_its_swappin.mp4", icon: "FaRightLeft", color: "brand-purple" },
      { id: 4, title: "ШАГ 4: PR ГОТОВ! ТЫ КРАСАВЧИК!", description: "PR создан. Проверь, смерджи. Всё! Ты поменял картинку быстрее, чем заварил дошик.", videoSrc: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/tutorial-1-img-swap//4_profit_check.mp4", icon: "FaThumbsUp", color: "brand-green" }
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
}; // This should be defined or imported if used by NextLevelTeaser for bg color

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
        // Provide actual image URLs for a better effect
        // mainBackgroundImageUrl="/path/to/your/main-hero-bg.jpg"
        // foregroundImageUrl="/path/to/your/foreground-object.png"
        // revealedBackgroundImageUrl="/path/to/your/revealed-bg.jpg"
      >
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
      </RockstarHeroSection>
      
      <TutorialContentContainer>
        <div className="space-y-16 md:space-y-24">
          {stepsToRender.map((step, index) => {
            const stepColor = colorClasses[step.color as keyof typeof colorClasses] || colorClasses["brand-purple"];
            const hasVideo = !!step.videoSrc && typeof step.videoSrc === 'string';

            return (
              <TutorialStepSection key={step.id} className={cn(index > 0 && "border-t border-border/30 pt-12 md:pt-16")}>
                <div className={cn(
                  "flex flex-col gap-6 md:gap-10",
                  index % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"
                )}>
                  <div className={cn("space-y-4 flex flex-col items-start justify-center", hasVideo ? "md:w-2/5 lg:w-1/3" : "w-full")}>
                    <h2 className={cn("text-3xl md:text-4xl font-orbitron flex items-center gap-3", stepColor.text)}>
                      <VibeContentRenderer content={`::${step.icon}::`} className="text-3xl opacity-90" />
                      <VibeContentRenderer content={step.title} />
                    </h2>
                    <p className="text-muted-foreground text-base md:text-lg leading-relaxed">
                      <VibeContentRenderer content={step.description} />
                    </p>
                    {step.id === 3 && ( 
                      <Button asChild className={cn(
                        "inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-background transition-colors shadow-lg mt-4",
                        "bg-brand-yellow hover:bg-brand-yellow/80 focus:ring-2 focus:ring-brand-yellow focus:ring-offset-2 focus:ring-offset-background"
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
        buttonLink="/repo-xml?flow=imageSwap"
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