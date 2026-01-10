"use client";

import React, { useEffect, useState, useRef } from "react";
import { motion, useMotionValue, useTransform, useSpring } from "framer-motion";
import { Ghost, Bike, Cpu, Loader2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingProps {
  variant?: 'bike' | 'generic' | 'system' | 'kinetic';
  text?: string;
  className?: string;
}

// --- COMPONENT: 3D KINETIC CORE (New "Surprise" Visual) ---
const KineticCore = () => {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const handleMouseMove = ({ clientX, clientY }: React.MouseEvent) => {
    mouseX.set(clientX);
    mouseY.set(clientY);
  };

  // Smooth spring values for rotation
  const rotateX = useSpring(useTransform(mouseY, [0, window.innerHeight], [15, -15]), { stiffness: 100, damping: 30 });
  const rotateY = useSpring(useTransform(mouseX, [0, window.innerWidth], [-15, 15]), { stiffness: 100, damping: 30 });

  return (
    <div onMouseMove={handleMouseMove} className="relative w-full h-full flex items-center justify-center perspective-1000">
      <motion.div 
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        className="relative w-64 h-64"
      >
        {/* Outer Ring */}
        <motion.div 
          className="absolute inset-0 border-2 border-dashed border-primary/20 rounded-full shadow-[0_0_30px_rgba(var(--primary),0.1)]"
          style={{ transform: "rotateX(90deg)" }}
          animate={{ rotateZ: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        />
        
        {/* Middle Gyroscope Ring */}
        <motion.div 
          className="absolute inset-8 border border-brand-purple/30 rounded-full"
          style={{ transform: "rotateY(90deg)" }}
          animate={{ rotateZ: -360 }}
          transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
        />

        {/* Inner Core Ring */}
        <motion.div 
          className="absolute inset-16 border-2 border-brand-cyan/40 rounded-full"
          animate={{ scale: [1, 1.1, 1], rotate: 360 }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Central Nucleus */}
        <motion.div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 bg-gradient-to-br from-primary to-brand-purple rounded-full shadow-[0_0_40px_rgba(var(--primary),0.5)]"
          animate={{ 
            boxShadow: ["0 0 40px rgba(var(--primary),0.5)", "0 0 80px rgba(var(--brand-cyan),0.8)", "0 0 40px rgba(var(--primary),0.5)"],
            scale: [1, 0.9, 1]
          }}
          transition={{ duration: 2, repeat: Infinity }}
        >
           <div className="w-full h-full bg-white/20 rounded-full animate-spin blur-sm" />
        </motion.div>
        
        {/* Floating Data Particles */}
        {[...Array(6)].map((_, i) => (
            <motion.div
                key={i}
                className="absolute top-1/2 left-1/2 w-2 h-2 bg-brand-gold rounded-full"
                style={{
                    transformOrigin: "0 0",
                    transform: `rotate(${i * 60}deg) translateX(140px)`,
                }}
                animate={{
                    opacity: [0, 1, 0],
                    scale: [0, 1.5, 0]
                }}
                transition={{ duration: 2, repeat: Infinity, delay: i * 0.3, ease: "easeInOut" }}
            />
        ))}
      </motion.div>
    </div>
  );
};

// --- COMPONENT: DATA STREAM BACKGROUND ---
const DataStream = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20 dark:opacity-10">
    {[...Array(20)].map((_, i) => (
      <motion.div
        key={i}
        className="absolute top-[-10%] w-[1px] h-[20%] bg-foreground"
        style={{ left: `${Math.random() * 100}%` }}
        animate={{ top: "110%" }}
        transition={{ duration: Math.random() * 5 + 3, repeat: Infinity, ease: "linear", delay: Math.random() * 2 }}
      />
    ))}
  </div>
);

export function Loading({ variant = 'kinetic', text, className }: LoadingProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  // ================= KINETIC VARIANT (The Surprise) =================
  if (variant === 'kinetic') {
    return (
      <div className={cn("min-h-screen bg-background text-foreground flex flex-col items-center justify-center overflow-hidden relative", className)}>
        <div className="absolute inset-0 bg-grid-pattern opacity-50 dark:opacity-20" />
        <DataStream />
        
        <div className="relative z-10 flex flex-col items-center">
            <KineticCore />
            
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.8 }}
                className="mt-12 text-center space-y-4"
            >
                <h2 className="font-orbitron font-black text-4xl md:text-5xl text-transparent bg-clip-text bg-gradient-to-r from-brand-deep-indigo via-primary to-brand-cyan dark:from-brand-purple dark:via-brand-cyan dark:to-brand-pink tracking-widest uppercase">
                    Init Core
                </h2>
                <div className="h-px w-24 mx-auto bg-foreground/20 dark:bg-white/20" />
                <p className="font-mono text-sm md:text-base text-muted-foreground animate-pulse tracking-widest">
                    {text || 'CALIBRATING SYSTEMS...'}
                </p>
            </motion.div>
        </div>
      </div>
    );
  }

  // ================= GENERIC VARIANT =================
  if (variant === 'generic') {
    return (
      <div className={cn("min-h-screen bg-background text-foreground flex flex-col items-center justify-center overflow-hidden relative", className)}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,hsl(var(--background))_90%)] z-0" />
        
        <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
            className="relative z-10 w-32 h-32 border-4 border-t-primary border-r-transparent border-b-brand-purple border-l-transparent rounded-full"
        >
            <div className="absolute inset-2 border-2 border-t-brand-cyan border-r-transparent border-b-transparent border-l-brand-red-orange rounded-full animate-spin" style={{ animationDuration: '5s', animationDirection: 'reverse' }} />
        </motion.div>
        
        <div className="relative z-10 mt-8 text-center">
            <h2 className="font-orbitron font-bold text-3xl text-foreground uppercase tracking-widest">Vibe OS</h2>
            <p className="font-mono text-xs text-muted-foreground mt-2">{text || 'Loading Assets'}</p>
        </div>
      </div>
    );
  }

  // ================= BIKE VARIANT =================
  if (variant === 'bike') {
    return (
      <div className={cn("min-h-screen bg-background text-foreground flex flex-col items-center justify-center overflow-hidden relative", className)}>
        {/* Speed Tunnel Effect */}
        <div className="absolute inset-0 perspective-1000 overflow-hidden">
          {[...Array(15)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute h-[2px] bg-brand-red-orange/40 dark:bg-brand-red-orange/60 left-0 right-0"
              style={{ top: `${Math.random() * 100}%` }}
              animate={{ 
                scaleX: [0, 1, 0], 
                x: ['-50%', '50%'],
                opacity: [0, 1, 0] 
              }}
              transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.1 }}
            />
          ))}
        </div>

        <div className="relative z-20 flex flex-col items-center">
            <motion.div 
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
                className="p-6 rounded-2xl border-2 border-brand-red-orange bg-card shadow-[0_0_30px_rgba(var(--brand-red-orange),0.2)]"
            >
                <Bike size={64} className="text-brand-red-orange" />
            </motion.div>
            <div className="mt-6 text-center w-64">
                <h2 className="font-orbitron font-black text-2xl uppercase text-foreground tracking-widest">Speed Sync</h2>
                <div className="w-full h-2 bg-muted rounded-full mt-3 overflow-hidden">
                    <motion.div 
                        className="h-full bg-brand-red-orange"
                        initial={{ width: "0%" }}
                        animate={{ width: "100%" }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                    />
                </div>
            </div>
        </div>
      </div>
    );
  }

  // ================= SYSTEM VARIANT =================
  return (
    <div className={cn("min-h-screen bg-background text-foreground flex flex-col items-center justify-center", className)}>
       <motion.div
         animate={{ rotate: 360 }}
         transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
         className="relative"
       >
         <Zap className="w-16 h-16 text-primary fill-primary/20" />
         <motion.div 
            className="absolute inset-0 rounded-full border border-primary"
            animate={{ scale: [1, 2], opacity: [0.8, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
         />
       </motion.div>
       <h3 className="mt-4 font-orbitron font-bold text-xl text-foreground">{text || 'SYSTEM'}</h3>
    </div>
  );
}