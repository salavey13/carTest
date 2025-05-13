"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// Ensure all icons are from Fa6
import { FaPlay, FaPause, FaForward, FaStop, FaFlagCheckered, FaDumbbell } from "react-icons/fa6";
import { toast } from "sonner";

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
      // TODO: Add logic for next exercise or workout completion (e.g., update CyberFitness profile)
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
    if (!isActive) { // Start
        setIsActive(true);
        setIsPaused(false);
        toast.info(`Начали упражнение: ${currentExercise}`);
    } else { // Pause/Resume
        setIsPaused(!isPaused);
        toast.info(isPaused ? `Пауза: ${currentExercise}`: `Продолжаем: ${currentExercise}`);
    }
  };

  const handleNext = () => {
    // Placeholder for next exercise logic
    toast.info("Переход к следующему упражнению (в разработке).");
    // Example logic (needs proper state management):
    // const nextUp = "Планка"; // Determine next exercise
    // setCurrentExercise(nextExercise);
    // setNextExercise(nextUp);
    // setTimer(60); // Set timer for plank
    // setIsActive(true);
    // setIsPaused(false);
  };

  const handleComplete = () => {
    setIsActive(false);
    setIsPaused(false);
    setTimer(0); // Visually show completion
    toast.success("Тренировка полностью завершена!");
    // TODO: Add logic for saving progress, updating CyberFitness profile, etc.
  };

  return (
    // Applied theme background and text colors
    <div className="min-h-screen bg-gradient-to-br from-dark-bg via-black to-dark-card text-light-text p-4 pt-24 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
         {/* Applied theme card styles */}
        <Card className="bg-dark-card/80 backdrop-blur-md border border-brand-green/50 shadow-xl shadow-green-glow text-center"> {/* Used custom shadow */}
          <CardHeader>
            <FaDumbbell className="text-5xl text-brand-green mx-auto mb-3 drop-shadow-lg" />
            <CardTitle className="text-3xl font-bold text-brand-green cyber-text">
              Ваша Тренировка
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-8 p-6">
            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-2">{currentExercise}</h2>
              <p className="text-7xl font-mono font-bold text-brand-pink my-6 tracking-wider drop-shadow-lg text-shadow-neon"> {/* Applied text shadow */}
                {formatTime(timer)}
              </p>
              <p className="text-muted-foreground">Следующее: {nextExercise}</p>
            </section>

            <section className="grid grid-cols-2 gap-4">
              {/* Applied theme button variants and styles */}
              <Button
                onClick={handleStartPause}
                size="lg" // Make main button larger
                className="col-span-2 bg-brand-green text-black hover:bg-brand-green/80 font-mono text-lg py-3 shadow-md hover:shadow-lg"
              >
                {isActive && !isPaused ? <FaPause className="mr-2" /> : <FaPlay className="mr-2" />}
                {isActive && !isPaused ? "Пауза" : isActive && isPaused ? "Продолжить" : "Старт"}
              </Button>
              <Button
                onClick={handleNext}
                variant="outline"
                className="border-brand-blue text-brand-blue hover:bg-brand-blue/10 hover:text-white font-mono py-3"
                disabled={!isActive} // Disable if not active
              >
                <FaForward className="mr-2" /> Далее
              </Button>
              <Button
                onClick={handleComplete}
                variant="destructive" // Use destructive for completion/stop
                className="font-mono py-3"
                disabled={!isActive && timer === 120}
              >
                <FaFlagCheckered className="mr-2" /> Завершить
              </Button>
            </section>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}