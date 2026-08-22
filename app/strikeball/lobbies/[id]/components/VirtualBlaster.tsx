"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  FaCrosshairs, FaHandFist, FaBolt, FaTemperatureHigh, 
  FaScrewdriverWrench, FaBiohazard, FaCrown, FaTriangleExclamation 
} from "react-icons/fa6";
import { useGameSounds } from "../hooks/useGameSounds";
import { executeProximityBoom, fieldRepair } from "../../../actions/blaster";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";

export function VirtualBlaster({ onHit, lobbyId, userId }: any) {
  const { dbUser, refreshDbUser } = useAppContext();
  const sounds = useGameSounds();
  
  const [mode, setMode] = useState<"ranged" | "melee">("ranged");
  const [heat, setHeat] = useState(0); 
  const [isOverheated, setIsOverheated] = useState(false);
  const [isFiring, setIsFiring] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);

  const isHumiliated = !!dbUser?.metadata?.is_humiliated;

  // Boot sound
  useEffect(() => { sounds.startMatch(); }, []);

  // Passive Cooling logic with Heat-Sync
  useEffect(() => {
    const coolingInterval = setInterval(() => {
      setHeat((p) => {
        const next = Math.max(0, p - (isOverheated ? 4 : 2));
        if (isOverheated && next === 0) setIsOverheated(false);
        return next;
      });
    }, 100);
    return () => clearInterval(coolingInterval);
  }, [isOverheated]);

  const triggerFire = useCallback(() => {
    if (isHumiliated || isOverheated) {
        sounds.playHumiliation(); // "Empty click" sound
        if (isOverheated) toast.error("THERMAL_LOCK", { description: "Weapon too hot. Venting..." });
        return;
    }
    
    sounds.fire();
    setIsFiring(true);
    setHeat((p) => {
        const next = Math.min(100, p + 15);
        if (next >= 100) setIsOverheated(true);
        return next;
    });
    setTimeout(() => setIsFiring(false), 80);
  }, [isHumiliated, isOverheated, sounds]);

  const triggerMelee = useCallback(async () => {
    if (isHumiliated) return sounds.playHumiliation();
    
    sounds.meleeAttack();
    setHeat((p) => Math.min(100, p + 40));
    
    const res = await executeProximityBoom(userId, lobbyId);
    if (res.success) {
      sounds.playHolyShit();
      if (navigator.vibrate) navigator.vibrate([500, 100, 500]);
      toast.success("HUMILIATION DELIVERED", { icon: <FaCrown /> });
    }
  }, [isHumiliated, sounds, userId, lobbyId]);

  const handleRepair = async () => {
    setIsRepairing(true);
    sounds.playMedkit(); // "Pneumatic/Hiss" sound
    await fieldRepair(userId);
    await refreshDbUser();
    setIsRepairing(false);
  };

  const touchStartTime = useRef(0);
  const handleTouchStart = () => { touchStartTime.current = Date.now(); };
  const handleTouchEnd = () => {
    const elapsed = Date.now() - touchStartTime.current;
    if (elapsed < 350) mode === "ranged" ? triggerFire() : triggerMelee();
    else {
        setMode(prev => prev === "ranged" ? "melee" : "ranged");
        if (navigator.vibrate) navigator.vibrate(20);
    }
  };

  return (
    <div className={cn(
      "relative select-none touch-none p-4 rounded-3xl border-4 transition-all duration-700",
      isHumiliated ? "bg-red-950/20 border-red-600 shadow-[0_0_20px_red]" : "bg-black border-zinc-800",
      isOverheated && "border-orange-600 shadow-[0_0_15px_orange]"
    )}>
      
      {/* 📡 TELEMETRY (DYNAMIC TEXT) */}
      <div className="flex justify-between items-center mb-6 font-mono">
        <div className="flex flex-col">
          <span className="text-[7px] text-zinc-600 uppercase tracking-tighter">Combat_Link</span>
          <span className={cn(
            "text-[10px] font-black tracking-widest",
            isHumiliated ? "text-red-600" : isOverheated ? "text-orange-500 animate-pulse" : "text-brand-cyan"
          )}>
            {isHumiliated ? "MANGLED_UNIT" : isOverheated ? "OVERHEATED" : "ANDURIL_READY"}
          </span>
        </div>
        <div className="text-right">
            <span className="text-[7px] text-zinc-600 uppercase">Temp</span>
            <span className={cn("text-[10px] font-bold block", heat > 70 ? "text-orange-500" : "text-zinc-400")}>
                {heat}%
            </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 relative">
        
        {/* 🔫 THE BLASTER (WITH INTEGRATED HEAT RING) */}
        <motion.button
          onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}
          animate={isFiring ? { scale: 0.85, y: 10, rotate: -2 } : { scale: 1, y: 0, rotate: isHumiliated ? 15 : 0 }}
          className={cn(
            "aspect-square relative flex flex-col items-center justify-center border-2 rounded-2xl transition-all duration-500",
            isHumiliated ? "bg-zinc-950 border-red-900 scale-x-75" : 
            mode === "ranged" ? "bg-zinc-900 border-brand-cyan/30" : "bg-zinc-900 border-brand-gold/30"
          )}
        >
          {/* THE HEAT RING: Visual fill around the button */}
          <svg className="absolute inset-0 w-full h-full -rotate-90">
            <circle
              cx="50%" cy="50%" r="48%"
              fill="none"
              stroke={isOverheated ? "orange" : "white"}
              strokeWidth="2"
              strokeDasharray="251"
              strokeDashoffset={251 - (251 * heat) / 100}
              className="transition-all duration-200 opacity-20"
            />
          </svg>

          <div className={cn(
            "text-5xl transition-all duration-1000",
            isHumiliated ? "rotate-[130deg] scale-y-50 blur-[1px] opacity-30" : "",
            mode === "ranged" ? "text-brand-cyan" : "text-brand-gold"
          )}>
            {mode === "ranged" ? <FaCrosshairs /> : <FaHandFist />}
          </div>

          <span className="mt-4 text-[9px] font-black uppercase text-zinc-600">
            {isHumiliated ? "BENT" : mode}
          </span>
        </motion.button>

        {/* 💀 TERMINATE */}
        <button
          onClick={() => { sounds.death(); onHit(); }}
          className="aspect-square flex flex-col items-center justify-center border-2 border-red-900 bg-red-950/10 rounded-2xl active:bg-red-600 transition-colors group"
        >
          <FaBiohazard className="text-4xl text-red-900 group-active:text-white" />
          <span className="mt-4 text-[9px] font-bold text-red-900 group-active:text-white">EXIT</span>
        </button>

        {/* 🛠️ REPAIR OVERLAY */}
        <AnimatePresence>
          {isHumiliated && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="absolute inset-0 z-20 flex flex-col items-center justify-center backdrop-blur-md bg-black/60 rounded-2xl border-2 border-red-500"
            >
              <Button 
                onClick={handleRepair}
                disabled={isRepairing}
                className="bg-white text-black font-black hover:bg-brand-cyan transition-all h-20 w-32 rounded-none skew-x-[-15deg]"
              >
                {isRepairing ? "FIXING..." : "REPAIR"}
              </Button>
              <div className="flex gap-1 mt-4">
                 <motion.div animate={{ opacity: [1,0,1] }} className="w-1 h-1 bg-red-500" />
                 <span className="text-[8px] text-red-500 font-bold uppercase">Barrel_Warped</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ⚠️ OVERHEAT GLITCH OVERLAY */}
      {isOverheated && (
          <div className="absolute inset-0 pointer-events-none border-2 border-orange-500/50 animate-pulse rounded-3xl" />
      )}
    </div>
  );
}