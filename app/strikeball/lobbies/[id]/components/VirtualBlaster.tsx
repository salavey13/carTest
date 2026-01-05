"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaCrosshairs, FaHandFist, FaRadiation, FaBolt, FaTemperatureHigh } from "react-icons/fa6";
import { useGameSounds } from "../hooks/useGameSounds";
import { cn } from "@/lib/utils";

interface VirtualBlasterProps {
  onHit: () => void;
  onDeath?: () => void;
}

export function VirtualBlaster({ onHit, onDeath }: VirtualBlasterProps) {
  const sounds = useGameSounds();
  
  // --- INTERNAL HARDWARE STATE ---
  const [mode, setMode] = useState<"ranged" | "melee">("ranged");
  const [heat, setHeat] = useState(0); // 0 to 100
  const [isOverheated, setIsOverheated] = useState(false);
  const [isFiring, setIsFiring] = useState(false);
  const [isDead, setIsDead] = useState(false);

  // --- REFS FOR TOUCH LOGIC ---
  const pressTimer = useRef<NodeJS.Timeout | null>(null);
  const touchStartTime = useRef<number>(0);
  const isCancelled = useRef(false);
  const LONG_PRESS_THRESHOLD = 700;

  // --- PASSIVE COOLING SYSTEM ---
  useEffect(() => {
    const coolingInterval = setInterval(() => {
      setHeat((prev) => {
        const next = Math.max(0, prev - (isOverheated ? 5 : 2));
        if (isOverheated && next === 0) setIsOverheated(false);
        return next;
      });
    }, 100);
    return () => clearInterval(coolingInterval);
  }, [isOverheated]);

  // --- COMBAT ACTIONS ---
  const triggerFire = useCallback(() => {
    if (isOverheated || isDead) return;

    sounds.fire();
    setIsFiring(true);
    setHeat((prev) => {
      const newHeat = prev + 15;
      if (newHeat >= 100) {
        setIsOverheated(true);
        sounds.playHumiliation(); // "Overheated" sound
        if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 500]);
        return 100;
      }
      return newHeat;
    });

    setTimeout(() => setIsFiring(false), 100);
  }, [isOverheated, isDead, sounds]);

  const triggerMelee = useCallback(() => {
    if (isDead) return;
    sounds.meleeAttack();
    setHeat((prev) => Math.min(100, prev + 40));
    // Anduril-grade kinetic shake handled by Framer Motion
  }, [isDead, sounds]);

  const handleDeath = () => {
    setIsDead(true);
    sounds.death();
    onHit();
    onDeath?.();
    if (navigator.vibrate) navigator.vibrate(800);
  };

  // --- TOUCH HANDLERS (REVERSED & OPTIMIZED) ---
  const onTouchStart = (e: any) => {
    if (isDead) return;
    isCancelled.current = false;
    touchStartTime.current = Date.now();
    
    pressTimer.current = setTimeout(() => {
      if (!isCancelled.current) {
        setMode((prev) => (prev === "ranged" ? "melee" : "ranged"));
        if (navigator.vibrate) navigator.vibrate(50);
      }
    }, LONG_PRESS_THRESHOLD);
  };

  const onTouchEnd = (e: any) => {
    const elapsed = Date.now() - touchStartTime.current;
    if (pressTimer.current) clearTimeout(pressTimer.current);

    if (!isCancelled.current && elapsed > 40 && elapsed < LONG_PRESS_THRESHOLD) {
      mode === "ranged" ? triggerFire() : triggerMelee();
    }
  };

  return (
    <div className="relative select-none touch-none">
      
      {/* 📊 TELEMETRY OVERLAY */}
      <div className="absolute -top-12 left-0 right-0 flex justify-between items-end px-2 font-mono">
        <div className="flex flex-col">
          <span className="text-[8px] text-zinc-500 uppercase">Hardware_Status</span>
          <span className={cn(
            "text-xs font-bold tracking-tighter",
            isOverheated ? "text-red-500 animate-pulse" : "text-brand-cyan"
          )}>
            {isOverheated ? "SYS_OVERHEAT_LOCKOUT" : "UPLINK_STABLE"}
          </span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[8px] text-zinc-500 uppercase">Core_Temp</span>
          <span className={cn("text-xs font-bold", heat > 80 ? "text-red-500" : "text-white")}>
            {heat}°C
          </span>
        </div>
      </div>

      {/* 🔥 HEAT BAR */}
      <div className="w-full h-1.5 bg-zinc-900 border border-zinc-800 mb-4 overflow-hidden rounded-full">
        <motion.div 
          className={cn(
            "h-full shadow-[0_0_10px_currentColor]",
            isOverheated ? "bg-red-600" : "bg-brand-cyan"
          )}
          animate={{ width: `${heat}%` }}
          transition={{ type: "spring", bounce: 0, duration: 0.2 }}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        
        {/* 🔫 MAIN BLASTER UNIT */}
        <motion.button
          onMouseDown={onTouchStart} onMouseUp={onTouchEnd}
          onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
          animate={isFiring ? { scale: 0.95, y: 5 } : { scale: 1, y: 0 }}
          className={cn(
            "cyber-clip aspect-square relative flex flex-col items-center justify-center border-2 transition-all duration-300",
            isOverheated ? "bg-red-950/20 border-red-900 opacity-50 grayscale" : 
            mode === "ranged" ? "bg-zinc-900/80 border-brand-cyan shadow-[inset_0_0_20px_rgba(34,211,238,0.1)]" : 
            "bg-zinc-900/80 border-brand-gold shadow-[inset_0_0_20px_rgba(234,179,8,0.1)]"
          )}
        >
          {/* Dynamic Reticle Background */}
          <div className="absolute inset-0 flex items-center justify-center opacity-10">
             <motion.div 
               animate={{ rotate: 360 }} 
               transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
               className="w-3/4 h-3/4 border-2 border-dashed border-current rounded-full" 
             />
          </div>

          <div className={cn(
            "text-5xl drop-shadow-[0_0_15px_currentColor]",
            mode === "ranged" ? "text-brand-cyan" : "text-brand-gold"
          )}>
            {mode === "ranged" ? <FaCrosshairs /> : <FaHandFist />}
          </div>

          <div className="mt-4 flex flex-col items-center gap-1">
             <span className="text-[10px] font-black tracking-widest uppercase opacity-80">
               {mode === "ranged" ? "Bolt_Rifle" : "Kinetic_Strike"}
             </span>
             <div className="flex gap-1">
                {[1,2,3].map(i => (
                  <div key={i} className={cn("w-1.5 h-1.5 rotate-45", heat > (i*25) ? "bg-current" : "bg-zinc-800")} />
                ))}
             </div>
          </div>

          {/* Overheat Indicator overlay */}
          <AnimatePresence>
            {isOverheated && (
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-red-900/40 backdrop-blur-sm flex flex-col items-center justify-center"
              >
                <FaTemperatureHigh className="text-4xl text-white animate-bounce" />
                <span className="text-[8px] font-black text-white mt-2">COOLING_REQUIRED</span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>

        {/* 💀 TERMINATION UNIT (DEATH) */}
        <motion.button
          onClick={handleDeath}
          disabled={isDead}
          whileTap={{ scale: 0.9 }}
          className={cn(
            "cyber-clip-reverse aspect-square relative overflow-hidden border-2 transition-all duration-500",
            isDead ? "bg-zinc-950 border-zinc-800" : "bg-red-950/20 border-red-600 hover:bg-red-600 group"
          )}
        >
          {/* Static Scanline Overlay */}
          <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.5)_50%)] bg-[size:100%_4px] opacity-20" />
          
          <div className="flex flex-col items-center justify-center h-full gap-2 relative z-10">
            <FaRadiation className={cn(
              "text-4xl transition-all",
              isDead ? "text-zinc-800" : "text-red-500 group-hover:text-white animate-pulse"
            )} />
            <div className="text-center">
              <div className={cn("text-xs font-black tracking-tighter uppercase", isDead ? "text-zinc-700" : "text-white")}>
                {isDead ? "Signal_Lost" : "Signal_Kill"}
              </div>
              <div className="text-[8px] font-mono text-red-500 group-hover:text-white opacity-60">
                [ Protocol_Alpha ]
              </div>
            </div>
          </div>

          {/* Flash Effect on death */}
          <AnimatePresence>
            {isDead && (
              <motion.div 
                initial={{ x: "-100%" }} animate={{ x: "100%" }}
                transition={{ duration: 0.5, repeat: Infinity }}
                className="absolute inset-0 bg-white/5 skew-x-12"
              />
            )}
          </AnimatePresence>
        </motion.button>

      </div>

      {/* 🧩 FOOTER STATUS */}
      <div className="mt-4 flex justify-between items-center px-4 py-2 bg-zinc-950/50 border-x border-zinc-900">
         <div className="flex items-center gap-2">
            <FaBolt className={cn("text-[10px]", heat > 50 ? "text-brand-yellow" : "text-zinc-600")} />
            <span className="text-[7px] font-mono text-zinc-500 uppercase tracking-widest">Battery: 84%</span>
         </div>
         <div className="text-[7px] font-mono text-zinc-700 uppercase">
            Anduril_Tactical_v4.0.1
         </div>
      </div>
    </div>
  );
}