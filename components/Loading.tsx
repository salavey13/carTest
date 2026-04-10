"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import { motion, useMotionValue, useTransform, useSpring, AnimatePresence } from "framer-motion";
import { Ghost, Bike, Cpu, Zap, Terminal, Radio, Activity, Wifi, Shield, Lock, Unlock, Eye, Binary, Fingerprint, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingProps {
  variant?: 'bike' | 'generic' | 'system' | 'kinetic';
  text?: string;
  className?: string;
}

// --- UTILITY: Generate deterministic random based on seed ---
const seededRandom = (seed: number) => {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
};

// --- COMPONENT: GLITCH TEXT EFFECT ---
const GlitchText = ({ text, className }: { text: string; className?: string }) => {
  return (
    <div className={cn("relative font-orbitron font-black tracking-widest uppercase", className)}>
      <span className="relative z-10">{text}</span>
      <span className="absolute top-0 left-0 -z-10 text-red-500 opacity-70 animate-pulse translate-x-[2px]">
        {text}
      </span>
      <span className="absolute top-0 left-0 -z-10 text-cyan-500 opacity-70 animate-pulse -translate-x-[2px] delay-75">
        {text}
      </span>
    </div>
  );
};

// --- COMPONENT: NEON HEXAGON GRID ---
const HexGrid = () => {
  const hexagons = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => ({
      id: i,
      delay: i * 0.15,
      scale: 1 - i * 0.12,
      opacity: 1 - i * 0.12,
    }));
  }, []);

  return (
    <div className="relative w-64 h-64 flex items-center justify-center">
      {hexagons.map((hex) => (
        <motion.div
          key={hex.id}
          className="absolute inset-0 flex items-center justify-center"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ 
            scale: hex.scale, 
            opacity: hex.opacity,
            rotate: [0, 60, 0]
          }}
          transition={{ 
            scale: { delay: hex.delay, duration: 0.5, ease: "easeOut" },
            rotate: { duration: 8, repeat: Infinity, ease: "linear", delay: hex.delay }
          }}
        >
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <motion.polygon
              points="50,5 95,27.5 95,72.5 50,95 5,72.5 5,27.5"
              fill="none"
              stroke="url(#hexGradient)"
              strokeWidth="1.5"
              className="drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]"
            />
            <defs>
              <linearGradient id="hexGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgb(6,182,212)" />
                <stop offset="50%" stopColor="rgb(168,85,247)" />
                <stop offset="100%" stopColor="rgb(236,72,153)" />
              </linearGradient>
            </defs>
          </svg>
        </motion.div>
      ))}
      
      {/* Center Core */}
      <motion.div
        className="absolute w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500 via-purple-500 to-pink-500 blur-sm"
        animate={{ 
          scale: [1, 1.2, 1],
          opacity: [0.8, 1, 0.8]
        }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute w-8 h-8 rounded-full bg-white"
        animate={{ scale: [1, 0.8, 1] }}
        transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
};

// --- COMPONENT: MATRIX RAIN ---
const MatrixRain = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const chars = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEF";
    const fontSize = 14;
    const columns = canvas.width / fontSize;
    const drops: number[] = Array(Math.floor(columns)).fill(1);

    let animationId: number;
    
    const draw = () => {
      ctx.fillStyle = 'rgba(2, 6, 23, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.fillStyle = '#0ea5e9';
      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < drops.length; i++) {
        const text = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);
        
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }
      
      animationId = requestAnimationFrame(draw);
    };

    draw();

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 opacity-30" />;
};

// --- COMPONENT: PARTICLE FIELD ---
const ParticleField = () => {
  const particleCount = 50;
  
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: particleCount }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-cyan-500 rounded-full"
          initial={{ 
            x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1000),
            y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 1000),
            scale: 0,
            opacity: 0 
          }}
          animate={{ 
            y: [null, Math.random() * -500],
            scale: [0, Math.random() * 2 + 1, 0],
            opacity: [0, Math.random() * 0.5 + 0.3, 0]
          }}
          transition={{ 
            duration: Math.random() * 10 + 10,
            repeat: Infinity,
            delay: Math.random() * 5,
            ease: "linear"
          }}
          style={{
            boxShadow: '0 0 6px rgba(6,182,212,0.8)'
          }}
        />
      ))}
    </div>
  );
};

