"use client";
import { FaCrosshairs, FaHandFist, FaSkullCrossbones } from "react-icons/fa6";
import { useState, useRef, useEffect } from "react";
import { useGameSounds } from "../hooks/useGameSounds";
import { cn } from "@/lib/utils";

interface VirtualBlasterProps {
  onHit: () => void;
  onDeath?: () => void;
}

export function VirtualBlaster({ onHit, onDeath }: VirtualBlasterProps) {
  const sounds = useGameSounds();
  const [mode, setMode] = useState<"ranged" | "melee">("ranged");
  const [isLongPress, setIsLongPress] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  const toggleMode = () => {
    setMode(prev => (prev === "ranged" ? "melee" : "ranged"));
  };

  const handleAction = () => {
    if (mode === "ranged") {
      sounds.fire();
    } else {
      sounds.meleeAttack();
    }
  };

  const handleDeath = () => {
    sounds.death();
    onHit();
    onDeath?.();

    // Screen flash
    const flash = document.createElement("div");
    flash.className = "fixed inset-0 bg-red-500/30 z-50 pointer-events-none transition-opacity duration-300";
    document.body.appendChild(flash);
    setTimeout(() => {
      flash.style.opacity = "0";
      setTimeout(() => flash.remove(), 300);
    }, 100);
  };

  // Long-press handler for mode toggle
  const startLongPress = () => {
    setIsLongPress(true);
    longPressTimer.current = setTimeout(() => {
      toggleMode();
      setIsLongPress(false);
    }, 800); // ≥800ms = mode toggle
  };

  const cancelLongPress = () => {
    setIsLongPress(false);
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleTap = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isLongPress) {
      handleAction();
    }
    cancelLongPress();
  };

  useEffect(() => {
    return () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
    };
  }, []);

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Action Button */}
      <button
        onMouseDown={startLongPress}
        onMouseUp={handleTap}
        onMouseLeave={cancelLongPress}
        onTouchStart={startLongPress}
        onTouchEnd={handleTap}
        onTouchMove={cancelLongPress}
        className={cn(
          "cyber-clip w-full aspect-square bg-gradient-to-br from-[#1a202c] to-[#2d3748] border relative overflow-hidden",
          "shadow-lg transition-all duration-150 active:scale-95 focus:outline-none",
          mode === "ranged"
            ? "border-brand-cyan/40 hover:border-brand-cyan/80"
            : "border-brand-gold/40 hover:border-brand-gold/80"
        )}
      >
        {/* Icon */}
        <div
          className={cn(
            "flex items-center justify-center h-full text-4xl font-orbitron font-black tracking-widest",
            mode === "ranged"
              ? "text-brand-cyan drop-shadow-[0_0_10px_rgba(34,211,238,0.6)]"
              : "text-brand-gold drop-shadow-[0_0_10px_rgba(234,179,8,0.6)]"
          )}
        >
          {mode === "ranged" ? <FaCrosshairs /> : <FaHandFist />}
        </div>

        {/* Long-press hint (small label inside button bottom) */}
        <span className="absolute bottom-1 left-0 right-0 text-[8px] text-gray-400 font-mono uppercase tracking-wider text-center">
          {mode === "ranged" ? "hold → melee" : "hold → ranged"}
        </span>
      </button>

      {/* Death Button */}
      <button
        onClick={handleDeath}
        className={cn(
          "cyber-clip-reverse w-full aspect-square bg-gradient-to-br from-[#2a0a0a] to-[#1a0505] border border-red-600/40",
          "relative overflow-hidden shadow-lg transition-all duration-150 active:scale-95 focus:outline-none hover:border-red-600/80",
          "group"
        )}
      >
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 10px, #000 10px, #000 20px)" }} />
        <div className="flex flex-col items-center justify-center h-full gap-1">
          <div className="text-red-500 text-4xl drop-shadow-[0_0_10px_rgba(239,68,68,0.8)] animate-pulse">
            <FaSkullCrossbones />
          </div>
          <span className="font-orbitron font-black text-lg tracking-widest text-red-500 drop-shadow-md">
            KILLED
          </span>
        </div>
        <div className="absolute inset-0 bg-red-500 mix-blend-overlay opacity-0 group-active:opacity-20 transition-opacity" />
      </button>
    </div>
  );
}