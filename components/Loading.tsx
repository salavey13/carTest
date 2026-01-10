"use client";

import React, { useEffect, useState } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { Ghost, Bike, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingProps {
  variant?: 'bike' | 'generic' | 'system';
  text?: string;
  className?: string;
}

// --- INTERNAL: PARTICLE SYSTEM ---
const ParticleField = ({ count = 60, colorClass = "bg-brand-deep-indigo", windowHeight = 1000 }: { count?: number; colorClass?: string; windowHeight: number }) => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: count }).map((_, i) => {
        const delay = Math.random() * 5;
        const duration = Math.random() * 10 + 10;
        const size = Math.random() * 3 + 1;
        const left = Math.random() * 100;
        
        return (
          <motion.div
            key={i}
            className={cn("absolute rounded-full opacity-20 dark:opacity-40", colorClass)}
            style={{
              width: size,
              height: size,
              left: `${left}%`,
              top: '100%',
              boxShadow: `0 0 ${size * 2}px currentColor`,
            }}
            animate={{
              y: [-20, -windowHeight - 100],
              opacity: [0, 0.6, 0],
              scale: [1, 1.2, 0.5],
            }}
            transition={{
              duration: duration,
              repeat: Infinity,
              delay: delay,
              ease: "linear",
            }}
          />
        );
      })}
    </div>
  );
};

