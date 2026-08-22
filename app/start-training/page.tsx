// /app/start-training/page.tsx
"use client";
import React, { useState, useEffect, Suspense, useCallback, useId } from 'react'; 
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
// Removed direct Fa6 icon imports that are now handled by VibeContentRenderer for buttons
// FaPlay, FaPause, FaForward, FaFlagCheckered, FaDumbbell
import { toast } from "sonner";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { cn } from "@/lib/utils";
import TutorialLoader from '../tutorials/TutorialLoader'; 
import RockstarHeroSection from '../tutorials/RockstarHeroSection'; 
import { useAppContext } from '@/contexts/AppContext';
import { fetchUserCyberFitnessProfile, QUEST_ORDER, isQuestUnlocked as checkQuestUnlocked } from '@/hooks/cyberFitnessSupabase';
import type { CyberFitnessProfile } from '@/hooks/cyberFitnessSupabase';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface TutorialLink {
  href: string;
  title: string;
  icon: string;
  color: string;
  wtfHref: string;
  questId: string; 
}

const tutorialLinks: TutorialLink[] = [
  { href: "/tutorials/image-swap", wtfHref: "/tutorials/image-swap?mode=wtf", title: "Миссия 1: Битый Пиксель", icon: "FaArrowRightArrowLeft", color: "brand-green", questId: "image-swap-mission" },
  { href: "/tutorials/icon-swap", wtfHref: "/tutorials/icon-swap?mode=wtf", title: "Миссия 2: Сапёр Иконок", icon: "FaBomb", color: "brand-red", questId: "icon-swap-mission" },
  { href: "/tutorials/video-swap", wtfHref: "/tutorials/video-swap?mode=wtf", title: "Миссия 3: Видео-Рендер", icon: "FaVideo", color: "brand-cyan", questId: "video-swap-mission" },
  { href: "/tutorials/inception-swap", wtfHref: "/tutorials/inception-swap?mode=wtf", title: "Миссия 4: Inception Swap", icon: "FaInfinity", color: "brand-lime", questId: "inception-swap-mission" },
  { href: "/tutorials/the-fifth-door", wtfHref: "/tutorials/the-fifth-door?mode=wtf", title: "Миссия 5: Пятая Дверь", icon: "FaKey", color: "brand-yellow", questId: "the-fifth-door-mission" },
];

const colorClasses: Record<string, { text: string; border: string; shadow: string, bgHover: string, ring: string }> = {
  "brand-green": { text: "text-brand-green", border: "border-brand-green/60", shadow: "hover:shadow-green-glow", bgHover: "hover:bg-brand-green/10", ring: "focus:ring-brand-green" },
  "brand-red": { text: "text-destructive", border: "border-destructive/60", shadow: "hover:shadow-red-glow", bgHover: "hover:bg-destructive/10", ring: "focus:ring-destructive" },
  "brand-cyan": { text: "text-brand-cyan", border: "border-brand-cyan/60", shadow: "hover:shadow-cyan-glow", bgHover: "hover:bg-brand-cyan/10", ring: "focus:ring-brand-cyan" },
  "brand-lime": { text: "text-neon-lime", border: "border-neon-lime/60", shadow: "hover:shadow-neon-lime/50", bgHover: "hover:bg-neon-lime/10", ring: "focus:ring-neon-lime" },
  "brand-yellow": { text: "text-brand-yellow", border: "border-brand-yellow/60", shadow: "hover:shadow-yellow-glow", bgHover: "hover:bg-brand-yellow/10", ring: "focus:ring-brand-yellow" },
  "brand-pink-wtf": { text: "text-white", border: "border-brand-pink/70", shadow: "hover:shadow-pink-glow", bgHover: "hover:bg-brand-pink/80", ring: "focus:ring-brand-pink" },
};

