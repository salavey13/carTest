"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  motion,
  useMotionValue,
  useTransform,
  useSpring,
  AnimatePresence,
} from "framer-motion";
import { Bike, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingProps {
  variant?: "bike" | "generic" | "system" | "kinetic";
  text?: string;
  className?: string;
  /** Колбэк после полного завершения и fade-out */
  onLoaded?: () => void;
  /** Длительность загрузки в мс (по умолчанию 4000) */
  duration?: number;
}

const SLANG = [
  "brotski, booting...",
  "no cap, loading...",
  "vibe check: passed",
  "you're him",
  "don't be mid",
  "main character energy",
] as const;

// === KINETIC CORE (фазы внутри) ===
const KineticCore = ({ phase }: { phase: "booting" | "almost" | "ready" }) => {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const [dimensions, setDimensions] = useState({ width: 1000, height: 1000 });

  useEffect(() => {
    const handleResize = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const rotateX = useSpring(
    useTransform(mouseY, [0, dimensions.height], [12, -12]),
    { stiffness: phase === "booting" ? 80 : 50, damping: 30 }
  );

  const rotateY = useSpring(
    useTransform(mouseX, [0, dimensions.width], [-12, 12]),
    { stiffness: phase === "booting" ? 80 : 50, damping: 30 }
  );

  const isAlmost = phase === "almost" || phase === "ready";
  const isReady = phase === "ready";

  const particles = useMemo(
    () =>
      Array.from({ length: 6 }).map((_, i) => ({
        id: `particle-${i}`,
        rotation: i * 60,
        delay: i * 0.25,
      })),
    []
  );

  return (
    <div
      onMouseMove={({ clientX, clientY }) => {
        mouseX.set(clientX);
        mouseY.set(clientY);
      }}
      className="relative flex items-center justify-center perspective-1000"
    >
      <motion.div
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        className="relative w-[18rem] h-[18rem] md:w-[22rem] md:h-[22rem]"
      >
        {/* outer ring */}
        <motion.div
          className="absolute inset-0 rounded-full border border-primary/20"
          style={{ transform: "rotateX(90deg)" }}
          animate={{ rotateZ: 360 }}
          transition={{
            duration: isAlmost ? 40 : 18,
            repeat: Infinity,
            ease: "linear",
          }}
        />

        {/* middle ring */}
        <motion.div
          className="absolute inset-8 rounded-full border border-brand-purple/30"
          style={{ transform: "rotateY(90deg)" }}
          animate={{ rotateZ: -360 }}
          transition={{
            duration: isAlmost ? 22 : 10,
            repeat: Infinity,
            ease: "linear",
          }}
        />

        {/* inner ring */}
        <motion.div
          className="absolute inset-16 rounded-full border-2 border-brand-cyan/40"
          animate={{
            scale: isReady ? [1, 1.02, 1] : isAlmost ? [1, 1.03, 1] : [1, 1.08, 1],
          }}
          transition={{
            duration: isReady ? 5 : isAlmost ? 6 : 4,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* core */}
        <motion.div
          className="absolute top-1/2 left-1/2 w-20 h-20 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-primary to-brand-purple"
          animate={{
            scale: isReady ? [1, 0.98, 1] : isAlmost ? [1, 0.97, 1] : [1, 0.92, 1],
            boxShadow: isReady
              ? [
                  "0 0 50px rgba(var(--primary),0.6)",
                  "0 0 120px rgba(var(--brand-cyan),1)",
                  "0 0 50px rgba(var(--primary),0.6)",
                ]
              : isAlmost
              ? [
                  "0 0 40px rgba(var(--primary),0.5)",
                  "0 0 100px rgba(var(--brand-cyan),0.9)",
                  "0 0 40px rgba(var(--primary),0.5)",
                ]
              : [
                  "0 0 30px rgba(var(--primary),0.4)",
                  "0 0 70px rgba(var(--brand-cyan),0.7)",
                  "0 0 30px rgba(var(--primary),0.4)",
                ],
          }}
          transition={{
            duration: isReady ? 2 : isAlmost ? 2.5 : 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* particles — только в фазе booting */}
        {phase === "booting" &&
          particles.map(({ id, rotation, delay }) => (
            <motion.div
              key={id}
              className="absolute top-1/2 left-1/2 w-1.5 h-1.5 rounded-full bg-brand-gold"
              style={{
                transformOrigin: "0 0",
                transform: `rotate(${rotation}deg) translateX(120px)`,
              }}
              animate={{
                opacity: [0, 1, 0],
                scale: [0, 1.4, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay,
                ease: "easeOut",
              }}
            />
          ))}
      </motion.div>
    </div>
  );
};

// === DATA STREAM (затухает к концу) ===
const DataStream = ({ phase }: { phase: "booting" | "almost" | "ready" }) => {
  const lines = useMemo(
    () =>
      Array.from({ length: 20 }, (_, i) => ({
        id: `line-${i}`,
        left: `${(i * 100) / 20}%`,
        duration: 3 + (i % 4),
        delay: (i % 5) * 0.2,
      })),
    []
  );

  const opacity = phase === "booting" ? 0.2 : phase === "almost" ? 0.1 : 0.05;

  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none transition-opacity duration-1000"
      style={{ opacity }}
    >
      {lines.map(({ id, left, duration, delay }) => (
        <motion.div
          key={id}
          className="absolute top-[-10%] h-[20%] w-px bg-foreground"
          style={{ left }}
          animate={{ top: "110%" }}
          transition={{
            duration,
            repeat: Infinity,
            ease: "linear",
            delay,
          }}
        />
      ))}
    </div>
  );
};

// === TEXT (автономная смена) ===
const LoadingText = ({
  text,
  phase,
}: {
  text?: string;
  phase: "booting" | "almost" | "ready";
}) => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (phase !== "booting") return;
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % SLANG.length);
    }, 1800);
    return () => clearInterval(interval);
  }, [phase]);

  const displayText = text
    ? text
    : phase === "ready"
    ? "ready"
    : phase === "almost"
    ? "almost ready..."
    : SLANG[index];

  return (
    <div className="flex flex-col items-center text-center mt-10 max-w-sm">
      <motion.h2
        layoutId="loading-title"
        className="font-orbitron font-black text-3xl md:text-5xl tracking-[0.25em] uppercase text-transparent bg-clip-text bg-gradient-to-r from-brand-deep-indigo via-primary to-brand-cyan dark:from-brand-purple dark:via-brand-cyan dark:to-brand-pink"
      >
        Init Core
      </motion.h2>

      <div className="mt-4 h-px w-24 bg-gradient-to-r from-transparent via-foreground/30 to-transparent" />

      <AnimatePresence mode="wait">
        <motion.p
          key={displayText}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          transition={{ duration: 0.2 }}
          className="mt-5 font-mono text-sm md:text-base text-muted-foreground tracking-widest uppercase"
        >
          {displayText}
        </motion.p>
      </AnimatePresence>
    </div>
  );
};

