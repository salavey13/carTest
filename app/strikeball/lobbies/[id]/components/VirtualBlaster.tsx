"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  FaCrosshairs, FaHandFist, FaBolt, FaTemperatureHigh, 
  FaScrewdriverWrench, FaBiohazard, FaCrown, FaTriangleExclamation 
} from "react-icons/fa6";
import { useGameSounds } from "../hooks/useGameSounds";
import { executeProximityBoom, fieldRepair } from "../../actions/blaster";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";

export function VirtualBlaster({ onHit, onDeath, lobbyId, userId }: any) {
  const { dbUser, refreshDbUser } = useAppContext();
  const sounds = useGameSounds();
  
  // --- STATES ---
  const [mode, setMode] = useState<"ranged" | "melee">("ranged");
  const [heat, setHeat] = useState(0); 
  const [isOverheated, setIsOverheated] = useState(false);
  const [isFiring, setIsFiring] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);

  // Check humiliation from Global Context
  const isHumiliated = !!dbUser?.metadata?.is_humiliated;

  // --- PASSIVE COOLING ---
  useEffect(() => {
    const coolingInterval = setInterval(() => {
      setHeat((p) => Math.max(0, p - (isOverheated ? 4 : 2)));
      if (isOverheated && heat === 0) setIsOverheated(false);
    }, 100);
    return () => clearInterval(coolingInterval);
  }, [isOverheated, heat]);

  // --- ACTIONS ---
  const triggerFire = useCallback(() => {
    if (isHumiliated) {
        sounds.playHumiliation();
        toast.error("HARDWARE FAILURE", { description: "Your barrel is bent. Repair required." });
        return;
    }
    if (isOverheated) return;
    
    sounds.fire();
    setIsFiring(true);
    setHeat((p) => Math.min(100, p + 12));
    if (heat + 12 >= 100) setIsOverheated(true);
    setTimeout(() => setIsFiring(false), 80);
  }, [isHumiliated, isOverheated, sounds, heat]);

  const triggerMelee = useCallback(async () => {
    if (isHumiliated) return sounds.playHumiliation();
    
    sounds.meleeAttack();
    setHeat((p) => Math.min(100, p + 35));
    
    const res = await executeProximityBoom(userId, lobbyId);
    if (res.success) {
      sounds.playHolyShit();
      if (navigator.vibrate) navigator.vibrate([500, 100, 500]);
      toast.success("HUMILIATION DELIVERED", { icon: <FaCrown /> });
    }
  }, [isHumiliated, sounds, userId, lobbyId]);

  const handleRepair = async () => {
    setIsRepairing(true);
    sounds.playMedkit(); // Use medkit sound for mechanical repair vibe
    await fieldRepair(userId);
    await refreshDbUser();
    setIsRepairing(false);
    toast.success("GEAR REPAIRED", { description: "Integrity Restored to 100%" });
  };

  // --- TOUCH HANDLERS (Simplified for clarity) ---
  const touchStartTime = useRef(0);
  const handleTouchStart = () => { touchStartTime.current = Date.now(); };
  const handleTouchEnd = () => {
    const elapsed = Date.now() - touchStartTime.current;
    if (elapsed < 500) mode === "ranged" ? triggerFire() : triggerMelee();
    else setMode(prev => prev === "ranged" ? "melee" : "ranged");
  };

  return (
    <div className={cn(
      "relative select-none touch-none p-4 rounded-2xl border-2 transition-all duration-700",
      isHumiliated ? "bg-red-950/20 border-red-500 blur-[0.5px]" : "bg-black border-zinc-800"
    )}>
      
      {/* 📡 TELEMETRY */}
      <div className="flex justify-between items-center mb-4 font-mono">
        <div className="flex flex-col">
          <span className="text-[7px] text-zinc-500 uppercase">Integrity_Control</span>
          <span className={cn("text-[10px] font-bold", isHumiliated ? "text-red-500 animate-pulse" : "text-brand-cyan")}>
            {isHumiliated ? "CRITICAL_FAILURE" : "SYSTEMS_NOMINAL"}
          </span>
        </div>
        {isHumiliated && (
            <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ repeat: Infinity }}>
                <FaTriangleExclamation className="text-red-500 text-lg" />
            </motion.div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 relative">
        
        {/* 🔫 THE BLASTER (COULD BE A CROISSANT) */}
        <motion.button
          onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}
          animate={isFiring ? { scale: 0.9, y: 5 } : { scale: 1, y: 0 }}
          className={cn(
            "cyber-clip aspect-square relative flex flex-col items-center justify-center border-2 transition-all duration-1000",
            isHumiliated ? "border-red-900 bg-black rotate-[15deg] scale-x-75" : 
            mode === "ranged" ? "border-brand-cyan bg-zinc-900" : "border-brand-gold bg-zinc-900"
          )}
        >
          {/* THE MANGLED EFFECT: If humiliated, rotate and skew the icon */}
          <div className={cn(
            "text-5xl transition-all duration-1000",
            isHumiliated ? "rotate-[120deg] scale-y-50 skew-x-12 opacity-40" : "",
            mode === "ranged" ? "text-brand-cyan" : "text-brand-gold"
          )}>
            {mode === "ranged" ? <FaCrosshairs /> : <FaHandFist />}
          </div>

          <div className="mt-4 text-[8px] font-black uppercase opacity-50">
            {isHumiliated ? "BENT_BARREL" : mode}
          </div>
        </motion.button>

        {/* 💀 DEATH / SIGNAL EXIT */}
        <button
          onClick={() => { sounds.death(); onHit(); }}
          className="cyber-clip-reverse aspect-square flex flex-col items-center justify-center border-2 border-red-600 bg-red-950/20"
        >
          <FaBiohazard className="text-4xl text-red-500" />
          <span className="mt-4 text-[8px] font-mono text-red-500">TERMINATE</span>
        </button>

        {/* 🛠️ REPAIR OVERLAY */}
        <AnimatePresence>
          {isHumiliated && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="absolute inset-0 z-20 flex flex-col items-center justify-center backdrop-blur-sm bg-black/60 rounded-xl"
            >
              <Button 
                onClick={handleRepair}
                disabled={isRepairing}
                className="bg-white text-black font-black hover:bg-brand-cyan transition-all px-6 py-8 rounded-none skew-x-[-10deg]"
              >
                {isRepairing ? "REPAIRING..." : <><FaScrewdriverWrench className="mr-2" /> FIELD REPAIR</>}
              </Button>
              <span className="text-[8px] text-white/40 mt-4 font-mono">ESTIMATED_TIME: 1.5s</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 🧩 FOOTER */}
      <div className="mt-4 flex justify-between items-center px-2 py-1 bg-zinc-950 border border-zinc-900">
         <span className="text-[7px] text-zinc-600 font-mono">UID: {userId.slice(0,8)}</span>
         <a href="https://t.me/oneSitePlsBot/app" className="text-[7px] font-bold text-brand-cyan animate-pulse">
            FW: ANDURIL_MANGLED_v4.2
         </a>
      </div>
    </div>
  );
}