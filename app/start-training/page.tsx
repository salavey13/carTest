"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FaPlay, FaPause, FaForward, FaFlagCheckered, FaDumbbell, FaGraduationCap } from "react-icons/fa6";
import { toast } from "sonner";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { cn } from "@/lib/utils";

interface TutorialLink {
  href: string;
  title: string;
  icon: string;
  color: string;
}

const tutorialLinks: TutorialLink[] = [
  { href: "/tutorials/image-swap", title: "Миссия 1: Битый Пиксель", icon: "FaExchangeAlt", color: "brand-green" },
  { href: "/tutorials/icon-swap", title: "Миссия 2: Сапёр Иконок", icon: "FaBomb", color: "brand-red" },
  { href: "/tutorials/video-swap", title: "Миссия 3: Видео-Рендер", icon: "FaVideo", color: "brand-cyan" },
  { href: "/tutorials/inception-swap", title: "Миссия 4: Inception Swap", icon: "FaInfinity", color: "brand-lime" },
];

const colorClasses: Record<string, { text: string; border: string; shadow: string, bgHover: string, ring: string }> = {
  "brand-green": { text: "text-brand-green", border: "border-brand-green/60", shadow: "hover:shadow-green-glow", bgHover: "hover:bg-brand-green/10", ring: "focus:ring-brand-green" },
  "brand-red": { text: "text-destructive", border: "border-destructive/60", shadow: "hover:shadow-red-glow", bgHover: "hover:bg-destructive/10", ring: "focus:ring-destructive" },
  "brand-cyan": { text: "text-brand-cyan", border: "border-brand-cyan/60", shadow: "hover:shadow-cyan-glow", bgHover: "hover:bg-brand-cyan/10", ring: "focus:ring-brand-cyan" },
  "brand-lime": { text: "text-neon-lime", border: "border-neon-lime/60", shadow: "hover:shadow-neon-lime/50", bgHover: "hover:bg-neon-lime/10", ring: "focus:ring-neon-lime" },
};


export default function StartTrainingPage() {
  const [timer, setTimer] = useState(120); // 2 minutes in seconds
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentExercise, setCurrentExercise] = useState("Приседания");
  const [nextExercise, setNextExercise] = useState("Отжимания");

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
    <div className="min-h-screen bg-gradient-to-br from-dark-bg via-black to-dark-card text-light-text p-4 pt-24 flex flex-col items-center justify-start">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="w-full max-w-md mb-12"
      >
        <Card className="bg-dark-card/90 backdrop-blur-xl border border-brand-green/60 shadow-2xl shadow-green-glow text-center"> 
          <CardHeader className="p-6 md:p-8 border-b border-brand-green/40">
            <FaDumbbell className="text-6xl text-brand-green mx-auto mb-4 drop-shadow-[0_0_15px_theme(colors.brand-green)]" />
            <CardTitle className="text-3xl md:text-4xl font-orbitron font-bold text-brand-green cyber-text glitch" data-text="VIBE ТРЕНИРОВКА">
              VIBE ТРЕНИРОВКА
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
                {isActive && !isPaused ? <FaPause className="mr-2.5" /> : <FaPlay className="mr-2.5" />}
                {isActive && !isPaused ? "Пауза" : isActive && isPaused ? "Продолжить" : "Старт"}
              </Button>
              <Button
                onClick={handleNext}
                variant="outline"
                className="border-brand-blue text-brand-blue hover:bg-brand-blue/20 hover:text-white font-orbitron py-3 text-base shadow-md hover:shadow-brand-blue/30 transform hover:scale-105 transition-all duration-300"
                disabled={!isActive} 
              >
                <FaForward className="mr-2" /> Далее
              </Button>
              <Button
                onClick={handleComplete}
                variant="destructive" 
                className="bg-brand-red hover:bg-brand-red/80 text-destructive-foreground font-orbitron py-3 text-base shadow-md hover:shadow-brand-red/40 transform hover:scale-105 transition-all duration-300"
                disabled={!isActive && timer === 120}
              >
                <FaFlagCheckered className="mr-2" /> Завершить
              </Button>
            </section>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="w-full max-w-2xl" // Adjusted width for tutorial links
      >
        <Card className="bg-dark-card/80 backdrop-blur-md border border-brand-purple/50 shadow-xl shadow-purple-glow">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl font-orbitron text-brand-purple flex items-center justify-center gap-2">
                <FaGraduationCap /> Обучающие Миссии
            </CardTitle>
            <CardDescription className="text-muted-foreground font-mono text-center">
                Прокачай свои навыки работы с платформой!
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 md:p-6">
            {tutorialLinks.map((link) => {
              const colorConfig = colorClasses[link.color as keyof typeof colorClasses] || { text: "text-primary", border: "border-primary", shadow: "hover:shadow-primary/50", bgHover: "hover:bg-primary/10", ring: "focus:ring-primary" };
              return (
                <Link href={link.href} key={link.href} passHref>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full h-auto py-3 px-4 flex flex-col items-center justify-center space-y-2 text-center transition-all duration-200 transform hover:scale-105 focus:scale-105",
                      "bg-dark-card/50 border-2 rounded-lg",
                      colorConfig.text,
                      colorConfig.border,
                      colorConfig.shadow,
                      colorConfig.bgHover,
                      colorConfig.ring
                    )}
                  >
                    <VibeContentRenderer content={`::${link.icon}::`} className="text-3xl mb-1" />
                    <span className="font-orbitron text-sm font-medium leading-tight">{link.title}</span>
                  </Button>
                </Link>
              );
            })}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}