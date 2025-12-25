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

  // 🔊 Preload sounds on mount — no first-click delay!
  useEffect(() => {
    // Warm cache: trigger load without playing
    sounds.fire();
    sounds.meleeAttack();
    sounds.death();
    // Chrome requires user gesture to *play*, but loading metadata is instant
    // We just ensure buffers are ready.
  }, [sounds]);

  // ✅ Fixed long-press state machine
  const pressTimer = useRef<NodeJS.Timeout | null>(null);
  const touchStartTime = useRef<number>(0);
  const isCancelled = useRef(false);

  const LONG_PRESS_THRESHOLD = 800; // ms

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    isCancelled.current = false;
    touchStartTime.current = Date.now();

    pressTimer.current = setTimeout(() => {
      if (!isCancelled.current) {
        setMode(prev => (prev === "ranged" ? "melee" : "ranged"));
      }
    }, LONG_PRESS_THRESHOLD);
  };

  const handleEnd = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const elapsed = Date.now() - touchStartTime.current;

    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }

    // Only fire if NOT long-press & NOT cancelled (e.g., by move)
    if (!isCancelled.current && elapsed < LONG_PRESS_THRESHOLD - 50) {
      // Debounce rapid taps (esp. mobile)
      if (elapsed > 50) {
        if (mode === "ranged") {
          sounds.fire();
        } else {
          sounds.meleeAttack();
        }
      }
    }
  };

  const handleCancel = () => {
    isCancelled.current = true;
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
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

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Action Button */}
      <button
        // Mouse
        onMouseDown={handleStart}
        onMouseUp={handleEnd}
        onMouseLeave={handleCancel}
        // Touch
        onTouchStart={handleStart}
        onTouchEnd={handleEnd}
        onTouchMove={handleCancel}
        onTouchCancel={handleCancel}
        className={cn(
          "cyber-clip w-full aspect-square bg-gradient-to-br from-[#1a202c] to-[#2d3748] border relative overflow-hidden",
          "shadow-lg transition-all duration-150 active:scale-95 focus:outline-none",
          mode === "ranged"
            ? "border-brand-cyan/40 hover:border-brand-cyan/80"
            : "border-brand-gold/40 hover:border-brand-gold/80"
        )}
      >
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

        <span className="absolute bottom-1 left-0 right-0 text-[8px] text-gray-400 font-mono uppercase tracking-wider text-center">
          {mode === "ranged" ? "hold → melee" : "hold → ranged"}
        </span>
      </button>

      {/* Death Button */}
      <button
        onClick={handleDeath}
        className={cn(
          "cyber-clip-reverse w-full aspect-square bg-gradient-to-br from-[#2a0a0a] to-[#1a0505] border border-red-600/40",
          "relative overflow-hidden shadow-lg transition-all duration-150 active:scale-95 focus:outline-none hover:border-red-600/80 group"
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