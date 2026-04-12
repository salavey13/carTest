"use client";

import React, { useEffect, useState } from "react";
import { motion, useMotionValue, useTransform, useSpring } from "framer-motion";
import { Bike, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingProps {
  variant?: "bike" | "generic" | "system" | "kinetic";
  text?: string;
  className?: string;
}

// === SLANG (tight) ===
const SLANG = [
  "brotski, booting...",
  "no cap, loading...",
  "vibe check: passed",
  "you're him",
  "don't be mid",
  "main character energy",
] as const;

// === KINETIC CORE ===
const KineticCore = ({ almostReady }: { almostReady: boolean }) => {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const rotateX = useSpring(
    useTransform(mouseY, [0, typeof window !== "undefined" ? window.innerHeight : 1000], [12, -12]),
    { stiffness: almostReady ? 50 : 80, damping: 30 }
  );

  const rotateY = useSpring(
    useTransform(mouseX, [0, typeof window !== "undefined" ? window.innerWidth : 1000], [-12, 12]),
    { stiffness: almostReady ? 50 : 80, damping: 30 }
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
            duration: almostReady ? 40 : 18,
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
            duration: almostReady ? 22 : 10,
            repeat: Infinity,
            ease: "linear",
          }}
        />

        {/* inner ring */}
        <motion.div
          className="absolute inset-16 rounded-full border-2 border-brand-cyan/40"
          animate={{
            scale: almostReady ? [1, 1.03, 1] : [1, 1.08, 1],
          }}
          transition={{
            duration: almostReady ? 6 : 4,
            repeat: Infinity,
          }}
        />

        {/* core */}
        <motion.div
          className="absolute top-1/2 left-1/2 w-20 h-20 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-primary to-brand-purple"
          animate={{
            scale: almostReady ? [1, 0.97, 1] : [1, 0.92, 1],
            boxShadow: almostReady
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
            duration: almostReady ? 2.5 : 2,
            repeat: Infinity,
          }}
        />

        {/* particles */}
        {Array.from({ length: 6 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute top-1/2 left-1/2 w-1.5 h-1.5 rounded-full bg-brand-gold"
            style={{
              transformOrigin: "0 0",
              transform: `rotate(${i * 60}deg) translateX(120px)`,
            }}
            animate={{
              opacity: almostReady ? [0, 0.4, 0] : [0, 1, 0],
              scale: almostReady ? [0, 1, 0] : [0, 1.4, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: i * 0.25,
            }}
          />
        ))}
      </motion.div>
    </div>
  );
};

// === DATA STREAM ===
const DataStream = () => {
  const lines = Array.from({ length: 20 }, (_, i) => ({
    left: `${(i * 100) / 20}%`,
    duration: 3 + (i % 4),
    delay: (i % 5) * 0.2,
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20 dark:opacity-10">
      {lines.map((l, i) => (
        <motion.div
          key={i}
          className="absolute top-[-10%] h-[20%] w-px bg-foreground"
          style={{ left: l.left }}
          animate={{ top: "110%" }}
          transition={{
            duration: l.duration,
            repeat: Infinity,
            ease: "linear",
            delay: l.delay,
          }}
        />
      ))}
    </div>
  );
};

// === TEXT ===
const LoadingText = ({
  text,
  almostReady,
}: {
  text?: string;
  almostReady: boolean;
}) => {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (almostReady) return;

    const id = setInterval(() => {
      setI((v) => (v + 1) % SLANG.length);
    }, 1800);

    return () => clearInterval(id);
  }, [almostReady]);

  return (
    <div className="flex flex-col items-center text-center mt-10 max-w-sm">
      <h2 className="font-orbitron font-black text-3xl md:text-5xl tracking-[0.25em] uppercase text-transparent bg-clip-text bg-gradient-to-r from-brand-deep-indigo via-primary to-brand-cyan dark:from-brand-purple dark:via-brand-cyan dark:to-brand-pink">
        Init Core
      </h2>

      <div className="mt-4 h-px w-24 bg-gradient-to-r from-transparent via-foreground/30 to-transparent" />

      <p className="mt-5 font-mono text-sm md:text-base text-muted-foreground tracking-widest uppercase">
        {text || (almostReady ? "almost ready..." : SLANG[i])}
      </p>
    </div>
  );
};

// === MAIN ===
export function Loading({
  variant = "kinetic",
  text,
  className,
}: LoadingProps) {
  const [mounted, setMounted] = useState(false);
  const [almostReady, setAlmostReady] = useState(false);

  useEffect(() => {
    setMounted(true);

    const t = setTimeout(() => {
      setAlmostReady(true);
    }, 3500);

    return () => clearTimeout(t);
  }, []);

  if (!mounted) return null;

  // === KINETIC ===
  if (variant === "kinetic") {
    return (
      <div
        className={cn(
          "min-h-screen bg-background text-foreground flex items-center justify-center relative overflow-hidden px-6",
          className
        )}
      >
        <div className="absolute inset-0 bg-grid-pattern opacity-40 dark:opacity-15" />
        <DataStream />

        <div className="relative z-10 flex flex-col items-center justify-center">
          <KineticCore almostReady={almostReady} />
          <LoadingText text={text} almostReady={almostReady} />
        </div>
      </div>
    );
  }

  // === GENERIC ===
  if (variant === "generic") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 text-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          className="w-28 h-28 rounded-full border-4 border-t-primary border-b-brand-purple border-r-transparent border-l-transparent"
        />
        <p className="font-mono text-sm text-muted-foreground tracking-widest uppercase">
          {text || "loading..."}
        </p>
      </div>
    );
  }

  // === BIKE ===
  if (variant === "bike") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6">
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 1, repeat: Infinity }}
          className="p-6 rounded-2xl border border-brand-red-orange"
        >
          <Bike size={56} className="text-brand-red-orange" />
        </motion.div>

        <div className="w-56">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-brand-red-orange"
              animate={{ width: ["0%", "100%"] }}
              transition={{ duration: 1.4, repeat: Infinity }}
            />
          </div>
        </div>
      </div>
    );
  }

  // === SYSTEM ===
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
      >
        <Zap className="w-14 h-14 text-primary" />
      </motion.div>

      <p className="font-mono text-sm text-muted-foreground tracking-widest uppercase">
        {text || "system..."}
      </p>
    </div>
  );
}