// --- INTERNAL: PERSPECTIVE GRID ---
const CyberGrid = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {/* Grid Floor - Uses border-color which adapts to theme */}
      <motion.div 
        className="absolute bottom-[-50%] left-[-50%] w-[200%] h-[100%] opacity-30 dark:opacity-20"
        style={{
           backgroundImage: `
            linear-gradient(to right, hsl(var(--border) / 0.5) 1px, transparent 1px),
            linear-gradient(to bottom, hsl(var(--border) / 0.5) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
          transform: 'perspective(600px) rotateX(60deg)'
        }}
        animate={{
          backgroundPosition: ['0px 0px', '0px 60px'],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "linear"
        }}
      />
      {/* Vignette overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent z-10" />
    </div>
  );
};

export function Loading({ variant = 'generic', text, className }: LoadingProps) {
  const [mounted, setMounted] = useState(false);
  const [windowHeight, setWindowHeight] = useState(1080);
  
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  
  useEffect(() => {
    setMounted(true);
    setWindowHeight(window.innerHeight);
    const handleResize = () => setWindowHeight(window.innerHeight);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const moveX = useTransform(mouseX, [0, 1920], [-20, 20]); // Assuming 1920 base width
  const moveY = useTransform(mouseY, [0, 1080], [-20, 20]);

  const handleMouseMove = (e: React.MouseEvent) => {
    mouseX.set(e.clientX);
    mouseY.set(e.clientY);
  };

  // ================= GENERIC VARIANT =================
  if (variant === 'generic') {
    return (
      <div 
        onMouseMove={handleMouseMove}
        className={cn(
          "min-h-screen bg-background text-foreground flex flex-col items-center justify-center overflow-hidden relative selection:bg-brand-purple selection:text-white", 
          className
        )}
      >
        {/* 1. Background Layers */}
        <CyberGrid />
        
        {/* 2. Particle System (Parallax) */}
        <motion.div style={{ x: moveX, y: moveY }} className="absolute inset-0 z-0 scale-110">
           {/* In light mode, use deep indigo particles. In dark mode, use purple. */}
           <ParticleField count={60} colorClass="bg-brand-deep-indigo dark:bg-brand-purple" windowHeight={windowHeight} />
        </motion.div>

        {/* 3. Central Vortex */}
        <div className="relative z-20 flex flex-col items-center">
          {/* Orbit Rings */}
          <div className="relative w-32 h-32 sm:w-48 sm:h-48 flex items-center justify-center">
            
            {/* Ring 1 */}
            <motion.div 
              className="absolute inset-0 border-2 border-brand-purple/20 dark:border-brand-purple/50 rounded-full border-t-brand-deep-indigo dark:border-t-brand-cyan border-l-transparent"
              animate={{ rotate: 360 }}
              transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
            />
            
            {/* Ring 2 */}
            <motion.div 
              className="absolute inset-4 border-2 border-brand-cyan/20 dark:border-brand-cyan/30 rounded-full border-t-transparent border-r-brand-red-orange dark:border-r-brand-pink"
              animate={{ rotate: -360 }}
              transition={{ duration: 7, repeat: Infinity, ease: "linear" }}
            />

            {/* Ring 3 (Dashed) */}
            <motion.div 
              className="absolute inset-8 border-2 border-dashed border-brand-pink/20 dark:border-brand-pink/40 rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
            />

            {/* Core Ghost Icon - Adapts color via text-foreground or specific brand color */}
            <motion.div
              animate={{ scale: [1, 1.1, 1], opacity: [0.8, 1, 0.8] }}
              transition={{ duration: 3, repeat: Infinity }}
              className="text-foreground dark:text-white drop-shadow-[0_0_15px_rgba(var(--brand-purple),0.5)] dark:drop-shadow-[0_0_15px_rgba(147,51,234,0.8)]"
            >
              <Ghost size={64} className="fill-current" />
            </motion.div>
          </div>

          {/* Text Status */}
          <div className="mt-8 text-center z-20">
            <h2 className="font-orbitron font-bold text-2xl sm:text-3xl text-transparent bg-clip-text bg-gradient-to-r from-brand-deep-indigo via-brand-purple to-brand-red-orange dark:from-brand-purple dark:via-brand-cyan dark:to-brand-pink tracking-widest uppercase">
              Vibe OS
            </h2>
            <motion.p 
              className="font-mono text-xs sm:text-sm text-muted-foreground dark:text-brand-purple/80 mt-2 tracking-[0.2em] uppercase"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              {text || 'System Initializing...'}
            </motion.p>
            
            {/* Progress Dots */}
            <div className="flex gap-2 justify-center mt-4">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="h-1 w-8 bg-brand-deep-indigo dark:bg-brand-cyan"
                  animate={{ scaleX: [0, 1, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2, ease: "easeInOut" }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ================= BIKE VARIANT (SPEED TUNNEL) =================
  if (variant === 'bike') {
    return (
      <div className={cn("min-h-screen bg-background text-foreground flex flex-col items-center justify-center overflow-hidden relative", className)}>
         {/* Speed Lines Background */}
         <div className="absolute inset-0 perspective-container">
           {[...Array(30)].map((_, i) => (
             <motion.div
               key={i}
               className="absolute bg-brand-red-orange/20 dark:bg-brand-red-orange/30 h-[1px] w-full left-0"
               style={{
                 top: `${Math.random() * 100}%`,
                 transformOrigin: "center",
               }}
               animate={{
                 x: ['-50%', '150%'],
                 width: ['10%', '100%'],
                 opacity: [0, 1, 0]
               }}
               transition={{
                 duration: Math.random() * 1 + 0.5,
                 repeat: Infinity,
                 delay: Math.random() * 2,
                 ease: "linear"
               }}
             />
           ))}
         </div>

         <div className="relative z-20 flex flex-col items-center">
           {/* Central Icon */}
           <motion.div 
             className="relative p-6 rounded-full border border-brand-red-orange/20 bg-card/50 backdrop-blur-sm dark:bg-black/50"
             animate={{ boxShadow: ["0 0 0px rgba(239,68,68,0)", "0 0 30px rgba(239,68,68,0.6)", "0 0 0px rgba(239,68,68,0)"] }}
             transition={{ duration: 2, repeat: Infinity }}
           >
              <Bike size={48} className="text-brand-red-orange" />
              {/* Rotating ring around bike */}
              <motion.div 
                className="absolute inset-0 border-2 border-dashed border-brand-red-orange rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              />
           </motion.div>

           <div className="mt-8 text-center">
              <h2 className="font-orbitron font-black text-3xl text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-600 uppercase tracking-widest animate-pulse">
                Garage Sync
              </h2>
              <p className="font-mono text-sm text-muted-foreground dark:text-orange-500/80 mt-2 tracking-widest">
                {text || 'REVVING ENGINE...'}
              </p>
              {/* Speedometer Bar */}
              <div className="w-64 h-2 bg-muted rounded-full mt-4 overflow-hidden border border-border dark:border-gray-800">
                  <motion.div 
                      className="h-full bg-gradient-to-r from-orange-600 to-red-600"
                      initial={{ width: "0%" }}
                      animate={{ width: "100%" }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  />
              </div>
           </div>
         </div>
      </div>
    );
  }

  // ================= SYSTEM VARIANT (NEW) =================
  return (
    <div className={cn("min-h-screen bg-background text-foreground flex flex-col items-center justify-center overflow-hidden relative", className)}>
      <div className="relative z-10 flex flex-col items-center space-y-8">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          className="p-4 rounded-full border-2 border-border border-t-primary"
        >
          <Cpu className="w-16 h-16 text-primary" />
        </motion.div>
        <div className="text-center space-y-2">
          <h2 className="font-orbitron font-bold text-xl text-foreground">SYSTEM UPGRADE</h2>
          <p className="text-sm text-muted-foreground font-mono">{text || 'Optimizing core modules...'}</p>
        </div>
      </div>
      <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />
    </div>
  );
}