// --- COMPONENT: SCANNER LINE ---
const ScannerLine = () => (
  <motion.div
    className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500 to-transparent shadow-[0_0_20px_rgba(6,182,212,0.8)] z-30"
    initial={{ top: "0%" }}
    animate={{ top: "100%" }}
    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
  />
);

// --- COMPONENT: TERMINAL LOGS ---
const TerminalLogs = ({ text }: { text?: string }) => {
  const logs = useMemo(() => [
    "> Initializing neural handshake...",
    "> Bypassing security protocols...",
    "> Decrypting data streams...",
    "> Establishing secure connection...",
    text || "> Loading assets...",
    "> Optimizing performance...",
    "> Rendering interface..."
  ], [text]);

  const [visibleLogs, setVisibleLogs] = useState<string[]>([]);

  useEffect(() => {
    let index = 0;
    const interval = setInterval(() => {
      if (index < logs.length) {
        setVisibleLogs(prev => [...prev, logs[index]]);
        index++;
      } else {
        setVisibleLogs([]);
        index = 0;
      }
    }, 800);
    
    return () => clearInterval(interval);
  }, [logs]);

  return (
    <div className="font-mono text-[10px] sm:text-xs text-cyan-500/60 space-y-1 max-w-md mx-auto mt-8 h-32 overflow-hidden">
      <AnimatePresence mode="popLayout">
        {visibleLogs.map((log, i) => (
          <motion.div
            key={`${log}-${i}`}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-2"
          >
            <ChevronRight className="w-3 h-3 text-cyan-400" />
            <span className="truncate">{log}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

// --- COMPONENT: 3D KINETIC CORE (Enhanced) ---
const KineticCore = () => {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const handleMouseMove = ({ clientX, clientY }: React.MouseEvent) => {
    mouseX.set(clientX);
    mouseY.set(clientY);
  };

  const rotateX = useSpring(useTransform(mouseY, [0, typeof window !== 'undefined' ? window.innerHeight : 1000], [20, -20]), { stiffness: 150, damping: 20 });
  const rotateY = useSpring(useTransform(mouseX, [0, typeof window !== 'undefined' ? window.innerWidth : 1000], [-20, 20]), { stiffness: 150, damping: 20 });

  return (
    <div onMouseMove={handleMouseMove} className="relative w-80 h-80 flex items-center justify-center perspective-1000 cursor-crosshair">
      <motion.div 
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        className="relative w-full h-full"
      >
        {/* Outer Holographic Ring */}
        <motion.div 
          className="absolute inset-0 rounded-full border border-dashed border-cyan-500/30"
          style={{ transform: "translateZ(-50px) rotateX(75deg)" }}
          animate={{ rotateZ: 360 }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
        >
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-pink-500/10 blur-xl" />
        </motion.div>
        
        {/* Middle Gyroscope Ring */}
        <motion.div 
          className="absolute inset-8 rounded-full border border-purple-500/40 shadow-[0_0_30px_rgba(168,85,247,0.3)]"
          style={{ transform: "rotateY(85deg)" }}
          animate={{ rotateZ: -360 }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        >
          {[0, 90, 180, 270].map((deg, i) => (
            <motion.div
              key={i}
              className="absolute w-3 h-3 bg-purple-400 rounded-full shadow-[0_0_10px_rgba(168,85,247,0.8)]"
              style={{ 
                top: '50%', 
                left: '50%', 
                transform: `rotate(${deg}deg) translateX(120px) translateY(-50%)` 
              }}
              animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity, delay: i * 0.5 }}
            />
          ))}
        </motion.div>

        {/* Inner Data Ring */}
        <motion.div 
          className="absolute inset-16 rounded-full border-2 border-cyan-400/50"
          animate={{ rotate: -360, scale: [1, 1.05, 1] }}
          transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
        >
          <Binary className="absolute top-2 left-1/2 -translate-x-1/2 w-5 h-5 text-cyan-400" />
          <Fingerprint className="absolute bottom-2 left-1/2 -translate-x-1/2 w-5 h-5 text-cyan-400" />
          <Eye className="absolute left-2 top-1/2 -translate-y-1/2 w-5 h-5 text-cyan-400" />
          <Lock className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 text-cyan-400" />
        </motion.div>

        {/* Central Nucleus */}
        <motion.div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24"
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        >
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan-500 via-purple-500 to-pink-500 opacity-80 blur-md animate-pulse" />
          <div className="absolute inset-2 rounded-full bg-slate-950 flex items-center justify-center">
            <motion.div
              animate={{ 
                boxShadow: [
                  "0 0 20px rgba(6,182,212,0.5)", 
                  "0 0 60px rgba(168,85,247,0.8)", 
                  "0 0 20px rgba(236,72,153,0.5)",
                  "0 0 20px rgba(6,182,212,0.5)"
                ],
              }}
              transition={{ duration: 3, repeat: Infinity }}
              className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center"
            >
              <Cpu className="w-6 h-6 text-white" />
            </motion.div>
          </div>
        </motion.div>
        
        {/* Orbiting Satellites */}
        {[0, 60, 120, 180, 240, 300].map((deg, i) => (
          <motion.div
            key={i}
            className="absolute top-1/2 left-1/2 w-2 h-2"
            style={{ transformOrigin: "0 0" }}
            animate={{ rotate: 360 }}
            transition={{ duration: 8 + i, repeat: Infinity, ease: "linear", delay: i * 0.2 }}
          >
            <motion.div
              className="absolute w-3 h-3 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full shadow-[0_0_15px_rgba(251,191,36,0.8)]"
              style={{ transform: `rotate(${deg}deg) translateX(140px)` }}
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.1 }}
            />
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
};

// --- COMPONENT: BIKE SPEEDSTER (Enhanced) ---
const BikeSpeedster = () => {
  return (
    <div className="relative w-full max-w-lg mx-auto h-64 flex items-center justify-center overflow-hidden">
      {/* Speed Lines Background */}
      <div className="absolute inset-0 perspective-1000">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute h-[2px] bg-gradient-to-r from-transparent via-orange-500 to-transparent"
            style={{ 
              top: `${20 + (i * 3)}%`,
              left: '-100%',
              right: '-100%'
            }}
            animate={{ 
              x: ['-100%', '100%'],
              opacity: [0, 1, 0]
            }}
            transition={{ 
              duration: 0.6, 
              repeat: Infinity, 
              delay: i * 0.05,
              ease: "easeIn"
            }}
          />
        ))}
      </div>

      {/* Bike Container */}
      <motion.div 
        className="relative z-10"
        animate={{ 
          x: [-10, 10, -10],
          y: [0, -5, 0]
        }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* Wheel Particles */}
        <motion.div
          className="absolute -left-16 top-1/2 -translate-y-1/2"
          animate={{ rotate: -360 }}
          transition={{ duration: 0.5, repeat: Infinity, ease: "linear" }}
        >
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
            <div
              key={deg}
              className="absolute w-2 h-2 bg-orange-400 rounded-full shadow-[0_0_10px_rgba(251,191,36,0.8)]"
              style={{ 
                transform: `rotate(${deg}deg) translateX(60px)` 
              }}
            />
          ))}
        </motion.div>

        <motion.div
          className="absolute -right-16 top-1/2 -translate-y-1/2"
          animate={{ rotate: 360 }}
          transition={{ duration: 0.5, repeat: Infinity, ease: "linear" }}
        >
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
            <div
              key={deg}
              className="absolute w-2 h-2 bg-orange-400 rounded-full shadow-[0_0_10px_rgba(251,191,36,0.8)]"
              style={{ 
                transform: `rotate(${deg}deg) translateX(60px)` 
              }}
            />
          ))}
        </motion.div>

        {/* Main Bike Icon */}
        <motion.div
          className="p-8 rounded-3xl bg-gradient-to-br from-orange-500/20 to-red-500/20 border-2 border-orange-500/50 backdrop-blur-sm"
          animate={{ 
            boxShadow: [
              "0 0 30px rgba(251,191,36,0.3)",
              "0 0 60px rgba(251,191,36,0.5)",
              "0 0 30px rgba(251,191,36,0.3)"
            ]
          }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <Bike size={80} className="text-orange-400 drop-shadow-[0_0_15px_rgba(251,191,36,0.8)]" strokeWidth={1.5} />
        </motion.div>

        {/* Speedometer Ring */}
        <svg className="absolute -inset-8 w-[calc(100%+4rem)] h-[calc(100%+4rem)] -z-10">
          <motion.circle
            cx="50%"
            cy="50%"
            r="48%"
            fill="none"
            stroke="url(#bikeGradient)"
            strokeWidth="2"
            strokeDasharray="10 5"
            animate={{ rotate: 360 }}
            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
          />
          <defs>
            <linearGradient id="bikeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(251,191,36,0)" />
              <stop offset="50%" stopColor="rgba(251,191,36,0.5)" />
              <stop offset="100%" stopColor="rgba(251,191,36,0)" />
            </linearGradient>
          </defs>
        </svg>
      </motion.div>

      {/* Ground Speed Effect */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-orange-500 to-transparent opacity-50" />
    </div>
  );
};