// === MAIN ===
export function Loading({
  variant = "kinetic",
  text,
  className,
  onLoaded,
  duration = 4000,
}: LoadingProps) {
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<"booting" | "almost" | "ready">("booting");
  const [visible, setVisible] = useState(true);

  // Монтирование
  useEffect(() => {
    setMounted(true);
  }, []);

  // Автономный тайминг фаз
  useEffect(() => {
    if (!mounted) return;

    const almostTimer = setTimeout(() => {
      setPhase("almost");
    }, duration * 0.7); // 70% времени на booting

    const readyTimer = setTimeout(() => {
      setPhase("ready");
    }, duration * 0.9); // 90% времени на almost

    const fadeOutTimer = setTimeout(() => {
      setVisible(false);
    }, duration + 200); // ещё немного на fade-out

    const completeTimer = setTimeout(() => {
      onLoaded?.();
    }, duration + 600); // после завершения анимации

    return () => {
      clearTimeout(almostTimer);
      clearTimeout(readyTimer);
      clearTimeout(fadeOutTimer);
      clearTimeout(completeTimer);
    };
  }, [mounted, duration, onLoaded]);

  if (!mounted) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="loader"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
          className={cn(
            "fixed inset-0 z-50 bg-background text-foreground flex items-center justify-center overflow-hidden px-6",
            className
          )}
        >
          <div className="absolute inset-0 bg-grid-pattern opacity-40 dark:opacity-15" />
          <DataStream phase={phase} />

          <div className="relative z-10 flex flex-col items-center justify-center">
            {variant === "kinetic" && <KineticCore phase={phase} />}
            {variant === "generic" && (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                className="w-28 h-28 rounded-full border-4 border-t-primary border-b-brand-purple border-r-transparent border-l-transparent"
              />
            )}
            {variant === "bike" && (
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="p-6 rounded-2xl border border-brand-red-orange"
              >
                <Bike size={56} className="text-brand-red-orange" />
              </motion.div>
            )}
            {variant === "system" && (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <Zap className="w-14 h-14 text-primary" />
              </motion.div>
            )}

            <LoadingText text={text} phase={phase} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}