const pageTranslations = {
    ru: {
        pageTitle: "VIBE ТРЕНИРОВКА",
        pageSubtitleTraining: "Это твоя личная тренировочная площадка. Прокачивай скиллы, выполняй миссии, становись кибер-магом!", 
        trainingTitle: "VIBE ТРЕНИРОВКА",
        missionsTitle: "::FaGraduationCap:: Взломай Матрицу Кода: Твои Первые Миссии!",
        missionsSubtitle: "Обычные туториалы – для зубрил. Эти – твой SPEEDRUN к скиллу. На каждой миссии есть WTF-кнопка – это как секретный уровень, только для самых дерзких. НЕ ЗАССЫ, ЖМИ!",
        toggleButtonToWtf: "::FaPooStorm:: Врубить WTF-Режим СТРАНИЦЫ!",
        toggleButtonToNormal: "::FaBook:: Вернуть Норм Вид",
        lockedMissionTooltip: "Сначала пройди предыдущую миссию, чумба!",
    },
    wtf: {
        pageTitle: "::FaCity:: GTA VIBE TRAINING GROUND!",
        pageSubtitleTraining: "Забудь про нудные тренировки и скучные гайды. Тут – чистый ФАН и СКИЛЛ-АП! Жми WTF-кнопки на миссиях, если не боишься стать КИБЕР-КОТЛЕТОЙ!",
        trainingTitle: "::FaDumbbell:: ФИЗУХА ДЛЯ КИБЕР-АТЛЕТА (МОЖНО СКИПНУТЬ, ЕСЛИ ТЫ ДРИЩ)",
        missionsTitle: "::FaGamepad:: GTA Vibe Missions ::FaStreetView::",
        missionsSubtitle: "Хватит катать вату! Это не школа, это GTA Vibe! Пройди эти миссии, чтобы стать реальным пацаном в кодинге. WTF-режим – для тех, кто не боится запачкать руки и сломать пару правил. GO GO GO!",
        toggleButtonToWtf: "::FaPooStorm:: Врубить WTF-Режим СТРАНИЦЫ!", 
        toggleButtonToNormal: "::FaBook:: Вернуть Норм Вид", 
        lockedMissionTooltip: "СНАЧАЛА ПРЕДЫДУЩУЮ, НУБАС!",
    }
}

function StartTrainingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { dbUser, isAuthenticated } = useAppContext();
  const heroTriggerId = useId().replace(/:/g, "-") + "-hero-trigger";

  const initialMode = searchParams.get('mode') === 'wtf' ? 'wtf' : 'ru';
  const [currentMode, setCurrentMode] = useState<'ru' | 'wtf'>(initialMode);
  
  const [timer, setTimer] = useState(120); 
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentExercise, setCurrentExercise] = useState("Приседания");
  const [nextExercise, setNextExercise] = useState("Отжимания");

  const [cyberProfile, setCyberProfile] = useState<CyberFitnessProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const t = pageTranslations[currentMode];

  const togglePageMode = () => {
    const newMode = currentMode === 'ru' ? 'wtf' : 'ru';
    setCurrentMode(newMode);
    const currentPath = window.location.pathname;
    if (newMode === 'wtf') {
      router.replace(`${currentPath}?mode=wtf`);
    } else {
      router.replace(currentPath);
    }
  };

  useEffect(() => {
    const modeFromUrl = searchParams.get('mode') === 'wtf' ? 'wtf' : 'ru';
    if (modeFromUrl !== currentMode) {
      setCurrentMode(modeFromUrl);
    }
  }, [searchParams, currentMode]);

  const fetchProfile = useCallback(async () => {
    if (isAuthenticated && dbUser?.user_id) {
      setLoadingProfile(true);
      const profileData = await fetchUserCyberFitnessProfile(dbUser.user_id);
      if (profileData.success && profileData.data) {
        setCyberProfile(profileData.data);
      } else {
        toast.error("Не удалось загрузить профиль CyberFitness.");
      }
      setLoadingProfile(false);
    } else if (!isAuthenticated) {
      setLoadingProfile(false); 
    }
  }, [isAuthenticated, dbUser?.user_id]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isActive && !isPaused && timer > 0) {
      interval = setInterval(() => {
        setTimer((prevTimer) => prevTimer - 1);
      }, 1000);
    } else if (timer === 0 && isActive) {
      setIsActive(false);
      toast.success(`Тренировка "${currentExercise}" завершена!`);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, isPaused, timer, currentExercise]);

  const formatTime = (timeInSeconds: number) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = timeInSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleStartPause = () => {
    if (!isActive) { 
        setIsActive(true);
        setIsPaused(false);
        toast.info(`Начали упражнение: ${currentExercise}`);
    } else { 
        setIsPaused(!isPaused);
        toast.info(isPaused ? `Пауза: ${currentExercise}`: `Продолжаем: ${currentExercise}`);
    }
  };

  const handleNext = () => {
    toast.info("Переход к следующему упражнению (в разработке).");
  };

  const handleComplete = () => {
    setIsActive(false);
    setIsPaused(false);
    setTimer(0); 
    toast.success("Тренировка полностью завершена!");
  };

  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-x-hidden">
      <RockstarHeroSection
        title={t.pageTitle}
        subtitle={t.pageSubtitleTraining} 
        triggerElementSelector={`#${heroTriggerId}`}
        backgroundImageObjectUrl="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/appStore/oneSitePls_transparent_icon.png"
      >
         <Button 
            onClick={togglePageMode} 
            variant="outline" 
            size="lg"
            className={cn(
              "backdrop-blur-lg transition-all duration-300 font-orbitron active:scale-95 transform hover:scale-105 focus:ring-offset-background",
              currentMode === 'ru' 
                ? "bg-brand-pink/10 border-2 border-brand-pink text-brand-pink shadow-md shadow-brand-pink/40 hover:bg-brand-pink/20 hover:text-white hover:shadow-pink-glow focus:ring-2 focus:ring-brand-pink" 
                : "bg-brand-blue/10 border-2 border-brand-blue text-brand-blue shadow-md shadow-brand-blue/40 hover:bg-brand-blue/20 hover:text-white hover:shadow-blue-glow focus:ring-2 focus:ring-brand-blue"
            )}
        >
          <VibeContentRenderer content={currentMode === 'ru' ? pageTranslations.ru.toggleButtonToWtf : pageTranslations.wtf.toggleButtonToNormal} />
        </Button>
      </RockstarHeroSection>

      <div id={heroTriggerId} style={{ height: '150vh' }} aria-hidden="true" />
      
      <div className="container mx-auto px-4 py-12 md:py-16 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: currentMode === 'wtf' ? 0.2 : 0.1 }}
          className="w-full max-w-md mb-12 mx-auto" 
        >
          <Card className="bg-dark-card/90 backdrop-blur-xl border border-brand-green/60 shadow-2xl shadow-green-glow text-center"> 
            <CardHeader className="p-6 md:p-8 border-b border-brand-green/40">
              <VibeContentRenderer content='::FaDumbbell className="text-6xl text-brand-green mx-auto mb-4 drop-shadow-[0_0_15px_theme(colors.brand-green)]"::' />
              <CardTitle className="text-3xl md:text-4xl font-orbitron font-bold text-brand-green cyber-text glitch" data-text={currentMode === 'wtf' ? "ФИЗУХА (СКИП)" : "VIBE ТРЕНИРОВКА"}>
                 <VibeContentRenderer content={t.trainingTitle} />
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-8 p-6 md:p-8">
              <section>
                <h2 className="text-2xl font-orbitron font-semibold text-light-text mb-2">{currentExercise}</h2>
                <p className="text-7xl md:text-8xl font-mono font-bold text-brand-pink my-6 tracking-wider drop-shadow-lg text-shadow-neon"> 
                  {formatTime(timer)}
                </p>
                <p className="text-muted-foreground font-mono">Следующее: {nextExercise}</p>
              </section>

              <section className="grid grid-cols-2 gap-4">
                <Button
                  onClick={handleStartPause}
                  size="lg" 
                  className="col-span-2 bg-gradient-to-r from-brand-green to-neon-lime text-black hover:brightness-110 font-orbitron text-lg py-3.5 shadow-lg hover:shadow-brand-green/50 transform hover:scale-105 transition-all duration-300"
                >
                  {isActive && !isPaused ? <VibeContentRenderer content='::FaPause className="mr-2.5"::' /> : <VibeContentRenderer content='::FaPlay className="mr-2.5"::' />}
                  {isActive && !isPaused ? "Пауза" : isActive && isPaused ? "Продолжить" : "Старт"}
                </Button>
                <Button
                  onClick={handleNext}
                  variant="outline"
                  className="border-brand-blue text-brand-blue hover:bg-brand-blue/20 hover:text-white font-orbitron py-3 text-base shadow-md hover:shadow-brand-blue/30 transform hover:scale-105 transition-all duration-300"
                  disabled={!isActive} 
                >
                  <VibeContentRenderer content='::FaForward className="mr-2"::' /> Далее
                </Button>
                <Button
                  onClick={handleComplete}
                  variant="destructive" 
                  className="bg-brand-red hover:bg-brand-red/80 text-destructive-foreground font-orbitron py-3 text-base shadow-md hover:shadow-brand-red/40 transform hover:scale-105 transition-all duration-300"
                  disabled={!isActive && timer === 120}
                >
                  <VibeContentRenderer content='::FaFlagCheckered className="mr-2"::' /> Завершить
                </Button>
              </section>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: currentMode === 'wtf' ? 0.4 : 0.3 }}
          className="w-full max-w-2xl mx-auto" 
        >
          <Card className={cn("bg-dark-card/80 backdrop-blur-md border shadow-xl", currentMode === 'wtf' ? "border-brand-pink/70 shadow-pink-glow" : "border-brand-purple/50 shadow-purple-glow")}>
            <CardHeader className="pb-4">
              <CardTitle className={cn("text-2xl font-orbitron flex items-center justify-center gap-2", currentMode === 'wtf' ? "text-brand-pink gta-vibe-text-effect" : "text-brand-purple")}>
                  <VibeContentRenderer content={t.missionsTitle} />
              </CardTitle>
              <CardDescription className="text-muted-foreground font-mono text-center">
                  <VibeContentRenderer content={t.missionsSubtitle} />
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 md:p-6">
              {loadingProfile && <TutorialLoader />}
              {!loadingProfile && tutorialLinks.map((link) => {
                const colorConfig = colorClasses[link.color as keyof typeof colorClasses] || { text: "text-primary", border: "border-primary", shadow: "hover:shadow-primary/50", bgHover: "hover:bg-primary/10", ring: "focus:ring-primary" };
                const wtfColorConfig = colorClasses["brand-pink-wtf"];
                const isUnlocked = cyberProfile ? checkQuestUnlocked(link.questId, cyberProfile.completedQuests, QUEST_ORDER) : false;
                
                const buttonCard = (
                   <Card 
                      className={cn(
                          "flex flex-col items-center justify-between p-4 rounded-lg border-2 bg-dark-card/60 backdrop-blur-sm transition-all duration-200 transform",
                          isUnlocked ? `${colorConfig.border} ${colorConfig.shadow} hover:scale-[1.03] hover:-translate-y-1` : "border-muted/30 opacity-60 cursor-not-allowed"
                      )}
                    >
                      <VibeContentRenderer content={`::${link.icon}::`} className={cn("text-5xl mb-2 drop-shadow-[0_0_8px_currentColor]", isUnlocked ? colorConfig.text : "text-muted-foreground")} />
                      <span className={cn("font-orbitron text-md font-semibold leading-tight text-center mb-3", isUnlocked ? colorConfig.text : "text-muted-foreground")}>{link.title}</span>
                      <div className="flex flex-col gap-2 w-full mt-auto">
                          <Button asChild variant="outline" className={cn("w-full text-xs py-2", colorConfig.text, colorConfig.border, colorConfig.bgHover, colorConfig.ring, "hover:text-white focus:text-white", !isUnlocked && "pointer-events-none opacity-50")}>
                              <Link href={link.href} onClick={(e) => !isUnlocked && e.preventDefault()}><VibeContentRenderer content="Унылый Гайд" /></Link>
                          </Button>
                          <Button asChild variant="default" className={cn("w-full text-xs py-2 font-bold", wtfColorConfig.text, wtfColorConfig.border, wtfColorConfig.bgHover, wtfColorConfig.ring, "bg-brand-pink hover:bg-brand-pink/90 active:bg-brand-pink text-shadow-neon", !isUnlocked && "pointer-events-none opacity-50")}>
                              <Link href={link.wtfHref} onClick={(e) => !isUnlocked && e.preventDefault()}><VibeContentRenderer content="WTF-РЕЖИМ ::FaBiohazard::" /></Link>
                          </Button>
                      </div>
                  </Card>
                );

                return isUnlocked ? buttonCard : (
                  <TooltipProvider key={link.href + "-tooltip"}>
                    <Tooltip delayDuration={100}>
                      <TooltipTrigger asChild>
                        <div>{buttonCard}</div>
                      </TooltipTrigger>
                      <TooltipContent className="bg-black/80 text-brand-orange border-brand-orange/50 font-mono">
                        <p>{t.lockedMissionTooltip}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              })}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

export default function StartTrainingPage() {
  return (
    <Suspense fallback={<TutorialLoader />}>
      <StartTrainingContent />
    </Suspense>
  )
}