// --- MAIN LOADING COMPONENT ---
export function Loading({ variant = 'kinetic', text, className }: LoadingProps) {
  const [mounted, setMounted] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setMounted(true);
    // Simulate loading progress
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) return 0;
        return prev + Math.random() * 15;
      });
    }, 200);
    return () => clearInterval(interval);
  }, []);

  if (!mounted) return null;

  const displayProgress = Math.min(progress, 100);

  // ================= KINETIC VARIANT (Next Level) =================
  if (variant === 'kinetic') {
    return (
      <div className={cn(
        "min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center justify-center overflow-hidden relative",
        className
      )}>
        <MatrixRain />
        <ParticleField />
        <ScannerLine />
        
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(2,6,23,0.8)_100%)] z-10" />
        
        <div className="relative z-20 flex flex-col items-center px-4">
          <KineticCore />
          
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="mt-8 text-center space-y-6 w-full max-w-md"
          >
            <GlitchText 
              text="NEURAL SYNC" 
              className="text-4xl md:text-6xl bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent"
            />
            
            {/* Progress Bar */}
            <div className="relative h-1 bg-slate-800 rounded-full overflow-hidden">
              <motion.div 
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500"
                style={{ width: `${displayProgress}%` }}
                transition={{ type: "spring", stiffness: 100 }}
              />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
            </div>
            
            <TerminalLogs text={text} />
            
            <div className="flex items-center justify-center gap-4 text-xs font-mono text-slate-500">
              <span className="flex items-center gap-1">
                <Wifi className="w-3 h-3 text-emerald-400" />
                SECURE
              </span>
              <span className="flex items-center gap-1">
                <Shield className="w-3 h-3 text-cyan-400" />
                ENCRYPTED
              </span>
              <span className="flex items-center gap-1">
                <Radio className="w-3 h-3 text-amber-400 animate-pulse" />
                LIVE
              </span>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // ================= GENERIC VARIANT (Next Level) =================
  if (variant === 'generic') {
    return (
      <div className={cn(
        "min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center justify-center overflow-hidden relative",
        className
      )}>
        <ParticleField />
        
        <div className="relative z-10 flex flex-col items-center">
          <HexGrid />
          
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-12 text-center space-y-4"
          >
            <motion.h2 
              className="font-orbitron font-black text-3xl md:text-4xl uppercase tracking-[0.3em] text-slate-300"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              SYSTEM BOOT
            </motion.h2>
            
            <div className="flex items-center gap-2 justify-center">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.8)]"
                  animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.3 }}
                />
              ))}
            </div>
            
            <p className="font-mono text-sm text-slate-500">
              {text || 'Initializing modules...'}
            </p>
          </motion.div>
        </div>
      </div>
    );
  }

  // ================= BIKE VARIANT (Next Level) =================
  if (variant === 'bike') {
    return (
      <div className={cn(
        "min-h-screen bg-gradient-to-br from-slate-950 via-orange-950/20 to-slate-950 text-slate-200 flex flex-col items-center justify-center overflow-hidden relative",
        className
      )}>
        <BikeSpeedster />
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-12 text-center space-y-4 z-10"
        >
          <h2 className="font-orbitron font-black text-3xl md:text-5xl uppercase tracking-wider text-orange-400 drop-shadow-[0_0_15px_rgba(251,191,36,0.5)]">
            TURBO SYNC
          </h2>
          
          {/* Animated Speed Bar */}
          <div className="w-64 h-2 bg-slate-800 rounded-full overflow-hidden mx-auto">
            <motion.div
              className="h-full bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500"
              animate={{ 
                width: ["0%", "100%", "0%"],
                x: ["-100%", "0%", "100%"]
              }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>
          
          <p className="font-mono text-sm text-orange-300/70 animate-pulse">
            {text || 'Optimizing performance...'}
          </p>
          
          <div className="flex justify-center gap-2 mt-4">
            {['RPM', 'TORQUE', 'SPEED'].map((label, i) => (
              <div key={label} className="text-center">
                <motion.div
                  className="text-lg font-orbitron font-bold text-amber-400"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                >
                  {Math.floor(Math.random() * 9000 + 1000)}
                </motion.div>
                <div className="text-[10px] text-slate-500 uppercase">{label}</div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  // ================= SYSTEM VARIANT (Next Level) =================
  return (
    <div className={cn(
      "min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center justify-center relative overflow-hidden",
      className
    )}>
      {/* Circuit Board Background */}
      <div className="absolute inset-0 opacity-10">
        <svg className="w-full h-full">
          <pattern id="circuit" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
            <circle cx="50" cy="50" r="2" fill="currentColor" />
            <path d="M50 50 L50 0 M50 50 L100 50 M50 50 L50 100 M50 50 L0 50" stroke="currentColor" strokeWidth="0.5" fill="none" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#circuit)" />
        </svg>
      </div>

      <div className="relative z-10 flex flex-col items-center">
        {/* Central Power Core */}
        <motion.div
          className="relative w-32 h-32"
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
        >
          {[0, 45, 90, 135].map((deg, i) => (
            <motion.div
              key={deg}
              className="absolute inset-0 border-2 border-cyan-500/30 rounded-full"
              style={{ transform: `rotate(${deg}deg) scale(${1 - i * 0.15})` }}
              animate={{ 
                borderColor: ["rgba(6,182,212,0.3)", "rgba(168,85,247,0.5)", "rgba(6,182,212,0.3)"]
              }}
              transition={{ duration: 2, repeat: Infinity, delay: i * 0.2 }}
            />
          ))}
          
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              animate={{ 
                scale: [1, 1.2, 1],
                boxShadow: [
                  "0 0 20px rgba(6,182,212,0.5)",
                  "0 0 40px rgba(168,85,247,0.8)",
                  "0 0 20px rgba(6,182,212,0.5)"
                ]
              }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center"
            >
              <Zap className="w-8 h-8 text-white fill-white" />
            </motion.div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8 text-center space-y-3"
        >
          <h3 className="font-orbitron font-bold text-2xl text-cyan-400 tracking-widest">
            {text || 'SYSTEM ACTIVE'}
          </h3>
          
          <div className="flex items-center gap-2 justify-center text-xs font-mono text-slate-500">
            <Terminal className="w-3 h-3" />
            <span>v2.0.1</span>
            <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
            <span>ONLINE</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}